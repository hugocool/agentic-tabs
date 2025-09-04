export type Row = { url?: string; decision?: string; group?: string }

export function deriveCounts(rows: Row[]) {
  const c = { keep: 0, archive: 0, drop: 0, review: 0 }
  for (const r of rows) {
    const d = String(r.decision || "Review").toLowerCase()
    if (d === "keep") c.keep++
    else if (d === "archive") c.archive++
    else if (d === "drop") c.drop++
    else c.review++
  }
  return c
}

export function deriveDomainCounts(rows: Row[]) {
  const dc: Record<string, number> = {}
  for (const r of rows) {
    try { const host = new URL(r.url || "").hostname; if (host) dc[host] = (dc[host] || 0) + 1 } catch {}
  }
  return dc
}

export function noChanges(summary?: { closedCount?: number; grouped?: number }) {
  if (!summary) return false
  return (summary.closedCount || 0) === 0 && (summary.grouped || 0) === 0
}

