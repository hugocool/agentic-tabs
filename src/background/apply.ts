import { upsertSession, normalizeUrl } from "./local-store"
import { upsertNotion } from "./notion"
import { stableHash, getLastApplied, setLastApplied } from "./preview-cache"

type DecisionRow = {
  url?: string
  title?: string
  decision: "Keep" | "Archive" | "Drop" | "Review"
  group?: string
  project?: string
  task?: string
}

export async function applyDecisions({ sessionId, decisions, options }: {
  sessionId: string
  decisions: DecisionRow[]
  options?: { closeNonKeep?: boolean; createGroups?: boolean }
}) {
  const hash = stableHash(decisions)
  const last = await getLastApplied(sessionId)
  if (last && last === hash) return { openedCount: 0, closedCount: 0, grouped: 0, skipped: 0 }

  // persist
  await upsertSession({ sessionId, decisions: decisions as any })
  // fire-and-forget notion
  try { await upsertNotion({ sessionId, decisions: decisions as any }) } catch {}

  const closeNonKeep = options?.closeNonKeep !== false
  const createGroups = options?.createGroups !== false

  // Collect tabs in session windows
  let winIds: number[] = []
  try {
    const { sessionMap = {} } = await chrome.storage.session.get("sessionMap")
    winIds = (sessionMap[sessionId] || []) as number[]
  } catch {
    const { sessionMap = {} } = await chrome.storage.local.get("sessionMap")
    winIds = (sessionMap[sessionId] || []) as number[]
  }
  const all = await chrome.tabs.query({})
  const scoped = all.filter(t => t.windowId != null && winIds.includes(t.windowId))

  const keepSet = new Set(decisions.filter(d => d.decision === "Keep").map(d => normalizeUrl(d.url)!).filter(Boolean))
  let closedCount = 0
  if (closeNonKeep) {
    const toClose = scoped.filter(t => {
      const n = normalizeUrl(t.url)
      return t.id != null && n && (!keepSet.has(n)) && /^https?:\/\//i.test(t.url || "")
    })
    if (toClose.length) {
      try { await chrome.tabs.remove(toClose.map(t => t.id!) as number[]) } catch {}
      closedCount = toClose.length
    }
  }

  let grouped = 0
  if (createGroups) {
    const byGroup: Record<string, number[]> = {}
    for (const d of decisions.filter(d => d.decision === "Keep")) {
      const n = normalizeUrl(d.url)
      if (!n) continue
      const g = d.group || "Session"
      const matches = scoped.filter(t => normalizeUrl(t.url) === n && t.id != null)
      const ids = matches.map(t => t.id!) as number[]
      if (!ids.length) continue
      byGroup[g] ||= []
      byGroup[g].push(...ids)
    }
    for (const [name, ids] of Object.entries(byGroup)) {
      if (ids.length < 2) continue
      try {
        const gid = await chrome.tabs.group({ tabIds: Array.from(new Set(ids)) })
        await chrome.tabGroups.update(gid, { title: name, color: "blue" })
        grouped++
      } catch {}
    }
  }

  await setLastApplied(sessionId, hash)
  return { openedCount: 0, closedCount, grouped, skipped: 0 }
}

