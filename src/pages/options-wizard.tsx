import React, { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { Client } from "@notionhq/client"
import { loadOptions } from "../options-logic"
import { saveNotionSchema, NotionSchemaMap } from "../background/notion-env"
import { suggestResourceMapping, validateResourceMapping, fetchDatabaseProps, type DbProps } from "../background/notion-schema"
import DbPicker from "./components/DbPicker"
import PropMapper from "./components/PropMapper"
import DryRun from "./components/DryRun"

function Wizard() {
  const [token, setToken] = useState("")
  const [resourcesDbId, setResourcesDbId] = useState("")
  const [tasksDbId, setTasksDbId] = useState("")
  const [projectsDbId, setProjectsDbId] = useState("")
  const [sessionsDbId, setSessionsDbId] = useState("")
  const [propsRes, setPropsRes] = useState<DbProps>({})
  const [map, setMap] = useState<any>({ options: { strictTitleMatch: true } })
  const [status, setStatus] = useState("")

  useEffect(() => { loadOptions().then(o => setToken(o.notionToken || "")) }, [])

  const loadResProps = async () => {
    if (!resourcesDbId) return
    setStatus("Loading properties…")
    try {
      const p = await fetchDatabaseProps(resourcesDbId, token)
      setPropsRes(p)
      const sug = suggestResourceMapping(p)
      setMap((m: any) => ({ ...(m||{}), resources: { dbId: resourcesDbId, ...sug } }))
      setStatus("Properties loaded")
    } catch (e: any) {
      setStatus(`Retrieve failed: ${e?.message || e}`)
    }
  }

  const validateSave = async () => {
    const r = validateResourceMapping(map?.resources, propsRes)
    if (!r.ok) { setStatus(`Invalid mapping: ${r.errors.join(", ")}`); return }
    const schema: NotionSchemaMap = { resources: map.resources, options: map.options }
    await saveNotionSchema(schema)
    setStatus("Saved schema map.")
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 800 }}>
      <h2>Notion Setup Wizard</h2>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <input style={{ flex: 1 }} type="password" placeholder="Integration token" value={token} onChange={e => setToken(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Resources (required)</div>
          <DbPicker token={token} value={resourcesDbId} onChange={setResourcesDbId} />
          <button disabled={!resourcesDbId} onClick={loadResProps} style={{ marginTop: 6 }}>Load properties</button>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Projects (optional)</div>
          <DbPicker token={token} value={projectsDbId} onChange={setProjectsDbId} />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Tasks (optional)</div>
          <DbPicker token={token} value={tasksDbId} onChange={setTasksDbId} />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Sessions (optional)</div>
          <DbPicker token={token} value={sessionsDbId} onChange={setSessionsDbId} />
        </div>
      </div>
      {!!Object.keys(propsRes).length && (
        <div style={{ marginTop: 12 }}>
          <h4>Map properties</h4>
          <PropMapper
            props={propsRes}
            roles={[
              { key: "titleProp", label: "Title", kind: "title" },
              { key: "urlProp", label: "URL", kind: "url" },
              { key: "statusProp", label: "Status", kind: "select" },
              { key: "decisionProp", label: "Decision", kind: "select" },
              { key: "groupProp", label: "Group", kind: "rich_text" },
              { key: "projectRelProp", label: "Project relation", kind: "relation" },
              { key: "taskRelProp", label: "Task relation", kind: "relation" },
              { key: "relatedResProp", label: "Related resources (self‑relation)", kind: "relation" }
            ]}
            value={map.resources || {}}
            onChange={(next) => setMap((m:any) => ({ ...m, resources: { dbId: resourcesDbId, ...next } }))}
          />

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Options</div>
            <label style={{ display: "block", fontSize: 12 }}>
              <input type="checkbox" checked={!!map?.options?.strictTitleMatch} onChange={e => setMap((m:any)=> ({...m, options:{...m.options, strictTitleMatch: e.target.checked}}))} /> Strict title match for relations
            </label>
            <label style={{ display: "block", fontSize: 12 }}>
              <input type="checkbox" checked={!!map?.options?.autoCreateProjects} onChange={e => setMap((m:any)=> ({...m, options:{...m.options, autoCreateProjects: e.target.checked}}))} /> Auto‑create projects if missing
            </label>
            <label style={{ display: "block", fontSize: 12 }}>
              <input type="checkbox" checked={!!map?.options?.autoCreateTasks} onChange={e => setMap((m:any)=> ({...m, options:{...m.options, autoCreateTasks: e.target.checked}}))} /> Auto‑create tasks if missing
            </label>
            <label style={{ display: "block", fontSize: 12 }}>
              <input type="checkbox" checked={!!map?.options?.writeReverseLinks} onChange={e => setMap((m:any)=> ({...m, options:{...m.options, writeReverseLinks: e.target.checked}}))} /> Write reverse links on Projects/Tasks
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <DryRun schema={{ resources: map.resources } as any} sample={{ url: "https://example.com", title: "Example", decision: "Keep", group: "Quick" }} />
          </div>

          <button onClick={validateSave} style={{ marginTop: 12 }}>Validate & Save</button>
        </div>
      )}
      {status && <div style={{ marginTop: 12, fontSize: 12 }}>{status}</div>}
    </div>
  )
}

const root = document.createElement("div")
document.body.appendChild(root)
createRoot(root).render(<Wizard />)
