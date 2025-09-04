import { GraphState } from "../graph-types"

export async function act(s: GraphState): Promise<Partial<GraphState>> {
  if (!s.decisions) return {}
  if (s.persistedOk === false) return {}

  const keep = new Set(s.decisions.filter(d => d.decision === "Keep").map(d => d.url))
  const all = await chrome.tabs.query({})
  const toClose = all.filter(t => s.tabs.some(x => x.url === t.url) && t.url && !keep.has(t.url))
  if (toClose.length) {
    const ids = toClose.map(t => t.id!).filter(Boolean) as number[]
    const tuple = [ids[0], ...ids.slice(1)] as [number, ...number[]]
    try { await chrome.tabs.remove(tuple) } catch (e) { console.warn(e) }
  }
  const groups: Record<string, string[]> = {}
  for (const d of s.decisions.filter(d => d.decision === "Keep")) {
    const g = d.group || "Session"
    if (!groups[g]) groups[g] = []
    if (d.url) groups[g].push(d.url)
  }
  for (const [groupName, urls] of Object.entries(groups)) {
    const matching = (await chrome.tabs.query({})).filter(t => t.url && urls.includes(t.url))
    if (matching.length > 1) {
      const ids = matching.map(t => t.id!).filter(Boolean)
      try {
        const unique = Array.from(new Set(ids))
        if (unique.length < 2) continue
        const tuple = [unique[0], ...unique.slice(1)] as [number, ...number[]]
        const gid = await chrome.tabs.group({ tabIds: tuple }) as unknown as number
        await chrome.tabGroups.update(gid, { title: groupName, color: "blue" })
      } catch (e) { console.warn("Group failed", e) }
    }
  }
  return {}
}
