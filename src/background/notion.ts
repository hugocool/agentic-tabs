import { Client } from "@notionhq/client"

interface DecisionRow {
    url?: string
    title?: string
    decision: string
    group?: string
    project?: string
    task?: string
}

export async function upsertNotion({ sessionId, decisions }: { sessionId: string; decisions: DecisionRow[] }) {
    const { notionToken, resourcesDbId, sessionsDbId } = await chrome.storage.local.get([
        "notionToken",
        "resourcesDbId",
        "sessionsDbId"
    ])
    if (!notionToken || !resourcesDbId || !sessionsDbId) {
        console.warn("Notion credentials/DB IDs missing; skipping upsert")
        return
    }
    const notion = new Client({ auth: notionToken })
    const resourceIds: string[] = []

    for (const d of decisions) {
        if (!d.url) continue
        if (d.decision === "Drop") continue
        // Query by URL property
        const q = await notion.databases.query({
            database_id: resourcesDbId as string,
            filter: { property: "URL", url: { equals: d.url } }
        })
        let pageId = (q.results[0] as any)?.id as string | undefined
        if (!pageId) {
            const newPage = await notion.pages.create({
                parent: { database_id: resourcesDbId as string },
                properties: {
                    Name: { title: [{ text: { content: d.title || d.url } }] },
                    URL: { url: d.url },
                    Status: { select: { name: d.decision === "Archive" ? "Reference" : "Active" } },
                    Decision: { select: { name: d.decision } },
                    Group: d.group ? { rich_text: [{ text: { content: d.group } }] } : undefined,
                    Project: d.project ? { rich_text: [{ text: { content: d.project } }] } : undefined,
                    Task: d.task ? { rich_text: [{ text: { content: d.task } }] } : undefined
                }
            })
            pageId = newPage.id
        }
        resourceIds.push(pageId)
    }

    if (resourceIds.length) {
        await notion.pages.create({
            parent: { database_id: sessionsDbId as string },
            properties: {
                Name: { title: [{ text: { content: `Session ${sessionId}` } }] },
                SavedAt: { date: { start: new Date().toISOString() } },
                Resources: { relation: resourceIds.map(id => ({ id })) }
            }
        })
    }
}

// Minimal loader used as a fallback when local store lacks a session.
// Tries to find a session page named `Session <id>` with a relation to Resources, then returns Keep decisions.
export async function loadFromNotion(sessionId: string): Promise<{
  id: string
  items: { url: string; title?: string; decision: "Keep"; group?: string }[]
} | null> {
  try {
    const { notionToken, resourcesDbId, sessionsDbId } = await chrome.storage.local.get([
      "notionToken",
      "resourcesDbId",
      "sessionsDbId"
    ])
    if (!notionToken || !resourcesDbId || !sessionsDbId) return null
    const notion = new Client({ auth: notionToken })
    // Find session page by Name title equals `Session <id>`
    const q = await notion.databases.query({
      database_id: sessionsDbId as string,
      filter: {
        property: "Name",
        title: { equals: `Session ${sessionId}` }
      }
    })
    const page = q.results[0] as any
    if (!page) return null
    // Extract relation property 'Resources'
    const props = (page as any).properties || {}
    const rel = props["Resources"]
    if (!rel) return null
    // Notion API v2 returns relation ids directly on page properties for simple reads
    const relationIds: string[] = (rel.relation || []).map((r: any) => r.id)
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
