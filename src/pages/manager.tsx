import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { v4 as uuid } from "uuid"
import { openOptionsPage } from "../options-logic"

function Manager() {
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [running, setRunning] = useState(false)
    const [status, setStatus] = useState<string>("")

    useEffect(() => {
        // On mount ask background which session this window belongs to by creating a dummy start if needed
        chrome.runtime.sendMessage({ type: "START_SESSION" }, resp => {
            if (resp?.sessionId) setSessionId(resp.sessionId)
        })
    }, [])

    const runTriage = () => {
        if (!sessionId) return
        setRunning(true)
        setStatus("Running triage...")
        chrome.runtime.sendMessage({ type: "RUN_TRIAGE", sessionId }, resp => {
            setRunning(false)
            setStatus(resp?.ok ? "Triage complete" : "Triage failed")
        })
    }

    const resume = () => {
        if (!sessionId) return
        setRunning(true)
        setStatus("Resuming...")
        chrome.runtime.sendMessage({ type: "RESUME_SESSION", sessionId, mode: "reuse", open: "keep" }, resp => {
            setRunning(false)
            if (resp?.ok) setStatus(`Resumed: opened ${resp.openedCount}`)
            else setStatus("Resume failed")
        })
    }

    return (
        <div style={{ fontFamily: "system-ui", padding: 12, width: 300 }}>
            <h3 style={{ marginTop: 0 }}>Manager</h3>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Session: {sessionId || "…"}</div>
            <button disabled={!sessionId || running} onClick={runTriage} style={{ marginTop: 8 }}>
                {running ? "Working…" : "Save & Clean"}
            </button>
            <button disabled={!sessionId || running} onClick={resume} style={{ marginTop: 8, marginLeft: 8 }}>
                Resume session
            </button>
            <button onClick={openOptionsPage} style={{ marginTop: 8, marginLeft: 8 }}>
                Options
            </button>
            {status && <div style={{ marginTop: 8, fontSize: 12 }}>{status}</div>}
            <hr />
            <p style={{ fontSize: 12, lineHeight: 1.4 }}>
                This pinned tab manages tab classification, Notion upserts, and cleanup.
            </p>
        </div>
    )
}

const el = document.createElement("div")
document.body.appendChild(el)
createRoot(el).render(<Manager />)
