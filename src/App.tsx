import { useState, useRef, useCallback, useEffect } from "react";
import {
  uploadFile,
  analyzeFloorPlan,
  getStandards,
  getCountries,
  calculateSockets,
  generateDescription,
} from "./api";
import { generateSocketSVG, drawAnnotatedPlan } from "./planGenerator";

type Step = "upload" | "analyzing" | "review" | "calculating" | "results";

const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment / Flat" },
  { value: "office", label: "Office" },
  { value: "commercial", label: "Commercial" },
];

// Maps AI-detected room types to standard keys
const ROOM_TYPE_MAP: Record<string, string> = {
  kitchen: "kitchen",
  living_room: "living_room",
  living_area: "living_room",
  lounge: "living_room",
  sitting_room: "living_room",
  dining_room: "dining_room",
  dining_area: "dining_room",
  dining: "dining_room",
  bedroom: "bedroom",
  bedroom_1: "bedroom",
  bedroom_2: "bedroom",
  bedroom_3: "bedroom",
  master_bedroom: "bedroom",
  bathroom: "bathroom",
  bath: "bathroom",
  shower_room: "bathroom",
  hallway: "hallway",
  corridor: "hallway",
  entrance: "hallway",
  foyer: "hallway",
  hall: "hallway",
  home_office: "home_office",
  study: "home_office",
  office: "home_office",
  wc: "wc",
  toilet: "wc",
  "c.r.": "wc",
  cr: "wc",
  comfort_room: "wc",
  restroom: "wc",
  utility_room: "utility_room",
  laundry: "utility_room",
  storage: "utility_room",
  pantry: "utility_room",
  garage: "garage",
  carport: "garage",
  balcony: "balcony",
  terrace: "balcony",
  patio: "balcony",
  porch: "balcony",
  veranda: "balcony",
  loggia: "balcony",
};

function mapRoomType(type: string): string {
  const normalized = type.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  return ROOM_TYPE_MAP[normalized] || ROOM_TYPE_MAP[type.toLowerCase()] || normalized;
}

export default function App() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [countryCode, setCountryCode] = useState("LV");
  const [propertyType, setPropertyType] = useState("apartment");
  const [countries, setCountries] = useState<{ code: string; country: string }[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [standards, setStandards] = useState<any>(null);
  const [placements, setPlacements] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [svgContent, setSvgContent] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

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

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  };

  const startAnalysis = async () => {
    if (!file) return;
    setStep("analyzing");
    setError("");
    try {
      // Convert to base64 data URL for AI analysis (avoids blob storage access issues)
      const base64Url = await fileToBase64(file);

      // Upload to storage in parallel (for record keeping)
      const [analysis, std] = await Promise.all([
        analyzeFloorPlan(base64Url, propertyType),
        getStandards(countryCode),
        uploadFile(file).then(u => setUploadedUrl(u.url)).catch(() => {}),
      ]);

      setRooms(analysis.rooms || []);
      setStandards(std);
      setStep("review");
    } catch (err: any) {
      setError(err.message || "Analysis failed");
      setStep("upload");
    }
  };

  const startCalculation = async () => {
    setStep("calculating");
    setError("");
    try {
      const result = await calculateSockets(rooms, countryCode, propertyType, standards);
      setPlacements(result);

      const svg = generateSocketSVG(rooms, result.placements || [], 800, 600);
      setSvgContent(svg);

      // Draw annotated image
      if (previewUrl && canvasRef.current) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imageRef.current = img;
          if (canvasRef.current) {
            drawAnnotatedPlan(canvasRef.current, img, result.placements || []);
          }
        };
        img.src = previewUrl;
      }

      // Generate description
      const desc = await generateDescription(rooms, result, countryCode, propertyType);
      setDescription(desc.description || "");

      setStep("results");
    } catch (err: any) {
      setError(err.message || "Calculation failed");
      setStep("review");
    }
  };

  const downloadCanvas = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "rosette-annotated-plan.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const downloadSVG = () => {
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = "rosette-socket-plan.svg";
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const downloadSpec = () => {
    const blob = new Blob([description], { type: "text/markdown" });
    const link = document.createElement("a");
    link.download = "rosette-specification.md";
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreviewUrl("");
    setUploadedUrl("");
    setRooms([]);
    setStandards(null);
    setPlacements(null);
    setDescription("");
    setSvgContent("");
    setError("");
  };

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Upload" },
    { key: "analyzing", label: "2. Analyze" },
    { key: "review", label: "3. Review" },
    { key: "calculating", label: "4. Calculate" },
    { key: "results", label: "5. Results" },
  ];

  const stepOrder: Step[] = ["upload", "analyzing", "review", "calculating", "results"];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className="app">
      <header>
        <h1>⚡ Rosette</h1>
        <p>Electric Socket Planner — Baltic Construction Standards</p>
      </header>

      <div className="step-indicator">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className={`step ${i === currentIdx ? "active" : i < currentIdx ? "completed" : ""}`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div className="card">
          <h2>Upload Floor Plan</h2>
          <div className="config-row" style={{ marginTop: 16 }}>
            <label>
              <span>Country</span>
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                {(countries.length > 0
                  ? countries
                  : [
                      { code: "LV", country: "Latvia" },
                      { code: "LT", country: "Lithuania" },
                      { code: "EE", country: "Estonia" },
                    ]
                ).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.country}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Property Type</span>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            className={`upload-zone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Floor plan preview" className="preview-image" />
                <p>{file?.name}</p>
              </>
            ) : (
              <>
                <h3>📋 Drop your floor plan here</h3>
                <p>or click to browse — PNG, JPEG, WebP, or PDF (max 10MB)</p>
              </>
            )}
          </div>

          <button
            className="primary"
            style={{ marginTop: 16 }}
            disabled={!file}
            onClick={startAnalysis}
          >
            Analyze Floor Plan
          </button>
        </div>
      )}

      {/* STEP 2: Analyzing */}
      {step === "analyzing" && (
        <div className="card">
          <div className="loading">
            <div className="spinner" />
            <p>Analyzing floor plan with AI...</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>
              Identifying rooms, dimensions, and features
            </p>
          </div>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === "review" && (
        <div className="card">
          <h2>Review Detected Rooms</h2>
          <p style={{ color: "var(--text-light)", marginBottom: 16 }}>
            {rooms.length} rooms detected. Verify and adjust if needed.
          </p>
          <ul className="room-list">
            {rooms.map((room: any) => (
              <li key={room.id} className="room-item">
                <div>
                  <span className="room-type">{room.name || room.type}</span>
                  <span style={{ color: "var(--text-light)", marginLeft: 8, fontSize: "0.85rem" }}>
                    {room.area_m2} m² ({room.width_m}×{room.height_m}m)
                  </span>
                </div>
                <span className="room-sockets">
                  Min: {standards?.room_rules?.[mapRoomType(room.type)]?.minimum_sockets || "?"} sockets
                </span>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button onClick={reset}>← Start Over</button>
            <button className="primary" onClick={startCalculation}>
              Calculate Socket Placements →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Calculating */}
      {step === "calculating" && (
        <div className="card">
          <div className="loading">
            <div className="spinner" />
            <p>Calculating socket placements...</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>
              Applying {countryCode} construction standards
            </p>
          </div>
        </div>
      )}

      {/* STEP 5: Results */}
      {step === "results" && placements && (
        <>
          <div className="card">
            <h2>Results</h2>
            <p style={{ color: "var(--text-light)" }}>
              {placements.total_sockets || placements.placements?.length || 0} sockets across{" "}
              {placements.total_circuits || placements.circuits?.length || 0} circuits
            </p>
            {placements.summary && (
              <p style={{ marginTop: 8 }}>{placements.summary}</p>
            )}
          </div>

          <div className="results-grid">
            <div className="card">
              <h3>Annotated Floor Plan</h3>
              <div className="plan-canvas-container">
                <canvas ref={canvasRef} />
              </div>
              <div className="download-buttons">
                <button onClick={downloadCanvas}>📥 Download Annotated Plan (PNG)</button>
              </div>
            </div>

            <div className="card">
              <h3>Socket Layout Diagram</h3>
              <div className="svg-output" dangerouslySetInnerHTML={{ __html: svgContent }} />
              <div className="download-buttons">
                <button onClick={downloadSVG}>📥 Download SVG Diagram</button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Installation Specification</h3>
            <div className="description-content">{description}</div>
            <div className="download-buttons">
              <button onClick={downloadSpec}>📥 Download Specification (Markdown)</button>
            </div>
          </div>

          <div className="card" style={{ textAlign: "center" }}>
            <button className="primary" onClick={reset}>
              ← Plan Another Property
            </button>
          </div>
        </>
      )}
    </div>
  );
}
