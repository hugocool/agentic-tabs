import { describe, it, expect, beforeEach } from "vitest"
import { normalizeUrl, upsertSession, loadStore } from "../src/background/local-store"

// Minimal chrome mock
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
        async set(obj: Record<string, any>) {
          Object.assign(bag, obj)
        }
      }
    })()
  }
} as any

describe("local persistence", () => {
  beforeEach(async () => {
    // reset store
    // @ts-ignore
    await chrome.storage.local.set({ sessionStore_v1: { version: 1, sessions: {}, recentIds: [] } })
  })

  it("normalizes URLs predictably", () => {
    expect(normalizeUrl("https://X.com/a?utm_source=foo#frag")).toBe("https://x.com/a")
  })

  it("upserts decisions and recomputes sets", async () => {
    await upsertSession({
      sessionId: "s1",
      decisions: [
        { url: "https://x.com/A?utm_campaign=z#h", decision: "Keep" },
        { url: "https://y.com/p?q=1#t", decision: "Review" },
      ]
    })
    const store = await loadStore()
    const s = store.sessions["s1"]
    expect(s).toBeTruthy()
    expect(s.keepSet).toContain("https://x.com/A")
    expect((s.reviewSet || []).length).toBe(1)
  })
})
