import React, { useEffect, useMemo, useState } from "react"
import { Client } from "@notionhq/client"

type Props = { token: string; value?: string; onChange: (id: string) => void }

export default function DbPicker({ token, value, onChange }: Props) {
  const [q, setQ] = useState("")
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!token) return
      setLoading(true)
      try {
        const notion = new Client({ auth: token }) as any
        const res = await notion.search({ filter: { property: "object", value: "database" }, query: q, page_size: 25 })
        setItems(res.results || [])
      } catch { /* ignore */ }
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q, token])

  const labelFor = (db: any) => db?.title?.[0]?.plain_text || db?.id

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input placeholder="Search databases…" value={q} onChange={e => setQ(e.target.value)} />
      <select value={value || ""} onChange={e => onChange(e.target.value)}>
        <option value="">(pick database)</option>
        {items.map((d: any) => (
          <option key={d.id} value={d.id}>{labelFor(d)}</option>
        ))}
      </select>
      {loading && <div style={{ fontSize: 11, opacity: .7 }}>Loading…</div>}
    </div>
  )
}

