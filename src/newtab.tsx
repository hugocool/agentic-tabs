import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

function NewTab() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState("")

  const startSession = () => {
    chrome.runtime.sendMessage({ type: "START_SESSION" }, resp => {
      if (resp?.sessionId) {
        setSessionId(resp.sessionId)
        setLastAction("Session started")
      }
    })
  }

  const runTriage = () => {
    if (!sessionId) return
    chrome.runtime.sendMessage({ type: "RUN_TRIAGE", sessionId }, resp => {
      setLastAction(resp?.ok ? "Triage executed" : "Triage failed")
    })
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2 style={{ marginTop: 0 }}>Agentic Sessions</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={startSession}>Start session</button>
        <button disabled={!sessionId} onClick={runTriage}>Run triage</button>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>Session: {sessionId || "(none)"}</div>
      {lastAction && <div style={{ marginTop: 8, fontSize: 12 }}>{lastAction}</div>}
      <hr style={{ margin: "24px 0" }} />
      <p style={{ maxWidth: 520, lineHeight: 1.4 }}>
        This custom New Tab Page lets you start an agentic session. The background script pins a Manager tab in every new window. When you run triage the extension classifies open tabs (per session) with an on-device model (Chrome) or cloud fallback, upserts records to Notion, and closes unneeded tabs while grouping kept ones.
      </p>
      <details>
        <summary style={{ cursor: "pointer" }}>Notion setup</summary>
        <ol style={{ fontSize: 12 }}>
          <li>Create an internal integration & copy token.</li>
          <li>Share your Resources + Sessions databases with it.</li>
          <li>In the extension console: chrome.storage.local.set({notionToken:"secret_xxx", resourcesDbId:"db1", sessionsDbId:"db2" })</li>
        </ol>
      </details>
    </div>
  )
}

const root = document.createElement("div")
document.body.appendChild(root)
createRoot(root).render(<NewTab />)
