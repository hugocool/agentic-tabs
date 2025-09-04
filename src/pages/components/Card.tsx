import React from "react"

export default function Card({ item, selected, onToggle, draggable=true }: { item: any; selected?: boolean; onToggle?: () => void; draggable?: boolean }) {
  const host = (()=>{ try { return new URL(item.url||"").hostname } catch { return "" } })()
  return (
    <div role="option" aria-selected={!!selected}
      draggable={draggable}
      onClick={onToggle}
      style={{ padding: 8, margin: 6, borderRadius: 8, border: "1px solid #eee", background: selected ? "#eef6ff" : "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{item.title || item.url}</div>
      <div style={{ fontSize: 11, opacity: .7 }}>{host}{item.group ? ` · ${item.group}`: ""}</div>
    </div>
  )
}

