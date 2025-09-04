import React from "react"

export default function WipBadge({ count, limit }: { count: number; limit?: number }) {
  if (!limit) return <span style={{ fontSize: 11, opacity: .7 }}> {count}</span>
  const over = count > limit
  return (
    <span title={over ? `Over WIP limit (${count}/${limit})` : `${count}/${limit}`}
      style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 10, fontSize: 10, color: over ? "#8a2a0a" : "#0b6b0b", background: over ? "#ffe8dd" : "#e6f4e6", border: `1px solid ${over ? "#ffb89c" : "#cde3cd"}` }}>
      {count}/{limit}{over ? " OVER" : ""}
    </span>
  )
}

