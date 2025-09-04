import React, { useRef } from "react"
import Card from "./Card"
import WipBadge from "./WipBadge"

export default function Column({ id, title, items, wipLimit, overLimit, selected, onToggle, onDrop }:{
  id: string
  title: string
  items: any[]
  wipLimit?: number
  overLimit?: boolean
  selected: Set<string>
  onToggle: (url: string) => void
  onDrop: (item: any, index: number) => void
}){
  const ref = useRef<HTMLDivElement>(null)
  const onDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const onDropHere = (e: React.DragEvent) => {
    e.preventDefault()
    const payload = e.dataTransfer.getData("text/plain")
    if (!payload) return
    const item = JSON.parse(payload)
    onDrop(item, items.length)
  }
  return (
    <div role="listbox" aria-label={title} ref={ref}
      onDragOver={onDragOver} onDrop={onDropHere}
      style={{ flex: 1, minWidth: 220, border: "1px solid #eee", borderRadius: 8, background: "#fafafa", display: "flex", flexDirection: "column", maxHeight: 380 }}>
      <div style={{ padding: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", background: overLimit ? "#fff4e8" : "#fff" }}>
        <span>{title}</span>
        <WipBadge count={items.length} limit={wipLimit} />
      </div>
      <div style={{ overflow: "auto", paddingBottom: 6 }}>
        {items.map((it, i) => (
          <div key={it.url}
            draggable
            onDragStart={(e)=>{ e.dataTransfer.setData("text/plain", JSON.stringify(it)) }}
          >
            <Card item={it} selected={selected.has(it.url)} onToggle={()=>onToggle(it.url)} />
          </div>
        ))}
      </div>
    </div>
  )
}
