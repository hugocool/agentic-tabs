import { v4 as uuid } from "uuid"

type DecisionRow = {
  url?: string
  title?: string
  decision: "Keep" | "Archive" | "Drop" | "Review"
  group?: string
  project?: string
  task?: string
}

type PreviewRecord = {
  sessionId: string
  decisions: DecisionRow[]
  hash: string
  createdAt: string
}

const KEY = "previewCache"

export function stableHash(obj: any): string {
  const s = JSON.stringify(obj, Object.keys(obj).sort())
  // simple 32-bit hash
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return (h >>> 0).toString(16)
}

export async function savePreview(sessionId: string, decisions: DecisionRow[]) {
  const { [KEY]: bag = {} } = await chrome.storage.session.get(KEY)
  const previewId = uuid()
  const hash = stableHash(decisions)
  const rec: PreviewRecord = { sessionId, decisions, hash, createdAt: new Date().toISOString() }
  bag[previewId] = rec
  await chrome.storage.session.set({ [KEY]: bag })
  return { previewId, hash }
}

export async function getPreview(previewId: string): Promise<PreviewRecord | null> {
  const { [KEY]: bag = {} } = await chrome.storage.session.get(KEY)
  return bag?.[previewId] || null
}

export async function setLastApplied(sessionId: string, hash: string) {
  const k = "lastApplied"
  const { [k]: m = {} } = await chrome.storage.session.get(k)
  m[sessionId] = { hash, at: Date.now() }
  await chrome.storage.session.set({ [k]: m })
}

export async function getLastApplied(sessionId: string): Promise<string | null> {
  const k = "lastApplied"
  const { [k]: m = {} } = await chrome.storage.session.get(k)
  return m?.[sessionId]?.hash || null
}

