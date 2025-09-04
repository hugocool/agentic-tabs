export const E = {
  NOTION_CONFIG_MISSING: "NOTION_CONFIG_MISSING",
  NOTION_RATE_LIMIT: "NOTION_RATE_LIMIT",
  NOTION_HTTP: "NOTION_HTTP",
  TRIAGE_FAILED: "TRIAGE_FAILED",
  RESUME_FAILED: "RESUME_FAILED",
  MSG_BAD_ARGS: "MSG_BAD_ARGS",
  UNHANDLED: "UNHANDLED"
} as const

export type MsgOk<T = any> = { ok: true; data?: T }
export type MsgErr = { ok: false; error: { code: string; message: string; details?: any } }

export function err(code: string, message: string, details?: any): MsgErr {
  return { ok: false, error: { code, message, details } }
}

export function ok<T>(data?: T): MsgOk<T> { return { ok: true, data } }

