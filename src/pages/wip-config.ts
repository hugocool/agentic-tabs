export type WipLimits = { keep: number; review: number }

export async function loadWip(): Promise<WipLimits> {
  const { wip } = await chrome.storage.local.get("wip")
  return { keep: 7, review: 10, ...(wip || {}) }
}

export async function saveWip(wip: WipLimits) {
  await chrome.storage.local.set({ wip })
}

