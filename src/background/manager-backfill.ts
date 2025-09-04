// Ensures the Manager tab is present and pinned in all windows (idempotent)

const LOCK_KEY = "managerSetupLock"

export async function ensureManagerTabsForAllWindows() {
  // Concurrency guard using storage.session if available
  try {
    const hasSession = (chrome.storage as any)?.session?.get
    const bag = hasSession
      ? await chrome.storage.session.get(LOCK_KEY)
      : await chrome.storage.local.get(LOCK_KEY)
    if (bag?.[LOCK_KEY]) return
    if (hasSession) await chrome.storage.session.set({ [LOCK_KEY]: Date.now() })
    else await chrome.storage.local.set({ [LOCK_KEY]: Date.now() })
  } catch {}

  const managerUrl = chrome.runtime.getURL("pages/manager.html")
  let windows: chrome.windows.Window[] = []
  try {
    windows = await chrome.windows.getAll({ populate: true })
  } catch (e) {
    console.warn("windows.getAll failed", e)
    return
  }

  // Incognito handling: skip incognito windows by default; if allowed, getAll will include them and we still try
  for (const w of windows) {
    try {
      if (!w.id) continue
      if (w.incognito) {
        // Try only if allowed; if not allowed, calls will no-op/fail silently
        try { await ensureManagerInWindow(w.id, w.tabs || [], managerUrl) } catch {}
      } else {
        await ensureManagerInWindow(w.id, w.tabs || [], managerUrl)
      }
    } catch (e) {
      console.warn("ensureManagerInWindow failed", w.id, e)
    }
  }

  try {
    const hasSession = (chrome.storage as any)?.session?.remove
    if (hasSession) await chrome.storage.session.remove(LOCK_KEY)
    else await chrome.storage.local.remove(LOCK_KEY)
  } catch {}
}

export async function ensureManagerInWindow(
  windowId: number,
  tabs?: chrome.tabs.Tab[],
  managerUrl = chrome.runtime.getURL("pages/manager.html")
) {
  let list = tabs
  if (!list) {
    try { list = await chrome.tabs.query({ windowId }) } catch { list = [] as any }
  }
  const existing = (list || []).find(t => t.url === managerUrl)
  if (existing?.id != null) {
    if (!existing.pinned) {
      try { await chrome.tabs.update(existing.id, { pinned: true }) } catch {}
    }
    try { await chrome.tabs.move(existing.id, { index: 0 }) } catch {}
    return
  }
  try {
    await chrome.tabs.create({ windowId, url: managerUrl, pinned: true, index: 0, active: false })
  } catch (e) {
    console.warn("tabs.create manager failed", e)
  }
}

export { LOCK_KEY }

