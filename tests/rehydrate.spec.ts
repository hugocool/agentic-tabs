import { describe, it, expect, beforeEach } from "vitest"
import { rehydrateFromOpenTabs, upsertSession } from "../src/background/local-store"
import { installChromeMock, resetSessionStore } from "./test-helpers"

const { sessionBag } = installChromeMock({ withSession: true })

describe("rehydration", () => {
  beforeEach(async () => { await resetSessionStore(); sessionBag["sessionMap"] = {} })

  it("attaches window to best session with overlap", async () => {
    await upsertSession({
      sessionId: "A", decisions: [
        { url: "https://site.com/a", decision: "Keep" },
        { url: "https://site.com/b", decision: "Keep" },
        { url: "https://site.com/c", decision: "Review" },
      ]
    })
    await upsertSession({
      sessionId: "B", decisions: [
        { url: "https://other.com/x", decision: "Keep" }
      ]
    })
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

