import { Client } from "@notionhq/client"

export type OptionsShape = {
  notionToken: string
  resourcesDbId: string
  sessionsDbId: string
  projectsDbId?: string
  tasksDbId?: string
}

const KEYS = ["notionToken", "resourcesDbId", "sessionsDbId", "projectsDbId", "tasksDbId"] as const

export async function loadOptions(): Promise<Partial<OptionsShape>> {
  const bag = await chrome.storage.local.get([...KEYS])
  const out: Partial<OptionsShape> = {}
  for (const k of KEYS) if (bag[k]) (out as any)[k] = bag[k]
  return out
}

export async function saveOptions(form: Partial<OptionsShape>): Promise<void> {
  await chrome.storage.local.set(form)
}

export async function resetOptions(): Promise<void> {
  await chrome.storage.local.remove([...KEYS])
}

export async function testNotionConnection(opts: { notionToken: string; resourcesDbId: string }): Promise<{ ok: true; sample: string[] } | { ok: false; error: string }> {
  try {
    const notion = new Client({ auth: opts.notionToken })
    const res = await notion.databases.query({ database_id: opts.resourcesDbId, page_size: 3 })
    const names = (res.results as any[])
      .slice(0, 3)
      .map((p: any) => p?.properties?.Name?.title?.[0]?.plain_text)
      .filter(Boolean)
    return { ok: true, sample: names }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed" }
  }
}

export async function openOptionsPage() {
  try { await chrome.runtime.openOptionsPage() } catch {}
}

