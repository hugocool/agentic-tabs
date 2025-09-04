import React from "react"

type Role = { key: string; label: string; kind: string }

type Props = {
  props: Record<string, { type: string }>
  roles: Role[]
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
  errors?: Record<string, string>
}

const badgeStyle: React.CSSProperties = { padding: "2px 6px", border: "1px solid #ddd", borderRadius: 6, fontSize: 10, marginLeft: 6 }

export default function PropMapper({ props, roles, value, onChange, errors }: Props) {
  const entries = Object.entries(props)
  const optsByKind = (kind: string) => entries.filter(([_, v]) => v.type === kind || (kind === "select" && (v.type === "select" || v.type === "multi_select")))
  const set = (k: string, v: string) => onChange({ ...value, [k]: v })
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8, alignItems: "center" }}>
      {roles.map(r => (
        <React.Fragment key={r.key}>
          <div>{r.label} <span style={badgeStyle}>{r.kind}</span>{errors?.[r.key] && <span style={{ color: "#c00", marginLeft: 6, fontSize: 11 }}>{errors[r.key]}</span>}</div>
          <select value={value[r.key] || ""} onChange={e => set(r.key, e.target.value)}>
            <option value="">(none)</option>
            {optsByKind(r.kind).map(([name, def]) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </React.Fragment>
      ))}
    </div>
  )
}

