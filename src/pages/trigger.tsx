import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

function Trigger() {
  const [msg, setMsg] = useState("Running…")
  useEffect(() => {
    (async () => {
      try {
        const cmd = new URLSearchParams(location.search).get("cmd") || ""
        if (!cmd) throw new Error("Missing cmd")
        chrome.runtime.sendMessage({ type: "RUN_COMMAND", command: cmd }, (resp) => {
          if (resp?.ok) {
            window.close()
          } else {
            setMsg(`Command failed: ${resp?.error?.message || "Unknown"}`)
          }
        })
      } catch (e: any) {
        setMsg(`Error: ${e?.message || e}`)
      }
    })()
  }, [])
  return <div style={{ fontFamily: "system-ui", padding: 12, fontSize: 12 }}>{msg}</div>
}

const root = document.createElement("div")
document.body.appendChild(root)
createRoot(root).render(<Trigger />)

