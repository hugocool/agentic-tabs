import { resolveNameToId } from "./notion-search"
import { loadNotionSchema, loadNotionEnv } from "./notion-env"

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

export async function resolveRelations(rows: DecisionRowUI[], opts?: { createIfMissing?: { projects?: boolean; tasks?: boolean }, strict?: boolean }): Promise<ResolvedRow[]> {
  const schema = await loadNotionSchema(); const env = await loadNotionEnv(); if (!schema || !env) {
    // passthrough when schema/env missing
    return rows.map(r => ({ ...r })) as any
  }
  const strict = opts?.strict !== false
  const out: ResolvedRow[] = []
  for (const r of rows) {
    const o: ResolvedRow = { url: r.url, title: r.title, decision: r.decision, group: r.group }
    // project
    if (r.project && typeof r.project === 'object') {
      if (r.project.id) { o.projectId = r.project.id; o.projectTitle = r.project.title }
      else if (r.project.title) {
        const m = await resolveNameToId("projects", r.project.title, strict)
        if (m.id) { o.projectId = m.id; o.projectTitle = m.title }
      }
    } else if (typeof r.project === 'string' && r.project.trim()) {
      const m = await resolveNameToId("projects", r.project.trim(), strict)
      if (m.id) { o.projectId = m.id; o.projectTitle = m.title }
    }
    // task
    if (r.task && typeof r.task === 'object') {
      if (r.task.id) { o.taskId = r.task.id; o.taskTitle = r.task.title }
      else if (r.task.title) {
        const m = await resolveNameToId("tasks", r.task.title, strict)
        if (m.id) { o.taskId = m.id; o.taskTitle = m.title }
      }
    } else if (typeof r.task === 'string' && r.task.trim()) {
      const m = await resolveNameToId("tasks", r.task.trim(), strict)
      if (m.id) { o.taskId = m.id; o.taskTitle = m.title }
    }
    out.push(o)
  }
  return out
}

