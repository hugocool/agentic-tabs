import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { loadOptions, saveOptions, resetOptions, testNotionConnection } from "./options-logic"
import { ToastHost, showToast } from "./shared/toast"

function Options() {
  const [form, setForm] = useState({
    notionToken: "",
    resourcesDbId: "",
    sessionsDbId: "",
    projectsDbId: "",
    tasksDbId: ""
  })
  const [status, setStatus] = useState<string>("")

  useEffect(() => {
    loadOptions().then(v => setForm(f => ({ ...f, ...v } as any)))
  }, [])
  useEffect(() => {
    const listener = (msg: any) => { if (msg?.type === "TOAST") showToast(msg.text, msg.kind === "error" ? "error" : "info") }
    chrome.runtime.onMessage.addListener(listener)
    return () => { chrome.runtime.onMessage.removeListener(listener) }
  }, [])

  const onSave = async () => {
    await saveOptions(form)
    setStatus("Saved.")
  }

  const onReset = async () => {
    await resetOptions()
    setForm({ notionToken: "", resourcesDbId: "", sessionsDbId: "", projectsDbId: "", tasksDbId: "" })
    setStatus("Cleared.")
  }

  const onTest = async () => {
    setStatus("Testing...")
    const res = await testNotionConnection({ notionToken: form.notionToken, resourcesDbId: form.resourcesDbId })
    if (res.ok) setStatus(`OK — sample: ${res.sample.join(", ") || "no titles"}`)
    else setStatus(`Error: ${res.error}`)
  }

  const input = (label: string, key: keyof typeof form, type: string = "text") => (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 8 }}>
      <label style={{ fontSize: 12, marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={(form as any)[key] || ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value } as any)}
        style={{ padding: 6, borderRadius: 6, border: "1px solid #ccc", fontFamily: "inherit" }}
      />
    </div>
  )

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 720 }}>
      <h2>Agentic Tabs · Options</h2>
      {input("Notion token", "notionToken", "password")}
      {input("Resources DB ID", "resourcesDbId")}
      {input("Sessions DB ID", "sessionsDbId")}
      <details>
        <summary>Advanced (optional)</summary>
        {input("Projects DB ID", "projectsDbId")}
        {input("Tasks DB ID", "tasksDbId")}
      </details>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={onSave}>Save</button>
        <button onClick={onTest}>Test connection</button>
        <button onClick={onReset}>Reset</button>
        <button onClick={async () => { const url = chrome.runtime.getURL("pages/options-wizard.html"); await chrome.tabs.create({ url }) }}>Open Setup Wizard</button>
      </div>
      {status && <div style={{ marginTop: 8, fontSize: 12 }}>{status}</div>}
      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
        Create an internal integration and share your databases to grant access.
        See Notion documentation for setup steps.
      </p>
      <ToastHost />
    </div>
  )
}

const root = document.createElement("div")
document.body.appendChild(root)
createRoot(root).render(<Options />)
