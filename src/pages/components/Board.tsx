import React, { useMemo, useState } from "react"
import Column from "./Column"
import { moveAndRetag, columnsOf, type Row } from "../board-utils"
import WipBadge from "./WipBadge"

export default function Board({ preview, onChangeRows, wip }:{ preview: { id: string, rows: Row[] }; onChangeRows: (rows: Row[])=>void; wip: { keep: number, review: number } }){
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const cols = useMemo(()=>columnsOf(preview.rows), [preview.rows])
  const overKeep = cols.Keep.length > (wip?.keep ?? 7)
  const overReview = cols.Review.length > (wip?.review ?? 10)

  const toggle = (url: string) => setSelected(s => { const n = new Set(s); n.has(url)? n.delete(url): n.add(url); return n })
  const dropTo = (decision: "Keep"|"Review"|"Archive"|"Drop") => (card: Row, index: number) => {
    const next = moveAndRetag(preview.rows, card, decision, index)
    onChangeRows(next)
  }

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Board <WipBadge count={cols.Keep.length} limit={wip?.keep} /> <WipBadge count={cols.Review.length} limit={wip?.review} /></div>
      <div style={{ display: "flex", gap: 8 }}>
        <Column id="Keep" title="Keep" items={cols.Keep} wipLimit={wip?.keep} overLimit={overKeep} selected={selected} onToggle={toggle} onDrop={dropTo("Keep")} />
        <Column id="Review" title="Review" items={cols.Review} wipLimit={wip?.review} overLimit={overReview} selected={selected} onToggle={toggle} onDrop={dropTo("Review")} />
        <Column id="Archive" title="Archive" items={cols.Archive} selected={selected} onToggle={toggle} onDrop={dropTo("Archive")} />
        <Column id="Drop" title="Drop" items={cols.Drop} selected={selected} onToggle={toggle} onDrop={dropTo("Drop")} />
      </div>
    </div>
  )
}
