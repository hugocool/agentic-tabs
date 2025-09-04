import { describe, it, expect, beforeEach } from "vitest"
import { installChromeMock } from "./test-helpers"
import { savePreview, getPreview, updatePreview } from "../src/background/preview-cache"

describe("preview cache overrides", () => {
  beforeEach(() => { installChromeMock({ withSession: true }) })

  it("updates decisions for a previewId", async () => {
    const { previewId } = await savePreview("s1", [{ url: "https://a.com", decision: "Keep" } as any])
    let rec = await getPreview(previewId)
    expect(rec?.decisions?.length).toBe(1)
    await updatePreview(previewId, [{ url: "https://b.com", decision: "Archive" } as any])
    rec = await getPreview(previewId)
    expect(rec?.decisions?.[0]?.url).toBe("https://b.com")
  })
})

