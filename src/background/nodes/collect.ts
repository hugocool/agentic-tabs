import { GraphState } from "../graph-types"

export async function collect(s: GraphState): Promise<Partial<GraphState>> {
  const tabs = await chrome.tabs.query({})
  let winIds: number[] = []
  try {
    const { sessionMap = {} } = await chrome.storage.session.get("sessionMap")
    winIds = (sessionMap[s.sessionId] || []) as number[]
  } catch {
    const { sessionMap = {} } = await chrome.storage.local.get("sessionMap")
    winIds = (sessionMap[s.sessionId] || []) as number[]
  }
  const filtered = tabs
    .filter(t => t.windowId != null && winIds.includes(t.windowId))
    .map(t => ({ url: t.url, title: t.title }))
  return { tabs: filtered }
}

