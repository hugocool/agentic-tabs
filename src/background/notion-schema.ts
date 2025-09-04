// Heuristics for mapping Notion database properties to required roles
export type DbProps = Record<string, { type: string }>

const SYNS: Record<string, string[]> = {
  title: ["title", "name"],
  url: ["url", "link", "website", "source"],
  status: ["status", "state", "stage"],
  decision: ["decision", "keep", "archive", "drop", "review"],
  group: ["group", "category", "tag"],
  project: ["project", "initiative", "epic"],
  task: ["task", "todo", "issue"]
}

function scoreName(prop: string, candidates: string[]) {
  const p = prop.toLowerCase()
  for (const c of candidates) {
    if (p === c) return 3
    if (p.includes(c)) return 1
  }
  return 0
}

export function suggestResourceMapping(props: DbProps) {
  const entries = Object.entries(props)
  const titleCandidates = entries.filter(([_, v]) => v.type === "title")
  const urlCandidates = entries.filter(([_, v]) => v.type === "url")
  const statusCandidates = entries.filter(([_, v]) => v.type === "select" || v.type === "multi_select")
  const richTextCandidates = entries.filter(([_, v]) => v.type === "rich_text")

  const best = (arr: [string, { type: string }][], synKey: string) => {
    let bestName = arr[0]?.[0]
    let bestScore = -1
    for (const [name] of arr) {
      const s = scoreName(name, SYNS[synKey])
      if (s > bestScore) { bestScore = s; bestName = name }
    }
    return bestName
  }

  const titleProp = best(titleCandidates, "title")
  const urlProp = best(urlCandidates, "url")
  const statusProp = best(statusCandidates, "status")
  const decisionProp = best(statusCandidates, "decision")
  const groupProp = best(richTextCandidates, "group")

  return { titleProp, urlProp, statusProp, decisionProp, groupProp }
}

export function validateResourceMapping(map: any, props: DbProps) {
  const errors: string[] = []
  if (!map?.titleProp || props[map.titleProp]?.type !== "title") errors.push("titleProp must map to a title property")
  if (!map?.urlProp || props[map.urlProp]?.type !== "url") errors.push("urlProp must map to a url property")
  if (map?.statusProp && !(props[map.statusProp]?.type === "select" || props[map.statusProp]?.type === "multi_select")) errors.push("statusProp must be select/multi_select")
  if (map?.decisionProp && !(props[map.decisionProp]?.type === "select" || props[map.decisionProp]?.type === "multi_select")) errors.push("decisionProp must be select/multi_select")
  if (map?.groupProp && props[map.groupProp]?.type !== "rich_text") errors.push("groupProp must be rich_text")
  return { ok: errors.length === 0, errors }
}

// Fetch DB property schema (name -> { type })
export async function fetchDatabaseProps(dbId: string, token: string): Promise<DbProps> {
  const { Client } = await import("@notionhq/client")
  const notion = new Client({ auth: token }) as any
  const db = await notion.databases.retrieve({ database_id: dbId })
  const out: DbProps = {}
  Object.entries((db as any).properties || {}).forEach(([name, def]: any) => {
    out[name] = { type: def?.type }
  })
  return out
}

// Back-compat synthesizer from a minimal env (resources DB only)
export function synthesizeDefaultSchema(props: DbProps, dbId: string) {
  const firstOf = (typ: string) => Object.entries(props).find(([, v]) => v.type === typ)?.[0]
  const titleProp = firstOf("title") || "Name"
  const urlProp = firstOf("url") || "URL"
  return {
    resources: { dbId, titleProp, urlProp }
  }
}
