import { Client } from "@notionhq/client"
import { notionCallSafe } from "./notion-wrap"
import { notify } from "./notify"
import { logger } from "../shared/logger"
import { E } from "../shared/errors"
import { loadNotionEnv, loadNotionSchema } from "./notion-env"
import { buildResourceProperties, mergeRelation } from "./notion-writer"

interface DecisionRow {
    url?: string
    title?: string
    decision: string
    group?: string
    project?: string
    task?: string
}

export async function upsertNotion({ sessionId, decisions }: { sessionId: string; decisions: DecisionRow[] }) {
    const env = await loadNotionEnv()
    if (!env) {
        console.warn("Notion credentials/DB IDs missing; skipping upsert")
        return
    }
    const schema = await loadNotionSchema().catch(() => null)
    const { notionToken } = env
    const resourcesDbId = schema?.resources?.dbId || env.resourcesDbId
    if (!resourcesDbId) return
    const sessionsDbId = schema?.sessions?.enabled ? schema?.sessions?.dbId : undefined
    const notion = new Client({ auth: notionToken })
    const resourceIds: string[] = []

    for (const d of decisions) {
        if (!d.url) continue
        if (d.decision === "Drop") continue
        // Query by URL property
        const urlProp = schema?.resources?.urlProp || "URL"
        const qRes = await notionCallSafe(() => (notion as any).databases.query({
            database_id: resourcesDbId as string,
            filter: { property: urlProp, url: { equals: d.url as string } }
        }))
        if (!qRes.ok) {
            if (qRes.error.code === E.NOTION_RATE_LIMIT) {
                notify("Agentic Tabs", "Notion rate-limited. Will retry later.")
            }
            logger.warn("Notion query failed", qRes.error as any)
            continue
        }
        const q = qRes.data as any
        let page: any = (q as any).results?.[0] as any
        let pageId: string | undefined = page?.id as string | undefined
        if (!pageId) {
            const props: Record<string, any> = schema?.resources
              ? buildResourceProperties(d as any, schema.resources)
              : {
                  Name: { title: [{ text: { content: d.title || d.url } }] },
                  URL: { url: d.url as string },
                  Status: { select: { name: d.decision === "Archive" ? "Reference" : "Active" } },
                  Decision: { select: { name: d.decision } },
                  ...(d.group ? { Group: { rich_text: [{ text: { content: d.group } }] } } : {})
                }
            if (d.project) props.Project = { rich_text: [{ text: { content: d.project } }] }
            if (d.task) props.Task = { rich_text: [{ text: { content: d.task } }] }
            const createRes = await notionCallSafe(() => notion.pages.create({
                parent: { database_id: resourcesDbId as string },
                properties: props as any
            }))
            if (!createRes.ok) {
                if (createRes.error.code === E.NOTION_RATE_LIMIT) {
                    notify("Agentic Tabs", "Notion rate-limited. Will retry later.")
                }
                logger.error("Notion page create failed", createRes.error as any)
                continue
            }
            pageId = (createRes.data as any).id
            page = await notion.pages.retrieve({ page_id: pageId as string })
        }
        // Relations: merge project/task relations if mapped and resolved
        if (pageId) {
          // read existing relations to avoid overwriting
          const existing = page?.properties || {}
          const relProps: Record<string, any> = {}
          if (schema?.resources?.projectRelProp && (d as any).projectId) {
            const cur = existing?.[schema.resources.projectRelProp]?.relation || []
            relProps[schema.resources.projectRelProp] = { relation: mergeRelation(cur, (d as any).projectId) }
          }
          if (schema?.resources?.taskRelProp && (d as any).taskId) {
            const cur = existing?.[schema.resources.taskRelProp]?.relation || []
            relProps[schema.resources.taskRelProp] = { relation: mergeRelation(cur, (d as any).taskId) }
          }
          if (Object.keys(relProps).length) {
            await notion.pages.update({ page_id: pageId, properties: relProps as any })
          }
          resourceIds.push(pageId)
        }
    }

    if (resourceIds.length && sessionsDbId) {
        const res = await notionCallSafe(() => notion.pages.create({
            parent: { database_id: sessionsDbId as string },
            properties: {
                Name: { title: [{ text: { content: `Session ${sessionId}` } }] },
                SavedAt: { date: { start: new Date().toISOString() } },
                Resources: { relation: resourceIds.map(id => ({ id })) }
            } as any
        }))
        if (!res.ok) {
            if (res.error.code === E.NOTION_RATE_LIMIT) {
                notify("Agentic Tabs", "Notion rate-limited. Will retry later.")
            }
            logger.error("Notion session page create failed", res.error as any)
        }
    }
}

// Minimal loader used as a fallback when local store lacks a session.
// Tries to find a session page named `Session <id>` with a relation to Resources, then returns Keep decisions.
export async function loadFromNotion(sessionId: string): Promise<{
    id: string
    items: { url: string; title?: string; decision: "Keep"; group?: string }[]
} | null> {
    try {
        const env = await loadNotionEnv(); if (!env) return null
        const { notionToken, resourcesDbId, sessionsDbId } = env
        const notion = new Client({ auth: notionToken })
        // Find session page by Name title equals `Session <id>`
        const qRes = await notionCallSafe(() => (notion as any).databases.query({
            database_id: sessionsDbId as string,
            filter: {
                property: "Name",
                title: { equals: `Session ${sessionId}` }
            }
        }))
        if (!qRes.ok) return null
        const page = (qRes.data as any).results[0] as any
        if (!page) return null
        // Extract relation property 'Resources'
        const props = (page as any).properties || {}
        const rel = props["Resources"]
        if (!rel) return null
        // Notion API v2 returns relation ids directly on page properties for simple reads
        const relationIds: string[] = (rel.relation || []).map((r: any) => r.id).filter(Boolean)
        if (!relationIds.length) return null
        const items: { url: string; title?: string; decision: "Keep"; group?: string }[] = []
        for (const rid of relationIds) {
            try {
                const rp = await notion.pages.retrieve({ page_id: rid }) as any
                const rprops = rp.properties || {}
                const url = rprops?.URL?.url as string | undefined
                const title = (rprops?.Name?.title?.[0]?.plain_text as string | undefined) || undefined
                if (url) items.push({ url, title, decision: "Keep", group: "Session" })
            } catch (e) {
                console.warn("Notion resource fetch failed", e)
            }
        }
        if (!items.length) return null
        return { id: sessionId, items }
    } catch (e) {
        console.warn("loadFromNotion failed", e)
        return null
    }
}
