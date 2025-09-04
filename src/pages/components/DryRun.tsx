import React from "react"
import { buildResourceProperties } from "../../background/notion-writer"
import type { NotionSchemaMap } from "../../background/notion-env"

type Props = { schema: NotionSchemaMap; sample: { url: string; title?: string; decision?: any; group?: string } }

export default function DryRun({ schema, sample }: Props) {
  if (!schema?.resources) return null
  const props = buildResourceProperties({
    url: sample.url,
    title: sample.title,
    decision: (sample.decision || "Keep") as any,
    group: sample.group
  } as any, schema.resources)
  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 6 }}>Dry‑run properties (Resources)</div>
      <pre style={{ fontSize: 11, background: "#fafafa", padding: 8, border: "1px solid #eee", borderRadius: 6 }}>{JSON.stringify(props, null, 2)}</pre>
    </div>
  )
}

