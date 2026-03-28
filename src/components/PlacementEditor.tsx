import { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Group, Text, Line, Arc } from "react-konva";
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

const OUTLET_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
const OUTLET_LABELS: Record<number, string> = {
  1: "Single", 2: "Double", 3: "Triple", 4: "Quad", 5: "5-gang", 6: "6-gang",
};

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
  const distN = relY, distS = 1 - relY, distW = relX, distE = 1 - relX;
  const min = Math.min(distN, distS, distW, distE);
  if (min === distN) return "north";
  if (min === distS) return "south";
  if (min === distW) return "west";
  return "east";
}

function switchboardPct(sb: Switchboard, rooms: Room[]): { x: number; y: number } {
  if (sb.x_pct !== undefined && sb.y_pct !== undefined) return { x: sb.x_pct, y: sb.y_pct };
  const room = rooms.find((r) => r.id === sb.room_id);
  if (!room) return { x: 50, y: 50 };
  const p = room.position;
  const cx = p.x_pct + p.w_pct / 2, cy = p.y_pct + p.h_pct / 2;
  switch (sb.wall?.toLowerCase()) {
    case "north": return { x: cx, y: p.y_pct + 2 };
    case "south": return { x: cx, y: p.y_pct + p.h_pct - 2 };
    case "west": return { x: p.x_pct + 2, y: cy };
    case "east": return { x: p.x_pct + p.w_pct - 2, y: cy };
    default: return { x: cx, y: cy };
  }
}

function constrainSwitchboard(sb: Switchboard, rooms: Room[]): Switchboard {
  const room = rooms.find((r) => r.id === sb.room_id || r.name === sb.room_name);
  if (!room || sb.x_pct === undefined || sb.y_pct === undefined) return sb;
  const p = room.position;
  const m = 3;
  const xMin = p.x_pct + m, xMax = p.x_pct + p.w_pct - m;
  const yMin = p.y_pct + m, yMax = p.y_pct + p.h_pct - m;
  if (sb.x_pct >= xMin && sb.x_pct <= xMax && sb.y_pct >= yMin && sb.y_pct <= yMax) return sb;
  return { ...sb, x_pct: Math.max(xMin, Math.min(xMax, sb.x_pct)), y_pct: Math.max(yMin, Math.min(yMax, sb.y_pct)) };
}

let nextSocketId = 100;

// ── Component ──

export function PlacementEditor({
  imageUrl, rooms, placements: initialPlacements, switchboard: initialSwitchboard, onConfirm, onBack,
}: PlacementEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Sockets split: "placed" on the map vs "tray" waiting to be placed
  const [placedSockets, setPlacedSockets] = useState<SocketPlacement[]>([]);
  const [tray, setTray] = useState<SocketPlacement[]>(() =>
    initialPlacements.map((s) => ({ ...s, gang: s.gang || 1 })),
  );

  const [switchboard, setSwitchboard] = useState<Switchboard>(() => {
    const pos = switchboardPct(initialSwitchboard, rooms);
    return constrainSwitchboard({ ...initialSwitchboard, x_pct: pos.x, y_pct: pos.y }, rooms);
  });

  const [selectedSocket, setSelectedSocket] = useState<string | null>(null);
  const [placingSocket, setPlacingSocket] = useState<string | null>(null);
  const [showDbPanel, setShowDbPanel] = useState(false);
  const [history, setHistory] = useState<{ placed: SocketPlacement[]; tray: SocketPlacement[]; switchboard: Switchboard }[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useEffect(() => { const img = new window.Image(); img.onload = () => setImage(img); img.src = imageUrl; }, [imageUrl]);

  useEffect(() => {
    function resize() {
      if (!containerRef.current || !image) return;
      const maxW = containerRef.current.clientWidth;
      const ratio = image.naturalHeight / image.naturalWidth;
      setStageSize({ width: Math.min(maxW, 1200), height: Math.min(maxW, 1200) * ratio });
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [image]);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(0, historyIdx + 1), { placed: structuredClone(placedSockets), tray: structuredClone(tray), switchboard: structuredClone(switchboard) }]);
    setHistoryIdx((prev) => prev + 1);
  }, [placedSockets, tray, switchboard, historyIdx]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (historyIdx > 0) { const prev = history[historyIdx - 1]; setPlacedSockets(prev.placed); setTray(prev.tray); setSwitchboard(prev.switchboard); setHistoryIdx((i) => i - 1); }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, historyIdx]);

  useEffect(() => { setHistory([{ placed: [], tray: structuredClone(initialPlacements), switchboard: structuredClone(switchboard) }]); setHistoryIdx(0); }, []);

  // ── Socket drag ──
  const handleSocketDragEnd = useCallback((socketId: string, e: KonvaEventObject<DragEvent>) => {
    const xPct = pixelToPct(e.target.x(), stageSize.width), yPct = pixelToPct(e.target.y(), stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    setPlacedSockets((prev) => prev.map((s) => s.socket_id === socketId ? { ...s, x_pct: xPct, y_pct: yPct, wall: room ? deriveWall(xPct, yPct, room) : s.wall, room_id: room?.id ?? s.room_id, room_name: room?.name ?? s.room_name } : s));
    pushHistory();
  }, [stageSize, rooms, pushHistory]);

  const handleDbDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const xPct = pixelToPct(e.target.x(), stageSize.width), yPct = pixelToPct(e.target.y(), stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    setSwitchboard((prev) => ({ ...prev, x_pct: xPct, y_pct: yPct, room_id: room?.id ?? prev.room_id, room_name: room?.name ?? prev.room_name, wall: room ? deriveWall(xPct, yPct, room) : prev.wall }));
    pushHistory();
  }, [stageSize, rooms, pushHistory]);

  // ── Click on map — place from tray ──
  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!placingSocket) { setSelectedSocket(null); setShowDbPanel(false); return; }
    const stage = e.target.getStage(); if (!stage) return;
    const pointer = stage.getPointerPosition(); if (!pointer) return;
    const xPct = pixelToPct(pointer.x, stageSize.width), yPct = pixelToPct(pointer.y, stageSize.height);
    const socketData = tray.find((s) => s.socket_id === placingSocket); if (!socketData) return;
    const clickRoom = findContainingRoom(xPct, yPct, rooms);
    const targetRoom = clickRoom || rooms.find((r) => r.id === socketData.room_id);
    if (!targetRoom) return;
    const p = targetRoom.position, m = 3;
    const cx = Math.max(p.x_pct + m, Math.min(p.x_pct + p.w_pct - m, xPct));
    const cy = Math.max(p.y_pct + m, Math.min(p.y_pct + p.h_pct - m, yPct));
    const placed: SocketPlacement = { ...socketData, x_pct: cx, y_pct: cy, wall: deriveWall(cx, cy, targetRoom), room_id: targetRoom.id, room_name: targetRoom.name };
    setTray((prev) => prev.filter((s) => s.socket_id !== placingSocket));
    setPlacedSockets((prev) => [...prev, placed]);
    setSelectedSocket(placed.socket_id); setPlacingSocket(null);
    pushHistory();
  }, [placingSocket, tray, stageSize, rooms, pushHistory]);

  // ── Double-click = quick-add ──
  const handleStageDoubleClick = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage(); if (!stage) return;
    const pointer = stage.getPointerPosition(); if (!pointer) return;
    const xPct = pixelToPct(pointer.x, stageSize.width), yPct = pixelToPct(pointer.y, stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms); if (!room) return;
    const p = room.position, m = 3;
    const cx = Math.max(p.x_pct + m, Math.min(p.x_pct + p.w_pct - m, xPct));
    const cy = Math.max(p.y_pct + m, Math.min(p.y_pct + p.h_pct - m, yPct));
    nextSocketId += 1;
    const ns: SocketPlacement = { room_id: room.id, room_name: room.name, socket_id: `s${nextSocketId}`, x_pct: cx, y_pct: cy, wall: deriveWall(cx, cy, room), height_mm: 300, type: "standard_16a", gang: 1 };
    setPlacedSockets((prev) => [...prev, ns]); setSelectedSocket(ns.socket_id);
    pushHistory();
  }, [stageSize, rooms, pushHistory]);

  // ── Tray actions ──
  const startPlacing = (socketId: string) => { setPlacingSocket(socketId); setSelectedSocket(null); setShowDbPanel(false); };

  const addSocketToTray = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId); if (!room) return;
    nextSocketId += 1;
    setTray((prev) => [...prev, { room_id: room.id, room_name: room.name, socket_id: `s${nextSocketId}`, x_pct: 0, y_pct: 0, wall: "north", height_mm: 300, type: "standard_16a", gang: 1 }]);
  };

  const deleteFromTray = (socketId: string) => { setTray((prev) => prev.filter((s) => s.socket_id !== socketId)); if (placingSocket === socketId) setPlacingSocket(null); };

  const updateSocket = useCallback((socketId: string, updates: Partial<SocketPlacement>) => {
    setPlacedSockets((prev) => prev.map((s) => s.socket_id === socketId ? { ...s, ...updates } : s));
  }, []);

  const updateTraySocket = useCallback((socketId: string, updates: Partial<SocketPlacement>) => {
    setTray((prev) => prev.map((s) => s.socket_id === socketId ? { ...s, ...updates } : s));
  }, []);

  const deleteSocket = useCallback((socketId: string) => { setPlacedSockets((prev) => prev.filter((s) => s.socket_id !== socketId)); setSelectedSocket(null); pushHistory(); }, [pushHistory]);

  const unplaceSocket = useCallback((socketId: string) => {
    const socket = placedSockets.find((s) => s.socket_id === socketId); if (!socket) return;
    setPlacedSockets((prev) => prev.filter((s) => s.socket_id !== socketId));
    setTray((prev) => [...prev, socket]); setSelectedSocket(null); pushHistory();
  }, [placedSockets, pushHistory]);

  const resetToProposal = useCallback(() => {
    const pos = switchboardPct(initialSwitchboard, rooms);
    setPlacedSockets([]); setTray(initialPlacements.map((s) => ({ ...s, gang: s.gang || 1 })));
    setSwitchboard(constrainSwitchboard({ ...initialSwitchboard, x_pct: pos.x, y_pct: pos.y }, rooms));
    setPlacingSocket(null); setSelectedSocket(null); pushHistory();
  }, [initialPlacements, initialSwitchboard, rooms, pushHistory]);

  const placeAllAuto = useCallback(() => {
    const newPlaced: SocketPlacement[] = [];
    const byRoom = new Map<string, SocketPlacement[]>();
    for (const s of tray) { if (!byRoom.has(s.room_id)) byRoom.set(s.room_id, []); byRoom.get(s.room_id)!.push(s); }
    for (const [roomId, roomSockets] of byRoom) {
      const room = rooms.find((r) => r.id === roomId); if (!room) continue;
      const p = room.position, m = 3, walls = ['north', 'east', 'south', 'west'];
      roomSockets.forEach((s, i) => {
        const wIdx = i % walls.length, posInW = Math.floor(i / walls.length);
        const nOnW = Math.ceil(roomSockets.length / walls.length), frac = (posInW + 1) / (nOnW + 1);
        let x = p.x_pct + p.w_pct / 2, y = p.y_pct + p.h_pct / 2;
        switch (walls[wIdx]) {
          case 'north': x = p.x_pct + m + frac * (p.w_pct - 2 * m); y = p.y_pct + m; break;
          case 'south': x = p.x_pct + m + frac * (p.w_pct - 2 * m); y = p.y_pct + p.h_pct - m; break;
          case 'west': x = p.x_pct + m; y = p.y_pct + m + frac * (p.h_pct - 2 * m); break;
          case 'east': x = p.x_pct + p.w_pct - m; y = p.y_pct + m + frac * (p.h_pct - 2 * m); break;
        }
        newPlaced.push({ ...s, x_pct: x, y_pct: y, wall: walls[wIdx] });
      });
    }
    setPlacedSockets((prev) => [...prev, ...newPlaced]); setTray([]); pushHistory();
  }, [tray, rooms, pushHistory]);

  const selectedData = placedSockets.find((s) => s.socket_id === selectedSocket);

  const placedByRoom = new Map<string, SocketPlacement[]>();
  for (const s of placedSockets) { if (!placedByRoom.has(s.room_id)) placedByRoom.set(s.room_id, []); placedByRoom.get(s.room_id)!.push(s); }
  const trayByRoom = new Map<string, SocketPlacement[]>();
  for (const s of tray) { if (!trayByRoom.has(s.room_id)) trayByRoom.set(s.room_id, []); trayByRoom.get(s.room_id)!.push(s); }

  const { width: W, height: H } = stageSize;

  return (
    <section className="card fade-in placement-editor">
      <h2>Place sockets &amp; distribution board</h2>
      <p className="muted">
        {placingSocket
          ? <strong style={{ color: "var(--ac)" }}>Click on the floor plan to place {placingSocket}</strong>
          : <>Pick sockets from the tray (right) and click on the map to place them. Drag to reposition.</>}
      </p>

      <div className="placement-toolbar">
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {tray.length > 0 && <button className="btn primary" onClick={placeAllAuto}>⚡ Auto-place all ({tray.length})</button>}
          {placingSocket && <button className="btn ghost" onClick={() => setPlacingSocket(null)}>✕ Cancel</button>}
          <button className="btn outline" onClick={resetToProposal}>↺ Reset</button>
        </div>
        <span className="muted sm">{placedSockets.length} placed · {tray.length} in tray</span>
      </div>

      <div className="placement-layout">
        <div className="placement-plan-col">
          <div ref={containerRef} className="placement-canvas-wrap" style={placingSocket ? { cursor: "crosshair" } : undefined}>
            {image && (
              <Stage width={W} height={H} onDblClick={handleStageDoubleClick} onDblTap={handleStageDoubleClick} onClick={handleStageClick} onTap={handleStageClick}>
                <Layer><KonvaImage image={image} width={W} height={H} /></Layer>
                <Layer>
                  {rooms.map((room) => {
                    const p = room.position;
                    const x = pctToPixel(p.x_pct, W), y = pctToPixel(p.y_pct, H);
                    const w = pctToPixel(p.w_pct, W), h = pctToPixel(p.h_pct, H);
                    const type = room.type?.toLowerCase().replace(/[\s-]+/g, "_") ?? "other";
                    const fill = ROOM_COLORS[type] ?? "#f1f5f9";
                    const nP = placedByRoom.get(room.id)?.length || 0, nT = trayByRoom.get(room.id)?.length || 0;
                    return (
                      <Group key={room.id}>
                        <Rect x={x} y={y} width={w} height={h} fill={fill} opacity={0.35}
                          stroke={placingSocket ? "#4f46e5" : "#94a3b8"} strokeWidth={placingSocket ? 2 : 1} cornerRadius={2} />
                        <Text x={x + 4} y={y + 4} text={`${room.name} (${nP}${nT > 0 ? `+${nT}` : ""})`}
                          fontSize={Math.max(10, Math.min(14, w * 0.08))} fontFamily="Inter, system-ui, sans-serif" fontStyle="600" fill="#374151" />
                      </Group>
                    );
                  })}
                </Layer>
                <Layer listening={false}>
                  {switchboard.x_pct !== undefined && switchboard.y_pct !== undefined && placedSockets.map((s) => (
                    <Line key={`w-${s.socket_id}`}
                      points={[pctToPixel(switchboard.x_pct!, W), pctToPixel(switchboard.y_pct!, H), pctToPixel(s.x_pct, W), pctToPixel(s.y_pct, H)]}
                      stroke="#cbd5e1" strokeWidth={0.5} dash={[4, 4]} opacity={0.5} />
                  ))}
                </Layer>
                <Layer>
                  {placedSockets.map((s) => {
                    const sx = pctToPixel(s.x_pct, W), sy = pctToPixel(s.y_pct, H);
                    const isSel = s.socket_id === selectedSocket;
                    const color = SOCKET_COLORS[s.type] ?? SOCKET_COLORS.standard_16a;
                    const r = isSel ? 10 : 8;
                    const gang = s.gang || 1;
                    const gangLines: number[][] = [];
                    if (gang === 1) { gangLines.push([0, 1, 0, -r + 2]); }
                    else { const sp = Math.min(r - 2, gang * 2.5); for (let i = 0; i < gang; i++) { const lx = -sp / 2 + (sp / (gang - 1)) * i; gangLines.push([lx, 1, lx, -r + 2]); } }
                    // Rotation: semicircle opens into room (away from wall)
                    const wallRot: Record<string, number> = { north: 0, south: 180, east: 270, west: 90 };
                    const rot = wallRot[(s.wall || 'north').toLowerCase()] ?? 0;
                    return (
                      <Group key={s.socket_id} x={sx} y={sy} draggable
                        onDragEnd={(e) => handleSocketDragEnd(s.socket_id, e)}
                        onClick={(e) => { e.cancelBubble = true; setSelectedSocket(s.socket_id); setShowDbPanel(false); setPlacingSocket(null); }}
                        onTap={(e) => { e.cancelBubble = true; setSelectedSocket(s.socket_id); setShowDbPanel(false); setPlacingSocket(null); }}>
                        {isSel && <Circle radius={r + 5} fill={color} opacity={0.15} />}
                        {/* Symbol group — rotated to face away from wall */}
                        <Group rotation={rot}>
                          <Circle radius={r + 2} fill="white" opacity={0.9} />
                          <Arc angle={180} rotation={180} innerRadius={0} outerRadius={r} fill="none" stroke={color} strokeWidth={2} />
                          <Line points={[-r, 0, r, 0]} stroke={color} strokeWidth={2} />
                          <Line points={[-r + 2, 3, r - 2, 3]} stroke={color} strokeWidth={1.2} />
                          {gangLines.map((pts, idx) => <Line key={idx} points={pts} stroke={color} strokeWidth={1.5} />)}
                        </Group>
                        {/* Label stays horizontal (outside rotation) */}
                        <Text x={-16} y={-r - 16} text={s.socket_id} fontSize={9} fontFamily="Inter, system-ui, sans-serif" fontStyle="700" fill={color} width={32} align="center" />
                        {gang > 1 && (<>
                          <Circle x={r + 2} y={-r} radius={6} fill={color} />
                          <Text x={r - 1} y={-r - 4} text={String(gang)} fontSize={8} fontFamily="Inter, system-ui, sans-serif" fontStyle="700" fill="white" width={6} align="center" />
                        </>)}
                      </Group>
                    );
                  })}
                </Layer>
                <Layer>
                  {switchboard.x_pct !== undefined && switchboard.y_pct !== undefined && (
                    <Group x={pctToPixel(switchboard.x_pct, W)} y={pctToPixel(switchboard.y_pct, H)} draggable
                      onDragEnd={handleDbDragEnd}
                      onClick={(e) => { e.cancelBubble = true; setShowDbPanel(true); setSelectedSocket(null); }}
                      onTap={(e) => { e.cancelBubble = true; setShowDbPanel(true); setSelectedSocket(null); }}>
                      <Rect x={-18} y={-12} width={36} height={24} fill="#1e293b" stroke="#0f172a" strokeWidth={1.5} cornerRadius={3} />
                      <Text x={-18} y={-9} width={36} text="DB" fontSize={11} fontFamily="Inter, system-ui, sans-serif" fontStyle="700" fill="white" align="center" />
                      <Text x={-18} y={1} width={36} text="⚡" fontSize={8} fontFamily="Inter, system-ui, sans-serif" fill="#fbbf24" align="center" />
                    </Group>
                  )}
                </Layer>
              </Stage>
            )}
            {!image && <div className="placement-loading"><div className="pulse-ring" /><p className="muted">Loading floor plan…</p></div>}
          </div>

          {selectedData && (
            <div className="placement-panel" onClick={(e) => e.stopPropagation()}>
              <div className="placement-panel-head">
                <strong>{selectedData.socket_id}</strong>
                <span className="muted sm">{selectedData.room_name} · {selectedData.wall} wall</span>
                <button className="modal-close" onClick={() => setSelectedSocket(null)} aria-label="Close">×</button>
              </div>
              <div className="placement-panel-body">
                <label className="form-field">
                  <span>Type</span>
                  <select value={selectedData.type} onChange={(e) => updateSocket(selectedData.socket_id, { type: e.target.value })}>
                    {SOCKET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>Outlets at this point</span>
                  <div className="outlet-grid">
                    {OUTLET_OPTIONS.map((g) => (
                      <button key={g} className={`outlet-btn ${(selectedData.gang || 1) === g ? "active" : ""}`}
                        onClick={() => updateSocket(selectedData.socket_id, { gang: g })} title={OUTLET_LABELS[g]}>
                        <span className="outlet-num">{g}</span>
                        <span className="outlet-label">{OUTLET_LABELS[g]}</span>
                      </button>
                    ))}
                  </div>
                </label>
                <label className="form-field">
                  <span>Height</span>
                  <div className="height-presets">
                    {HEIGHT_PRESETS.map((h) => (
                      <button key={h} className={`btn ${selectedData.height_mm === h ? "primary" : "outline"}`}
                        onClick={() => updateSocket(selectedData.socket_id, { height_mm: h })}>{h}mm</button>
                    ))}
                  </div>
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="btn ghost" style={{ color: "var(--tx2)", flex: 1 }} onClick={() => unplaceSocket(selectedData.socket_id)}>↩ To tray</button>
                  <button className="btn ghost" style={{ color: "var(--err)", flex: 1 }} onClick={() => deleteSocket(selectedData.socket_id)}>🗑 Delete</button>
                </div>
              </div>
            </div>
          )}

          {showDbPanel && (
            <div className="placement-panel" onClick={(e) => e.stopPropagation()}>
              <div className="placement-panel-head">
                <strong>Distribution Board</strong>
                <span className="muted sm">{switchboard.room_name} · {switchboard.wall} wall</span>
                <button className="modal-close" onClick={() => setShowDbPanel(false)} aria-label="Close">×</button>
              </div>
              <div className="placement-panel-body">
                <p className="muted sm" style={{ lineHeight: 1.5 }}>{switchboard.reason}</p>
                <p className="muted sm">Height: {switchboard.height_mm}mm</p>
              </div>
            </div>
          )}
        </div>

        {/* Socket tray — right sidebar */}
        <div className="placement-tray">
          <div className="tray-header"><strong>Socket tray</strong><span className="muted sm">{tray.length} to place</span></div>
          {rooms.map((room) => {
            const roomTray = trayByRoom.get(room.id) || [];
            const roomPlaced = placedByRoom.get(room.id) || [];
            const type = room.type?.toLowerCase().replace(/[\s-]+/g, "_") ?? "other";
            const bgColor = ROOM_COLORS[type] ?? "#f1f5f9";
            return (
              <div key={room.id} className="tray-room" style={{ borderLeftColor: bgColor }}>
                <div className="tray-room-head">
                  <span className="tray-room-name">{room.name}</span>
                  <span className="muted sm">{roomPlaced.length + roomTray.length}</span>
                </div>
                {roomPlaced.map((s) => (
                  <div key={s.socket_id} className={`tray-chip placed ${s.socket_id === selectedSocket ? "selected" : ""}`}
                    onClick={() => { setSelectedSocket(s.socket_id); setShowDbPanel(false); }}>
                    <span className="tray-chip-id">✓ {s.socket_id}</span>
                    <span className="tray-chip-meta">{(s.gang || 1) > 1 ? `${s.gang}× ` : ""}{s.wall}</span>
                  </div>
                ))}
                {roomTray.map((s) => (
                  <div key={s.socket_id} className={`tray-chip unplaced ${placingSocket === s.socket_id ? "placing" : ""}`}>
                    <div className="tray-chip-main" onClick={() => startPlacing(s.socket_id)}>
                      <span className="tray-chip-id">{s.socket_id}</span>
                      <span className="tray-chip-action">click to place →</span>
                    </div>
                    <div className="tray-chip-actions">
                      <select className="tray-outlet-select" value={s.gang || 1}
                        onChange={(e) => updateTraySocket(s.socket_id, { gang: parseInt(e.target.value) })}
                        onClick={(e) => e.stopPropagation()} title="Outlets">
                        {OUTLET_OPTIONS.map((g) => <option key={g} value={g}>{g}×</option>)}
                      </select>
                      <button className="tray-chip-del" onClick={() => deleteFromTray(s.socket_id)} title="Remove">✕</button>
                    </div>
                  </div>
                ))}
                <button className="tray-add-btn" onClick={() => addSocketToTray(room.id)}>+ Add</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="placement-legend">
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#4f46e5" }} /> Standard 16A</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#f59e0b" }} /> Dedicated</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#ef4444" }} /> Oven 32A</div>
        <div className="placement-legend-item"><span className="placement-legend-swatch" style={{ background: "#1e293b" }} /> Distribution Board</div>
      </div>

      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <button className="btn primary" onClick={() => onConfirm([...placedSockets, ...tray], switchboard)}>Confirm placement →</button>
      </div>
    </section>
  );
}
