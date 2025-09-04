import type { NotionSchemaMap } from "./notion-env"

export type DecisionRow = {
  url?: string
  title?: string
  decision: "Keep" | "Archive" | "Drop" | "Review"
  group?: string
  project?: string
  task?: string
  projectId?: string
  taskId?: string
}

export function buildResourceProperties(d: DecisionRow, m: NotionSchemaMap["resources"]) {
  const props: any = {}
  if (m.titleProp) props[m.titleProp] = { title: [{ text: { content: d.title || d.url! } }] }
  if (m.urlProp && d.url) props[m.urlProp] = { url: d.url }
  if (m.statusProp && d.decision) props[m.statusProp] = { select: { name: d.decision === "Archive" ? "Reference" : "Active" } }
  if (m.decisionProp && d.decision) props[m.decisionProp] = { select: { name: d.decision } }
  if (m.groupProp && d.group) props[m.groupProp] = { rich_text: [{ text: { content: d.group } }] }
  // Relations optional; will be populated in future tickets
  return props
}

export function mergeRelation(arr: any[] | undefined, id: string) {
  const set = new Set((arr || []).map((x: any) => x?.id).filter(Boolean))
  set.add(id)
  return Array.from(set).map(id => ({ id }))
}

