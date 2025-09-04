import { StateGraph, MemorySaver } from "@langchain/langgraph"
import { GraphState } from "./graph-types"
import { collect } from "./nodes/collect"
import { classify } from "./nodes/classify"

// Preview graph: collect → classify only; no side effects
const g = new (StateGraph as any)({ channels: {} })
  .addNode("collect", collect as any)
  .addNode("classify", classify as any)
  .addEdge("collect", "classify")

const previewCompiled = (g as any).compile({ checkpointer: new MemorySaver() })

export async function runPreview(sessionId: string) {
  const res = await previewCompiled.invoke({ sessionId, tabs: [] } as GraphState, {
    configurable: { thread_id: `preview:${sessionId}` }
  })
  return { decisions: res.decisions || [], tabs: res.tabs || [] }
}
