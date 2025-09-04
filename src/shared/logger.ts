export type Level = "debug" | "info" | "warn" | "error"
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const ENV_LEVEL = (typeof process !== "undefined" && (process as any)?.env?.NODE_ENV) ? (process as any).env.NODE_ENV : undefined
const CURRENT: Level = (ENV_LEVEL === "production" ? "info" : "debug")

export function log(level: Level, msg: string, meta?: Record<string, any>) {
  if (ORDER[level] < ORDER[CURRENT]) return
  const payload = meta ? { ...meta } : ""
  const fn = (console as any)[level] || console.log
  try { fn(`[${level.toUpperCase()}] ${msg}`, payload) } catch { /* no-op */ }
}

export const logger = {
  debug: (m: string, meta?: any) => log("debug", m, meta),
  info:  (m: string, meta?: any) => log("info",  m, meta),
  warn:  (m: string, meta?: any) => log("warn",  m, meta),
  error: (m: string, meta?: any) => log("error", m, meta)
}

