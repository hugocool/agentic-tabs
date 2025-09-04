import { StateGraph } from "@langchain/langgraph"
import { GraphState } from "./graph-types"
import { collect } from "./nodes/collect"
import { classify } from "./nodes/classify"
import { persistLocal } from "./nodes/persistLocal"
import { persistNotion } from "./nodes/persistNotion"
import { act } from "./nodes/act"

export function buildGraph() {
  // Use generic for clarity; underlying lib typings can be noisy so cast nodes
  // Provide empty channel reducers (single root state) so we can just mutate state via nodes
  const g = new StateGraph<GraphState>({ channels: {} as any })
    .addNode("collect", collect as any)
    .addNode("classify", classify as any)
    .addNode("persist", persistLocal as any)
    .addNode("upsert", persistNotion as any)
    .addNode("act", act as any)
    .addEdge("collect", "classify")
    .addEdge("classify", "persist")
    .addEdge("persist", "upsert")
    .addEdge("upsert", "act")
  return g as any
}
