# Local Persistence & Rehydration (v1)

This document explains how sessions are persisted locally and how they are rehydrated after browser or extension restarts.

## Why local persistence?

The runtime session map (`chrome.storage.session`) is volatile and lost on restart. Persisting durable session state in `chrome.storage.local` allows us to list and resume prior sessions and to rebuild the runtime window mapping without relying on window IDs remaining stable.

## Schema v1

Stored under key `sessionStore_v1`:

```
type Decision = "Keep" | "Archive" | "Drop" | "Review"

type SessionLocal = {
  id: string
  name?: string
  createdAt: string // ISO
  lastActiveAt: string // ISO
  items: Array<{
    url: string
    title?: string
    decision: Decision
    group?: string
    project?: string
    task?: string
    lastSeenAt?: string // ISO
  }>
  // cached, computed fields
  domains?: Record<string, number>
  keepSet?: string[]
  reviewSet?: string[]
}

type SessionStoreV1 = {
  version: 1
  sessions: Record<string, SessionLocal>
  recentIds: string[] // MRU of session ids
}
```

## URL Normalization

`normalizeUrl(url)` is used consistently when persisting and matching:

- Lowercases scheme and host
- Strips URL hash
- Drops common tracking params (`utm_*`, `fbclid`, `gclid`, etc.)
- Preserves remaining query string so identity stays accurate

We keep the original URL in `items[].url` and only use the normalized value internally for matching.

## Save Flow

- Input: `{ sessionId, decisions[] }`
- Upsert each URL (normalized) with latest decision, group, metadata
- Update `lastActiveAt = now()`
- Rebuild cached `domains`, `keepSet`, `reviewSet`
- Update MRU `recentIds` (move session to front)

We cap `items` at 1000 per session to stay within storage quotas; older items beyond the cap are converted to `Archive` by default.

## Startup Rehydration

Algorithm run on `onStartup` and `onInstalled` (and available via message `REHYDRATE_ON_STARTUP`):

1. Load `sessionStore_v1`.
2. Scan open windows/tabs (`chrome.tabs.query({})`).
3. For each window, build set `W` of normalized tab URLs, excluding the pinned Manager tab.
4. For each stored session `S`, compute overlap score:
   - `score = |W ∩ (S.keepSet ∪ S.reviewSet)| / max(1, |W|)`
   - require `score ≥ 0.4` and at least 2 URL matches.
5. Select the best session by highest score; tie-break by `lastActiveAt` (most recent).
6. Attach window to that `sessionId` in `chrome.storage.session.sessionMap`.
7. No match → leave unattached.

Telemetry: a single summarized log line is emitted: `[rehydrate] windows=<n> attached=<n> matched=<m> unmatched=<u>`.

Edge compatibility: if `chrome.storage.session` is not available in your Edge build, the runtime map temporarily falls back to `chrome.storage.local` under the same key (`sessionMap`). Persistence still lives in `storage.local`. On newer Edge versions (Chromium ≥ 102), `storage.session` is used.

## Resume Behavior

`RESUME_SESSION { sessionId }` opens missing `Keep` URLs only and applies tab groups according to `items[].group`. If any `Keep` URL is already open anywhere, it is not opened again (idempotent). The current window is attached to the session in the runtime map.

## Safety Rules

- Ambiguity: if a window matches multiple sessions equally after tie-breaks, it is not auto-attached.
- Storage errors: on failed persistence we skip auto-closing in triage.
- Defaults: the last-resort classifier fallback marks items as `Review`, not `Keep`.

## Messages

- `SAVE_LOCAL_STATE { sessionId, decisions[] }`
- `REHYDRATE_ON_STARTUP`
- `GET_SESSIONS { limit? }`
- `RESUME_SESSION { sessionId }`

## Quotas & Retention

- `chrome.storage.local` provides ~5MB per extension.
- We store only what we need (URL, decision, minimal metadata) and cap items per session.
- Consider pruning old sessions or archiving to Notion if you approach limits.
