// Central adaptive backoff shared across all Notion calls.
// Maintains a sliding delay increased on 429/5xx and relaxed on success.

let currentDelay = 0
let lastIncrease = 0
const MAX_DELAY = 8000
const DECAY_MS = 15000 // after this window without errors, decay delay

export function recordNotionError(severity: "rate" | "server") {
    const base = severity === "rate" ? 1500 : 800
    const now = Date.now()
    // If last increase was recently, compound; else start fresh
    if (now - lastIncrease < 5000) {
        currentDelay = Math.min(MAX_DELAY, currentDelay * 2 || base)
    } else {
        currentDelay = Math.min(MAX_DELAY, Math.max(currentDelay, base))
    }
    lastIncrease = now
}

export function recordNotionSuccess() {
    const now = Date.now()
    if (currentDelay && now - lastIncrease > DECAY_MS) {
        currentDelay = Math.floor(currentDelay / 2)
        if (currentDelay < 300) currentDelay = 0
        lastIncrease = now
    }
}

export async function applyNotionBackoff() {
    if (currentDelay > 0) {
        const jitter = Math.random() * 0.25 * currentDelay
        await new Promise(r => setTimeout(r, currentDelay + jitter))
    }
}

export function getNotionBackoffState() {
    return { currentDelay }
}
