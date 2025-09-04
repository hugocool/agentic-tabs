import { GraphState } from "../graph-types"
import { upsertSession } from "../local-store"

export async function persistLocal(s: GraphState): Promise<Partial<GraphState>> {
  if (!s.decisions?.length) return { persistedOk: true }
  try {
    await upsertSession({ sessionId: s.sessionId, decisions: s.decisions as any })
    return { persistedOk: true }
  } catch (e) {
    console.warn("Local persistence failed; skipping auto-act", e)
    return { persistedOk: false }
  }
}

