export function startSession(): Promise<{ sessionId?: string }> {
  return new Promise(res => chrome.runtime.sendMessage({ type: "START_SESSION" }, res))
}
export function runTriage(sessionId: string): Promise<any> {
  return new Promise(res => chrome.runtime.sendMessage({ type: "RUN_TRIAGE", sessionId }, res))
}
export function resumeSessionMsg(sessionId: string, mode: "reuse" | "newWindow" = "reuse", open: "keep" | "keep+archive" = "keep"): Promise<any> {
  return new Promise(res => chrome.runtime.sendMessage({ type: "RESUME_SESSION", sessionId, mode, open }, res))
}
export function listSessions(limit = 5): Promise<{ ok: boolean; sessions?: any[] }> {
  return new Promise(res => chrome.runtime.sendMessage({ type: "GET_SESSIONS", limit }, res))
}

export function previewTriage(sessionId: string): Promise<any> {
  return new Promise(res => chrome.runtime.sendMessage({ type: "PREVIEW_TRIAGE", sessionId }, res))
}

export function applyDecisionsMsg(sessionId: string, previewId: string, decisions: any[]): Promise<any> {
  return new Promise(res => chrome.runtime.sendMessage({ type: "APPLY_DECISIONS", sessionId, previewId, decisions }, res))
}
