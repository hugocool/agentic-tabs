// Shared test helpers for chrome storage + session store
export function installChromeMock(opts: { tabs?: any[]; withSession?: boolean } = {}) {
    const { tabs = [], withSession = true } = opts
    const localBag: Record<string, any> = {}
    const sessionBag: Record<string, any> = {}
    // @ts-ignore
    global.chrome = {
        storage: {
            local: {
                async get(keys?: any) {
                    if (!keys) return { ...localBag }
                    if (typeof keys === 'string') return { [keys]: localBag[keys] }
                    if (Array.isArray(keys)) { const out: any = {}; for (const k of keys) out[k] = localBag[k]; return out }
                    const out: any = {}; for (const k of Object.keys(keys || {})) out[k] = localBag[k]; return out
                },
                async set(obj: Record<string, any>) { Object.assign(localBag, obj) },
                async remove(keys: string[] | string) { const arr = Array.isArray(keys) ? keys : [keys]; for (const k of arr) delete localBag[k] }
            },
            session: withSession ? {
                async get(keys?: any) {
                    if (!keys) return { ...sessionBag }
                    if (typeof keys === 'string') return { [keys]: sessionBag[keys] }
                    if (Array.isArray(keys)) { const out: any = {}; for (const k of keys) out[k] = sessionBag[k]; return out }
                    const out: any = {}; for (const k of Object.keys(keys || {})) out[k] = sessionBag[k]; return out
                },
                async set(obj: Record<string, any>) { Object.assign(sessionBag, obj) }
            } : undefined
        },
        tabs: {
            async query() { return tabs.slice() },
            async remove(_ids: number[]) { /* noop */ },
            async group(_: any) { return 1 },
        },
        tabGroups: { async update() { } },
        runtime: { getURL: (p: string) => `chrome-extension://id/${p}`, openOptionsPage: async () => { } },
        windows: { async getAll() { return [] }, async getCurrent() { return { id: 1 } }, async create(_: any) { return { id: 1 } } }
    } as any
    return { localBag, sessionBag }
}

export async function resetSessionStore() {
    // @ts-ignore
    await chrome.storage.local.set({ sessionStore_v1: { version: 1, sessions: {}, recentIds: [] } })
}
