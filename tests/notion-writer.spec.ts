import { describe, it, expect } from "vitest"
import { buildResourceProperties } from "../src/background/notion-writer"

describe("notion writer", () => {
  it("includes mapped keys and relations on create", () => {
    const m = {
      dbId: "res",
      titleProp: "Name",
      urlProp: "URL",
      decisionProp: "Decision",
      statusProp: "Status",
      groupProp: "Group",
      projectRelProp: "Project",
      taskRelProp: "Task"
    } as any
    const p = buildResourceProperties({ url: "https://x.com", title: "X", decision: "Keep", group: "G", projectId: "P", taskId: "T" } as any, m)
    expect(p.Name.title[0].text.content).toBe("X")
    expect(p.URL.url).toBe("https://x.com")
    expect(p.Decision.select.name).toBe("Keep")
    expect(p.Group.rich_text[0].text.content).toBe("G")
    expect(p.Project.relation[0].id).toBe("P")
    expect(p.Task.relation[0].id).toBe("T")
  })
})

