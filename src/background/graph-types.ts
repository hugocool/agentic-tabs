import { z } from "zod"

export const DecisionZ = z.enum(["Keep", "Archive", "Drop", "Review"])

export const DecisionRowZ = z.object({
  url: z.string(),
  title: z.string().optional(),
  decision: DecisionZ,
  group: z.string().optional(),
  project: z.string().optional(),
  task: z.string().optional()
})

export const GraphStateZ = z.object({
  sessionId: z.string(),
  tabs: z.array(z.object({ url: z.string().optional(), title: z.string().optional() })),
  decisions: z.array(DecisionRowZ).optional(),
  persistedOk: z.boolean().optional()
})

export type GraphState = z.infer<typeof GraphStateZ>
