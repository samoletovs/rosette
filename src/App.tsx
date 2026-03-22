import { useState, useRef, useCallback, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  uploadFile,
  analyzeFloorPlan,
  getStandards,
  getCountries,
  calculateSockets,
  generateDescription,
  submitFeedback,
  getAuthUser,
  AuthUser,
} from "./api";
import { generateRoomLayouts, generateCircuitDiagram, generateWiringDiagram, drawReferencePlan } from "./planGenerator";

type Step = "upload" | "analyzing" | "review" | "calculating" | "results";

const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment / Flat" },
  { value: "office", label: "Office" },
  { value: "commercial", label: "Commercial" },
];

const ROOM_TYPE_MAP: Record<string, string> = {
  kitchen: "kitchen", living_room: "living_room", living_area: "living_room",
  lounge: "living_room", sitting_room: "living_room", dining_room: "dining_room",
  dining_area: "dining_room", dining: "dining_room", bedroom: "bedroom",
  bedroom_1: "bedroom", bedroom_2: "bedroom", bedroom_3: "bedroom",
  master_bedroom: "bedroom", bathroom: "bathroom", bath: "bathroom",
  shower_room: "bathroom", hallway: "hallway", corridor: "hallway",
  entrance: "hallway", foyer: "hallway", hall: "hallway",
  home_office: "home_office", study: "home_office", office: "home_office",
  wc: "wc", toilet: "wc", "c.r.": "wc", cr: "wc", comfort_room: "wc",
  restroom: "wc", utility_room: "utility_room", laundry: "utility_room",
  storage: "utility_room", pantry: "utility_room", garage: "garage",
  carport: "garage", balcony: "balcony", terrace: "balcony", patio: "balcony",
  porch: "balcony", veranda: "balcony", loggia: "balcony",
};

function mapRoomType(type: string): string {
  const n = type.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  return ROOM_TYPE_MAP[n] || ROOM_TYPE_MAP[type.toLowerCase()] || n;
}

const FLAG: Record<string, string> = { LV: "\u{1F1F1}\u{1F1FB}", LT: "\u{1F1F1}\u{1F1F9}", EE: "\u{1F1EA}\u{1F1EA}" };

export default function App() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [base64Url, setBase64Url] = useState("");
  const [countryCode, setCountryCode] = useState("LV");
  const [propertyType, setPropertyType] = useState("apartment");
  const [countries, setCountries] = useState<{ code: string; country: string }[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [standards, setStandards] = useState<any>(null);
  const [placements, setPlacements] = useState<any>(null);
  const [descEn, setDescEn] = useState("");
  const [descLocal, setDescLocal] = useState("");
  const [specLang, setSpecLang] = useState<"en" | "local">("en");
  const [langName, setLangName] = useState("Latvian");
  const [svgRoomLayouts, setSvgRoomLayouts] = useState("");
  const [svgCircuitDiagram, setSvgCircuitDiagram] = useState("");
  const [svgWiringDiagram, setSvgWiringDiagram] = useState("");
  const [diagramTab, setDiagramTab] = useState<"rooms" | "circuits" | "wiring" | "plan">("rooms");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [socketOverrides, setSocketOverrides] = useState<Record<string, number>>({});
  const [theme, setTheme] = useState(() => localStorage.getItem("rosette-theme") || "ocean");
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbType, setFbType] = useState("improvement");
  const [fbTitle, setFbTitle] = useState("");
  const [fbDesc, setFbDesc] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbSuccess, setFbSuccess] = useState(false);
  const [fbError, setFbError] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);

  // Fetch authenticated user
  useEffect(() => {
    getAuthUser().then(setUser);
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("rosette-theme", theme);
  }, [theme]);

  useEffect(() => {
    getCountries()
      .then((r) => setCountries(r.countries))
      .catch(() =>
        setCountries([
          { code: "LV", country: "Latvia" },
          { code: "LT", country: "Lithuania" },
          { code: "EE", country: "Estonia" },
        ])
      );
  }, []);

  // Draw reference plan (no socket dots) when results tab shows the floor plan
  useEffect(() => {
    if (step !== "results" || !base64Url || diagramTab !== "plan") return;
    const timer = setTimeout(() => {
      if (!canvasRef.current) return;
      const img = new Image();
      img.onload = () => {
        if (canvasRef.current) {
          drawReferencePlan(canvasRef.current, img);
          setCanvasReady(true);
        }
      };
      img.src = base64Url;
    }, 100);
    return () => clearTimeout(timer);
  }, [step, base64Url, diagramTab]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError("");
    const reader = new FileReader();
    reader.onload = () => setBase64Url(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const startAnalysis = async () => {
    if (!file || !base64Url) return;
    setStep("analyzing");
    setError("");
    try {
      const [analysis, std] = await Promise.all([
        analyzeFloorPlan(base64Url, propertyType),
        getStandards(countryCode),
        uploadFile(file).catch(() => {}),
      ]);
      const analysisRooms = analysis.rooms || [];
      if (analysisRooms.length === 0) {
        setError("No rooms detected in the floor plan. Please upload a clearer image with visible room labels.");
        setStep("upload");
        return;
      }
      setRooms(analysisRooms);
      setStandards(std);
      // Initialize socket overrides from standards
      const overrides: Record<string, number> = {};
      for (const room of analysisRooms) {
        const stdKey = mapRoomType(room.type);
        const min = std?.room_rules?.[stdKey]?.minimum_sockets;
        overrides[room.id] = min ?? 2;
      }
      setSocketOverrides(overrides);
      setStep("review");
    } catch (err: any) {
      setError(err.name === "AbortError" ? "Request timed out — please try again." : (err.message || "Analysis failed"));
      setStep("upload");
    }
  };

  const startCalculation = async () => {
    setStep("calculating");
    setError("");
    try {
      // Augment rooms with user's socket overrides
      const roomsWithOverrides = rooms.map((r: any) => ({
        ...r,
        requested_sockets: socketOverrides[r.id] ?? standards?.room_rules?.[mapRoomType(r.type)]?.minimum_sockets ?? 2,
      }));
      const result = await calculateSockets(roomsWithOverrides, countryCode, propertyType, standards);
      setPlacements(result);

      // Generate professional diagrams
      setSvgRoomLayouts(generateRoomLayouts(rooms, result.placements || []));
      setSvgCircuitDiagram(generateCircuitDiagram(result.circuits || [], result.total_sockets || 0, result.rcd_groups));
      setSvgWiringDiagram(generateWiringDiagram(result.wiring || [], rooms, result.circuits || []));

      const desc = await generateDescription(roomsWithOverrides, result, countryCode, propertyType);
      setDescEn(desc.description_en || "");
      setDescLocal(desc.description_local || "");
      setLangName(desc.language?.name || "Local");
      setStep("results");
    } catch (err: any) {
      setError(err.name === "AbortError" ? "Calculation timed out — please try again." : (err.message || "Calculation failed"));
      setStep("review");
    }
  };

  const download = (data: string, name: string, mime: string) => {
    const a = document.createElement("a");
    a.download = name;
    a.href = data.startsWith("data:") ? data : URL.createObjectURL(new Blob([data], { type: mime }));
    a.click();
  };

  const reset = () => {
    setStep("upload"); setFile(null); setPreviewUrl(""); setBase64Url("");
    setRooms([]); setStandards(null); setPlacements(null);
    setDescEn(""); setDescLocal(""); setSvgRoomLayouts(""); setSvgCircuitDiagram(""); setSvgWiringDiagram("");
    setError(""); setCanvasReady(false); setSocketOverrides({});
  };

  const handleFeedbackSubmit = async () => {
    if (!fbTitle.trim() || !fbDesc.trim()) { setFbError("Title and description are required"); return; }
    setFbSending(true); setFbError("");
    try {
      await submitFeedback({ type: fbType, title: fbTitle, description: fbDesc, page: step });
      setFbSuccess(true);
      setTimeout(() => { setShowFeedback(false); setFbSuccess(false); setFbTitle(""); setFbDesc(""); setFbType("improvement"); }, 1800);
    } catch (err: any) {
      setFbError(err.message || "Failed to submit");
    } finally {
      setFbSending(false);
    }
  };

  const stepsData: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "analyzing", label: "Analyze" },
    { key: "review", label: "Review" },
    { key: "calculating", label: "Calculate" },
    { key: "results", label: "Results" },
  ];
  const stepIdx = ["upload", "analyzing", "review", "calculating", "results"].indexOf(step);

  return (
    <div className="app">
      <header>
        <div className="brand"><span className="brand-icon">⚡</span><h1>Rosette</h1></div>
        <p className="tagline">Electric socket planner — Baltic standards</p>
        {user && (
          <div className="user-bar">
            <span className="user-name">{user.userDetails}</span>
            <a href="/.auth/logout?post_logout_redirect_uri=/signedout.html" className="btn ghost sm">Sign out</a>
          </div>
        )}
      </header>

      <nav className="stepper">
        {stepsData.map((s, i) => (
          <div key={s.key} className={`s-item ${i === stepIdx ? "current" : i < stepIdx ? "done" : ""}`}>
            <div className="s-dot">{i < stepIdx ? "✓" : i + 1}</div>
            <span className="s-label">{s.label}</span>
          </div>
        ))}
        <div className="s-track"><div className="s-fill" style={{ width: `${(stepIdx / 4) * 100}%` }} /></div>
      </nav>

      {error && <div className="alert">{error}<button onClick={() => setError("")}>×</button></div>}

      <main>
        {step === "upload" && (
          <section className="card fade-in">
            <h2>Upload floor plan</h2>
            <p className="muted">Select country, property type, and upload your plan</p>
            <div className="form-row">
              <label className="form-field">
                <span>Country</span>
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                  {(countries.length > 0 ? countries : [{ code: "LV", country: "Latvia" }, { code: "LT", country: "Lithuania" }, { code: "EE", country: "Estonia" }]).map((c) => (
                    <option key={c.code} value={c.code}>{c.country}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Property type</span>
                <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                  {PROPERTY_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </label>
            </div>
            <div className={`drop ${dragging ? "over" : ""} ${file ? "filled" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {previewUrl
                ? <><img src={previewUrl} alt="Preview" /><span className="pill">{file?.name}</span></>
                : <><div className="drop-icon">📐</div><p>Drop floor plan here</p><p className="muted sm">PNG, JPEG, WebP or PDF — max 10 MB</p></>}
            </div>
            <div className="btn-row" style={{justifyContent:'flex-end'}}><button className="btn primary" disabled={!file} onClick={startAnalysis}>Analyze floor plan →</button></div>
          </section>
        )}

        {(step === "analyzing" || step === "calculating") && (
          <section className="card fade-in center-content">
            <div className="pulse-ring" /><div className="pulse-icon">⚡</div>
            <h3>{step === "analyzing" ? "Analyzing floor plan" : "Calculating placements"}</h3>
            <p className="muted">{step === "analyzing" ? "AI is identifying rooms…" : `Applying ${countryCode} standards…`}</p>
          </section>
        )}

        {step === "review" && (
          <section className="card fade-in">
            <h2>Review detected rooms</h2>
            <p className="muted">{rooms.length} rooms detected — adjust socket counts if needed</p>
            <div className="room-list">
              {rooms.map((r: any) => {
                const min = standards?.room_rules?.[mapRoomType(r.type)]?.minimum_sockets;
                const count = socketOverrides[r.id] ?? min ?? 2;
                return (
                  <div key={r.id} className="room-row">
                    <div><strong>{r.name || r.type}</strong><span className="muted sm"> {r.area_m2} m² · {r.width_m}×{r.height_m}m</span></div>
                    <div className="socket-control">
                      <button className="cnt-btn" onClick={() => setSocketOverrides(p => ({...p, [r.id]: Math.max(0, count - 1)}))} aria-label="Decrease">−</button>
                      <span className="cnt-val">{count}</span>
                      <button className="cnt-btn" onClick={() => setSocketOverrides(p => ({...p, [r.id]: count + 1}))} aria-label="Increase">+</button>
                      <span className="cnt-label">sockets</span>
                      {min != null && count < min && <span className="cnt-warn">below min ({min})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={reset}>← Back</button>
              <button className="btn primary" onClick={startCalculation}>Calculate placements →</button>
            </div>
          </section>
        )}

        {step === "results" && placements && (
          <div className="results fade-in">
            <section className="card stats-bar">
              <div className="stat"><span className="stat-n">{placements.total_sockets || placements.placements?.length || 0}</span><span className="stat-l">Sockets</span></div>
              <div className="stat-sep" />
              <div className="stat"><span className="stat-n">{placements.total_circuits || placements.circuits?.length || 0}</span><span className="stat-l">Circuits</span></div>
              <div className="stat-sep" />
              <div className="stat"><span className="stat-n">{rooms.length}</span><span className="stat-l">Rooms</span></div>
              {placements.total_cable_m > 0 && <>
                <div className="stat-sep" />
                <div className="stat"><span className="stat-n">~{placements.total_cable_m}</span><span className="stat-l">Cable (m)</span></div>
              </>}
            </section>
            {placements.summary && <p className="summary-text">{placements.summary}</p>}

            {/* Electrical Diagrams with tabs */}
            <section className="card">
              <div className="spec-head">
                <h3>Electrical diagrams</h3>
                <div className="toggle-group">
                  <button className={`toggle-btn ${diagramTab === "rooms" ? "on" : ""}`} onClick={() => setDiagramTab("rooms")}>Room layouts</button>
                  <button className={`toggle-btn ${diagramTab === "circuits" ? "on" : ""}`} onClick={() => setDiagramTab("circuits")}>Circuit diagram</button>
                  <button className={`toggle-btn ${diagramTab === "wiring" ? "on" : ""}`} onClick={() => setDiagramTab("wiring")}>Wiring plan</button>
                  <button className={`toggle-btn ${diagramTab === "plan" ? "on" : ""}`} onClick={() => setDiagramTab("plan")}>Floor plan</button>
                </div>
              </div>

              {diagramTab === "rooms" && (
                <>
                  <div className="plan-box svg-box" dangerouslySetInnerHTML={{ __html: svgRoomLayouts }} />
                  <button className="btn outline" onClick={() => download(svgRoomLayouts, "rosette-room-layouts.svg", "image/svg+xml")}>↓ Download room layouts</button>
                </>
              )}
              {diagramTab === "circuits" && (
                <>
                  <div className="plan-box svg-box" dangerouslySetInnerHTML={{ __html: svgCircuitDiagram }} />
                  <button className="btn outline" onClick={() => download(svgCircuitDiagram, "rosette-circuit-diagram.svg", "image/svg+xml")}>↓ Download circuit diagram</button>
                </>
              )}
              {diagramTab === "wiring" && (
                <>
                  <div className="plan-box svg-box" dangerouslySetInnerHTML={{ __html: svgWiringDiagram }} />
                  <button className="btn outline" onClick={() => download(svgWiringDiagram, "rosette-wiring-plan.svg", "image/svg+xml")}>↓ Download wiring plan</button>
                </>
              )}
              {diagramTab === "plan" && (
                <>
                  <div className="plan-box"><canvas ref={canvasRef} /></div>
                  <p className="muted sm" style={{textAlign:"center", margin:"8px 0"}}>Original floor plan for reference — socket positions are in the specification above</p>
                  <button className="btn outline" disabled={!canvasReady} onClick={() => canvasRef.current && download(canvasRef.current.toDataURL("image/png"), "rosette-reference-plan.png", "image/png")}>↓ Download reference plan</button>
                </>
              )}
            </section>

            <section className="card">
              <div className="spec-head">
                <h3>Installation specification</h3>
                <div className="toggle-group">
                  <button className={`toggle-btn ${specLang === "en" ? "on" : ""}`} onClick={() => setSpecLang("en")}>🇬🇧 English</button>
                  <button className={`toggle-btn ${specLang === "local" ? "on" : ""}`} onClick={() => setSpecLang("local")}>{FLAG[countryCode] || "🌍"} {langName}</button>
                </div>
              </div>
              <div className="spec-body"><Markdown remarkPlugins={[remarkGfm]}>{specLang === "en" ? descEn : descLocal}</Markdown></div>
              <button className="btn outline" onClick={() => {
                const c = specLang === "en" ? descEn : descLocal;
                download(c, `rosette-spec-${specLang === "en" ? "en" : countryCode.toLowerCase()}.md`, "text/markdown");
              }}>↓ Download specification</button>
            </section>

            <div className="center-row"><button className="btn primary" onClick={reset}>Plan another property</button></div>
          </div>
        )}
      </main>

      <footer>
        <div className="theme-bar">
          {["ocean", "violet", "emerald", "rose", "midnight"].map((t) => (
            <div key={t} className={`theme-dot ${theme === t ? "active" : ""}`} data-t={t}
              onClick={() => setTheme(t)} title={t.charAt(0).toUpperCase() + t.slice(1)} />
          ))}
        </div>
        <button className="btn ghost feedback-btn" onClick={() => setShowFeedback(true)}>💬 Send feedback</button>
        <p>Rosette © 2026 · Baltic electrical standards (LBN · STR · EVS)</p>
      </footer>

      {showFeedback && (
        <div className="modal-overlay" onClick={() => !fbSending && setShowFeedback(false)}>
          <div className="modal fade-in" onClick={(e) => e.stopPropagation()}>
            {fbSuccess ? (
              <div className="center-content" style={{padding: "40px 24px"}}>
                <div style={{fontSize: "1.5rem", marginBottom: 12}}>✓</div>
                <h3>Thank you!</h3>
                <p className="muted">Your feedback has been submitted.</p>
              </div>
            ) : (
              <>
                <div className="modal-head">
                  <h3>Send feedback</h3>
                  <button className="modal-close" onClick={() => setShowFeedback(false)}>×</button>
                </div>
                <div className="modal-body">
                  <label className="form-field">
                    <span>Type</span>
                    <select value={fbType} onChange={(e) => setFbType(e.target.value)}>
                      <option value="bug">Bug report</option>
                      <option value="feature">Feature request</option>
                      <option value="improvement">Improvement</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Title</span>
                    <input type="text" className="fb-input" placeholder="Brief summary" value={fbTitle}
                      onChange={(e) => setFbTitle(e.target.value)} maxLength={200} />
                  </label>
                  <label className="form-field">
                    <span>Description</span>
                    <textarea className="fb-textarea" placeholder="Describe in detail…" value={fbDesc}
                      onChange={(e) => setFbDesc(e.target.value)} rows={4} maxLength={2000} />
                  </label>
                  {fbError && <p className="fb-error">{fbError}</p>}
                </div>
                <div className="modal-foot">
                  <button className="btn ghost" onClick={() => setShowFeedback(false)}>Cancel</button>
                  <button className="btn primary" disabled={fbSending || !fbTitle.trim() || !fbDesc.trim()} onClick={handleFeedbackSubmit}>
                    {fbSending ? "Sending…" : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
