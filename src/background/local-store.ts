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

export type DecisionRow = {
  url?: string
  title?: string
  decision: Decision
  group?: string
  project?: string
  task?: string
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
    // Preserve original path case and trailing slash
    const path = u.pathname || "/"
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
    // Cache normalized (lowercase scheme/host, strip tracking/hash), preserve path case
    const n = normalizeUrl(it.url)
    if (!n) continue
    if (it.decision === "Keep") keepSet.push(n)
    if (it.decision === "Review") reviewSet.push(n)
    try {
      const d = new URL(n).hostname.toLowerCase()
      if (it.decision === "Keep" || it.decision === "Review") domains[d] = (domains[d] || 0) + 1
    } catch {}
  }
  session.domains = domains
  session.keepSet = Array.from(new Set(keepSet))
  session.reviewSet = Array.from(new Set(reviewSet))
  return session
}

export async function upsertSession(input: { sessionId: string; decisions: DecisionRow[] }) {
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
  counts: { keep: number; archive: number; review: number; drop: number }
}[]> {
  const store = await loadStore()
  const ids = store.recentIds.length ? store.recentIds : Object.keys(store.sessions)
  const rows = ids.map(id => store.sessions[id]).filter(Boolean)
  rows.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
  const out = rows.map(s => {
    const counts = { keep: 0, archive: 0, review: 0, drop: 0 }
    for (const it of s.items) {
      if (it.decision === "Keep") counts.keep++
      else if (it.decision === "Archive") counts.archive++
      else if (it.decision === "Review") counts.review++
      else counts.drop++
    }
    return {
      id: s.id,
      name: s.name,
      lastActiveAt: s.lastActiveAt,
      counts
    }
  })
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

  // Prefer session storage; fallback to local if session area is unavailable (older Edge)
  try {
    // @ts-ignore
    if ((chrome.storage as any)?.session?.set) {
      await chrome.storage.session.set({ sessionMap })
    } else {
      await chrome.storage.local.set({ sessionMap })
    }
  } catch {
    await chrome.storage.local.set({ sessionMap })
  }

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
  let sessionMap: Record<string, number[]> = {}
  try {
    const bag = await chrome.storage.session.get("sessionMap")
    sessionMap = (bag?.sessionMap || {}) as Record<string, number[]>
  } catch {
    const bag = await chrome.storage.local.get("sessionMap")
    sessionMap = (bag?.sessionMap || {}) as Record<string, number[]>
  }
  const arr = sessionMap[sessionId] || []
  if (!arr.includes(currentWin.id!)) arr.push(currentWin.id!)
  sessionMap[sessionId] = arr
  try {
    // @ts-ignore
    if ((chrome.storage as any)?.session?.set) {
      await chrome.storage.session.set({ sessionMap })
    } else {
      await chrome.storage.local.set({ sessionMap })
    }
  } catch {
    await chrome.storage.local.set({ sessionMap })
  }

  return { ok: true, opened: openedTabIds.length }
}

// Additional helpers for AT-2
export function canonicalizeUrl(u?: string | null): string {
  if (!u) return ""
  try {
    const x = new URL(u)
    x.hash = ""
    if (x.pathname.endsWith("/") && x.pathname !== "/") x.pathname = x.pathname.slice(0, -1)
    return x.toString()
  } catch {
    return String(u)
  }
}

export function computeToOpen(params: {
  decisions: SessionItem[]
  includeArchive?: boolean
  alreadyOpen: Set<string> // normalized or canonicalized
}) {
  const includeArchive = !!params.includeArchive
  const wanted = new Set<string>()
  for (const it of params.decisions) {
    if (!it.url) continue
    if (it.decision === "Keep" || (includeArchive && it.decision === "Archive")) {
      const id = normalizeUrl(it.url)
      if (id) wanted.add(id)
    }
  }
  const toOpen: string[] = []
  for (const u of wanted) if (!params.alreadyOpen.has(u)) toOpen.push(u)
  return toOpen
}

export async function resumeSession(args: {
  sessionId: string
  mode?: "reuse" | "newWindow"
  open?: "keep" | "keep+archive"
  focusUrl?: string
}): Promise<{ ok: boolean; openedCount: number; skippedCount: number; groupedCount: number; windowIds: number[]; reason?: string }> {
  const { sessionId } = args
  const mode = args.mode || "reuse"
  const includeArchive = args.open === "keep+archive"

  const store = await loadStore()
  let session = store.sessions[sessionId]
  if (!session || !session.items || session.items.length === 0) {
    // Lazy Notion fallback
    try {
      const mod = await import("./notion")
      const nf = await mod.loadFromNotion(sessionId)
      if (nf?.items?.length) {
        // Convert into SessionLocal shape minimally
        session = {
          id: sessionId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          items: nf.items.map(i => ({ url: i.url, title: i.title, decision: "Keep", group: i.group || "Session" }))
        }
      }
    } catch (e) { console.warn("Notion fallback import failed", e) }
  }
  if (!session || !session.items || session.items.length === 0) {
    return { ok: false, openedCount: 0, skippedCount: 0, groupedCount: 0, windowIds: [], reason: "no_session" }
  }

  // Resolve target windows
  let windowIds: number[] = []
  try {
    const mod = await import("./session-map")
    windowIds = await (mod as any).ensureWindows(sessionId)
    if (mode === "newWindow" || windowIds.length === 0) {
      const urlsFirst: string[] = []
      const win = await chrome.windows.create({ url: urlsFirst.length ? urlsFirst : undefined })
      if (win?.id != null) {
        windowIds.push(win.id)
        await (mod as any).attachWindow(sessionId, win.id)
      }
    }
  } catch (e) {
    console.warn("ensure/attach windows failed", e)
  }
  if (windowIds.length === 0) {
    const win = await chrome.windows.create({})
    if (win?.id != null) windowIds.push(win.id)
  }

  // Compute already open set across target windows (idempotence)
  const openSet = new Set<string>()
  for (const wid of windowIds) {
    try {
      const tabs = await chrome.tabs.query({ windowId: wid })
      for (const t of tabs) {
        const n = normalizeUrl(t.url)
        if (n) openSet.add(n)
      }
    } catch {}
  }

  const toOpenNorm = computeToOpen({ decisions: session.items, includeArchive, alreadyOpen: openSet })
  // Map normalized URL back to original for open call
  const normToOriginal = new Map<string, string>()
  for (const it of session.items) {
    const n = normalizeUrl(it.url)
    if (n && !normToOriginal.has(n)) normToOriginal.set(n, it.url)
  }
  const toOpenOriginal = toOpenNorm.map(u => normToOriginal.get(u) || u)

  // Open missing tabs in the first target window
  const primaryWin = windowIds[0]
  const openedTabIds: number[] = []
  for (const url of toOpenOriginal) {
    if (!/^https?:\/\//i.test(url)) continue
    try {
      const tab = await chrome.tabs.create({ windowId: primaryWin, url })
      if (tab?.id != null) openedTabIds.push(tab.id)
    } catch (e) { console.warn("open failed", url, e) }
  }

  // Group kept tabs by group within each window
  let groupedCount = 0
  const keepItems = session.items.filter(i => i.decision === "Keep")
  const keepSet = new Set(keepItems.map(i => normalizeUrl(i.url)).filter(Boolean) as string[])
  for (const wid of windowIds) {
    try {
      const tabs = await chrome.tabs.query({ windowId: wid })
      // Build group -> tabIds
      const byGroup: Record<string, number[]> = {}
      for (const it of keepItems) {
        const n = normalizeUrl(it.url)
        if (!n || !keepSet.has(n)) continue
        const g = it.group || "Session"
        const matched = tabs.filter(t => normalizeUrl(t.url) === n && t.id != null)
        const ids = matched.map(t => t.id!) as number[]
        if (!ids.length) continue
        byGroup[g] ||= []
        byGroup[g].push(...ids)
      }
      for (const [name, ids] of Object.entries(byGroup)) {
        if (ids.length < 2) continue
        try {
          const gid = await chrome.tabs.group({ tabIds: Array.from(new Set(ids)) })
          await chrome.tabGroups.update(gid, { title: name, color: "blue" })
          groupedCount++
        } catch (e) { console.warn("group failed", e) }
      }
    } catch {}
  }

  // Focus handling
  if (args.focusUrl) {
    const targetN = normalizeUrl(args.focusUrl)
    if (targetN) {
      const allTabs = await chrome.tabs.query({ windowId: primaryWin })
      const candidate = allTabs.find(t => normalizeUrl(t.url) === targetN)
      if (candidate?.id != null) {
        try { await chrome.tabs.update(candidate.id, { active: true }) } catch {}
      }
    }
  } else if (openedTabIds.length) {
    try { await chrome.tabs.update(openedTabIds[0], { active: true }) } catch {}
  }

  // Persist lastActiveAt
  store.sessions[sessionId] = computeCachedFields({ ...session, lastActiveAt: new Date().toISOString() })
  await saveStore(store)

  const openedCount = openedTabIds.length
  const skippedCount = Math.max(0, toOpenOriginal.length - openedCount)
  console.log(`[resume] session=${sessionId} windows=${windowIds.length} opened=${openedCount} grouped=${groupedCount}`)
  return { ok: true, openedCount, skippedCount, groupedCount, windowIds }
}
