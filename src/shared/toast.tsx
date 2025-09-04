import React, { useEffect, useState } from "react"

type Toast = { id: number; text: string; kind?: "info" | "error" }
type Listener = (t: Toast) => void

let counter = 1
const listeners = new Set<Listener>()

export function showToast(text: string, kind: "info" | "error" = "info") {
  const t: Toast = { id: counter++, text, kind }
  listeners.forEach(fn => fn(t))
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const onAdd = (t: Toast) => {
      setItems(prev => [...prev, t])
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), 3000)
    }
    listeners.add(onAdd)
    return () => { listeners.delete(onAdd) }
  }, [])
  return (
    <div style={{ position: "fixed", bottom: 12, right: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 9999 }}>
      {items.map(t => (
        <div key={t.id} style={{ background: t.kind === "error" ? "#ffe6e6" : "#eef6ff", border: "1px solid #ccc", padding: "8px 10px", borderRadius: 6, boxShadow: "0 2px 6px rgba(0,0,0,.08)", fontSize: 12 }}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

