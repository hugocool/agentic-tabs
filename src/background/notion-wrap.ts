import { logger } from "../shared/logger"
import { err, E, ok, MsgOk, MsgErr } from "../shared/errors"
import { applyNotionBackoff, recordNotionError, recordNotionSuccess } from "./notion-backoff"
import { emitToast } from "./toast-bus"

export async function notionCallSafe<T>(fn: () => Promise<T>): Promise<MsgOk<T> | MsgErr> {
  let attempt = 0
  let delay = 400
  while (attempt < 4) {
    try {
      await applyNotionBackoff()
      const data = await fn()
      recordNotionSuccess()
      return ok(data)
    } catch (e: any) {
      const status = e?.status || e?.code || e?.response?.status
      if (status === 429) {
        recordNotionError("rate")
        if (attempt === 0) emitToast("Notion rate limit — retrying", "warn", "notion-429")
        logger.warn("Notion 429 — backing off", { attempt })
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        attempt++
        continue
      }
      if (status >= 500 && status < 600) {
        recordNotionError("server")
        if (attempt === 0) emitToast("Notion temporary error — retrying", "warn", "notion-5xx")
        logger.warn("Notion 5xx — retry", { attempt, status })
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        attempt++
        continue
      }
      logger.error("Notion call failed", { status, e: String(e?.message || e) })
      return err(E.NOTION_HTTP, e?.message || "Notion error")
    }
  }
  emitToast("Notion rate limited — will pause operations", "error", "notion-rl-final", 10000)
  return err(E.NOTION_RATE_LIMIT, "Rate limited by Notion — try again later")
}

