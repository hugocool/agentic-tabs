import { normalizePersistUrl } from "./url"
import { resolveRelations } from "./notion-resolve"
import { upsertNotion } from "./notion"
import { emitToast } from "./toast-bus"
import { enqueue } from "./capture-queue"
import { readSessionMap } from "./session-map-io"

export type CaptureScope = "active" | "window" | "session"

async function collect(scope: CaptureScope, sessionId?: string) {
  if (scope === "active") {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
    return t ? [t] : []
  }
  if (scope === "window") {
    const w = await chrome.windows.getCurrent()
    return chrome.tabs.query({ windowId: w.id! })
  }
  const map = await readSessionMap()
  const ids: number[] = (sessionId && map[sessionId]) || []
  const all = await chrome.tabs.query({})
  return all.filter(t => ids.includes(t.windowId!))
}

export async function capture(scope: CaptureScope, sessionId?: string) {
  const tabs = await collect(scope, sessionId)
  const rows = tabs
    .map(t => ({ url: normalizePersistUrl(t.url), title: t.title, decision: "Keep" as const, group: "Quick" }))
    .filter(r => r.url && /^https?:\/\//i.test(r.url!))
  if (!rows.length) return { ok: true, saved: 0 }

  const resolved = await resolveRelations(rows as any).catch(() => rows as any)
  try {
    await upsertNotion({ sessionId: sessionId || "quick", decisions: resolved as any })
    emitToast(`Saved ${rows.length} tab${rows.length === 1 ? "" : "s"}`)
    return { ok: true, saved: rows.length }
  } catch (e) {
    emitToast("Capture queued (offline or error)", "warn", "capture-queued", 5000)
    await enqueue(rows as any)
    return { ok: false, queued: rows.length }
  }
}

