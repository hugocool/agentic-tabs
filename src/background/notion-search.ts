import { Client } from "@notionhq/client"
import { loadNotionEnv, loadNotionSchema } from "./notion-env"

type Kind = "projects" | "tasks"

const CACHE_KEY = "notionSearchCache"
const TTL_MS = 10 * 60 * 1000

type Cache = Record<string, { // key: dbId
  byName: Record<string, { id: string; at: number }>
  byId: Record<string, { title: string; at: number }>
}>

async function readCache(): Promise<Cache> {
  const { [CACHE_KEY]: c = {} } = await chrome.storage.session.get(CACHE_KEY)
  return c as Cache
}
async function writeCache(c: Cache) {
  await chrome.storage.session.set({ [CACHE_KEY]: c })
}

export async function searchNotion(kind: Kind, q: string, limit = 6): Promise<{ id: string; title: string }[]> {
  const env = await loadNotionEnv(); const schema = await loadNotionSchema()
  if (!env || !schema) return []
  const dbId = kind === "projects" ? schema.projects?.dbId : schema.tasks?.dbId
  if (!dbId) return []
  const notion = new Client({ auth: env.notionToken }) as any
  const res = await notion.databases.query({ database_id: dbId, page_size: limit, filter: { property: (schema.projects?.titleProp || schema.tasks?.titleProp || "Name"), title: { contains: q } } })
  const items = (res.results || []).map((p: any) => ({ id: p.id, title: p.properties?.[schema.projects?.titleProp || schema.tasks?.titleProp || "Name"]?.title?.[0]?.plain_text || p.id }))
  // update cache
  const cache = await readCache()
  cache[dbId] ||= { byName: {}, byId: {} }
  const now = Date.now()
  for (const it of items) {
    cache[dbId].byName[it.title.toLowerCase()] = { id: it.id, at: now }
    cache[dbId].byId[it.id] = { title: it.title, at: now }
  }
  await writeCache(cache)
  return items
}

export async function resolveNameToId(kind: Kind, name: string, strict = true): Promise<{ id?: string; title?: string }> {
  const schema = await loadNotionSchema(); const env = await loadNotionEnv(); if (!schema || !env) return {}
  const dbId = kind === "projects" ? schema.projects?.dbId : schema.tasks?.dbId
  if (!dbId) return {}
  const titleProp = (kind === "projects" ? schema.projects?.titleProp : schema.tasks?.titleProp) || "Name"
  const cache = await readCache()
  const entry = cache[dbId]?.byName?.[name.toLowerCase()]
  const now = Date.now()
  if (entry && now - entry.at < TTL_MS) return { id: entry.id, title: name }
  // query exact first if strict
  const notion = new Client({ auth: env.notionToken }) as any
  const exact = await notion.databases.query({ database_id: dbId, page_size: 1, filter: { property: titleProp, title: { equals: name } } })
  const hit = exact.results?.[0]
  if (hit) {
    const id = hit.id; const title = hit.properties?.[titleProp]?.title?.[0]?.plain_text || name
    cache[dbId] ||= { byName: {}, byId: {} }
    cache[dbId].byName[name.toLowerCase()] = { id, at: now }
    cache[dbId].byId[id] = { title, at: now }
    await writeCache(cache)
    return { id, title }
  }
  if (strict) return {}
  // fallback contains
  const res = await notion.databases.query({ database_id: dbId, page_size: 1, filter: { property: titleProp, title: { contains: name } } })
  const row = res.results?.[0]
  if (!row) return {}
  const id = row.id; const title = row.properties?.[titleProp]?.title?.[0]?.plain_text || name
  cache[dbId] ||= { byName: {}, byId: {} }
  cache[dbId].byName[name.toLowerCase()] = { id, at: now }
  cache[dbId].byId[id] = { title, at: now }
  await writeCache(cache)
  return { id, title }
}

