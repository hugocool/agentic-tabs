// Local persistence of sessions (v1) + rehydration utilities

export type Decision = "Keep" | "Archive" | "Drop" | "Review"

export type SessionItem = {
  url: string
  title?: string
  decision: Decision
  group?: string
  project?: string
  task?: string
  lastSeenAt?: string // ISO
}

export type SessionLocal = {
  id: string
  name?: string
  createdAt: string // ISO
  lastActiveAt: string // ISO
  items: SessionItem[]
  domains?: Record<string, number>
  keepSet?: string[]
  reviewSet?: string[]
}

export type SessionStoreV1 = {
  version: 1
  sessions: Record<string, SessionLocal>
  recentIds: string[]
}

const STORE_KEY = "sessionStore_v1"
const MAX_ITEMS_PER_SESSION = 1000
const MIN_MATCHES = 2
const SCORE_THRESHOLD = 0.4

// URL normalization used for persistence and matching
export function normalizeUrl(input?: string | null): string | undefined {
  if (!input) return undefined
  try {
    const u = new URL(input)
    const scheme = u.protocol.toLowerCase()
    const host = u.hostname.toLowerCase()
    // Strip hash
    u.hash = ""
    // Drop tracking params
    const params = u.searchParams
    const toDelete: string[] = []
    params.forEach((_, key) => {
      if (/^(utm_|fbclid|gclid|yclid|msclkid|si|igshid|mc_eid|mc_cid|vero_id|_hs|ref|ref_src)$/i.test(key)) {
        toDelete.push(key)
      }
    })
    toDelete.forEach(k => params.delete(k))
    const path = u.pathname.replace(/\/$/, "") || "/"
    const query = params.toString()
    return `${scheme}//${host}${path}${query ? `?${query}` : ""}`
  } catch {
    return input || undefined
  }
}

export async function loadStore(): Promise<SessionStoreV1> {
  const { [STORE_KEY]: raw } = await chrome.storage.local.get(STORE_KEY)
  const store: SessionStoreV1 = raw || { version: 1, sessions: {}, recentIds: [] }
  return store
}

export async function saveStore(store: SessionStoreV1) {
  await chrome.storage.local.set({ [STORE_KEY]: store })
}

function computeCachedFields(session: SessionLocal): SessionLocal {
  const domains: Record<string, number> = {}
  const keepSet: string[] = []
  const reviewSet: string[] = []
  for (const it of session.items) {
    const n = normalizeUrl(it.url)
    if (!n) continue
    if (it.decision === "Keep") keepSet.push(n)
    if (it.decision === "Review") reviewSet.push(n)
    try {
      const d = new URL(n).hostname
      if (it.decision === "Keep" || it.decision === "Review") domains[d] = (domains[d] || 0) + 1
    } catch {}
  }
  session.domains = domains
  session.keepSet = Array.from(new Set(keepSet))
  session.reviewSet = Array.from(new Set(reviewSet))
  return session
}

export async function upsertSession(input: { sessionId: string; decisions: SessionItem[] }) {
  const now = new Date().toISOString()
  const store = await loadStore()
  const id = input.sessionId
  const existing = store.sessions[id] || {
    id,
    name: undefined,
    createdAt: now,
    lastActiveAt: now,
    items: [] as SessionItem[]
  }

  // Merge by normalized URL
  const byNorm = new Map<string, SessionItem>()
  for (const it of existing.items) {
    const n = normalizeUrl(it.url)
    if (n) byNorm.set(n, it)
  }
  for (const d of input.decisions) {
    if (!d.url) continue
    const n = normalizeUrl(d.url)
    if (!n) continue
    const prev = byNorm.get(n)
    const merged: SessionItem = {
      ...(prev || {}),
      ...d,
      url: d.url,
      lastSeenAt: now
    }
    byNorm.set(n, merged)
  }
  let mergedItems = Array.from(byNorm.values())

  // Cap items to last N (older converted to Archive by default)
  if (mergedItems.length > MAX_ITEMS_PER_SESSION) {
    mergedItems.sort((a, b) => (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""))
    const head = mergedItems.slice(0, MAX_ITEMS_PER_SESSION)
    const tail = mergedItems.slice(MAX_ITEMS_PER_SESSION).map(it => ({ ...it, decision: "Archive" as Decision }))
    mergedItems = head.concat(tail)
  }

  const updated: SessionLocal = computeCachedFields({
    ...existing,
    items: mergedItems,
    lastActiveAt: now
  })

  store.sessions[id] = updated
  // Update MRU recentIds
  store.recentIds = [id, ...store.recentIds.filter(x => x !== id)].slice(0, 50)
  await saveStore(store)
  return updated
}

export async function listSessionsForNTP(limit?: number): Promise<{
  id: string
  name?: string
  lastActiveAt: string
  counts: { keep: number; review: number; total: number }
}[]> {
  const store = await loadStore()
  const ids = store.recentIds.length ? store.recentIds : Object.keys(store.sessions)
  const rows = ids.map(id => store.sessions[id]).filter(Boolean)
  rows.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
  const out = rows.map(s => ({
    id: s.id,
    name: s.name,
    lastActiveAt: s.lastActiveAt,
    counts: {
      keep: s.items.filter(i => i.decision === "Keep").length,
      review: s.items.filter(i => i.decision === "Review").length,
      total: s.items.length
    }
  }))
  return typeof limit === "number" ? out.slice(0, limit) : out
}

function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  const s = new Set<T>(a)
  for (const x of b) s.add(x)
  return s
}

export type RehydrateSummary = {
  windowsConsidered: number
  windowsAttached: number
  tabsMatched: number
  tabsUnmatched: number
}

export async function rehydrateFromOpenTabs(): Promise<RehydrateSummary> {
  const store = await loadStore()
  const tabs = await chrome.tabs.query({})
  const managerUrl = chrome.runtime.getURL("pages/manager.html")
  const byWindow = new Map<number, string[]>()
  for (const t of tabs) {
    if (!t.url || t.url === managerUrl) continue
    const n = normalizeUrl(t.url)
    if (!n) continue
    const arr = byWindow.get(t.windowId!) || []
    arr.push(n)
    byWindow.set(t.windowId!, arr)
  }

  const sessionMap: Record<string, number[]> = {}
  let windowsAttached = 0
  let tabsMatched = 0
  let tabsUnmatched = 0

  const sessions = Object.values(store.sessions)
  for (const [winId, urls] of byWindow.entries()) {
    const W = new Set(urls)
    let best: { id: string; score: number; matches: number; lastActiveAt: string } | null = null
    for (const s of sessions) {
      const S = union(new Set(s.keepSet || []), new Set(s.reviewSet || []))
      let matches = 0
      for (const u of W) if (S.has(u)) matches++
      const score = matches / Math.max(1, W.size)
      if (matches >= MIN_MATCHES && score >= SCORE_THRESHOLD) {
        if (!best || score > best.score || (score === best.score && s.lastActiveAt > best.lastActiveAt)) {
          best = { id: s.id, score, matches, lastActiveAt: s.lastActiveAt }
        }
      }
    }
    if (best) {
      sessionMap[best.id] ||= []
      if (!sessionMap[best.id].includes(winId)) sessionMap[best.id].push(winId)
      windowsAttached++
      tabsMatched += best.matches
      tabsUnmatched += Math.max(0, W.size - best.matches)
    } else {
      tabsUnmatched += W.size
    }
  }

  await chrome.storage.session.set({ sessionMap })

  const summary: RehydrateSummary = {
    windowsConsidered: byWindow.size,
    windowsAttached,
    tabsMatched,
    tabsUnmatched
  }
  console.log(
    `[rehydrate] windows=${summary.windowsConsidered} attached=${summary.windowsAttached} matched=${summary.tabsMatched} unmatched=${summary.tabsUnmatched}`
  )
  return summary
}

export async function resumeSessionOpenMissing(sessionId: string) {
  const store = await loadStore()
  const s = store.sessions[sessionId]
  if (!s) return { ok: false, reason: "not_found" as const }
  const keepItems = s.items.filter(i => i.decision === "Keep")
  const keepSet = new Set((s.keepSet || []).filter(Boolean))
  // Idempotence: do not open if already open anywhere
  const allTabs = await chrome.tabs.query({})
  const openSet = new Set(
    allTabs.map(t => normalizeUrl(t.url)).filter(Boolean) as string[]
  )
  const missing = Array.from(keepSet).filter(u => !openSet.has(u))
  const currentWin = await chrome.windows.getCurrent()
  const openedTabIds: number[] = []
  for (const urlNorm of missing) {
    const item = keepItems.find(i => normalizeUrl(i.url) === urlNorm)
    const url = item?.url || urlNorm
    try {
      const tab = await chrome.tabs.create({ windowId: currentWin.id!, url })
      if (tab.id) openedTabIds.push(tab.id)
    } catch (e) {
      console.warn("Failed to open", url, e)
    }
  }
  // Grouping: apply tab groups by `group` for currently open kept tabs
  const keptUrls = new Set(Array.from(keepSet))
  const relevantTabs = (await chrome.tabs.query({})).filter(t => {
    const n = normalizeUrl(t.url)
    return !!n && keptUrls.has(n)
  })
  const byGroup: Record<string, number[]> = {}
  for (const it of keepItems) {
    const g = it.group || "Session"
    const n = normalizeUrl(it.url)
    if (!n || !keptUrls.has(n)) continue
    const matching = relevantTabs.filter(t => normalizeUrl(t.url) === n)
    const ids = matching.map(t => t.id!).filter(Boolean) as number[]
    if (!ids.length) continue
    byGroup[g] ||= []
    byGroup[g].push(...ids)
  }
  for (const [groupName, ids] of Object.entries(byGroup)) {
    if (ids.length < 2) continue
    try {
      const gid = await chrome.tabs.group({ tabIds: Array.from(new Set(ids)) })
      await chrome.tabGroups.update(gid, { title: groupName, color: "blue" })
    } catch (e) { console.warn("Grouping failed", e) }
  }

  // Attach current window to session runtime map
  const { sessionMap = {} } = await chrome.storage.session.get("sessionMap")
  const arr = sessionMap[sessionId] || []
  if (!arr.includes(currentWin.id!)) arr.push(currentWin.id!)
  sessionMap[sessionId] = arr
  await chrome.storage.session.set({ sessionMap })

  return { ok: true, opened: openedTabIds.length }
}

