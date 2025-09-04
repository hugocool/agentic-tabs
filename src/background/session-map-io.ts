export type SessionMap = Record<string, number[]>

export async function readSessionMap(): Promise<SessionMap> {
    try {
        // @ts-ignore
        if ((chrome.storage as any)?.session?.get) {
            const { sessionMap = {} } = await chrome.storage.session.get("sessionMap")
            return (sessionMap as SessionMap) || {}
        }
    } catch { }
    const { sessionMap = {} } = await chrome.storage.local.get("sessionMap")
    return (sessionMap as SessionMap) || {}
}

export async function writeSessionMap(map: SessionMap) {
    try {
        // @ts-ignore
        if ((chrome.storage as any)?.session?.set) {
            await chrome.storage.session.set({ sessionMap: map })
            return
        }
    } catch { }
    await chrome.storage.local.set({ sessionMap: map })
}

export async function attachWindowToSession(sessionId: string, windowId: number) {
    const map = await readSessionMap()
    map[sessionId] ||= []
    if (!map[sessionId].includes(windowId)) map[sessionId].push(windowId)
    await writeSessionMap(map)
}