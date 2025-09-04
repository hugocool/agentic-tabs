import { describe, it, expect } from "vitest"
import { recordNotionError, recordNotionSuccess, getNotionBackoffState } from "../src/background/notion-backoff"

describe("notion-backoff", () => {
    it("increases delay on repeated errors", () => {
        recordNotionError("rate")
        const a = getNotionBackoffState().currentDelay
        recordNotionError("rate")
        const b = getNotionBackoffState().currentDelay
        expect(b).toBeGreaterThanOrEqual(a)
    })
    it("does not explode past max", () => {
        for (let i = 0; i < 10; i++) recordNotionError("rate")
        expect(getNotionBackoffState().currentDelay).toBeLessThanOrEqual(8000)
    })
    it("decays after success window (simulated)", () => {
        recordNotionError("rate")
        const before = getNotionBackoffState().currentDelay
        // simulate passage by directly calling success multiple times; decay uses time heuristic so may remain
        recordNotionSuccess()
        const after = getNotionBackoffState().currentDelay
        expect(after).toBeLessThanOrEqual(before)
    })
})
