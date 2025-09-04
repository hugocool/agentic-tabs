export type NotionEnv = {
    notionToken: string
    resourcesDbId?: string
    sessionsDbId?: string
}

export async function loadNotionEnv(): Promise<NotionEnv | null> {
    const { notionToken, resourcesDbId, sessionsDbId } = await chrome.storage.local.get([
        "notionToken", "resourcesDbId", "sessionsDbId"
    ])
    if (!notionToken) return null
    return { notionToken, resourcesDbId, sessionsDbId }
}

export type NotionSchemaMap = {
  resources: {
    dbId: string
    titleProp: string
    urlProp: string
    decisionProp?: string
    statusProp?: string
    groupProp?: string
    projectRelProp?: string
    taskRelProp?: string
    // Optional self-relation to relate Resources ↔ Resources
    relatedResProp?: string
  }
  tasks?: {
    dbId: string
    titleProp: string
    statusProp?: string
    dueProp?: string
    projectRelProp?: string
    resRelProp?: string
  }
  projects?: {
    dbId: string
    titleProp: string
    statusProp?: string
    resRelProp?: string
    taskRelProp?: string
  }
  sessions?: {
    enabled: boolean
    dbId?: string
    nameProp?: string
    savedAtProp?: string
    resRelProp?: string
  }
}

export async function loadNotionSchema(): Promise<NotionSchemaMap | null> {
  const { notionSchemaMap } = await chrome.storage.local.get("notionSchemaMap")
  return notionSchemaMap || null
}

export async function saveNotionSchema(m: NotionSchemaMap) {
  await chrome.storage.local.set({ notionSchemaMap: m })
}
