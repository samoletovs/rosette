import { useRef, useState } from "react";
import type { ReactNode } from "react";

interface PlanUploadProps {
  file: File | null;
  previewUrl: string;
  ready: boolean;
  retry: boolean;
  onFile: (file: File) => void;
  onAnalyze: () => void;
  children: ReactNode;
}

export function PlanUpload({ file, previewUrl, ready, retry, onFile, onAnalyze, children }: PlanUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <section className="upload-layout" aria-labelledby="upload-heading">
      <div className="plan-sheet">
        <div className="sheet-heading"><span className="eyebrow">Your starting point</span><span>Floor plan</span></div>
        <div className={`drop ${dragging ? "over" : ""} ${file ? "filled" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); const chosen = event.dataTransfer.files[0]; if (chosen) onFile(chosen); }}>
          {previewUrl && file?.type !== "application/pdf" ? <img src={previewUrl} alt="Your selected floor plan" /> : (
            <svg className="upload-drawing" viewBox="0 0 360 240" aria-hidden="true">
              <path d="M30 30h300v180H30zm180 0v180M30 130h180M130 130v80" />
              <path className="drawing-furniture" d="M52 52h95v34H52zm-2 103h48v36H50zm180-96h75v38h-75zm0 72h75v57h-75z" />
              <path className="drawing-door" d="M210 108h-40a40 40 0 0 0 40 40M95 130V95a35 35 0 0 1 35 35" />
            </svg>
          )}
          <input ref={input} id="plan-file" className="sr-only" tabIndex={-1} type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf" aria-label="Floor plan file"
            onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen) onFile(chosen); event.target.value = ""; }} />
          <button type="button" className="btn upload-button" id="choose-plan" onClick={() => input.current?.click()} aria-describedby="upload-help">
            {file ? "Choose a different plan" : "Choose floor plan"} <span aria-hidden="true">↗</span>
          </button>
          <p id="upload-help">Or drop it here. PNG, JPEG, WebP or PDF · up to 10 MB</p>
          {file && <p className="file-name" role="status">{file.name}</p>}
          {file?.type === "application/pdf" && <p className="file-note">PDF selected. For the interactive placement preview, use an image version of your plan.</p>}
        </div>
        <p className="sheet-caption">Use a clear plan with visible room labels. No plan? An image of a simple sketch works too.</p>
      </div>
      <div className="upload-details">
        <p className="eyebrow">About your property</p>
        <h2 id="upload-heading">A good plan starts here.</h2>
        <p className="muted">Choose your property and country. You’ll check the detected rooms before placing anything.</p>
        <div className="form-row">{children}</div>
        <button className="btn primary full" disabled={!file || !ready} onClick={onAnalyze}>
          {file && !ready ? "Reading your file…" : retry ? "Try analysis again" : "Analyze floor plan"} <span aria-hidden="true">→</span>
        </button>
        <p className="field-help">Analysis can take up to 90 seconds. You stay in control of the next step.</p>
      </div>
    </section>
  );
}
