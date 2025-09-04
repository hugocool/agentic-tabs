import { describe, it, expect } from "vitest"
import { canonicalizeUrl, computeToOpen } from "../src/background/local-store"

describe("resume utils", () => {
  it("canonicalizeUrl drops hash and trailing slash", () => {
    expect(canonicalizeUrl("https://a.com/path#frag/")).toBe("https://a.com/path")
    expect(canonicalizeUrl("https://a.com/"))
      .toBe("https://a.com/")
  })

  it("computeToOpen diffs wanted vs alreadyOpen", () => {
    const decisions = [
      { url: "https://ex.com/a", decision: "Keep" },
      { url: "https://ex.com/b?utm_source=x", decision: "Keep" },
      { url: "https://ex.com/c", decision: "Archive" },
      { url: "https://ex.com/d", decision: "Drop" }
    ] as any
    const already = new Set(["https://ex.com/a"].map(x => x))
    const toOpenKeep = computeToOpen({ decisions, alreadyOpen: already })
    expect(toOpenKeep).toContain("https://ex.com/b")
    expect(toOpenKeep).not.toContain("https://ex.com/a")

    const toOpenBoth = computeToOpen({ decisions, includeArchive: true, alreadyOpen: already })
    expect(toOpenBoth.find(u => u.startsWith("https://ex.com/c"))).toBeTruthy()
  })
})

