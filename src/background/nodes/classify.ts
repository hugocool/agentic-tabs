import { GraphState, DecisionRowZ } from "../graph-types"
import { classifyTabs } from "../ai"

export async function classify(s: GraphState): Promise<Partial<GraphState>> {
  const decisionsRaw = await classifyTabs(s.tabs)
  let decisions: any[] = []
  try {
    const arr = Array.isArray(decisionsRaw) ? decisionsRaw : []
    decisions = arr
      .map((d) => DecisionRowZ.safeParse(d))
      .filter((r) => r.success)
      .map((r: any) => r.data)
  } catch (e) {
    console.warn("Decision validation failed", e)
    decisions = []
  }
  return { decisions }
}

