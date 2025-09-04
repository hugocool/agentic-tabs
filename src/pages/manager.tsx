import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { openOptionsPage } from "../options-logic"
import { startSession, previewTriage, applyDecisionsMsg, resumeSessionMsg, listWindowsMsg, attachHereMsg, detachWindowMsg } from "../background/session-client"
import { deriveCounts, deriveDomainCounts, noChanges } from "./preview-utils"
import Board from "./components/Board"
import { loadWip } from "./wip-config"
import { ToastHost, showToast } from "../shared/toast"

function Manager() {
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [running, setRunning] = useState(false)
    const [status, setStatus] = useState<string>("")
    const [preview, setPreview] = useState<{ id: string, rows: any[] } | null>(null)
    const [selected, setSelected] = useState<number[]>([])
    const [counts, setCounts] = useState({ keep: 0, archive: 0, drop: 0, review: 0 })
    const [domainCounts, setDomainCounts] = useState<Record<string, number>>({})
    const [attached, setAttached] = useState<number[]>([])
    const [wip, setWip] = useState<{ keep: number; review: number }>({ keep: 7, review: 10 })

    useEffect(() => { startSession().then(r => r.sessionId && setSessionId(r.sessionId)) }, [])
    useEffect(() => {
        const listener = (msg: any) => { if (msg?.type === "TOAST") showToast(msg.text, msg.kind === "error" ? "error" : msg.kind === "warn" ? "error" : "info") }
        chrome.runtime.onMessage.addListener(listener)
        return () => { chrome.runtime.onMessage.removeListener(listener) }
    }, [])
    useEffect(() => { if (sessionId) listWindowsMsg(sessionId).then(r => setAttached(r?.data?.windowIds || r?.windowIds || [])) }, [sessionId])
    useEffect(() => { if (preview) { setCounts(deriveCounts(preview.rows)); setDomainCounts(deriveDomainCounts(preview.rows)) } }, [preview])
    useEffect(() => { loadWip().then(setWip).catch(()=>{}) }, [])

    const runPreview = () => {
        if (!sessionId) return
        setRunning(true)
        setStatus("Previewing...")
        previewTriage(sessionId).then(resp => {
            setRunning(false)
            if (resp?.ok) {
                setPreview({ id: resp.data?.previewId || resp.previewId, rows: resp.data?.decisions || resp.decisions || [] })
                setStatus(`Preview ready (${(resp.data?.meta?.count) ?? (resp.decisions?.length || 0)})`)
            } else setStatus("Preview failed")
        })
    }

    const resume = () => {
        if (!sessionId) return
        setRunning(true)
        setStatus("Resuming...")
        resumeSessionMsg(sessionId).then(resp => {
            setRunning(false)
            setStatus(resp?.ok ? `Resumed: opened ${resp.openedCount ?? resp.data?.openedCount ?? 0}` : "Resume failed")
        })
    }

    return (
        <div style={{ fontFamily: "system-ui", padding: 12, width: 300 }}>
            <h3 style={{ marginTop: 0 }}>Manager</h3>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Session: {sessionId || "…"}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Attached windows: {attached.length}</div>
            <button disabled={!sessionId || running} onClick={runPreview} style={{ marginTop: 8 }}>
                {running ? "Working…" : (preview ? "Re-preview" : "Preview")}
            </button>
            <button disabled={!sessionId || running} onClick={resume} style={{ marginTop: 8, marginLeft: 8 }}>
                Resume session
            </button>
            <button onClick={openOptionsPage} style={{ marginTop: 8, marginLeft: 8 }}>
                Options
            </button>
            {status && <div style={{ marginTop: 8, fontSize: 12 }}>{status}</div>}
            <div style={{ marginTop: 8 }}>
                <button disabled={!sessionId} onClick={async () => { if (!sessionId) return; await attachHereMsg(sessionId); const w = await listWindowsMsg(sessionId); setAttached(w?.data?.windowIds || w?.windowIds || []) }}>Attach this window</button>
                <button disabled={!sessionId} onClick={async () => { if (!sessionId) return; const w = await chrome.windows.getCurrent(); await detachWindowMsg(sessionId, w.id!); const r = await listWindowsMsg(sessionId); setAttached(r?.data?.windowIds || r?.windowIds || []) }} style={{ marginLeft: 8 }}>Detach this window</button>
            </div>
            {!!attached.length && (
                <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                    {attached.map(wid => (
                        <li key={wid}>
                            Window {wid} &nbsp;
                            <button onClick={async () => { try { await chrome.windows.update(wid, { focused: true }) } catch { } }}>Focus</button>
                            <button onClick={async () => { if (!sessionId) return; await detachWindowMsg(sessionId, wid); const r = await listWindowsMsg(sessionId); setAttached(r?.data?.windowIds || r?.windowIds || []) }} style={{ marginLeft: 6 }}>Detach</button>
                        </li>
                    ))}
                </ul>
            )}
            <hr />
            {preview && (
              <div style={{ fontSize: 12 }}>
                <div style={{ marginBottom: 6 }}>Preview ({preview.rows.length}) · Keep {counts.keep} · Archive {counts.archive} · Drop {counts.drop} · Review {counts.review}</div>
                <Board preview={preview} wip={wip} onChangeRows={(rows)=>{ setPreview({ ...preview, rows }); chrome.runtime.sendMessage({ type: "SAVE_PREVIEW_OVERRIDES", previewId: preview.id, decisions: rows }) }} />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button disabled={running} onClick={() => {
                    const toClose = preview.rows.filter(r => r.decision !== 'Keep').length
                    if (toClose > 10 && !window.confirm(`Close ${toClose} tabs now?`)) return
                    applyDecisionsMsg(sessionId!, preview.id, preview.rows).then(resp => {
                      if (resp?.ok) {
                        const s = resp.data || resp
                        setStatus(noChanges(s) ? 'No changes to apply' : `Applied: closed ${s.closedCount ?? 0}, grouped ${s.grouped ?? 0}`)
                      } else setStatus('Apply failed')
                    })
                  }}>Apply</button>
                </div>
              </div>
            )}
            <p style={{ fontSize: 12, lineHeight: 1.4 }}>
                This pinned tab manages tab classification, Notion upserts, and cleanup.
            </p>
            <ToastHost />
        </div>
    )
}

const el = document.createElement("div")
document.body.appendChild(el)
createRoot(el).render(<Manager />)
