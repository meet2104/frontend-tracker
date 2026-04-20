import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";

const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { margin: 0; background: #060810; }
  :root {
    --bg:#060810; --s1:#0c0f1a; --s2:#111525; --s3:#171c2e;
    --b1:rgba(255,255,255,0.055); --b2:rgba(255,255,255,0.10); --b3:rgba(255,255,255,0.16);
    --cyan:#00f5ff; --cyan2:#00c8d4; --red:#ff4d6d; --green:#00e5a0;
    --amber:#ffb547; --blue:#4d8cff; --purple:#a78bfa;
    --text:#dde3f4; --text2:#8b97b8; --muted:#3d4a68;
    --font:'Arial',sans-serif; --mono:'Courier New',monospace;
  }
  @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.7)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  .fade-up { animation: fadeUp .35s ease both; }
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:var(--s1); }
  ::-webkit-scrollbar-thumb { background:var(--muted); border-radius:3px; }
  input, textarea, select {
    font-family:var(--mono); background:var(--s3); border:1px solid var(--b2);
    color:var(--text); border-radius:8px; padding:9px 13px; font-size:.8rem;
    outline:none; transition:border-color .2s,box-shadow .2s; width:100%;
  }
  input:focus, textarea:focus {
    border-color:rgba(0,245,255,.4); box-shadow:0 0 0 3px rgba(0,245,255,.08);
  }
  input::placeholder { color:var(--muted); }
`;

const BASE = "http://localhost:5000";

const DEFAULT_CONFIG   = { api: `${BASE}/api/track/activity`, userId: "default-user", machine: "default-machine" };
const DEFAULT_FORBIDDEN = [];

const C = {
  bg:"#060810", s1:"#0c0f1a", s2:"#111525", s3:"#171c2e",
  b1:"rgba(255,255,255,0.055)", b2:"rgba(255,255,255,0.10)",
  cyan:"#00f5ff", cyan2:"#00c8d4", red:"#ff4d6d", green:"#00e5a0",
  amber:"#ffb547", blue:"#4d8cff", purple:"#a78bfa",
  text:"#dde3f4", text2:"#8b97b8", muted:"#3d4a68",
};

const pill = (color) => ({
  display:"inline-flex", alignItems:"center", gap:5,
  fontSize:".6rem", letterSpacing:".1em", textTransform:"uppercase",
  padding:"3px 10px", borderRadius:100, fontFamily:"var(--mono)",
  background:`${color}18`, color, border:`1px solid ${color}35`, fontWeight:500,
});
const dot = (color) => ({
  width:5, height:5, borderRadius:"50%", background:color,
  display:"inline-block", boxShadow:`0 0 6px ${color}`,
});
const card = (extra={}) => ({
  background:C.s1, border:`1px solid ${C.b1}`, borderRadius:16,
  padding:"1.4rem 1.5rem", position:"relative", overflow:"hidden", ...extra,
});
const topShine = {
  position:"absolute", top:0, left:0, right:0, height:1,
  background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)",
};

function Btn({ children, onClick, variant="primary", size="md", disabled=false, style={} }) {
  const sizes = {
    sm:{ fontSize:".7rem",  padding:"6px 14px"  },
    md:{ fontSize:".78rem", padding:"9px 20px"  },
    lg:{ fontSize:".85rem", padding:"11px 26px" },
  };
  const variants = {
    primary: { background:`linear-gradient(135deg,${C.cyan}22,${C.cyan2}22)`, border:`1px solid ${C.cyan}55`, color:C.cyan,  boxShadow:`0 0 20px ${C.cyan}18`  },
    danger:  { background:`linear-gradient(135deg,${C.red}22,${C.red}11)`,   border:`1px solid ${C.red}55`,  color:C.red,   boxShadow:`0 0 20px ${C.red}18`   },
    success: { background:`linear-gradient(135deg,${C.green}22,${C.green}11)`,border:`1px solid ${C.green}55`,color:C.green, boxShadow:`0 0 20px ${C.green}18` },
    ghost:   { background:"transparent", border:`1px solid ${C.b2}`, color:C.text2 },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily:"var(--font)", fontWeight:600, border:"none",
      cursor:disabled ? "not-allowed":"pointer",
      display:"inline-flex", alignItems:"center", gap:7,
      transition:"all .2s", borderRadius:10, opacity:disabled?.5:1,
      ...sizes[size], ...variants[variant], ...style,
    }}>
      {children}
    </button>
  );
}

function Tag({ label, onRemove }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.s3, border:`1px solid ${C.red}35`, borderRadius:8, padding:"5px 10px", fontFamily:"var(--mono)", fontSize:".72rem", color:C.red }}>
      {label}
      {onRemove && (
        <button onClick={onRemove} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:"1rem", padding:0, lineHeight:1 }}>x</button>
      )}
    </div>
  );
}

function StatusDot({ status }) {
  const colMap = { online:C.green, offline:C.red, idle:C.amber };
  const col = colMap[status] || C.muted;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:col, boxShadow:`0 0 8px ${col}`, animation:"pulse 2s ease-in-out infinite", display:"inline-block" }} />
      <span style={{ fontSize:".65rem", fontFamily:"var(--mono)", textTransform:"uppercase", letterSpacing:".1em", color:col }}>{status}</span>
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily:"var(--mono)", fontSize:".6rem", letterSpacing:".12em", textTransform:"uppercase", color:C.muted, marginBottom:"1rem", display:"flex", alignItems:"center", gap:8 }}>
      {children}
    </div>
  );
}

function ConfigPanel({ config, onSave }) {
  const [form, setForm]   = useState(config);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { setForm(config); }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await axios.post(`${BASE}/api/control/config`, form);
      onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError("Failed to save: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key:"api",     label:"API Endpoint", icon:"API",  hint:"Backend tracking endpoint URL"   },
    { key:"userId",  label:"User ID",       icon:"USER", hint:"Unique identifier for this user" },
    { key:"machine", label:"Machine Name",  icon:"PC",  hint:"Hostname or label for this device"},
  ];

  return (
    <div className="fade-up">
      <div style={{ marginBottom:"1.5rem" }}>
        <h2 style={{ fontFamily:"var(--font)", fontSize:"1.05rem", fontWeight:700, color:C.text, marginBottom:6 }}>Agent Configuration</h2>
        <p style={{ fontSize:".75rem", color:C.text2 }}>Modify the agent's connection settings and identity parameters.</p>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
        {fields.map(f => (
          <div key={f.key} style={card()}>
            <div style={topShine} />
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:".62rem", letterSpacing:".12em", textTransform:"uppercase", color:C.muted, fontFamily:"var(--mono)", marginBottom:4, display:"flex", alignItems:"center", gap:6 }}>
                  <span>{f.icon}</span> {f.label}
                </div>
                <div style={{ fontSize:".7rem", color:C.text2 }}>{f.hint}</div>
              </div>
              <span style={pill(C.cyan)}><span style={dot(C.cyan)} />editable</span>
            </div>
            <input value={form[f.key] || ""} onChange={e => setForm({...form, [f.key]:e.target.value})} />
          </div>
        ))}
      </div>

      {saveError && (
        <div style={{ marginTop:"1rem", padding:"0.75rem 1rem", background:`${C.red}12`, border:`1px solid ${C.red}35`, borderRadius:8, fontFamily:"var(--mono)", fontSize:".7rem", color:C.red }}>
          Warning: {saveError}
        </div>
      )}

      <div style={{ marginTop:"1.5rem", display:"flex", gap:10 }}>
        <Btn onClick={handleSave} variant="primary" disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved!" : "Save Config"}
        </Btn>
        <Btn onClick={() => setForm(config)} variant="ghost">Reset</Btn>
      </div>

      <div style={{ marginTop:"1.5rem", ...card() }}>
        <div style={topShine} />
        <SectionLabel><span style={{ width:6, height:6, borderRadius:"50%", background:C.amber, display:"inline-block" }} />config.json preview</SectionLabel>
        <pre style={{ fontFamily:"var(--mono)", fontSize:".75rem", color:C.cyan2, lineHeight:1.7, background:C.s3, borderRadius:10, padding:"1rem", border:`1px solid ${C.b1}`, overflowX:"auto" }}>
          {JSON.stringify(form, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ForbiddenPanel({ apps, onSave }) {
  const [list, setList]   = useState(apps);
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => { setList(apps); }, [apps]);

  const add = () => {
    const val = input.trim().toLowerCase();
    if (!val) return;
    if (list.includes(val)) { setError("Already in list"); return; }
    if (!val.includes("."))  { setError("Include file extension (e.g. app.exe)"); return; }
    setList(prev => [...prev, val]);
    setInput("");
    setError("");
  };

  const remove = (app) => setList(prev => prev.filter(a => a !== app));

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await axios.post(`${BASE}/api/control/forbidden`, { apps: list });
      onSave(list);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError("Failed to save: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom:"1.5rem" }}>
        <h2 style={{ fontFamily:"var(--font)", fontSize:"1.05rem", fontWeight:700, color:C.text, marginBottom:6 }}>Forbidden Applications</h2>
        <p style={{ fontSize:".75rem", color:C.text2 }}>Processes listed here will be flagged and blocked by the agent.</p>
      </div>

      <div style={card({ marginBottom:"1.2rem" })}>
        <div style={topShine} />
        <SectionLabel>Add Forbidden App</SectionLabel>
        <div style={{ display:"flex", gap:10 }}>
          <input value={input} onChange={e => { setInput(e.target.value); setError(""); }} onKeyDown={e => e.key==="Enter" && add()} placeholder="e.g. discord.exe" style={{ flex:1 }} />
          <Btn onClick={add} variant="danger">+ Add</Btn>
        </div>
        {error && <div style={{ marginTop:8, fontSize:".7rem", color:C.red, fontFamily:"var(--mono)" }}>Warning: {error}</div>}
      </div>

      <div style={card({ marginBottom:"1.2rem" })}>
        <div style={topShine} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.1rem" }}>
          <SectionLabel>Blocked Processes</SectionLabel>
          <span style={pill(C.red)}><span style={dot(C.red)} />{list.length} apps</span>
        </div>
        {list.length === 0 ? (
          <div style={{ textAlign:"center", padding:"2rem 0", color:C.muted, fontSize:".78rem", fontFamily:"var(--mono)" }}>No forbidden apps configured</div>
        ) : (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {list.map(app => <Tag key={app} label={app} onRemove={() => remove(app)} />)}
          </div>
        )}
      </div>

      <div style={card({ marginBottom:"1.2rem" })}>
        <div style={topShine} />
        <SectionLabel><span style={{ width:6, height:6, borderRadius:"50%", background:C.amber, display:"inline-block" }} />forbidden.json preview</SectionLabel>
        <pre style={{ fontFamily:"var(--mono)", fontSize:".75rem", color:C.red, lineHeight:1.7, background:C.s3, borderRadius:10, padding:"1rem", border:`1px solid ${C.b1}` }}>
          {JSON.stringify(list, null, 2)}
        </pre>
      </div>

      {saveError && (
        <div style={{ marginBottom:"1rem", padding:"0.75rem 1rem", background:`${C.red}12`, border:`1px solid ${C.red}35`, borderRadius:8, fontFamily:"var(--mono)", fontSize:".7rem", color:C.red }}>
          Warning: {saveError}
        </div>
      )}

      <Btn onClick={handleSave} variant="danger" disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved!" : "Save Forbidden List"}
      </Btn>
    </div>
  );
}

function ActivityPanel({ forbidden, activityData, loading, fetchError, pagination, onPageChange, onLimitChange }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { page, limit } = pagination;

  const rows = activityData
    .map(a => ({
      time:    new Date(a.time).toLocaleTimeString(),
      app:     a.activeApp || "Unknown",
      title:   a.activeTitle || "Unknown",
      state:   a.state || "unknown",
      proc:    a.processCount || 0,
      machine: a.machine || "N/A",
      blocked: (a.state || "unknown") === "blocked" || forbidden.includes((a.activeApp || "Unknown").toLowerCase()),
    }))
    .filter(row => {
      const matchFilter = filter === "all" ||
        (filter === "blocked" ? row.blocked :
         filter === "active" ? (row.state === "active" && !row.blocked) :
         row.state === filter);
      const matchSearch =
        row.app.toLowerCase().includes(search.toLowerCase()) ||
        row.machine.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });

  const filteredTotalRecords = rows.length;
  const filteredTotalPages = Math.max(1, Math.ceil(filteredTotalRecords / limit));
  const currentPage = Math.min(page, filteredTotalPages);
  const pagedRows = rows.slice((currentPage - 1) * limit, currentPage * limit);

  useEffect(() => {
    if (page > filteredTotalPages) onPageChange(filteredTotalPages);
  }, [page, filteredTotalPages, onPageChange]);

  const stateColor = { active:C.green, blocked:C.red, idle:C.amber, away:C.blue };
  const FILTERS    = [["all","All"],["active","Active"],["idle","Idle"],["away","Away"],["blocked","Blocked"]];

  const PaginationBtn = ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"0.4rem 0.75rem", background:disabled ? C.s1:C.blue,
      color:disabled ? C.muted:"white", border:`1px solid ${disabled ? C.b1:C.blue}`,
      borderRadius:6, cursor:disabled ? "not-allowed":"pointer",
      fontFamily:"var(--font)", fontSize:".65rem", fontWeight:600,
      opacity:disabled ? .5:1,
    }}>
      {children}
    </button>
  );

  return (
    <div className="fade-up">
      <div style={{ marginBottom:"1.5rem" }}>
        <h2 style={{ fontFamily:"var(--font)", fontSize:"1.05rem", fontWeight:700, color:C.text, marginBottom:6 }}>Activity Log</h2>
        <p style={{ fontSize:".75rem", color:C.text2 }}>Real-time stream of tracked process events across all machines.</p>
      </div>

      {loading && (
        <div style={{ textAlign:"center", padding:"3rem", color:C.muted, fontFamily:"var(--mono)", fontSize:".78rem" }}>
          <div style={{ width:20, height:20, border:`2px solid ${C.cyan}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
          Loading activity data...
        </div>
      )}

      {!loading && fetchError && (
        <div style={{ padding:"1.5rem", background:C.s1, border:`1px solid ${C.red}40`, borderRadius:12, marginBottom:"1rem", textAlign:"center" }}>
          <div style={{ color:C.red, fontFamily:"var(--font)", fontWeight:600, marginBottom:8 }}>Error Loading Data</div>
          <div style={{ color:C.text2, fontFamily:"var(--mono)", fontSize:".7rem" }}>{fetchError}</div>
          <div style={{ color:C.muted, fontFamily:"var(--mono)", fontSize:".6rem", marginTop:6 }}>Make sure the backend is running on port 5000</div>
        </div>
      )}

      {!loading && !fetchError && (
        <>
          <div style={{ display:"flex", gap:10, marginBottom:"1rem", alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:3, background:C.s1, border:`1px solid ${C.b1}`, borderRadius:10, padding:3 }}>
              {FILTERS.map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} style={{ fontFamily:"var(--font)", fontSize:".68rem", letterSpacing:".06em", textTransform:"uppercase", padding:"6px 16px", borderRadius:8, border:"none", cursor:"pointer", transition:"all .2s", background:filter===key ? C.cyan:"transparent", color:filter===key ? C.bg:C.muted, fontWeight:filter===key ? 600:400 }}>
                  {label}
                </button>
              ))}
            </div>

            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search app or machine..." style={{ maxWidth:240, flex:1, minWidth:160 }} />

            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:"auto" }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:".65rem", color:C.text2 }}>Rows:</span>
              <select value={limit} onChange={e => { onLimitChange(Number(e.target.value)); }} style={{ width:"auto", padding:"5px 10px", cursor:"pointer" }}>
                {[5,10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.8rem", fontFamily:"var(--mono)", fontSize:".65rem", color:C.text2, borderBottom:`1px solid ${C.b1}`, paddingBottom:"0.6rem" }}>
            <span>Showing {pagedRows.length} of {filteredTotalRecords} filtered records</span>
            <span>Page {currentPage} of {filteredTotalPages}</span>
          </div>

          <div style={card({ padding:0 })}>
            <div style={topShine} />
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${C.b1}` }}>
                  {["Time","Application","Machine","State","Processes"].map((h,i) => (
                    <th key={h} style={{ fontFamily:"var(--mono)", fontSize:".58rem", letterSpacing:".12em", textTransform:"uppercase", color:C.muted, textAlign:i===4?"right":"left", padding:"1rem 1.2rem 1rem 0", paddingLeft:i===0?"1.4rem":0, fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, idx) => {
                  const isBlocked = row.blocked;
                  const col = isBlocked ? C.red : stateColor[row.state] || C.text2;
                  const maxProc = Math.max(...pagedRows.map(r => r.proc), 1);
                  return (
                    <tr key={idx} style={{ borderBottom:`1px solid rgba(255,255,255,0.025)`, background:isBlocked?"rgba(255,77,109,0.03)":"transparent", animation:"fadeUp .3s ease both", animationDelay:`${idx*0.03}s` }}>
                      <td style={{ padding:"0.85rem 0 0.85rem 1.4rem", fontFamily:"var(--mono)", fontSize:".72rem", color:C.text2 }}>{row.time}</td>
                      <td style={{ padding:"0.85rem 1.2rem 0.85rem 0" }}>
                        <div style={{ display:"inline-flex", alignItems:"center", gap:8, fontFamily:"var(--font)", fontWeight:500, fontSize:".78rem", color:isBlocked?C.red:C.text }}>
                          {row.app}
                          <span style={{ fontFamily:"var(--mono)", fontSize:".62rem", color:C.text2 }}>
                            ({row.title})
                          </span>
                        </div>
                      </td>
                      <td style={{ padding:"0.85rem 1.2rem 0.85rem 0" }}>
                        <span style={{ fontFamily:"var(--mono)", fontSize:".65rem", background:C.s3, border:`1px solid ${C.b1}`, padding:"3px 8px", borderRadius:6, color:C.text2 }}>{row.machine}</span>
                      </td>
                      <td style={{ padding:"0.85rem 1.2rem 0.85rem 0" }}>
                        <span style={pill(col)}><span style={dot(col)} />{isBlocked?"blocked":row.state}</span>
                      </td>
                      <td style={{ padding:"0.85rem 1.4rem 0.85rem 0", textAlign:"right" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end" }}>
                          <div style={{ width:48, height:3, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${Math.round((row.proc/maxProc)*100)}%`, background:col, borderRadius:2 }} />
                          </div>
                          <span style={{ fontFamily:"var(--mono)", fontWeight:600, fontSize:".82rem", color:col }}>{row.proc}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pagedRows.length === 0 && (
              <div style={{ textAlign:"center", padding:"3rem", color:C.muted, fontFamily:"var(--mono)", fontSize:".78rem" }}>No records match your filter</div>
            )}

            {filteredTotalPages > 1 && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1rem 1.4rem", borderTop:`1px solid ${C.b1}`, fontFamily:"var(--mono)", fontSize:".65rem" }}>
                <span style={{ color:C.text2 }}>
                  Records {((currentPage-1)*limit)+1}-{Math.min(currentPage*limit, filteredTotalRecords)} of {filteredTotalRecords}
                </span>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <PaginationBtn onClick={() => onPageChange(currentPage-1)} disabled={currentPage<=1}>Prev</PaginationBtn>
                  {Array.from({ length:Math.min(5, filteredTotalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(currentPage-2, filteredTotalPages-4)) + i;
                    if (p < 1 || p > filteredTotalPages) return null;
                    return (
                      <button key={p} onClick={() => onPageChange(p)} style={{
                        width:28, height:28, background:p===currentPage?C.blue:C.s1,
                        color:p===currentPage?"white":C.text, border:`1px solid ${p===currentPage?C.blue:C.b1}`,
                        borderRadius:6, cursor:"pointer", fontFamily:"var(--mono)", fontSize:".65rem",
                        fontWeight:p===currentPage?600:400,
                      }}>{p}</button>
                    );
                  })}
                  <PaginationBtn onClick={() => onPageChange(currentPage+1)} disabled={currentPage>=filteredTotalPages}>Next</PaginationBtn>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OverviewPanel({ config, forbidden, activityData, onDownloadPDF }) {
  const [activeChartType, setActiveChartType] = useState("line");
  const active  = activityData.filter(a => a.state === "active").length;
  const blocked = activityData.filter(a => a.state === "blocked" || forbidden.includes((a.activeApp||"").toLowerCase())).length;
  const total   = activityData.length;
  const pct     = total > 0 ? Math.round((active/total)*100) : 0;

  const stats = [
    { label:"Total Events",   value:total,            color:C.blue,   fill:100 },
    { label:"Active Sessions",value:active,           color:C.green,  fill:total>0?Math.round((active/total)*100):0 },
    { label:"Blocked Events", value:blocked,          color:C.red,    fill:total>0?Math.round((blocked/total)*100):0 },
    { label:"Forbidden Apps", value:forbidden.length, color:C.amber,  fill:Math.min(forbidden.length*20,100) },
  ];

  const recentEvents = activityData.slice(0,5).map(a => ({
    time:  new Date(a.time).toLocaleTimeString(),
    app:   a.activeApp || "Unknown",
    title: a.activeTitle || "Unknown",
    state: a.state || "unknown",
  }));
  const activeTrend = activityData.slice(0, 12).reverse().map(a => (a.state === "active" ? 1 : 0));
  const trendPoints = activeTrend.length > 1
    ? activeTrend.map((v, i) => `${(i/(activeTrend.length-1))*100},${v ? 6 : 30}`).join(" ")
    : "";
  const areaPoints = activeTrend.length > 1 ? `0,36 ${trendPoints} 100,36` : "";

  return (
    <div className="fade-up">
      <div style={{ marginBottom:"1.5rem", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h2 style={{ fontFamily:"var(--font)", fontSize:"1.05rem", fontWeight:700, color:C.text, marginBottom:6 }}>System Overview</h2>
          <p style={{ fontSize:".75rem", color:C.text2 }}>Live snapshot of the agent's current state and activity.</p>
        </div>
        <button onClick={onDownloadPDF} style={{
          background: `linear-gradient(135deg,${C.cyan}22,${C.cyan2}22)`,
          border: `1px solid ${C.cyan}55`,
          color: C.cyan,
          padding: "8px 16px",
          borderRadius: 8,
          fontFamily: "var(--font)",
          fontSize: ".72rem",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: `0 0 12px ${C.cyan}18`,
          transition: "all .2s",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download PDF
        </button>
      </div>

      <div style={{ ...card({ marginBottom:"1.2rem", background:`linear-gradient(135deg,${C.purple}08,${C.blue}06)`, border:`1px solid ${C.purple}25` }) }}>
        <div style={topShine} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:`linear-gradient(135deg,${C.purple}30,${C.blue}30)`, display:"grid", placeItems:"center", fontSize:".9rem", border:`1px solid ${C.purple}30` }}>ID</div>
            <div>
              <div style={{ fontFamily:"var(--font)", fontWeight:700, fontSize:"1rem", color:C.text, marginBottom:4 }}>Agent Identity</div>
              <div style={{ fontFamily:"var(--mono)", fontSize:".7rem", color:C.text2 }}>Current user and machine information</div>
            </div>
          </div>
          <StatusDot status="online" />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
          {[
            { label:"USER ID",  value:config.userId,  color:C.cyan  },
            { label:"MACHINE",  value:config.machine, color:C.green },
          ].map(item => (
            <div key={item.label} style={{ background:C.s1, borderRadius:8, padding:"1rem" }}>
              <div style={{ fontFamily:"var(--mono)", fontSize:".58rem", letterSpacing:".12em", textTransform:"uppercase", color:C.muted, marginBottom:6 }}>{item.label}</div>
              <div style={{ fontFamily:"var(--font)", fontSize:"1.1rem", fontWeight:600, color:item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:"1rem", paddingTop:"1rem", borderTop:`1px solid ${C.b1}`, fontFamily:"var(--mono)", fontSize:".62rem", color:C.muted }}>
          API - {config.api}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem", marginBottom:"1.2rem" }}>
        {stats.map(s => (
          <div key={s.label} style={card()}>
            <div style={topShine} />
            <div style={{ fontSize:".58rem", letterSpacing:".12em", textTransform:"uppercase", color:C.muted, fontFamily:"var(--mono)", marginBottom:".8rem", display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:s.color, display:"inline-block" }} />
              {s.label}
            </div>
            <div style={{ fontFamily:"var(--font)", fontSize:"2rem", fontWeight:700, letterSpacing:"-.02em", color:s.color, marginBottom:".4rem" }}>{s.value}</div>
            <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${s.fill}%`, background:s.color, borderRadius:2 }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:"1.2rem" }}>
        <div style={card()}>
          <div style={topShine} />
          <SectionLabel>
            <span style={{ width:6, height:6, borderRadius:"50%", background:C.green, display:"inline-block", animation:"pulse 2s ease-in-out infinite" }} />
            Recent Events
          </SectionLabel>
          {recentEvents.length === 0 ? (
            <div style={{ color:C.muted, fontFamily:"var(--mono)", fontSize:".72rem", padding:"1rem 0", textAlign:"center" }}>No events yet</div>
          ) : recentEvents.map((row, i) => {
            const isBlocked = forbidden.includes(row.app.toLowerCase()) || row.state === "blocked";
            const col = isBlocked ? C.red : row.state === "active" ? C.green : C.amber;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:i<recentEvents.length-1?`1px solid rgba(255,255,255,0.03)`:"none" }}>
                <span style={{ fontFamily:"var(--mono)", fontSize:".65rem", color:C.muted, minWidth:60 }}>{row.time}</span>
                <span style={{ flex:1, fontFamily:"var(--font)", fontSize:".78rem", color:isBlocked?C.red:C.text, fontWeight:500 }}>
                  {row.app}
                  <span style={{ marginLeft:6, fontFamily:"var(--mono)", fontSize:".62rem", color:C.text2 }}>
                    ({row.title})
                  </span>
                </span>
                <span style={pill(col)}><span style={dot(col)} />{isBlocked?"blocked":row.state}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={card()}>
            <div style={topShine} />
            <SectionLabel>Active Time</SectionLabel>
            <div style={{ position:"relative", height:90, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg viewBox="0 0 80 80" style={{ width:80, height:80, transform:"rotate(-90deg)" }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <circle cx="40" cy="40" r="32" fill="none" stroke={C.green} strokeWidth="6"
                  strokeDasharray={`${2*Math.PI*32}`}
                  strokeDashoffset={`${2*Math.PI*32*(1-pct/100)}`}
                  strokeLinecap="round"
                  style={{ filter:`drop-shadow(0 0 6px ${C.green})` }}
                />
              </svg>
              <div style={{ position:"absolute", textAlign:"center" }}>
                <div style={{ fontFamily:"var(--font)", fontWeight:700, fontSize:"1.1rem", color:C.green }}>{pct}%</div>
              </div>
            </div>
            <div style={{ textAlign:"center", fontFamily:"var(--mono)", fontSize:".62rem", color:C.text2, marginTop:6 }}>Active Sessions</div>
          </div>

          <div style={card()}>
            <div style={topShine} />
            <SectionLabel>Forbidden Apps</SectionLabel>
            {forbidden.length === 0 ? (
              <div style={{ color:C.muted, fontFamily:"var(--mono)", fontSize:".7rem" }}>None configured</div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {forbidden.slice(0,4).map(app => <span key={app} style={pill(C.red)}><span style={dot(C.red)} />{app}</span>)}
                {forbidden.length > 4 && <span style={pill(C.muted)}>+{forbidden.length-4} more</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentManager() {
  const [tab, setTab]           = useState("overview");
  const [config, setConfig]     = useState(DEFAULT_CONFIG);
  const [forbidden, setForbidden] = useState(DEFAULT_FORBIDDEN);
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [tick, setTick]         = useState(0);
  const [trackerRunning, setTrackerRunning] = useState(true);
  const [changingStatus, setChangingStatus] = useState(false);

  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchData = useCallback(async (pg = page, lim = limit) => {
    setLoading(true);
    setFetchError(null);
    try {
      try {
        const r = await axios.get(`${BASE}/api/control/config`);
        if (r.data?.success) setConfig(r.data.config);
      } catch { }

      try {
        const r = await axios.get(`${BASE}/api/control/forbidden`);
        if (r.data?.success) setForbidden(r.data.apps);
      } catch { }

      try {
        const r = await axios.get(`${BASE}/api/control/tracker-status`);
        if (r.data?.success) setTrackerRunning(r.data.enabled);
      } catch { }

      const r = await axios.get(`${BASE}/api/track/activity`, { params:{ page:1, limit:1000 } });
      const payload = r.data;
      const all = payload.data || payload;
      const allCount = payload.pagination?.totalRecords ?? all.length;
      setActivityData(all);
      setTotalRecords(allCount);
      setTotalPages(Math.max(1, Math.ceil(allCount / lim)));
    } catch (err) {
      setFetchError("Failed to reach backend: " + err.message);
      setActivityData([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    if (!document.getElementById("am-styles")) {
      const s = document.createElement("style");
      s.id = "am-styles";
      s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
    fetchData(page, limit);
    const iv = setInterval(() => fetchData(page, limit), 10000);
    return () => clearInterval(iv);
  }, [page, limit]);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x+1), 1000);
    return () => clearInterval(t);
  }, []);

  const handlePageChange = (p) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setPage(clamped);
  };

  const handleLimitChange = (l) => {
    setLimit(l);
    setPage(1);
  };

  const handleStartTracker = async () => {
    setChangingStatus(true);
    try {
      await axios.post(`${BASE}/api/control/tracker-start`);
      setTrackerRunning(true);
    } catch (err) {
      console.error("Failed to start tracker:", err);
    } finally {
      setChangingStatus(false);
    }
  };

  const handleStopTracker = async () => {
    setChangingStatus(true);
    try {
      await axios.post(`${BASE}/api/control/tracker-stop`);
      setTrackerRunning(false);
    } catch (err) {
      console.error("Failed to stop tracker:", err);
    } finally {
      setChangingStatus(false);
    }
  };

// Enhanced PDF Generation Function
  const generateComprehensivePDF = async (summary, activityData, forbiddenApps, stateDistributionData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let currentY = margin;

    // Color palette
    const colors = {
      primary: [0, 150, 200],      // Cyan
      secondary: [30, 60, 114],    // Dark blue
      success: [0, 180, 130],      // Green
      warning: [255, 180, 60],      // Amber
      danger: [255, 80, 100],      // Red
      text: [50, 50, 50],
      light: [240, 240, 240],
      gray: [120, 120, 120]
    };

    // Helper function to add a new page if needed
    const checkNewPage = (neededHeight) => {
      if (currentY + neededHeight > pageHeight - 30) {
        doc.addPage();
        currentY = margin;
        return true;
      }
      return false;
    };

    // Helper function to draw a rectangle with rounded corners
    const drawRoundedRect = (x, y, w, h, r, fill = false) => {
      doc.setDrawColor(...colors.primary);
      doc.setLineWidth(0.3);
      if (fill) {
        doc.setFillColor(245, 250, 255);
        doc.roundedRect(x, y, w, h, r, r, 'F');
      } else {
        doc.roundedRect(x, y, w, h, r, r, 'S');
      }
    };

    // Helper function to draw a bar chart
    const drawBarChart = (x, y, width, height, data, labels, barColor) => {
      const barCount = data.length;
      const barWidth = (width - 20) / barCount - 5;
      const maxValue = Math.max(...data, 1);
      
      doc.setFillColor(...barColor);
      data.forEach((value, index) => {
        const barHeight = (value / maxValue) * (height - 20);
        const xPos = x + 10 + index * (barWidth + 5);
        const yPos = y + height - barHeight - 10;
        doc.roundedRect(xPos, yPos, barWidth, barHeight, 2, 2, 'F');
        
        // Add value label
        doc.setFontSize(8);
        doc.setTextColor(...colors.text);
        doc.text(String(value), xPos + barWidth/2, yPos - 3, { align: 'center' });
        
        // Add label
        doc.setFontSize(7);
        doc.setTextColor(...colors.gray);
        const label = labels[index]?.length > 8 ? labels[index].substring(0, 8) + '..' : labels[index];
        doc.text(label, xPos + barWidth/2, y + height - 3, { align: 'center' });
      });
    };

    // Helper function to draw a line chart
    const drawLineChart = (x, y, width, height, data, labels, lineColor) => {
      if (!data || data.length < 2) return;
      
      const maxValue = Math.max(...data, 1);
      const minValue = Math.min(...data, 0);
      const range = maxValue - minValue || 1;
      
      const stepX = (width - 20) / (data.length - 1);
      
      // Draw grid lines
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      for (let i = 0; i <= 4; i++) {
        const gridY = y + 10 + (height - 20) * (i / 4);
        doc.line(x + 10, gridY, x + width - 10, gridY);
      }
      
      // Draw the line
      doc.setDrawColor(...lineColor);
      doc.setLineWidth(1.5);
      
      const points = data.map((value, index) => ({
        x: x + 10 + index * stepX,
        y: y + height - 10 - ((value - minValue) / range) * (height - 20)
      }));
      
      // Draw connecting lines
      for (let i = 0; i < points.length - 1; i++) {
        doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      }
      
      // Draw points and labels
      doc.setFontSize(7);
      doc.setTextColor(...colors.gray);
      points.forEach((point, index) => {
        // Draw point
        doc.setFillColor(...lineColor);
        doc.circle(point.x, point.y, 2, 'F');
        
        // Draw label (skip some labels if too many points)
        if (labels[index] && (index === 0 || index === points.length - 1 || index % Math.ceil(data.length / 6) === 0)) {
          doc.text(labels[index], point.x, y + height - 2, { align: 'center' });
        }
      });
      
      // Draw Y-axis labels
      doc.setFontSize(7);
      doc.setTextColor(...colors.gray);
      for (let i = 0; i <= 4; i++) {
        const value = maxValue - (range * i / 4);
        const labelY = y + 10 + (height - 20) * (i / 4);
        doc.text(String(Math.round(value * 10) / 10), x + 5, labelY + 2, { align: 'right' });
      }
    };

    // ==================== HEADER SECTION ====================
    // Company logo area (placeholder)
    doc.setFillColor(...colors.primary);
    doc.roundedRect(margin, currentY, 12, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('AM', margin + 2, currentY + 8);

    // Title
    doc.setTextColor(...colors.secondary);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Employee Activity Tracker Report", margin + 18, currentY + 8);

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.gray);
    doc.text("Comprehensive Activity Summary", margin + 18, currentY + 15);

    currentY += 30;

    // ==================== REPORT INFO BAR ====================
    const infoBoxHeight = 18;
    doc.setFillColor(250, 252, 255);
    doc.roundedRect(margin, currentY, pageWidth - 2*margin, infoBoxHeight, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setTextColor(...colors.gray);
    
    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    doc.text(`Report Generated: ${reportDate}`, margin + 5, currentY + 7);
    doc.text(`Machine: ${config.machine || 'N/A'}`, margin + 80, currentY + 7);
    doc.text(`User ID: ${config.userId || 'N/A'}`, margin + 140, currentY + 7);

    currentY += infoBoxHeight + 15;

    // ==================== EXECUTIVE SUMMARY ====================
    doc.setFontSize(14);
    doc.setTextColor(...colors.secondary);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Summary", margin, currentY);
    currentY += 8;

    // Summary stats cards
    const cardWidth = (pageWidth - 2*margin - 15) / 4;
    const stats = [
      { label: 'Total Records', value: summary.totalRecords || 0, color: colors.primary },
      { label: 'Total Hours', value: (summary.totalHours || 0).toFixed(1), color: colors.secondary },
      { label: 'Active %', value: `${summary.activePercentage || 0}%`, color: colors.success },
      { label: 'Avg Processes', value: (summary.avgProcesses || 0).toFixed(1), color: colors.warning }
    ];

    stats.forEach((stat, index) => {
      const x = margin + index * (cardWidth + 5);
      drawRoundedRect(x, currentY, cardWidth, 22, 3, true);
      
      doc.setFontSize(9);
      doc.setTextColor(...colors.gray);
      doc.setFont("helvetica", "normal");
      doc.text(stat.label, x + 5, currentY + 7);
      
      doc.setFontSize(16);
      doc.setTextColor(...stat.color);
      doc.setFont("helvetica", "bold");
      doc.text(String(stat.value), x + 5, currentY + 17);
    });

    currentY += 32;

    // ==================== STATE DISTRIBUTION BAR CHART ====================
    checkNewPage(70);
    
    doc.setFontSize(14);
    doc.setTextColor(...colors.secondary);
    doc.setFont("helvetica", "bold");
    doc.text("State Distribution", margin, currentY);
    currentY += 10;

    // Calculate Active vs Idle counts and percentages from total records
    let activeCount = 0;
    let idleCount = 0;
    const totalRecords = activityData?.length || 0;
    
    if (totalRecords > 0) {
      activeCount = activityData.filter(a => a.state === 'active').length;
      idleCount = activityData.filter(a => a.state === 'idle').length;
    }
    
    // Fallback to summary data if no activity data
    if (activeCount === 0 && idleCount === 0) {
      activeCount = summary.stateDistribution?.active || 0;
      idleCount = summary.stateDistribution?.idle || 0;
    }
    
    // Calculate percentages
    const totalStateRecords = activeCount + idleCount;
    const activePercentage = totalStateRecords > 0 ? Math.round((activeCount / totalStateRecords) * 100) : 0;
    const idlePercentage = totalStateRecords > 0 ? Math.round((idleCount / totalStateRecords) * 100) : 0;
    
    const chartWidth = pageWidth - 2 * margin;
    const chartHeight = 45;
    
    // Bar chart with percentage values
    const simpleData = [activePercentage, idlePercentage];
    const simpleLabels = ['Active', 'Idle'];
    
    drawBarChart(margin, currentY, chartWidth, chartHeight, simpleData, simpleLabels, colors.success);
    
    // Add legend with counts and percentages
    const legendY = currentY + chartHeight + 5;
    doc.setFillColor(...colors.success);
    doc.roundedRect(margin + 5, legendY, 8, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...colors.text);
    doc.setFont("helvetica", "normal");
    doc.text(`Active: ${activeCount} (${activePercentage}%)`, margin + 17, legendY + 6);
    
    doc.setFillColor(...colors.warning);
    doc.roundedRect(margin + 100, legendY, 8, 8, 1, 1, 'F');
    doc.text(`Idle: ${idleCount} (${idlePercentage}%)`, margin + 112, legendY + 6);

    currentY += chartHeight + 25;

    // ==================== TOP APPLICATIONS ====================
    checkNewPage(60);
    
    doc.setFontSize(14);
    doc.setTextColor(...colors.secondary);
    doc.setFont("helvetica", "bold");
    doc.text("Top Applications Usage", margin, currentY);
    currentY += 8;

    if (summary.topApps && summary.topApps.length > 0) {
      const appData = summary.topApps.map(a => a.usageCount);
      const appLabels = summary.topApps.map(a => a.appName);
      
      drawBarChart(margin, currentY, chartWidth, 50, appData, appLabels, colors.primary);
      
      // Detailed list below chart
      currentY += 60;
      doc.setFontSize(10);
      doc.setTextColor(...colors.secondary);
      doc.text("Detailed Application Usage:", margin, currentY);
      currentY += 8;
      
      doc.setFontSize(9);
      doc.setTextColor(...colors.text);
      summary.topApps.forEach((app, index) => {
        doc.setFont("helvetica", "normal");
        doc.text(`${index + 1}. ${app.appName}`, margin + 5, currentY);
        doc.setFont("helvetica", "bold");
        doc.text(`${app.usageCount} uses`, margin + 100, currentY);
        currentY += 7;
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(...colors.gray);
      doc.text("No application data available", margin + 5, currentY + 10);
      currentY += 25;
    }

    currentY += 10;

    // ==================== DAILY ACTIVITY ====================
    checkNewPage(60);
    
    doc.setFontSize(14);
    doc.setTextColor(...colors.secondary);
    doc.setFont("helvetica", "bold");
    doc.text("Daily Activity Trend", margin, currentY);
    currentY += 10;

    if (summary.dailyActivity && summary.dailyActivity.length > 0) {
      const dailyData = summary.dailyActivity.slice(0, 7).map(d => Math.round(d.minutesTracked / 60 * 10) / 10); // Convert to hours
      const dailyLabels = summary.dailyActivity.slice(0, 7).map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      
      drawBarChart(margin, currentY, chartWidth, 45, dailyData, dailyLabels, colors.secondary);
      
      // Add time values
      currentY += 55;
      doc.setFontSize(9);
      doc.setTextColor(...colors.gray);
      summary.dailyActivity.slice(0, 7).forEach((day, index) => {
        const x = margin + 10 + index * ((chartWidth - 20) / 7);
        const hours = (day.minutesTracked / 60).toFixed(1);
        doc.text(`${hours}h`, x, currentY);
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(...colors.gray);
      doc.text("No daily activity data available", margin + 5, currentY + 10);
    }

    currentY += 20;

    // ==================== FORBIDDEN APPS STATUS ====================
    checkNewPage(40);
    
    doc.setFontSize(14);
    doc.setTextColor(...colors.secondary);
    doc.setFont("helvetica", "bold");
    doc.text("Forbidden Applications Monitor", margin, currentY);
    currentY += 10;

    const forbiddenCount = forbiddenApps?.length || 0;
    
    if (forbiddenCount > 0) {
      doc.setFillColor(255, 245, 245);
      doc.roundedRect(margin, currentY, pageWidth - 2*margin, 15, 2, 2, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(...colors.danger);
      doc.text(`Currently Monitoring ${forbiddenCount} Forbidden Applications:`, margin + 5, currentY + 6);
      currentY += 18;
      
      doc.setFontSize(8);
      doc.setTextColor(...colors.text);
      forbiddenApps.slice(0, 5).forEach((app, index) => {
        doc.text(`• ${app}`, margin + 5, currentY);
        currentY += 5;
      });
      if (forbiddenCount > 5) {
        doc.text(`... and ${forbiddenCount - 5} more`, margin + 5, currentY);
        currentY += 5;
      }
    } else {
      doc.setFillColor(245, 255, 245);
      doc.roundedRect(margin, currentY, pageWidth - 2*margin, 15, 2, 2, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(...colors.success);
      doc.text("✓ No forbidden applications configured - All applications allowed", margin + 5, currentY + 6);
      currentY += 20;
    }

    currentY += 15;

    // ==================== RECENT ACTIVITY SAMPLE ====================
    checkNewPage(50);
    
    doc.setFontSize(14);
    doc.setTextColor(...colors.secondary);
    doc.setFont("helvetica", "bold");
    doc.text("Recent Activity Sample (Last 10 Events)", margin, currentY);
    currentY += 10;

    // Table header
    const tableWidth = pageWidth - 2 * margin;
    doc.setFillColor(...colors.secondary);
    doc.rect(margin, currentY, tableWidth, 8, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Time", margin + 5, currentY + 5.5);
    doc.text("Application", margin + 35, currentY + 5.5);
    doc.text("Title", margin + 85, currentY + 5.5);
    doc.text("State", margin + 135, currentY + 5.5);
    doc.text("Processes", margin + 155, currentY + 5.5);
    currentY += 8;

    // Table rows
    doc.setFont("helvetica", "normal");
    const recentActivities = activityData?.slice(0, 10) || [];
    
    recentActivities.forEach((activity, index) => {
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, currentY, tableWidth, 7, 'F');
      }
      
      doc.setTextColor(...colors.text);
      doc.setFontSize(8);
      
      const time = new Date(activity.time).toLocaleTimeString();
      const app = (activity.activeApp || 'Unknown').substring(0, 20);
      const state = activity.state || 'unknown';
      const title = (activity.activeTitle || 'Unknown').substring(0, 20);
      const processes = activity.processCount || 0;
      
      doc.text(time, margin + 5, currentY + 5);
      doc.text(app, margin + 35, currentY + 5);
      doc.text(title, margin + 85, currentY + 5);
      
      // State color indicator
      if (state === 'active') doc.setTextColor(...colors.success);
      else if (state === 'idle') doc.setTextColor(...colors.warning);
      else doc.setTextColor(...colors.gray);
      
      doc.text(state, margin + 135, currentY + 5);
      
      doc.setTextColor(...colors.text);
      doc.text(String(processes), margin + 160, currentY + 5);
      
      currentY += 7;
    });

    // ==================== FOOTER ====================
    // Check if we need a new page for footer
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = margin;
    }

    currentY = pageHeight - 25;
    
    // Footer line
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    
    currentY += 8;
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(...colors.gray);
    doc.setFont("helvetica", "normal");
    doc.text("Generated by AgentManager - Employee Activity Tracking System", margin, currentY);
    doc.text(`Page 1 of ${doc.internal.getNumberOfPages()}`, pageWidth - margin - 20, currentY, { align: 'right' });
    
    currentY += 5;
    doc.text(`Report ID: RPT-${Date.now().toString(36).toUpperCase()}`, margin, currentY);
    doc.text(`Confidential - For Internal Use Only`, pageWidth - margin - 20, currentY, { align: 'right' });

    // Save the PDF
    const filename = `Activity-Report-${config.machine || 'Machine'}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const handleDownloadPDF = useCallback(async () => {
    try {
      // Fetch summary data
      const response = await axios.get(`${BASE}/api/track/latest-summary`);
      const summary = response.data.summary || response.data;
      
      // Fetch all activity data for accurate state distribution calculation
      const activityResponse = await axios.get(`${BASE}/api/track/activity`, { params: { limit: 1000 } });
      const allActivityData = activityResponse.data?.data || activityResponse.data || [];
      
      // Use the full activity data for the table (last 10)
      const recentActivity = allActivityData.slice(0, 10);
      
      // Fetch state distribution data for the chart
      let stateDistributionData = null;
      try {
        const stateResponse = await axios.get(`${BASE}/api/track/state-distribution`, { params: { limit: 50 } });
        stateDistributionData = stateResponse.data?.data || [];
      } catch (e) {
        console.log("Could not fetch state distribution data");
      }
      
      // Fetch forbidden apps
      let forbiddenApps = [];
      try {
        const forbiddenResponse = await axios.get(`${BASE}/api/control/forbidden`);
        forbiddenApps = forbiddenResponse.data?.apps || [];
      } catch (e) {
        console.log("Could not fetch forbidden apps");
      }
      
      // Generate comprehensive PDF with full activity data
      await generateComprehensivePDF(summary, allActivityData, forbiddenApps, stateDistributionData);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again. Make sure the backend is running.");
    }
  }, [config.machine, config.userId]);

  const now     = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour12:false });
  const dateStr = now.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });

  const TABS = [
    { key:"overview",  label:"Overview",  icon:"" },
    { key:"config",    label:"Config",    icon:"" },
    { key:"forbidden", label:"Forbidden", icon:"" },
    { key:"activity",  label:"Activity",  icon:"" },
  ];

  const blockedCount = activityData.filter(a =>
    a.state==="blocked" || forbidden.includes((a.activeApp||"").toLowerCase())
  ).length;

  const TRACKER_OFFLINE_MS = 20000;
  const latestActivityMs = activityData.length > 0
    ? new Date(activityData[0]?.time).getTime()
    : 0;
  const isFreshActivity = Number.isFinite(latestActivityMs) && (Date.now() - latestActivityMs) <= TRACKER_OFFLINE_MS;
  const trackerStatus = (!fetchError && isFreshActivity) ? "online" : "offline";

  return (
    <div style={{ fontFamily:"var(--font)", background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column" }}>

      <div style={{ background:C.s1, borderBottom:`1px solid ${C.b1}`, padding:"0 2rem", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${C.cyan},${C.blue})`, display:"grid", placeItems:"center", fontSize:".7rem", boxShadow:`0 0 16px ${C.cyan}40`, flexShrink:0 }}>AM</div>
          <div>
            <div style={{ fontFamily:"var(--font)", fontWeight:700, fontSize:".9rem", color:C.text, letterSpacing:"-.01em" }}>AgentManager</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:".55rem", color:C.muted, textTransform:"uppercase", letterSpacing:".1em" }}>Prototype v1.0</div>
          </div>
        </div>

        <div style={{ display:"flex", gap:2, background:C.s2, border:`1px solid ${C.b1}`, borderRadius:11, padding:3 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ fontFamily:"var(--font)", fontSize:".7rem", fontWeight:tab===t.key?600:400, padding:"6px 18px", borderRadius:9, border:"none", cursor:"pointer", transition:"all .2s", background:tab===t.key?`linear-gradient(135deg,${C.cyan}22,${C.blue}15)`:"transparent", color:tab===t.key?C.cyan:C.muted, boxShadow:tab===t.key?`0 0 14px ${C.cyan}18`:"none", display:"flex", alignItems:"center", gap:0 }}>
              <span style={{ fontSize:".8rem" }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {trackerRunning ? (
            <Btn onClick={handleStopTracker} variant="danger" size="sm" disabled={changingStatus}>
              Stop
            </Btn>
          ) : (
            <Btn onClick={handleStartTracker} variant="success" size="sm" disabled={changingStatus}>
              Start
            </Btn>
          )}
          <Btn onClick={() => fetchData(page, limit)} variant="ghost" size="sm" disabled={loading}>
            Refresh
          </Btn>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"var(--mono)", fontSize:".75rem", color:C.text, letterSpacing:".04em" }}>{timeStr}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:".58rem", color:C.muted }}>{dateStr}</div>
          </div>
          <StatusDot status={trackerStatus} />
        </div>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        <div style={{ width:200, background:C.s1, borderRight:`1px solid ${C.b1}`, padding:"1.2rem 1rem", flexShrink:0, display:"flex", flexDirection:"column", gap:"0.8rem" }}>
          <SectionLabel>Agent Information</SectionLabel>
          {[
            { label:"Machine", value:config.machine },
            { label:"User ID", value:config.userId  },
            { label:"Status",  value:trackerStatus === "online" ? "Online" : "Offline" },
            { label:"Blocked", value:`${forbidden.length} apps` },
            { label:"Records", value:totalRecords },
          ].map(item => (
            <div key={item.label} style={{ borderBottom:`1px solid ${C.b1}`, paddingBottom:"0.7rem" }}>
              <div style={{ fontFamily:"var(--mono)", fontSize:".55rem", letterSpacing:".1em", textTransform:"uppercase", color:C.muted, marginBottom:3 }}>{item.label}</div>
              <div style={{ fontFamily:"var(--mono)", fontSize:".72rem", color:C.cyan2 }}>{item.value}</div>
            </div>
          ))}
          <div style={{ marginTop:"auto", fontFamily:"var(--mono)", fontSize:".55rem", letterSpacing:".08em", textTransform:"uppercase", color:C.muted, marginBottom:4 }}>API Target</div>
          <div style={{ fontFamily:"var(--mono)", fontSize:".58rem", color:C.text2, wordBreak:"break-all", lineHeight:1.5, background:C.s3, padding:"8px", borderRadius:8, border:`1px solid ${C.b1}` }}>
            {config.api}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"2rem 2.5rem" }}>
          {tab==="overview"  && <OverviewPanel  config={config} forbidden={forbidden} activityData={activityData} onDownloadPDF={handleDownloadPDF} />}
          {tab==="config"    && <ConfigPanel    config={config} onSave={setConfig} />}
          {tab==="forbidden" && <ForbiddenPanel apps={forbidden} onSave={setForbidden} />}
          {tab==="activity"  && (
            <ActivityPanel
              forbidden={forbidden}
              activityData={activityData}
              loading={loading}
              fetchError={fetchError}
              pagination={{ page, limit, totalPages, totalRecords }}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          )}
        </div>
      </div>

      <div style={{ background:C.s1, borderTop:`1px solid ${C.b1}`, padding:"0 2rem", height:30, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontFamily:"var(--mono)", fontSize:".6rem", color:C.muted }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:loading?C.amber:fetchError?C.red:C.green, display:"inline-block", marginRight:5, animation:loading?"pulse 2s ease-in-out infinite":"none" }} />
            {loading ? "Loading..." : fetchError ? "Error" : "Tracking Active"}
          </span>
          <span style={{ fontFamily:"var(--mono)", fontSize:".6rem", color:C.muted }}>Events: {totalRecords}</span>
          <span style={{ fontFamily:"var(--mono)", fontSize:".6rem", color:C.red }}>Blocked: {blockedCount}</span>
        </div>
        <span style={{ fontFamily:"var(--mono)", fontSize:".6rem", color:C.muted }}>AgentManager - prototype - {config.machine}</span>
      </div>
    </div>
  );
}
