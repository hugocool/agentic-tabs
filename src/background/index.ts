// Background script: pin Manager tab for every new window, manage sessions, message handling
import { createSessionForWindow, getSessionIdForWindow, addWindowToSession } from "./session-map"
import { runTriage } from "./graph"
import { upsertSession, rehydrateFromOpenTabs, listSessionsForNTP, resumeSession, resumeSessionOpenMissing } from "./local-store"
import { ensureManagerTabsForAllWindows, ensureManagerInWindow } from "./manager-backfill"
import { logger } from "../shared/logger"
import { ok, err, E } from "../shared/errors"
import { runPreview } from "./graph.preview"
import { savePreview, getPreview } from "./preview-cache"
import { applyDecisions } from "./apply"
import { handleCommand } from "./commands"
import { readSessionMap, writeSessionMap } from "./session-map-io"

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
            sendResponse(ok({ sessionId: id }))
        } else if (msg?.type === "ADD_WINDOW") {
            if (msg.sessionId && sender.tab?.windowId) {
                await addWindowToSession(msg.sessionId, sender.tab.windowId)
                sendResponse(ok())
            } else sendResponse(err(E.MSG_BAD_ARGS, "Missing sessionId or windowId"))
        } else if (msg?.type === "RUN_TRIAGE") {
            if (msg.sessionId) {
                await runTriage(msg.sessionId)
                sendResponse(ok())
            } else sendResponse(err(E.MSG_BAD_ARGS, "Missing sessionId"))
        } else if (msg?.type === "SAVE_LOCAL_STATE") {
            try {
                if (!msg.sessionId || !Array.isArray(msg.decisions)) throw new Error("bad_args")
                await upsertSession({ sessionId: msg.sessionId, decisions: msg.decisions })
                sendResponse(ok())
            } catch (e) {
                logger.error("SAVE_LOCAL_STATE failed", { e: String(e) })
                sendResponse(err(E.UNHANDLED, "Failed to save local state"))
            }
        } else if (msg?.type === "REHYDRATE_ON_STARTUP") {
            try {
                const summary = await rehydrateFromOpenTabs()
                sendResponse(ok({ summary }))
            } catch (e) {
                logger.error("Rehydrate failed", { e: String(e) })
                sendResponse(err(E.UNHANDLED, "Rehydrate failed"))
            }
        } else if (msg?.type === "GET_SESSIONS") {
            const limit = typeof msg.limit === "number" ? msg.limit : undefined
            const rows = await listSessionsForNTP(limit)
            sendResponse(ok({ sessions: rows }))
        } else if (msg?.type === "RESUME_SESSION") {
            if (!msg.sessionId) return sendResponse(err(E.MSG_BAD_ARGS, "Missing sessionId"))
            const { sessionId, mode, open, focusUrl } = msg
            // Back-compat: if no options provided, use minimal open-missing
            const res = (mode || open || focusUrl)
                ? await resumeSession({ sessionId, mode, open, focusUrl })
                : await resumeSessionOpenMissing(sessionId)
            if ((res as any).ok === false) sendResponse(res as any)
            else sendResponse(ok(res))
        } else if (msg?.type === "PREVIEW_TRIAGE") {
            if (!msg.sessionId) return sendResponse(err(E.MSG_BAD_ARGS, "Missing sessionId"))
            const { decisions } = await runPreview(msg.sessionId)
            const { previewId, hash } = await savePreview(msg.sessionId, decisions as any)
            const domains: Record<string, number> = {}
            for (const d of decisions as any[]) {
                try { const h = new URL(d.url).hostname; domains[h] = (domains[h] || 0) + 1 } catch {}
            }
            sendResponse(ok({ previewId, decisions, meta: { count: decisions.length, domains, hash } }))
        } else if (msg?.type === "APPLY_DECISIONS") {
            const { sessionId, previewId, decisions, options } = msg
            if (!sessionId || (!previewId && !Array.isArray(decisions))) return sendResponse(err(E.MSG_BAD_ARGS, "Missing args"))
            let rows = decisions
            if (!rows && previewId) {
                const rec = await getPreview(previewId)
                rows = rec?.decisions
            }
            if (!rows) return sendResponse(err(E.MSG_BAD_ARGS, "No decisions to apply"))
            try {
                const summary = await applyDecisions({ sessionId, decisions: rows, options })
                sendResponse(ok(summary))
            } catch (e) {
                logger.error("APPLY_DECISIONS failed", { e: String(e) })
                sendResponse(err(E.UNHANDLED, "Apply failed"))
            }
        } else if (msg?.type === "RUN_COMMAND") {
            try {
                if (!msg.command) return sendResponse(err(E.MSG_BAD_ARGS, "Missing command"))
                await handleCommand(msg.command)
                sendResponse(ok())
            } catch (e) {
                logger.error("RUN_COMMAND failed", { e: String(e) })
                sendResponse(err(E.UNHANDLED, "Command failed"))
            }
        } else if (msg?.type === "LIST_WINDOWS") {
            if (!msg.sessionId) return sendResponse(err(E.MSG_BAD_ARGS, "Missing sessionId"))
            const map = await readSessionMap()
            sendResponse(ok({ windowIds: map[msg.sessionId] || [] }))
        } else if (msg?.type === "REMOVE_WINDOW") {
            const { sessionId, windowId } = msg || {}
            if (!sessionId || typeof windowId !== "number") return sendResponse(err(E.MSG_BAD_ARGS, "Missing sessionId/windowId"))
            const map = await readSessionMap()
            if (map[sessionId]) {
                map[sessionId] = map[sessionId].filter((id: number) => id !== windowId)
                await writeSessionMap(map)
            }
            sendResponse(ok())
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

// Global commands
try {
  chrome.commands?.onCommand.addListener(async (command) => {
    try { await handleCommand(command) } catch (e) { console.warn("onCommand failed", command, e) }
  })
} catch {}

// Auto-prune mapping on window close
chrome.windows.onRemoved.addListener(async (closedId) => {
    try {
        const map = await readSessionMap()
        let changed = false
        for (const sid of Object.keys(map)) {
            const arr = map[sid] || []
            const next = arr.filter(id => id !== closedId)
            if (next.length !== arr.length) { map[sid] = next; changed = true }
        }
        if (changed) await writeSessionMap(map)
    } catch (e) {
        console.warn("onRemoved prune failed", e)
    }
})
