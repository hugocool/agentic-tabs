import { Client } from "@notionhq/client"
import { loadNotionEnv, loadNotionSchema } from "./notion-env"
import { notionCallSafe } from "./notion-wrap"
import { normalizePersistUrl } from "./url"
import { mergeRelation } from "./notion-writer"

export async function searchResources(q: string, limit = 10): Promise<{ id: string; title: string; url?: string; lastEdited?: string }[]> {
  const env = await loadNotionEnv(); const schema = await loadNotionSchema()
  if (!env || !schema?.resources?.dbId) return []
  const notion = new Client({ auth: env.notionToken }) as any
  const dbId = schema.resources.dbId
  const titleProp = schema.resources.titleProp || "Name"
  const urlProp = schema.resources.urlProp || "URL"

  // Query by title contains
  const resTitle = await notionCallSafe(() => notion.databases.query({ database_id: dbId, page_size: limit, filter: { property: titleProp, title: { contains: q } } }))
  // Query by URL contains (best-effort)
  const resUrl = await notionCallSafe(() => notion.databases.query({ database_id: dbId, page_size: limit, filter: { property: urlProp, url: { contains: q } } }))

  const seen = new Set<string>()
  const items: { id: string; title: string; url?: string; lastEdited?: string }[] = []
  const add = (arr: any) => {
    for (const p of arr?.results || []) {
      const id = p.id as string
      if (seen.has(id)) continue
      seen.add(id)
      const title = p.properties?.[titleProp]?.title?.[0]?.plain_text || id
      const url = p.properties?.[urlProp]?.url as string | undefined
      const lastEdited = p.last_edited_time as string | undefined
      items.push({ id, title, url, lastEdited })
    }
  }
  if (resTitle.ok) add(resTitle.data)
  if (resUrl.ok) add(resUrl.data)
  return items.slice(0, limit)
}

export async function attachToResource(params: { targetId: string; tab: { url?: string; title?: string }; mode: "set-url" | "bookmark" | "relate" }) {
  const env = await loadNotionEnv(); const schema = await loadNotionSchema()
  if (!env || !schema?.resources?.dbId) return { ok: false, reason: "no_schema" }
  const notion = new Client({ auth: env.notionToken }) as any
  const dbId = schema.resources.dbId
  const titleProp = schema.resources.titleProp || "Name"
  const urlProp = schema.resources.urlProp || "URL"
  const relatedProp = schema.resources.relatedResProp

  const url = normalizePersistUrl(params.tab.url)
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, reason: "bad_url" }

  if (params.mode === "set-url") {
    await notion.pages.update({ page_id: params.targetId, properties: { [urlProp]: { url } } })
    return { ok: true, updated: true }
  }

  if (params.mode === "bookmark") {
    // Fetch first children to check for identical bookmark at top (best-effort)
    let exists = false
    try {
      const children = await notion.blocks.children.list({ block_id: params.targetId, page_size: 50 })
      for (const b of children?.results || []) {
        if ((b as any).type === "bookmark" && (b as any).bookmark?.url === url) { exists = true; break }
      }
    } catch {}
    if (!exists) {
      try {
        await notion.blocks.children.append({
          block_id: params.targetId,
          children: [
            {
              object: "block",
              type: "bookmark",
              bookmark: { url, caption: [{ type: "text", text: { content: params.tab.title || url } }] }
            }
          ]
        })
      } catch {
        // Fallback paragraph
        await notion.blocks.children.append({
          block_id: params.targetId,
          children: [
            {
              object: "block",
              type: "paragraph",
              paragraph: { rich_text: [{ type: "text", text: { content: (params.tab.title || url) + " " } }, { type: "text", text: { content: url, link: { url } } }] }
            }
          ]
        })
      }
    }
    return { ok: true, updated: !exists }
  }

  // relate: ensure resource for this URL exists, then relate both ways using relatedProp
  const findRes = async (): Promise<string | undefined> => {
    const q = await notion.databases.query({ database_id: dbId, page_size: 1, filter: { property: urlProp, url: { equals: url } } })
    return q.results?.[0]?.id as string | undefined
  }
  let otherId = await findRes()
  if (!otherId) {
    const props: any = {}
    props[titleProp] = { title: [{ text: { content: params.tab.title || url } }] }
    props[urlProp] = { url }
    const created = await notion.pages.create({ parent: { database_id: dbId }, properties: props })
    otherId = created.id
  }
  if (!relatedProp) return { ok: true, updated: false } // nothing to write
  // Read existing to merge relation
  const target = await notion.pages.retrieve({ page_id: params.targetId }) as any
  const other = await notion.pages.retrieve({ page_id: otherId! }) as any
  const tRel = target.properties?.[relatedProp]?.relation || []
  const oRel = other.properties?.[relatedProp]?.relation || []
  const tProps: any = {}; tProps[relatedProp] = { relation: mergeRelation(tRel, otherId!) }
  const oProps: any = {}; oProps[relatedProp] = { relation: mergeRelation(oRel, params.targetId) }
  await notion.pages.update({ page_id: params.targetId, properties: tProps })
  await notion.pages.update({ page_id: otherId!, properties: oProps })
  return { ok: true, updated: true }
}

