import { ensureManagerInWindow } from "./manager-backfill"
import { getSessionIdForWindow } from "./session-map"
import { listSessionsForNTP } from "./local-store"
import { runTriage } from "./graph"
import { runPreview } from "./graph.preview"

export async function handleCommand(command: string) {
  switch (command) {
    case "start-session": {
      const w = await chrome.windows.getCurrent()
      await chrome.runtime.sendMessage({ type: "START_SESSION" })
      await ensureManagerInWindow(w.id!)
      return
    }
    case "preview-triage": {
      const w = await chrome.windows.getCurrent()
      const sid = await getSessionIdForWindow(w.id!)
      if (sid) await runPreview(sid)
      return
    }
    case "resume-last-session": {
      const rows = await listSessionsForNTP(1)
      const last = rows[0]?.id
      if (last) await chrome.runtime.sendMessage({ type: "RESUME_SESSION", sessionId: last, mode: "reuse", open: "keep" })
      return
    }
    case "open-options": {
      await chrome.runtime.openOptionsPage()
      return
    }
    case "focus-manager": {
      const w = await chrome.windows.getCurrent()
      await ensureManagerInWindow(w.id!)
      const managerUrl = chrome.runtime.getURL("pages/manager.html")
      const tabs = await chrome.tabs.query({ windowId: w.id })
      const m = tabs.find(t => t.url === managerUrl)
      if (m?.id) await chrome.tabs.update(m.id, { active: true })
      return
    }
  }
}

