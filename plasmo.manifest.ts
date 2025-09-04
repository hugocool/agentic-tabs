// Plasmo manifest override with explicit icon imports
// Import generated PNG assets (relative to project root)
import icon16 from "./assets/icon16.png"
import icon19 from "./assets/icon19.png"
import icon32 from "./assets/icon32.png"
import icon38 from "./assets/icon38.png"
import icon48 from "./assets/icon48.png"
import icon128 from "./assets/icon128.png"

// You can optionally import larger sizes if needed for future use
// import icon256 from "./assets/icon256.png"
// import icon512 from "./assets/icon512.png"

const manifest: chrome.runtime.ManifestV3 = {
    manifest_version: 3,
    name: "Agentic Tabs",
    version: "0.1.0",
    description: "Agentic tab triage extension (Plasmo + LangGraph + Notion)",
    permissions: [
        "activeTab",
        "contextMenus",
        "notifications",
        "sessions",
        "storage",
        "tabGroups",
        "tabs"
    ],
    host_permissions: [
        "https://api.notion.com/*"
    ],
    chrome_url_overrides: {
        newtab: "newtab.html"
    },
    options_ui: {
        page: "options.html",
        open_in_tab: true
    },
    action: {
        default_title: "Agentic Tabs",
        default_icon: {
            16: icon16,
            19: icon19,
            32: icon32,
            38: icon38
        }
    },
    omnibox: {
        keyword: "at"
    },
    icons: {
        16: icon16,
        32: icon32,
        48: icon48,
        128: icon128
    },
    commands: {
        "start-session": { description: "Start a new session" },
        "preview-triage": { description: "Preview triage" },
        "resume-last-session": { description: "Resume last session" },
        "open-options": { description: "Open options" },
        "focus-manager": { description: "Focus Manager tab" }
    }
}

export default manifest
