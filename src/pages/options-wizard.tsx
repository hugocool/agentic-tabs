import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { Client } from "@notionhq/client"
import { loadOptions } from "../options-logic"
import { saveNotionSchema, NotionSchemaMap } from "../background/notion-env"
import { suggestResourceMapping, validateResourceMapping, type DbProps } from "../background/notion-schema"

function Wizard() {
  const [token, setToken] = useState("")
  const [dbs, setDbs] = useState<any[]>([])
  const [resourcesDbId, setResourcesDbId] = useState("")
  const [props, setProps] = useState<DbProps>({})
  const [map, setMap] = useState<any>({})
  const [status, setStatus] = useState("")

  useEffect(() => { loadOptions().then(o => setToken(o.notionToken || "")) }, [])

  const searchDbs = async () => {
    setStatus("Searching…")
    try {
      const notion = new Client({ auth: token }) as any
      const res = await notion.search({ filter: { property: "object", value: "database" }, page_size: 20 })
      setDbs(res.results || [])
      setStatus(`Found ${res.results?.length || 0} databases`)
    } catch (e: any) {
      setStatus(`Search failed: ${e?.message || e}`)
    }
  }

  const loadProps = async () => {
    if (!resourcesDbId) return
    setStatus("Loading properties…")
    try {
      const notion = new Client({ auth: token }) as any
      const res = await notion.databases.retrieve({ database_id: resourcesDbId })
      const p: DbProps = {}
      Object.entries(res.properties || {}).forEach(([k, v]: any) => p[k] = { type: v?.type })
      setProps(p)
      const sug = suggestResourceMapping(p)
      setMap((m: any) => ({ ...(m||{}), resources: { dbId: resourcesDbId, ...sug } }))
      setStatus("Properties loaded")
    } catch (e: any) {
      setStatus(`Retrieve failed: ${e?.message || e}`)
    }
  }

  const validateSave = async () => {
    const r = validateResourceMapping(map?.resources, props)
    if (!r.ok) { setStatus(`Invalid mapping: ${r.errors.join(", ")}`); return }
    const schema: NotionSchemaMap = { resources: map.resources }
    await saveNotionSchema(schema)
    setStatus("Saved schema map.")
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 800 }}>
      <h2>Notion Setup Wizard</h2>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input style={{ flex: 1 }} type="password" placeholder="Integration token" value={token} onChange={e => setToken(e.target.value)} />
        <button onClick={searchDbs}>Search databases</button>
      </div>
      {!!dbs.length && (
        <div style={{ marginTop: 12 }}>
          <label>Resources DB:</label>
          <select value={resourcesDbId} onChange={e => setResourcesDbId(e.target.value)}>
            <option value="">(pick one)</option>
            {dbs.map((d:any) => <option key={d.id} value={d.id}>{d.title?.[0]?.plain_text || d.id}</option>)}
          </select>
          <button onClick={loadProps} style={{ marginLeft: 8 }}>Load properties</button>
        </div>
      )}
      {!!Object.keys(props).length && (
        <div style={{ marginTop: 12 }}>
          <h4>Map properties</h4>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
            {[["titleProp","title"],["urlProp","url"],["statusProp","select"],["decisionProp","select"],["groupProp","rich_text"]].map(([k, typ]) => (
              <React.Fragment key={k as string}>
                <div>{k}</div>
                <select value={map?.resources?.[k as string] || ""} onChange={e => setMap((m:any)=> ({...m, resources:{...m.resources, [k as string]: e.target.value}}))}>
                  <option value="">(none)</option>
                  {Object.entries(props).filter(([_,v]) => (k==="titleProp"? v.type==="title" : k==="urlProp"? v.type==="url" : k==="groupProp"? v.type==="rich_text" : (v.type==="select"||v.type==="multi_select"))).map(([name]) => <option key={name} value={name}>{name}</option>)}
                </select>
              </React.Fragment>
            ))}
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

