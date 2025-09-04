import { v4 as uuid } from "uuid"

type SessionMap = Record<string, number[]> // sessionId -> windowIds

const SESSION_KEY = "sessionMap"

function hasSessionArea(): boolean {
    try { return !!(chrome.storage as any)?.session?.get } catch { return false }
}

async function getRaw(): Promise<SessionMap> {
    try {
        if (hasSessionArea()) {
            const { sessionMap } = await chrome.storage.session.get(SESSION_KEY)
            return (sessionMap || {}) as SessionMap
        }
    } catch {}
    const { [SESSION_KEY]: fallback } = await chrome.storage.local.get(SESSION_KEY)
    return (fallback || {}) as SessionMap
}

async function setRaw(map: SessionMap) {
    try {
        if (hasSessionArea()) {
            await chrome.storage.session.set({ [SESSION_KEY]: map })
            return
        }
    } catch {}
    await chrome.storage.local.set({ [SESSION_KEY]: map })
}

export async function createSessionForWindow(windowId: number): Promise<string> {
    const map = await getRaw()
    const id = uuid()
    map[id] = [windowId]
    await setRaw(map)
    return id
}

export async function addWindowToSession(sessionId: string, windowId: number) {
    const map = await getRaw()
    map[sessionId] ||= []
    if (!map[sessionId].includes(windowId)) map[sessionId].push(windowId)
    await setRaw(map)
}

export async function getSessionIdForWindow(windowId: number): Promise<string | undefined> {
    const map = await getRaw()
    return Object.entries(map).find(([, wins]) => wins.includes(windowId))?.[0]
}

export async function listSessions(): Promise<{ sessionId: string; windowIds: number[] }[]> {
    const map = await getRaw()
    return Object.entries(map).map(([sessionId, windowIds]) => ({ sessionId, windowIds }))
}

export async function removeSession(sessionId: string) {
    const map = await getRaw()
    delete map[sessionId]
    await setRaw(map)
}

export async function attachWindow(sessionId: string, windowId: number) {
    const map = await getRaw()
    map[sessionId] ||= []
    if (!map[sessionId].includes(windowId)) map[sessionId].push(windowId)
    await setRaw(map)
}

export async function ensureWindows(sessionId: string): Promise<number[]> {
    const map = await getRaw()
    const winIds = (map[sessionId] || []).slice()
    if (!winIds.length) return []
    const all = await chrome.windows.getAll()
    const openIds = new Set(all.map(w => w.id))
    const filtered = winIds.filter(id => openIds.has(id)) as number[]
    if (filtered.length !== winIds.length) {
        map[sessionId] = filtered
        await setRaw(map)
    }
    return filtered
}
