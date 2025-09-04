// Background script: pin Manager tab for every new window, manage sessions, message handling
import { createSessionForWindow, getSessionIdForWindow, addWindowToSession } from "./session-map"
import { runTriage } from "./graph"
import { upsertSession, rehydrateFromOpenTabs, listSessionsForNTP, resumeSession, resumeSessionOpenMissing } from "./local-store"
import { ensureManagerTabsForAllWindows, ensureManagerInWindow } from "./manager-backfill"

// Pin a Manager tab for each new window
chrome.windows.onCreated.addListener(async w => {
    try {
        const url = chrome.runtime.getURL("pages/manager.html")
        const tab = await chrome.tabs.create({ windowId: w.id, url, index: 0 })
        await chrome.tabs.update(tab.id!, { pinned: true })
        // If this window has no session, create one automatically
        const existing = await getSessionIdForWindow(w.id!)
        if (!existing) await createSessionForWindow(w.id!)
    } catch (e) {
        console.warn("Failed to create manager tab", e)
    }
})

// Runtime message contract
// { type: 'START_SESSION' } -> { sessionId }
// { type: 'ADD_WINDOW', sessionId }
// { type: 'RUN_TRIAGE', sessionId }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    ; (async () => {
        if (msg?.type === "START_SESSION") {
            const current = await chrome.windows.getCurrent()
            const id = await createSessionForWindow(current.id!)
            sendResponse({ sessionId: id })
        } else if (msg?.type === "ADD_WINDOW") {
            if (msg.sessionId && sender.tab?.windowId) {
                await addWindowToSession(msg.sessionId, sender.tab.windowId)
                sendResponse({ ok: true })
            } else sendResponse({ ok: false })
        } else if (msg?.type === "RUN_TRIAGE") {
            if (msg.sessionId) {
                await runTriage(msg.sessionId)
                sendResponse({ ok: true })
            } else sendResponse({ ok: false })
        } else if (msg?.type === "SAVE_LOCAL_STATE") {
            try {
                if (!msg.sessionId || !Array.isArray(msg.decisions)) throw new Error("bad_args")
                await upsertSession({ sessionId: msg.sessionId, decisions: msg.decisions })
                sendResponse({ ok: true })
            } catch (e) {
                console.warn("SAVE_LOCAL_STATE failed", e)
                sendResponse({ ok: false })
            }
        } else if (msg?.type === "REHYDRATE_ON_STARTUP") {
            try {
                const summary = await rehydrateFromOpenTabs()
                sendResponse({ ok: true, summary })
            } catch (e) {
                console.warn("Rehydrate failed", e)
                sendResponse({ ok: false })
            }
        } else if (msg?.type === "GET_SESSIONS") {
            const limit = typeof msg.limit === "number" ? msg.limit : undefined
            const rows = await listSessionsForNTP(limit)
            sendResponse({ ok: true, sessions: rows })
        } else if (msg?.type === "RESUME_SESSION") {
            if (!msg.sessionId) return sendResponse({ ok: false })
            const { sessionId, mode, open, focusUrl } = msg
            // Back-compat: if no options provided, use minimal open-missing
            const res = (mode || open || focusUrl)
                ? await resumeSession({ sessionId, mode, open, focusUrl })
                : await resumeSessionOpenMissing(sessionId)
            sendResponse(res)
        }
    })()
    return true // async
})

// Startup / Installed hooks → rehydrate runtime session map
try {
    chrome.runtime.onStartup.addListener(async () => {
        try { await ensureManagerTabsForAllWindows() } catch (e) { console.warn("managerBackfill@startup", e) }
        try { await rehydrateFromOpenTabs() } catch (e) { console.warn("rehydrate@startup", e) }
    })
} catch {}

chrome.runtime.onInstalled.addListener(async () => {
    try { await ensureManagerTabsForAllWindows() } catch (e) { console.warn("managerBackfill@installed", e) }
    try { await rehydrateFromOpenTabs() } catch (e) { console.warn("rehydrate@installed", e) }
})
