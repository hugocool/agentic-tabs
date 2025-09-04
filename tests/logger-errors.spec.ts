import { describe, it, expect, vi, beforeEach } from "vitest"
import { logger, log } from "../src/shared/logger"
import { ok, err, E } from "../src/shared/errors"
import { notionCallSafe } from "../src/background/notion-wrap"

describe("logger + errors", () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => { })
    vi.spyOn(console, 'info').mockImplementation(() => { })
    vi.spyOn(console, 'warn').mockImplementation(() => { })
    vi.spyOn(console, 'error').mockImplementation(() => { })
  })

  it("ok/err shapes are consistent", () => {
    const a = ok({ x: 1 })
    expect(a.ok).toBe(true)
    const b = err(E.MSG_BAD_ARGS, "nope")
    expect(b.ok).toBe(false)
    expect(b.error.code).toBe(E.MSG_BAD_ARGS)
  })

  it("notionCallSafe retries 429 then returns ok", async () => {
    vi.useFakeTimers()
    let calls = 0
    const fn = async () => {
      calls++
      if (calls < 3) {
        const e: any = new Error("rate")
        e.status = 429
        throw e
      }
      return { ok: true }
    }
    const promise = notionCallSafe(fn)
    // Flush queued timers until promise resolves
    for (let i = 0; i < 10 && calls < 3; i++) {
      vi.advanceTimersByTime(5000)
      // allow microtasks
      await Promise.resolve()
    }
    const res = await promise
    expect(calls).toBe(3)
    expect((res as any).ok).toBe(true)
    vi.useRealTimers()
  }, 15000)
})

