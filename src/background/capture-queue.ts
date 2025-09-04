import { upsertNotion } from "./notion"

type QItem = { ts: number; rows: Array<{ url: string; title?: string; decision: "Keep"; group?: string; project?: any; task?: any }> }

const KEY = "captureQueue_v1"
const MAX_AGE = 7 * 24 * 60 * 60 * 1000

export async function enqueue(rows: QItem["rows"]) {
  const { [KEY]: q = [] } = await chrome.storage.local.get(KEY)
  q.push({ ts: Date.now(), rows })
  await chrome.storage.local.set({ [KEY]: q })
}

export async function drainQueue() {
  const now = Date.now()
  const bag = await chrome.storage.local.get(KEY)
  let q: QItem[] = bag[KEY] || []
  // drop expired
  q = q.filter(it => now - it.ts < MAX_AGE)
  if (!q.length) { await chrome.storage.local.set({ [KEY]: q }); return }
  const head = q[0]
  try {
    await upsertNotion({ sessionId: "quick", decisions: head.rows as any })
    q.shift()
    await chrome.storage.local.set({ [KEY]: q })
    if (q.length) setTimeout(drainQueue, 2000)
  } catch {
    // leave queue intact; try later
  }
}

