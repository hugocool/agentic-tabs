import { describe, it, expect, beforeEach } from "vitest"
import { rehydrateFromOpenTabs, upsertSession } from "../src/background/local-store"

// Minimal chrome mock for storage.session + tabs
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
        async set(obj: Record<string, any>) { Object.assign(bag, obj) }
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
        async set(obj: Record<string, any>) { Object.assign(bag, obj) }
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

describe("rehydration", () => {
  beforeEach(async () => {
    // reset stores
    // @ts-ignore
    await chrome.storage.local.set({ sessionStore_v1: { version: 1, sessions: {}, recentIds: [] } })
    // @ts-ignore
    await chrome.storage.session.set({ sessionMap: {} })
  })

  it("attaches window to best session with overlap", async () => {
    await upsertSession({ sessionId: "A", decisions: [
      { url: "https://site.com/a", decision: "Keep" },
      { url: "https://site.com/b", decision: "Keep" },
      { url: "https://site.com/c", decision: "Review" },
    ]})
    await upsertSession({ sessionId: "B", decisions: [
      { url: "https://other.com/x", decision: "Keep" }
    ]})
    // @ts-ignore
    chrome.tabs.query = async () => ([
      { url: "https://site.com/a", windowId: 1 },
      { url: "https://site.com/c", windowId: 1 },
      { url: chrome.runtime.getURL("pages/manager.html"), windowId: 1 },
    ]) as any
    const summary = await rehydrateFromOpenTabs()
    expect(summary.windowsAttached).toBe(1)
    // @ts-ignore
    const { sessionMap } = await chrome.storage.session.get("sessionMap")
    expect(sessionMap["A"]).toContain(1)
  })
})

