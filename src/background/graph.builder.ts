import { StateGraph } from "@langchain/langgraph"
import { GraphState } from "./graph-types"
import { collect } from "./nodes/collect"
import { classify } from "./nodes/classify"
import { persistLocal } from "./nodes/persistLocal"
import { persistNotion } from "./nodes/persistNotion"
import { act } from "./nodes/act"

export function buildGraph() {
  return new StateGraph<GraphState>()
    .addNode("collect", collect)
    .addNode("classify", classify)
    .addNode("persist", persistLocal)
    .addNode("upsert", persistNotion)
    .addNode("act", act)
    .addEdge("collect", "classify")
    .addEdge("classify", "persist")
    .addEdge("persist", "upsert")
    .addEdge("upsert", "act")
}

