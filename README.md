# Agentic Tabs Extension

Plasmo + LangGraph.js powered browser extension for agentic tab triage, New Tab replacement, per-window Manager tab, Notion integration, and AI-assisted classification.

## Features

- Overrides New Tab with a dashboard (`chrome_url_overrides.newtab`).
- Pins a Manager tab (index 0, pinned) in every new window automatically.
- Maintains a sessionId → windowIds mapping in `chrome.storage.session`.
- Local persistence of sessions in `chrome.storage.local` with startup rehydration.
- LangGraph pipeline: collect → classify → upsert (Notion) → act (close/group tabs).
- On-device classifier via Chrome Prompt API (Gemini Nano) with cloud fallback for Edge/other Chromium.
- Notion upsert: resources (by URL) + session page with relations.
- Safe Zod validation for model output.

## Project Structure

```
src/
  newtab.tsx                # New Tab Page UI
  pages/manager.tsx       # Pinned per-window Manager UI
  background/index.ts     # Background events & messaging
  background/graph.ts     # LangGraph workflow + runGraph()
  background/ai.ts        # Classifier (Prompt API + fallback)
  background/notion.ts    # Notion upsert helpers
  background/session-map.ts # Session mapping utilities
```

## Install & Run (Dev)

Preferred (pnpm + Node 20 LTS):

```bash
corepack enable
corepack prepare pnpm@8.15.8 --activate
nvm use 20 || fnm use 20 || asdf local nodejs 20.16.0
pnpm install
pnpm dev
```

If pnpm is unavailable you can fallback to npm, but native watcher issues may appear on very new Node versions (e.g., 23.x). Use Node 18 or 20 LTS to avoid build failures with optional native deps.

Load the generated development build folder (Plasmo prints the path) as an unpacked extension:

Chrome: chrome://extensions → Developer Mode → Load unpacked → select build dir.

Edge: edge://extensions → Developer Mode → Load unpacked → select build dir.

## Notion Setup

1. Create an internal integration in Notion; copy the secret token.
2. Create / identify two databases: Resources & Sessions.
3. Share both databases with the integration.
4. After loading the extension, run in the extension background page console:

   ```js
   chrome.storage.local.set({
     notionToken: "secret_xxx",
     resourcesDbId: "<resources-db-id>",
     sessionsDbId: "<sessions-db-id>"
   })
   ```

Recommended DB properties (Resources): Name (title), URL (url), Status (select), Decision (select), Group/Project/Task (rich text). Sessions DB: Name (title), SavedAt (date), Resources (relation).

## Running a Session

1. Open New Tab → Start session.
2. Browse; open more windows (each gets a Manager tab). All windows get tied to their own session automatically (simplified approach: first window per creation event). Optionally adapt logic to merge windows under one session.
3. Click "Run triage" (New Tab) or "Save & Clean" (Manager) to classify, upsert, and tidy tabs.

## Edge Notes

- Prompt API is Chrome-only currently—Edge will immediately use the cloud fallback.
- New Tab override & tab grouping APIs work in Edge (Chromium parity).
- If adding a side panel, Edge uses its Sidebar API (adjust feature-detection accordingly).

## Security / Distribution

- Internal integration token is stored locally (development). For distribution, implement OAuth & a backend relay; never ship raw tokens.
- Validate & sanitize model outputs (Zod already narrows structure; add further guards as needed).

## Persistence & Resume

See `docs/persistence.md` for details on the local storage schema, rehydration algorithm, and safety rules.

## Next Steps / Ideas

- Attach/Detach UI for correcting window-session mapping.
- Resume UI: list sessions & reopen kept tabs explicitly.
- More granular actions (archive vs drop → different closing strategies).
- Enhanced grouping (color coding by project).
- Cloud classifier endpoint with auth + rate limiting.

## Git & GitHub Setup

1. Initialize git (inside project root):
   ```bash
   git init
   git add .
   git commit -m "chore: initial scaffold (plasmo + langgraph + notion integration)"
   ```
2. Create a new empty repo on GitHub named `agentic-tabs` (no README/License/Gitignore so histories don't diverge) via UI OR with GitHub CLI:
   ```bash
   gh repo create your-user/agentic-tabs --public --source=. --remote=origin --description "Agentic tab triage extension" --push
   ```
   If you used the web UI instead, add remote & push:
   ```bash
   git remote add origin git@github.com:your-user/agentic-tabs.git
   git branch -M main
   git push -u origin main
   ```
3. Add branch protection rules (optional): require PR reviews & passing CI.
4. (Optional) Enable commit signing: `git config commit.gpgsign true`.
5. NEVER commit secrets. Store Notion token only in local storage (runtime) or a `.env` *not committed*. See `.env.example` for placeholders.

### Suggested Branch Strategy
* `main`: stable, tagged releases.
* `dev` (optional): integration branch for upcoming features.
* Feature branches: `feat/<short-name>`, bugfix: `fix/<issue-id>`.

### Tagging Releases
After testing a version:
```bash
git tag -a v0.1.0 -m "v0.1.0 initial prototype"
git push origin v0.1.0
```

### Optional CI (GitHub Actions)
Add `.github/workflows/ci.yml` to run type check / build:
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Enable corepack
        run: corepack enable
      - name: Install deps
        run: pnpm install
      - name: Type check
        run: npx tsc --noEmit
      - name: Build
        run: pnpm build
```

### .env / Secrets
Create a local `.env` (ignored) if you later externalize config:
```
NOTION_TOKEN=secret_xxx
RESOURCES_DB_ID=xxxxx
SESSIONS_DB_ID=yyyyy
```
Load at runtime (if you add env parsing) but currently the project uses `chrome.storage.local` set manually.

## License

Prototype code – adapt licensing as needed.
