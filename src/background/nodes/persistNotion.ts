import { GraphState } from "../graph-types"
import { upsertNotion } from "../notion"

export async function persistNotion(s: GraphState): Promise<Partial<GraphState>> {
  if (s.decisions?.length) {
    try { await upsertNotion({ sessionId: s.sessionId, decisions: s.decisions as any }) } catch (e) { console.warn("Notion upsert failed", e) }
  }
  return {}
}

