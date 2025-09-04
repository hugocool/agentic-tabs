export type Decision = "Keep"|"Review"|"Archive"|"Drop"
export type Row = { url?: string; title?: string; decision: Decision; group?: string }

export function moveAndRetag(rows: Row[], card: Row, toDecision: Decision, toIndex: number): Row[] {
  const idx = rows.findIndex(r => r.url === card.url)
  if (idx < 0) return rows
  const copy = rows.slice()
  const [it] = copy.splice(idx, 1)
  it.decision = toDecision
  const siblings = copy.filter(r => r.decision === toDecision)
  const anchor = Math.min(Math.max(toIndex, 0), siblings.length)
  // find insertion index in full list before next different decision block
  let ins = 0, seen = 0
  for (let i=0;i<copy.length;i++){
    if (copy[i].decision !== toDecision) continue
    if (seen === anchor){ ins = i; break }
    seen++
    ins = i+1
  }
  copy.splice(ins, 0, it)
  return copy
}

export function columnsOf(rows: Row[]) {
  return {
    Keep: rows.filter(r => r.decision === "Keep"),
    Review: rows.filter(r => r.decision === "Review"),
    Archive: rows.filter(r => r.decision === "Archive"),
    Drop: rows.filter(r => r.decision === "Drop")
  }
}

export function overLimit(count: number, limit?: number) { return !!limit && count > limit }

