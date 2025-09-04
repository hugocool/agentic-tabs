import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { openOptionsPage } from "./options-logic"

function NewTab() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState("")
  const [sessions, setSessions] = useState<any[]>([])

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

  const refreshSessions = () => {
    chrome.runtime.sendMessage({ type: "GET_SESSIONS", limit: 5 }, resp => {
      if (resp?.ok) setSessions(resp.sessions || [])
    })
  }

  const resume = (id: string) => {
    chrome.runtime.sendMessage({ type: "RESUME_SESSION", sessionId: id, mode: "reuse", open: "keep" }, resp => {
      if (resp?.ok) setLastAction(`Resumed ${id}: opened ${resp.openedCount}`)
      else setLastAction("Resume failed")
    })
  }

  useEffect(() => { refreshSessions() }, [])

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2 style={{ marginTop: 0 }}>Agentic Sessions</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={startSession}>Start session</button>
        <button disabled={!sessionId} onClick={runTriage}>Run triage</button>
        <button onClick={refreshSessions}>Refresh</button>
        <button onClick={openOptionsPage}>Options</button>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>Session: {sessionId || "(none)"}</div>
      {lastAction && <div style={{ marginTop: 8, fontSize: 12 }}>{lastAction}</div>}
      <hr style={{ margin: "24px 0" }} />
      <p style={{ maxWidth: 520, lineHeight: 1.4 }}>
        This custom New Tab Page lets you start an agentic session. The background script pins a Manager tab in every new window. When you run triage the extension classifies open tabs (per session) with an on-device model (Chrome) or cloud fallback, upserts records to Notion, and closes unneeded tabs while grouping kept ones.
      </p>
      <h4 style={{ marginBottom: 8 }}>Recent Sessions</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 520 }}>
        {sessions.map((s: any) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", border: "1px solid #eee", borderRadius: 6 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name || s.id}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Keep {s.counts.keep} · Review {s.counts.review} · Total {s.counts.keep + s.counts.archive + s.counts.review + s.counts.drop}</div>
            </div>
            <button onClick={() => resume(s.id)}>Resume</button>
          </div>
        ))}
        {!sessions.length && <div style={{ fontSize: 12, opacity: 0.7 }}>No sessions yet.</div>}
      </div>
      <details>
        <summary style={{ cursor: "pointer" }}>Notion setup</summary>
        <ol style={{ fontSize: 12 }}>
          <li>Create an internal integration & copy token.</li>
          <li>Share your Resources + Sessions databases with it.</li>
          <li>In the extension console, set Notion creds via chrome.storage.local.set(...)</li>
        </ol>
      </details>
    </div>
  )
}

const root = document.createElement("div")
document.body.appendChild(root)
createRoot(root).render(<NewTab />)
