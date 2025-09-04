import { MemorySaver } from "@langchain/langgraph"
import { buildGraph } from "./graph.builder"
import { GraphState } from "./graph-types"

const checkpointer = new MemorySaver()
const compiled = buildGraph().compile({ checkpointer })

export async function runTriage(sessionId: string): Promise<GraphState> {
  return compiled.invoke(
    { sessionId, tabs: [] } as GraphState,
    { configurable: { thread_id: sessionId } }
  )
}
