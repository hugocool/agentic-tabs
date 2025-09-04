// Unified URL utilities
export type NormalizeOptions = {
    stripHash?: boolean
    stripTracking?: boolean
    lowerHost?: boolean
    ensurePath?: boolean
    canonicalizePath?: boolean // remove trailing slash (except root)
}

const TRACKING_KEYS = new Set([
    "fbclid", "gclid", "yclid", "msclkid", "si", "igshid", "mc_eid", "mc_cid", "vero_id", "_hs", "ref", "ref_src"
])

export function normalizeUrlFlexible(input?: string | null, opts: NormalizeOptions = {}): string | undefined {
    if (!input) return undefined
    try {
        const u = new URL(input)
        if (opts.lowerHost) u.hostname = u.hostname.toLowerCase()
        if (opts.stripHash) u.hash = ""
        if (opts.stripTracking) {
            const del: string[] = []
            u.searchParams.forEach((_, k) => {
                const lk = k.toLowerCase()
                if (lk.startsWith("utm_") || TRACKING_KEYS.has(lk)) del.push(k)
            })
            del.forEach(k => u.searchParams.delete(k))
        }
        if (opts.canonicalizePath && u.pathname.endsWith("/") && u.pathname !== "/") {
            u.pathname = u.pathname.slice(0, -1)
        }
        if (opts.ensurePath && !u.pathname) u.pathname = "/"
        const q = u.searchParams.toString()
        return `${u.protocol}//${u.host}${u.pathname || "/"}${q ? `?${q}` : ""}`
    } catch {
        return input || undefined
    }
}

// Legacy behaviors wrappers
export function normalizePersistUrl(u?: string | null): string | undefined {
    return normalizeUrlFlexible(u, { stripHash: true, stripTracking: true, lowerHost: true, ensurePath: true })
}
export function canonicalDisplayUrl(u?: string | null): string | undefined {
    return normalizeUrlFlexible(u, { stripHash: true, canonicalizePath: true })
}