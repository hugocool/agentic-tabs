import { logger } from "../shared/logger"
import { err, E, ok, MsgOk, MsgErr } from "../shared/errors"

export async function notionCallSafe<T>(fn: () => Promise<T>): Promise<MsgOk<T> | MsgErr> {
  let attempt = 0
  let delay = 500
  while (attempt < 4) {
    try {
      const data = await fn()
      return ok(data)
    } catch (e: any) {
      const status = e?.status || e?.code || e?.response?.status
      if (status === 429) {
        logger.warn("Notion 429 — backing off", { attempt })
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        attempt++
        continue
      }
      logger.error("Notion call failed", { status, e: String(e?.message || e) })
      return err(E.NOTION_HTTP, e?.message || "Notion error")
    }
  }
  return err(E.NOTION_RATE_LIMIT, "Rate limited by Notion — try again later")
}

