export type NotionEnv = {
    notionToken: string
    resourcesDbId: string
    sessionsDbId: string
}

export async function loadNotionEnv(): Promise<NotionEnv | null> {
    const { notionToken, resourcesDbId, sessionsDbId } = await chrome.storage.local.get([
        "notionToken", "resourcesDbId", "sessionsDbId"
    ])
    if (!notionToken || !resourcesDbId || !sessionsDbId) return null
    return { notionToken, resourcesDbId, sessionsDbId }
}