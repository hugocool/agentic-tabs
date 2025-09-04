import { v4 as uuid } from "uuid"

type SessionMap = Record<string, number[]> // sessionId -> windowIds

async function getRaw(): Promise<SessionMap> {
    const { sessionMap } = await chrome.storage.session.get("sessionMap")
    return (sessionMap || {}) as SessionMap
}

async function setRaw(map: SessionMap) {
    await chrome.storage.session.set({ sessionMap: map })
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
