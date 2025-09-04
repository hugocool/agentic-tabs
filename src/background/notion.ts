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
