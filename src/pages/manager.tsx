import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { openOptionsPage } from "../options-logic"
import { startSession, previewTriage, applyDecisionsMsg, resumeSessionMsg, listWindowsMsg, attachHereMsg, detachWindowMsg } from "../background/session-client"

function Manager() {
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [running, setRunning] = useState(false)
    const [status, setStatus] = useState<string>("")
    const [preview, setPreview] = useState<{ id: string, rows: any[] } | null>(null)
    const [attached, setAttached] = useState<number[]>([])

    useEffect(() => { startSession().then(r => r.sessionId && setSessionId(r.sessionId)) }, [])
    useEffect(() => { if (sessionId) listWindowsMsg(sessionId).then(r => setAttached(r?.data?.windowIds || r?.windowIds || [])) }, [sessionId])

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
              <button disabled={!sessionId} onClick={async ()=>{ if (!sessionId) return; await attachHereMsg(sessionId); const w = await listWindowsMsg(sessionId); setAttached(w?.data?.windowIds || w?.windowIds || []) }}>Attach this window</button>
              <button disabled={!sessionId} onClick={async ()=>{ if (!sessionId) return; const w = await chrome.windows.getCurrent(); await detachWindowMsg(sessionId, w.id!); const r = await listWindowsMsg(sessionId); setAttached(r?.data?.windowIds || r?.windowIds || []) }} style={{ marginLeft: 8 }}>Detach this window</button>
            </div>
            {!!attached.length && (
              <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                {attached.map(wid => (
                  <li key={wid}>
                    Window {wid} &nbsp;
                    <button onClick={async ()=>{ try { await chrome.windows.update(wid, { focused: true }) } catch {} }}>Focus</button>
                    <button onClick={async ()=>{ if (!sessionId) return; await detachWindowMsg(sessionId, wid); const r = await listWindowsMsg(sessionId); setAttached(r?.data?.windowIds || r?.windowIds || []) }} style={{ marginLeft: 6 }}>Detach</button>
                  </li>
                ))}
              </ul>
            )}
            <hr />
            {preview && (
                <div style={{ fontSize: 12 }}>
                    <div style={{ marginBottom: 8 }}>Preview ({preview.rows.length})</div>
                    <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid #eee" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: "left", padding: 4 }}>Title</th>
                                    <th style={{ textAlign: "left", padding: 4 }}>Decision</th>
                                    <th style={{ textAlign: "left", padding: 4 }}>Group</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.rows.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ padding: 4, maxWidth: 160, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{r.title || r.url}</td>
                                        <td style={{ padding: 4 }}>
                                            <select value={r.decision} onChange={e => setPreview(p => p && { ...p, rows: p.rows.map((x, j) => j === i ? { ...x, decision: e.target.value } : x) })}>
                                                {['Keep', 'Archive', 'Drop', 'Review'].map(x => <option key={x} value={x}>{x}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: 4 }}>
                                            <input value={r.group || ''} onChange={e => setPreview(p => p && { ...p, rows: p.rows.map((x, j) => j === i ? { ...x, group: e.target.value } : x) })} style={{ width: 120 }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button disabled={running} onClick={() => applyDecisionsMsg(sessionId!, preview.id, preview.rows).then(resp => setStatus(resp?.ok ? `Applied: closed ${resp.data?.closedCount ?? 0}` : "Apply failed"))}>Apply</button>
                    </div>
                </div>
            )}
            <p style={{ fontSize: 12, lineHeight: 1.4 }}>
                This pinned tab manages tab classification, Notion upserts, and cleanup.
            </p>
        </div>
    )
}

const el = document.createElement("div")
document.body.appendChild(el)
createRoot(el).render(<Manager />)
