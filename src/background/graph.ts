import { StateGraph } from "@langchain/langgraph"
import { z } from "zod"
import { classifyTabs } from "./ai"
import { upsertSession } from "./local-store"
import { upsertNotion } from "./notion"

export const DecisionSchema = z.object({
    url: z.string(),
    title: z.string().optional(),
    decision: z.enum(["Keep", "Archive", "Drop", "Review"]),
    group: z.string().optional(),
    project: z.string().optional(),
    task: z.string().optional()
})

export type GraphState = {
    sessionId: string
    tabs: { url?: string; title?: string }[]
    decisions?: z.infer<typeof DecisionSchema>[]
    persistedOk?: boolean
}

const graph = new StateGraph<GraphState>()
    .addNode("collect", async s => {
        const tabs = await chrome.tabs.query({})
        const { sessionMap = {} } = await chrome.storage.session.get("sessionMap")
        const winIds: number[] = sessionMap[s.sessionId] || []
        const filtered = tabs.filter(t => winIds.includes(t.windowId!)).map(t => ({ url: t.url, title: t.title }))
        return { ...s, tabs: filtered }
    })
    .addNode("classify", async s => {
        const decisionsRaw = await classifyTabs(s.tabs)
        let decisions: any[] = []
        try {
            decisions = Array.isArray(decisionsRaw) ? decisionsRaw : []
            decisions = decisions.map(d => DecisionSchema.safeParse(d)).filter(r => r.success).map(r => (r as any).data)
        } catch (e) {
            console.warn("Decision validation failed", e)
            decisions = []
        }
        return { ...s, decisions }
    })
    .addNode("persist", async s => {
        if (!s.decisions?.length) return { ...s, persistedOk: true }
        try {
            await upsertSession({ sessionId: s.sessionId, decisions: s.decisions as any })
            return { ...s, persistedOk: true }
        } catch (e) {
            console.warn("Local persistence failed; skipping auto-act", e)
            return { ...s, persistedOk: false }
        }
    })
    .addNode("upsert", async s => {
        if (s.decisions?.length) await upsertNotion({ sessionId: s.sessionId, decisions: s.decisions })
        return s
    })
    .addNode("act", async s => {
        if (!s.decisions) return s
        if (s.persistedOk === false) return s
        const keep = new Set(
            s.decisions.filter(d => d.decision === "Keep").map(d => d.url)
        )
        const all = await chrome.tabs.query({})
        const toClose = all.filter(t => s.tabs.some(x => x.url === t.url) && t.url && !keep.has(t.url))
        if (toClose.length) {
            try { await chrome.tabs.remove(toClose.map(t => t.id!).filter(Boolean)) } catch (e) { console.warn(e) }
        }
        // Regroup kept tabs into their window (optional new window logic omitted for simplicity)
        const groups: Record<string, string[]> = {}
        for (const d of s.decisions.filter(d => d.decision === "Keep")) {
            const g = d.group || "Session"
            if (!groups[g]) groups[g] = []
            if (d.url) groups[g].push(d.url)
        }
        // For each group, apply grouping to existing open tabs
        for (const [groupName, urls] of Object.entries(groups)) {
            const matching = (await chrome.tabs.query({})).filter(t => t.url && urls.includes(t.url))
            if (matching.length > 1) {
                const ids = matching.map(t => t.id!).filter(Boolean)
                try {
                    const gid = await chrome.tabs.group({ tabIds: ids })
                    await chrome.tabGroups.update(gid, { title: groupName, color: "blue" })
                } catch (e) { console.warn("Group failed", e) }
            }
        }
        return s
    })
    .addEdge("collect", "classify")
    .addEdge("classify", "persist")
    .addEdge("persist", "upsert")
    .addEdge("upsert", "act")

export async function runGraph(sessionId: string) {
    // Rebuild/compile lazily (StateGraph currently executes directly after edges defined)
    // We can emulate compile by just executing nodes sequentially since we know the path.
    let state: GraphState = { sessionId, tabs: [] }
    state = await (graph as any).nodes.collect(state)
    state = await (graph as any).nodes.classify(state)
    state = await (graph as any).nodes.persist(state)
    state = await (graph as any).nodes.upsert(state)
    state = await (graph as any).nodes.act(state)
    return state
}
