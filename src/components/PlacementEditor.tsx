import { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Group, Text, Line } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Room, SocketPlacement, Switchboard } from "../types";
import { ROOM_COLORS } from "../symbolLibrary";

// ── Constants ──

const SOCKET_COLORS: Record<string, string> = {
  standard_16a: "#4f46e5",
  dedicated: "#f59e0b",
  oven: "#ef4444",
  lighting: "#10b981",
};

const HEIGHT_PRESETS = [300, 600, 1100] as const;

const SOCKET_TYPES = [
  { value: "standard_16a", label: "Standard 16A" },
  { value: "dedicated", label: "Dedicated" },
  { value: "oven", label: "Oven (32A)" },
] as const;

interface PlacementEditorProps {
  imageUrl: string;
  rooms: Room[];
  placements: SocketPlacement[];
  switchboard: Switchboard;
  onConfirm: (placements: SocketPlacement[], switchboard: Switchboard) => void;
  onBack: () => void;
}

// ── Helpers ──

function pctToPixel(pct: number, size: number): number {
  return (pct / 100) * size;
}

function pixelToPct(px: number, size: number): number {
  return (px / size) * 100;
}

function findContainingRoom(xPct: number, yPct: number, rooms: Room[]): Room | undefined {
  return rooms.find((r) => {
    const p = r.position;
    return xPct >= p.x_pct && xPct <= p.x_pct + p.w_pct &&
           yPct >= p.y_pct && yPct <= p.y_pct + p.h_pct;
  });
}

function deriveWall(xPct: number, yPct: number, room: Room): string {
  const p = room.position;
  const relX = (xPct - p.x_pct) / p.w_pct;
  const relY = (yPct - p.y_pct) / p.h_pct;
  const distN = relY;
  const distS = 1 - relY;
  const distW = relX;
  const distE = 1 - relX;
  const min = Math.min(distN, distS, distW, distE);
  if (min === distN) return "north";
  if (min === distS) return "south";
  if (min === distW) return "west";
  return "east";
}

function switchboardPct(sb: Switchboard, rooms: Room[]): { x: number; y: number } {
  if (sb.x_pct !== undefined && sb.y_pct !== undefined) {
    return { x: sb.x_pct, y: sb.y_pct };
  }
  const room = rooms.find((r) => r.id === sb.room_id);
  if (!room) return { x: 50, y: 50 };
  const p = room.position;
  const cx = p.x_pct + p.w_pct / 2;
  const cy = p.y_pct + p.h_pct / 2;
  switch (sb.wall?.toLowerCase()) {
    case "north": return { x: cx, y: p.y_pct + 2 };
    case "south": return { x: cx, y: p.y_pct + p.h_pct - 2 };
    case "west": return { x: p.x_pct + 2, y: cy };
    case "east": return { x: p.x_pct + p.w_pct - 2, y: cy };
    default: return { x: cx, y: cy };
  }
}

let nextSocketId = 100;

// ── Component ──

export function PlacementEditor({
  imageUrl,
  rooms,
  placements: initialPlacements,
  switchboard: initialSwitchboard,
  onConfirm,
  onBack,
}: PlacementEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [sockets, setSockets] = useState<SocketPlacement[]>(initialPlacements);
  const [switchboard, setSwitchboard] = useState<Switchboard>(() => {
    const pos = switchboardPct(initialSwitchboard, rooms);
    return { ...initialSwitchboard, x_pct: pos.x, y_pct: pos.y };
  });
  const [selectedSocket, setSelectedSocket] = useState<string | null>(null);
  const [showDbPanel, setShowDbPanel] = useState(false);
  const [history, setHistory] = useState<{ sockets: SocketPlacement[]; switchboard: Switchboard }[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  // Responsive canvas sizing
  useEffect(() => {
    function resize() {
      if (!containerRef.current || !image) return;
      const maxW = containerRef.current.clientWidth;
      const ratio = image.naturalHeight / image.naturalWidth;
      const w = Math.min(maxW, 1200);
      const h = w * ratio;
      setStageSize({ width: w, height: h });
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [image]);

  // Push snapshot to history
  const pushHistory = useCallback(() => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIdx + 1);
      return [...trimmed, { sockets: structuredClone(sockets), switchboard: structuredClone(switchboard) }];
    });
    setHistoryIdx((prev) => prev + 1);
  }, [sockets, switchboard, historyIdx]);

  // Undo (Ctrl+Z)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (historyIdx > 0) {
          const prev = history[historyIdx - 1];
          setSockets(prev.sockets);
          setSwitchboard(prev.switchboard);
          setHistoryIdx((i) => i - 1);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, historyIdx]);

  // Init history with initial state
  useEffect(() => {
    setHistory([{ sockets: structuredClone(initialPlacements), switchboard: structuredClone(switchboard) }]);
    setHistoryIdx(0);
  }, []);

  // ── Socket drag ──
  const handleSocketDragEnd = useCallback((socketId: string, e: KonvaEventObject<DragEvent>) => {
    const xPct = pixelToPct(e.target.x(), stageSize.width);
    const yPct = pixelToPct(e.target.y(), stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    setSockets((prev) =>
      prev.map((s) =>
        s.socket_id === socketId
          ? {
              ...s,
              x_pct: xPct,
              y_pct: yPct,
              wall: room ? deriveWall(xPct, yPct, room) : s.wall,
              room_id: room?.id ?? s.room_id,
              room_name: room?.name ?? s.room_name,
            }
          : s,
      ),
    );
    pushHistory();
  }, [stageSize, rooms, pushHistory]);

  // ── Switchboard drag ──
  const handleDbDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const xPct = pixelToPct(e.target.x(), stageSize.width);
    const yPct = pixelToPct(e.target.y(), stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    setSwitchboard((prev) => ({
      ...prev,
      x_pct: xPct,
      y_pct: yPct,
      room_id: room?.id ?? prev.room_id,
      room_name: room?.name ?? prev.room_name,
      wall: room ? deriveWall(xPct, yPct, room) : prev.wall,
    }));
    pushHistory();
  }, [stageSize, rooms, pushHistory]);

  // ── Add socket on double-click ──
  const handleStageDoubleClick = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const xPct = pixelToPct(pointer.x, stageSize.width);
    const yPct = pixelToPct(pointer.y, stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    if (!room) return;

    nextSocketId += 1;
    const newSocket: SocketPlacement = {
      room_id: room.id,
      room_name: room.name,
      socket_id: `s${nextSocketId}`,
      x_pct: xPct,
      y_pct: yPct,
      wall: deriveWall(xPct, yPct, room),
      height_mm: 300,
      type: "standard_16a",
    };
    setSockets((prev) => [...prev, newSocket]);
    pushHistory();
  }, [stageSize, rooms, pushHistory]);

  // ── Socket panel actions ──
  const updateSocket = useCallback((socketId: string, updates: Partial<SocketPlacement>) => {
    setSockets((prev) => prev.map((s) => s.socket_id === socketId ? { ...s, ...updates } : s));
  }, []);

  const deleteSocket = useCallback((socketId: string) => {
    setSockets((prev) => prev.filter((s) => s.socket_id !== socketId));
    setSelectedSocket(null);
    pushHistory();
  }, [pushHistory]);

  const resetToProposal = useCallback(() => {
    const pos = switchboardPct(initialSwitchboard, rooms);
    setSockets(structuredClone(initialPlacements));
    setSwitchboard({ ...initialSwitchboard, x_pct: pos.x, y_pct: pos.y });
    pushHistory();
  }, [initialPlacements, initialSwitchboard, rooms, pushHistory]);

  // ── Selected socket data ──
  const selectedData = sockets.find((s) => s.socket_id === selectedSocket);

  const { width: W, height: H } = stageSize;

  return (
    <section className="card fade-in placement-editor">
      <h2>Place sockets &amp; distribution board</h2>
      <p className="muted">
        Drag sockets and the distribution board to adjust positions.
        Double-click inside a room to add a socket.
      </p>

      <div className="placement-toolbar">
        <button className="btn outline" onClick={resetToProposal} aria-label="Reset to AI proposal">
          ↺ Reset to AI proposal
        </button>
        <span className="muted sm">{sockets.length} sockets · {rooms.length} rooms</span>
      </div>

      <div ref={containerRef} className="placement-canvas-wrap">
        {image && (
          <Stage
            width={W}
            height={H}
            onDblClick={handleStageDoubleClick}
            onDblTap={handleStageDoubleClick}
            onClick={() => { setSelectedSocket(null); setShowDbPanel(false); }}
            onTap={() => { setSelectedSocket(null); setShowDbPanel(false); }}
          >
            {/* Background floor plan */}
            <Layer>
              <KonvaImage image={image} width={W} height={H} />
            </Layer>

            {/* Room overlays */}
            <Layer>
              {rooms.map((room) => {
                const p = room.position;
                const x = pctToPixel(p.x_pct, W);
                const y = pctToPixel(p.y_pct, H);
                const w = pctToPixel(p.w_pct, W);
                const h = pctToPixel(p.h_pct, H);
                const type = room.type?.toLowerCase().replace(/[\s-]+/g, "_") ?? "other";
                const fill = ROOM_COLORS[type] ?? "#f1f5f9";
                return (
                  <Group key={room.id}>
                    <Rect x={x} y={y} width={w} height={h} fill={fill} opacity={0.35}
                      stroke="#94a3b8" strokeWidth={1} cornerRadius={2} />
                    <Text x={x + 4} y={y + 4} text={room.name}
                      fontSize={Math.max(10, Math.min(14, w * 0.08))}
                      fontFamily="Inter, system-ui, sans-serif" fontStyle="600"
                      fill="#374151" />
                  </Group>
                );
              })}
            </Layer>

            {/* Wiring lines from DB to sockets */}
            <Layer listening={false}>
              {switchboard.x_pct !== undefined && switchboard.y_pct !== undefined && sockets.map((s) => (
                <Line
                  key={`wire-${s.socket_id}`}
                  points={[
                    pctToPixel(switchboard.x_pct!, W),
                    pctToPixel(switchboard.y_pct!, H),
                    pctToPixel(s.x_pct, W),
                    pctToPixel(s.y_pct, H),
                  ]}
                  stroke="#cbd5e1"
                  strokeWidth={0.5}
                  dash={[4, 4]}
                  opacity={0.5}
                />
              ))}
            </Layer>

            {/* Socket markers */}
            <Layer>
              {sockets.map((s) => {
                const sx = pctToPixel(s.x_pct, W);
                const sy = pctToPixel(s.y_pct, H);
                const isSelected = s.socket_id === selectedSocket;
                const color = SOCKET_COLORS[s.type] ?? SOCKET_COLORS.standard_16a;
                const r = isSelected ? 10 : 7;
                return (
                  <Group
                    key={s.socket_id}
                    x={sx}
                    y={sy}
                    draggable
                    onDragEnd={(e) => handleSocketDragEnd(s.socket_id, e)}
                    onClick={(e) => { e.cancelBubble = true; setSelectedSocket(s.socket_id); setShowDbPanel(false); }}
                    onTap={(e) => { e.cancelBubble = true; setSelectedSocket(s.socket_id); setShowDbPanel(false); }}
                  >
                    {/* Glow ring when selected */}
                    {isSelected && <Circle radius={r + 4} fill={color} opacity={0.2} />}
                    {/* Socket circle */}
                    <Circle radius={r} fill="white" stroke={color} strokeWidth={2} />
                    {/* Cross symbol (IEC socket) */}
                    <Line points={[-3, 0, 3, 0]} stroke={color} strokeWidth={1.5} />
                    <Line points={[0, -3, 0, 3]} stroke={color} strokeWidth={1.5} />
                    {/* Label */}
                    <Text x={-12} y={-r - 14} text={s.socket_id} fontSize={9}
                      fontFamily="Inter, system-ui, sans-serif" fontStyle="700"
                      fill={color} width={24} align="center" />
                  </Group>
                );
              })}
            </Layer>

            {/* Distribution board marker */}
            <Layer>
              {switchboard.x_pct !== undefined && switchboard.y_pct !== undefined && (
                <Group
                  x={pctToPixel(switchboard.x_pct, W)}
                  y={pctToPixel(switchboard.y_pct, H)}
                  draggable
                  onDragEnd={handleDbDragEnd}
                  onClick={(e) => { e.cancelBubble = true; setShowDbPanel(true); setSelectedSocket(null); }}
                  onTap={(e) => { e.cancelBubble = true; setShowDbPanel(true); setSelectedSocket(null); }}
                >
                  {/* DB box */}
                  <Rect x={-18} y={-12} width={36} height={24}
                    fill="#1e293b" stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} />
                  <Text x={-18} y={-9} width={36} text="DB" fontSize={11}
                    fontFamily="Inter, system-ui, sans-serif" fontStyle="700"
                    fill="white" align="center" />
                  {/* Lightning bolt accent */}
                  <Text x={-18} y={1} width={36} text="⚡" fontSize={8}
                    fontFamily="Inter, system-ui, sans-serif"
                    fill="#fbbf24" align="center" />
                </Group>
              )}
            </Layer>
          </Stage>
        )}

        {!image && (
          <div className="placement-loading">
            <div className="pulse-ring" />
            <p className="muted">Loading floor plan…</p>
          </div>
        )}
      </div>

      {/* Socket detail panel */}
      {selectedData && (
        <div className="placement-panel" onClick={(e) => e.stopPropagation()}>
          <div className="placement-panel-head">
            <strong>{selectedData.socket_id}</strong>
            <span className="muted sm">{selectedData.room_name} · {selectedData.wall} wall</span>
            <button className="modal-close" onClick={() => setSelectedSocket(null)} aria-label="Close panel">×</button>
          </div>
          <div className="placement-panel-body">
            <label className="form-field">
              <span>Type</span>
              <select
                value={selectedData.type}
                onChange={(e) => updateSocket(selectedData.socket_id, { type: e.target.value })}
              >
                {SOCKET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Height</span>
              <div className="height-presets">
                {HEIGHT_PRESETS.map((h) => (
                  <button
                    key={h}
                    className={`btn ${selectedData.height_mm === h ? "primary" : "outline"}`}
                    onClick={() => updateSocket(selectedData.socket_id, { height_mm: h })}
                  >
                    {h}mm
                  </button>
                ))}
              </div>
            </label>
            <button className="btn ghost" style={{ color: "var(--err)" }}
              onClick={() => deleteSocket(selectedData.socket_id)}>
              Delete socket
            </button>
          </div>
        </div>
      )}

      {/* DB detail panel */}
      {showDbPanel && (
        <div className="placement-panel" onClick={(e) => e.stopPropagation()}>
          <div className="placement-panel-head">
            <strong>Distribution Board</strong>
            <span className="muted sm">{switchboard.room_name} · {switchboard.wall} wall</span>
            <button className="modal-close" onClick={() => setShowDbPanel(false)} aria-label="Close panel">×</button>
          </div>
          <div className="placement-panel-body">
            <p className="muted sm" style={{ lineHeight: 1.5 }}>{switchboard.reason}</p>
            <p className="muted sm">Height: {switchboard.height_mm}mm</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="placement-legend">
        <div className="placement-legend-item">
          <span className="placement-legend-dot" style={{ background: "#4f46e5" }} />
          Standard 16A
        </div>
        <div className="placement-legend-item">
          <span className="placement-legend-dot" style={{ background: "#f59e0b" }} />
          Dedicated
        </div>
        <div className="placement-legend-item">
          <span className="placement-legend-dot" style={{ background: "#ef4444" }} />
          Oven 32A
        </div>
        <div className="placement-legend-item">
          <span className="placement-legend-swatch" style={{ background: "#1e293b" }} />
          Distribution Board
        </div>
      </div>

      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <button className="btn primary" onClick={() => onConfirm(sockets, switchboard)}>
          Confirm placement →
        </button>
      </div>
    </section>
  );
}
