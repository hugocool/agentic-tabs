import { describe, it, expect, beforeEach } from "vitest"
import { normalizeUrl, upsertSession, loadStore } from "../src/background/local-store"
import { installChromeMock, resetSessionStore } from "./test-helpers"

installChromeMock({ withSession: false })

describe("local persistence", () => {
  beforeEach(async () => { await resetSessionStore() })

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
