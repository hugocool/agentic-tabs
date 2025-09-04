import { describe, it, expect } from "vitest"
import { moveAndRetag, columnsOf, overLimit } from "../src/pages/board-utils"

describe("board utils", () => {
  const rows = [
    { url: "u1", decision: "Review" },
    { url: "u2", decision: "Keep" },
    { url: "u3", decision: "Review" }
  ] as any
  it("moves and retags between columns", () => {
    const next = moveAndRetag(rows, rows[0], "Keep", 0)
    expect(next.find(r => r.url === "u1")!.decision).toBe("Keep")
    const cols = columnsOf(next)
    expect(cols.Keep.length).toBe(2)
    expect(cols.Review.length).toBe(1)
  })
  it("overLimit detects warnings", () => {
    expect(overLimit(8, 7)).toBe(true)
    expect(overLimit(7, 7)).toBe(false)
    expect(overLimit(3, undefined)).toBe(false)
  })
})

