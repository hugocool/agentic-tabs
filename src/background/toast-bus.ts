// Lightweight toast broadcasting from the service worker to all extension pages
// Pages listen for { type: "TOAST", text, kind }

export type ToastKind = "info" | "error" | "warn"

let lastSent: Record<string, number> = {}

export async function emitToast(text: string, kind: ToastKind = "info", dedupeKey?: string, minIntervalMs = 60000) {
    const key = dedupeKey || text
    const now = Date.now()
    if (lastSent[key] && now - lastSent[key] < minIntervalMs) return
    lastSent[key] = now
    try {
        const pages = await chrome.tabs.query({})
        const base = chrome.runtime.getURL("")
        for (const t of pages) {
            if (!t.id || !t.url) continue
            if (t.url.startsWith(base)) {
                chrome.tabs.sendMessage?.(t.id, { type: "TOAST", text, kind })
            }
        }
    } catch {
        // best-effort
    }
}
