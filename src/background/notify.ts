export async function notify(title: string, message: string) {
  try {
    // Minimal basic notification (icon may be omitted in dev)
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icon128.png",
      title,
      message
    } as any)
  } catch {
    // Best-effort: some environments may lack notifications permission
  }
}

