import { describe, it, expect } from "vitest"
import { deriveCounts, deriveDomainCounts, noChanges } from "../src/pages/preview-utils"

describe("preview utils", () => {
  it("derives counts from rows", () => {
    const rows = [
      { decision: "Keep" }, { decision: "Keep" },
      { decision: "Archive" }, { decision: "Drop" },
      { decision: "Review" }, { decision: undefined as any }
    ]
    const c = deriveCounts(rows as any)
    expect(c.keep).toBe(2); expect(c.archive).toBe(1); expect(c.drop).toBe(1); expect(c.review).toBe(2)
  })

  it("derives domain counts defensively", () => {
    const rows = [ { url: "https://a.com/x" }, { url: "https://a.com/y" }, { url: "https://b.com/" }, { url: "bad-url" } ]
    const d = deriveDomainCounts(rows as any)
    expect(d["a.com"]).toBe(2)
    expect(d["b.com"]).toBe(1)
  })

  it("detects no changes summary", () => {
    expect(noChanges({ closedCount: 0, grouped: 0 })).toBe(true)
    expect(noChanges({ closedCount: 1 })).toBe(false)
  })
})

