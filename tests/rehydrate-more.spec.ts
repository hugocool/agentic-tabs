import { describe, it, expect, beforeEach, vi } from "vitest"
import { rehydrateFromOpenTabs, upsertSession, listSessionsForNTP, loadStore } from "../src/background/local-store"

// chrome mock with session + tabs
// @ts-ignore
global.chrome = {
  storage: {
    local: (() => {
      const bag: Record<string, any> = {}
      return {
        async get(keys?: any) {
          if (!keys) return { ...bag }
          if (typeof keys === "string") return { [keys]: bag[keys] }
          const out: Record<string, any> = {}
          for (const k of keys) out[k] = bag[k]
          return out
        },
        async set(obj: Record<string, any>) { Object.assign(bag, obj) },
        async remove(key: string) { delete bag[key] }
      }
    })(),
    session: (() => {
      const bag: Record<string, any> = {}
      return {
        async get(keys?: any) {
          if (!keys) return { ...bag }
          if (typeof keys === "string") return { [keys]: bag[keys] }
          const out: Record<string, any> = {}
          for (const k of keys) out[k] = bag[k]
          return out
        },
        async set(obj: Record<string, any>) { Object.assign(bag, obj) },
        async remove(key: string) { delete bag[key] }
      }
    })()
  },
  tabs: {
    async query() { return [] as any[] }
  },
  runtime: {
    getURL: (p: string) => `chrome-extension://id/${p}`
  }
} as any

describe("rehydration tie-breaks and thresholds", () => {
  beforeEach(async () => {
    // reset stores
    // @ts-ignore
    await chrome.storage.local.set({ sessionStore_v1: { version: 1, sessions: {}, recentIds: [] } })
    // @ts-ignore
    await chrome.storage.session.set({ sessionMap: {} })
  })

  it("tie-breaks by recency when scores equal", async () => {
    await upsertSession({ sessionId: "A", decisions: [
      { url: "https://t.com/one", decision: "Keep" },
      { url: "https://t.com/two", decision: "Keep" },
    ]})
    // small delay to ensure later lastActiveAt
    await new Promise(r => setTimeout(r, 10))
    await upsertSession({ sessionId: "B", decisions: [
      { url: "https://t.com/one", decision: "Keep" },
      { url: "https://t.com/two", decision: "Keep" },
    ]})
    // window has same overlap for both
    // @ts-ignore
    chrome.tabs.query = async () => ([
      { url: "https://t.com/one", windowId: 1 },
      { url: "https://t.com/two", windowId: 1 },
    ]) as any
    const summary = await rehydrateFromOpenTabs()
    expect(summary.windowsAttached).toBe(1)
    // @ts-ignore
    const { sessionMap } = await chrome.storage.session.get("sessionMap")
    expect(sessionMap["B"]).toContain(1)
  })

  it("below threshold or min matches leaves window unattached", async () => {
    await upsertSession({ sessionId: "A", decisions: [
      { url: "https://site.com/a", decision: "Keep" }
    ]})
    // @ts-ignore
    chrome.tabs.query = async () => ([
      { url: "https://site.com/a", windowId: 1 },
    ]) as any
    const summary = await rehydrateFromOpenTabs()
    expect(summary.windowsAttached).toBe(0)
    // @ts-ignore
    const { sessionMap } = await chrome.storage.session.get("sessionMap")
    expect(Object.keys(sessionMap || {}).length).toBe(0)
  })

  it("GET_SESSIONS returns counts and MRU ordering", async () => {
    await upsertSession({ sessionId: "s1", decisions: [
      { url: "https://a.com/1", decision: "Keep" },
      { url: "https://a.com/2", decision: "Archive" },
      { url: "https://a.com/3", decision: "Review" },
      { url: "https://a.com/4", decision: "Drop" },
    ]})
    await upsertSession({ sessionId: "s2", decisions: [
      { url: "https://b.com/1", decision: "Keep" },
    ]})
    const rows = await listSessionsForNTP(10)
    expect(rows[0].id).toBe("s2") // MRU
    const s1 = rows.find(r => r.id === "s1")!
    expect(s1.counts.keep).toBe(1)
    expect(s1.counts.archive).toBe(1)
    expect(s1.counts.review).toBe(1)
    expect(s1.counts.drop).toBe(1)
  })
})

