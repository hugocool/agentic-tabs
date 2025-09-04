import { SessionLocal } from "./local-store"

export function combinedDecisionUrlSet(session: SessionLocal): Set<string> {
    return new Set([...(session.keepSet || []), ...(session.reviewSet || [])])
}