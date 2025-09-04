import { resolveNameToId } from "./notion-search"
import { loadNotionSchema, loadNotionEnv } from "./notion-env"
import { notionCallSafe } from "./notion-wrap"
import { Client } from "@notionhq/client"

export type DecisionRowUI = {
  url?: string
  title?: string
  decision: "Keep"|"Archive"|"Drop"|"Review"
  group?: string
  project?: string | { title: string; id?: string }
  task?: string | { title: string; id?: string }
}

export type ResolvedRow = Omit<DecisionRowUI, "project"|"task"> & {
  projectId?: string
  projectTitle?: string
  taskId?: string
  taskTitle?: string
}

export async function resolveRelations(rows: DecisionRowUI[], opts?: { strict?: boolean }): Promise<ResolvedRow[]> {
  const schema = await loadNotionSchema(); const env = await loadNotionEnv(); if (!schema || !env) {
    return rows.map(r => ({ ...r })) as any
  }
  const strictDefault = schema.options?.strictTitleMatch !== false
  const strict = opts?.strict ?? strictDefault

  // Collect unique names
  const needProjects = new Set<string>()
  const needTasks = new Set<string>()
  for (const r of rows) {
    const p = typeof r.project === 'string' ? r.project : r.project?.title
    const t = typeof r.task === 'string' ? r.task : r.task?.title
    if (p?.trim()) needProjects.add(p.trim())
    if (t?.trim()) needTasks.add(t.trim())
  }
  // Resolve unique names
  const projMap = new Map<string, { id: string, title: string }>()
  const taskMap = new Map<string, { id: string, title: string }>()
  for (const name of needProjects) {
    const m = await resolveNameToId("projects", name, strict)
    if (m.id) projMap.set(name, { id: m.id, title: m.title || name })
  }
  for (const name of needTasks) {
    const m = await resolveNameToId("tasks", name, strict)
    if (m.id) taskMap.set(name, { id: m.id, title: m.title || name })
  }
  // Optional create-if-missing
  const autoCreateProjects = !!schema.options?.autoCreateProjects
  const autoCreateTasks = !!schema.options?.autoCreateTasks
  const notion = new Client({ auth: env.notionToken }) as any
  const createFor = async (kind: "projects"|"tasks", name: string) => {
    const block = kind === "projects" ? schema.projects : schema.tasks
    if (!block?.dbId || !block.titleProp) return
    const props: any = { [block.titleProp]: { title: [{ text: { content: name } }] } }
    if (block.statusProp) props[block.statusProp] = { select: { name: "Active" } }
    const res = await notionCallSafe(() => notion.pages.create({ parent: { database_id: block.dbId }, properties: props }))
    if (res.ok) {
      const id = (res.data as any).id
      if (kind === "projects") projMap.set(name, { id, title: name })
      else taskMap.set(name, { id, title: name })
    }
  }
  if (autoCreateProjects) {
    for (const name of needProjects) if (!projMap.has(name)) await createFor("projects", name)
  }
  if (autoCreateTasks) {
    for (const name of needTasks) if (!taskMap.has(name)) await createFor("tasks", name)
  }
  // Annotate rows
  return rows.map(r => {
    const out: any = { url: r.url, title: r.title, decision: r.decision, group: r.group }
    const p = typeof r.project === 'string' ? r.project : r.project?.title
    const t = typeof r.task === 'string' ? r.task : r.task?.title
    if (p?.trim() && projMap.has(p.trim())) out.projectId = projMap.get(p.trim())!.id
    if (t?.trim() && taskMap.has(t.trim())) out.taskId = taskMap.get(t.trim())!.id
    return out
  })
}
