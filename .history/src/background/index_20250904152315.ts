// Background script: pin Manager tab for every new window, manage sessions, message handling
import { createSessionForWindow, getSessionIdForWindow, addWindowToSession } from "./session-map"
import { runGraph } from "./graph"

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
                await runGraph(msg.sessionId)
                sendResponse({ ok: true })
            } else sendResponse({ ok: false })
        }
    })()
    return true // async
})
