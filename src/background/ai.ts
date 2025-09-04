// Classifier leveraging Chrome Prompt API when present (Chrome) with a cloud fallback (Edge / others)

type TabLite = { url?: string; title?: string }

export async function classifyTabs(tabs: TabLite[]) {
    // Attempt on-device model (Chrome Prompt API / Gemini Nano)
    try {
        // @ts-ignore experimental global
        const ai = (globalThis as any).ai
        if (ai?.canCreateTextSession && ai.canCreateTextSession() === "readily") {
            // @ts-ignore
            const session = await ai.createTextSession()
            const schema = {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        url: { type: "string" },
                        title: { type: "string" },
                        decision: { type: "string", enum: ["Keep", "Archive", "Drop", "Review"] },
                        group: { type: "string" },
                        project: { type: "string" },
                        task: { type: "string" }
                    },
                    required: ["url", "decision"]
                }
            }
            const prompt = `Classify each tab into one of Keep|Archive|Drop|Review. Provide optional group/project/task. Tabs: ${JSON.stringify(tabs)}`
            // @ts-ignore (structured output experimental)
            const output = await session.prompt(prompt, { output: { schema } })
            const parsed = JSON.parse(output)
            return parsed
        }
    } catch (err) {
        console.warn("Prompt API classification failed, falling back", err)
    }

    // Fallback remote endpoint (replace with real endpoint)
    try {
        const resp = await fetch("https://your-llm-router/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tabs })
        })
        if (!resp.ok) throw new Error(`LLM fallback HTTP ${resp.status}`)
        return await resp.json()
    } catch (err) {
        console.error("Both local and remote classification failed", err)
        // Last-resort naive heuristic (safety-first -> Review)
        return tabs.map(t => ({ url: t.url, title: t.title, decision: "Review" }))
    }
}
