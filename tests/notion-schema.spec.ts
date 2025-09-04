import { describe, it, expect } from "vitest"
import { suggestResourceMapping, validateResourceMapping } from "../src/background/notion-schema"
import { buildResourceProperties } from "../src/background/notion-writer"

describe("notion schema mapping", () => {
  const props = {
    Name: { type: "title" },
    URL: { type: "url" },
    Status: { type: "select" },
    Decision: { type: "select" },
    Group: { type: "rich_text" }
  } as any

  it("suggests reasonable defaults", () => {
    const m = suggestResourceMapping(props)
    expect(m.titleProp).toBe("Name")
    expect(m.urlProp).toBe("URL")
  })

  it("validates types", () => {
    const m = { titleProp: "Name", urlProp: "URL", statusProp: "Status", decisionProp: "Decision", groupProp: "Group" }
    const r = validateResourceMapping(m, props)
    expect(r.ok).toBe(true)
  })

  it("builds properties from mapping", () => {
    const m = { dbId: "res", titleProp: "Name", urlProp: "URL", statusProp: "Status", decisionProp: "Decision", groupProp: "Group" } as any
    const p = buildResourceProperties({ url: "https://ex.com", title: "Ex", decision: "Keep", group: "G"}, m)
    expect(p.Name).toBeTruthy()
    expect(p.URL?.url).toBe("https://ex.com")
    expect(p.Decision?.select?.name).toBe("Keep")
  })
})

