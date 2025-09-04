import { describe, it, expect, beforeEach, vi } from "vitest"
import { loadOptions, saveOptions, resetOptions, testNotionConnection, openOptionsPage } from "../src/options-logic"
import { installChromeMock } from "./test-helpers"

installChromeMock({ withSession: false })
// Patch runtime.openOptionsPage spy after install
// @ts-ignore
chrome.runtime.openOptionsPage = vi.fn(async () => { })

vi.mock("@notionhq/client", () => {
  class Client {
    auth: string
    constructor({ auth }: any) { this.auth = auth }
    databases = {
      query: async ({ database_id, page_size }: any) => ({
        results: [
          { properties: { Name: { title: [{ plain_text: "A" }] } } },
          { properties: { Name: { title: [{ plain_text: "B" }] } } },
          { properties: { Name: { title: [{ plain_text: "C" }] } } },
        ]
      })
    }
  }
  return { Client }
})

describe("options logic", () => {
  beforeEach(() => { /* state already in mock; each test starts clean enough */ })

  it("saves, loads and resets options", async () => {
    await saveOptions({ notionToken: "t", resourcesDbId: "r", sessionsDbId: "s" })
    const v1 = await loadOptions()
    expect(v1.notionToken).toBe("t")
    await resetOptions()
    const v2 = await loadOptions()
    expect(v2.notionToken).toBeUndefined()
  })

  it("tests Notion connection and returns sample names", async () => {
    const res = await testNotionConnection({ notionToken: "t", resourcesDbId: "db" })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.sample.length).toBeGreaterThan(0)
  })

  it("openOptionsPage calls runtime API", async () => {
    await openOptionsPage()
    // @ts-ignore
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled()
  })
})

