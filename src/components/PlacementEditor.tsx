import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Group, Text, Line, Arc } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Room, SocketPlacement, Switchboard } from "../types";

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

function pctToPixel(pct: number, size: number): number { return (pct / 100) * size; }
function pixelToPct(px: number, size: number): number { return (px / size) * 100; }

function findContainingRoom(xPct: number, yPct: number, rooms: Room[]): Room | undefined {
  return rooms.find((r) => {
    const p = r.position;
    return xPct >= p.x_pct && xPct <= p.x_pct + p.w_pct && yPct >= p.y_pct && yPct <= p.y_pct + p.h_pct;
  });
}

function deriveWall(xPct: number, yPct: number, room: Room): string {
  const p = room.position;
  const relX = (xPct - p.x_pct) / p.w_pct, relY = (yPct - p.y_pct) / p.h_pct;
  const d = { north: relY, south: 1 - relY, west: relX, east: 1 - relX };
  return (Object.entries(d).sort((a, b) => a[1] - b[1])[0][0]);
}

function roomPrefix(room: Room): string {
  const name = (room.name || room.type || "R").replace(/[^a-zA-ZÀ-ÿ]/g, "");
  return (name.substring(0, 2) || "R").toUpperCase();
}

function switchboardPct(sb: Switchboard, rooms: Room[]): { x: number; y: number } {
  if (sb.x_pct !== undefined && sb.y_pct !== undefined) return { x: sb.x_pct, y: sb.y_pct };
  const room = rooms.find((r) => r.id === sb.room_id);
  if (!room) return { x: 50, y: 50 };
  const p = room.position, cx = p.x_pct + p.w_pct / 2, cy = p.y_pct + p.h_pct / 2;
  switch (sb.wall?.toLowerCase()) {
    case "north": return { x: cx, y: p.y_pct + 2 };
    case "south": return { x: cx, y: p.y_pct + p.h_pct - 2 };
    case "west": return { x: p.x_pct + 2, y: cy };
    case "east": return { x: p.x_pct + p.w_pct - 2, y: cy };
    default: return { x: cx, y: cy };
  }
}

function matchRoom(s: SocketPlacement, rooms: Room[]): Room | undefined {
  return rooms.find((r) => r.id === s.room_id)
    || rooms.find((r) => r.name === s.room_name)
    || rooms.find((r) => r.name.toLowerCase() === (s.room_name || "").toLowerCase())
    || rooms.find((r) => (s.room_id || "").toLowerCase().includes(r.type.toLowerCase()));
}

/** Assign prefixed IDs and normalize room_id per room */
function assignPrefixedIds(sockets: SocketPlacement[], rooms: Room[]): SocketPlacement[] {
  const prefixMap = new Map<string, string>();
  const usedPrefixes = new Map<string, number>();
  for (const room of rooms) {
    const base = roomPrefix(room);
    const existing = usedPrefixes.get(base) || 0;
    usedPrefixes.set(base, existing + 1);
    prefixMap.set(room.id, existing === 0 ? base : `${base}${existing + 1}`);
  }
  const counters = new Map<string, number>();
  return sockets.map((s) => {
    const room = matchRoom(s, rooms);
    const roomId = room?.id ?? s.room_id;
    const prefix = prefixMap.get(roomId) ?? roomPrefix(room || { name: s.room_name } as Room);
    const count = (counters.get(roomId) || 0) + 1;
    counters.set(roomId, count);
    return { ...s, socket_id: `${prefix}${count}`, room_id: room?.id ?? s.room_id, room_name: room?.name ?? s.room_name, gang: s.gang || 1 };
  });
}

// Fan sockets out from a center point with spacing
function fanFromPoint(cx: number, cy: number, count: number, spacingPct: number): { x: number; y: number }[] {
  if (count === 1) return [{ x: cx, y: cy }];
  const cols = Math.min(count, 4);
  const rows = Math.ceil(count / cols);
  const points: { x: number; y: number }[] = [];
  const startX = cx - ((cols - 1) * spacingPct) / 2;
  const startY = cy - ((rows - 1) * spacingPct) / 2;
  for (let i = 0; i < count; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    points.push({ x: startX + col * spacingPct, y: startY + row * spacingPct });
  }
  return points;
}

// ── Component ──

export function PlacementEditor({
  imageUrl, rooms, placements: initialPlacements, switchboard: initialSwitchboard, onConfirm, onBack,
}: PlacementEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const prefixedPlacements = useMemo(
    () => assignPrefixedIds(initialPlacements, rooms),
    [initialPlacements, rooms],
  );

  const [sockets, setSockets] = useState<SocketPlacement[]>([]);
  // Track which rooms have been placed and which are still pending
  const [placedRoomIds, setPlacedRoomIds] = useState<Set<string>>(new Set());
  const [dbPlaced, setDbPlaced] = useState(false);

  const [switchboard, setSwitchboard] = useState<Switchboard>(() => {
    const pos = switchboardPct(initialSwitchboard, rooms);
    return { ...initialSwitchboard, x_pct: pos.x, y_pct: pos.y };
  });

  // What we're placing: { type: 'room', roomId } | { type: 'db' } | null
  const [placing, setPlacing] = useState<{ type: 'room'; roomId: string } | { type: 'db' } | null>(null);
  const [selectedSocket, setSelectedSocket] = useState<string | null>(null);
  const [showDbPanel, setShowDbPanel] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

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

  // Group sockets by room
  const socketsByRoom = useMemo(() => {
    const map = new Map<string, SocketPlacement[]>();
    for (const s of prefixedPlacements) {
      if (!map.has(s.room_id)) map.set(s.room_id, []);
      map.get(s.room_id)!.push(s);
    }
    return map;
  }, [prefixedPlacements]);

  const placedByRoom = useMemo(() => {
    const map = new Map<string, SocketPlacement[]>();
    for (const s of sockets) {
      if (!map.has(s.room_id)) map.set(s.room_id, []);
      map.get(s.room_id)!.push(s);
    }
    return map;
  }, [sockets]);

  // Next ID for a room
  const nextId = useCallback((room: Room): string => {
    const prefix = roomPrefix(room);
    const count = sockets.filter((s) => s.room_id === room.id).length;
    return `${prefix}${count + 1}`;
  }, [sockets]);

  // ── Click on map ──
  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!placing) { setSelectedSocket(null); setShowDbPanel(false); return; }
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const xPct = pixelToPct(pointer.x, stageSize.width);
    const yPct = pixelToPct(pointer.y, stageSize.height);

    if (placing.type === 'db') {
      const room = findContainingRoom(xPct, yPct, rooms);
      setSwitchboard((prev) => ({
        ...prev, x_pct: xPct, y_pct: yPct,
        room_id: room?.id ?? prev.room_id, room_name: room?.name ?? prev.room_name,
        wall: room ? deriveWall(xPct, yPct, room) : prev.wall,
      }));
      setDbPlaced(true);
      setPlacing(null);
      return;
    }

    if (placing.type === 'room') {
      const roomId = placing.roomId;
      const roomSockets = socketsByRoom.get(roomId) || [];
      if (roomSockets.length === 0) { setPlacing(null); return; }

      // Fan sockets from click point
      const spacing = 4; // % spacing between sockets
      const positions = fanFromPoint(xPct, yPct, roomSockets.length, spacing);
      const newSockets = roomSockets.map((s, i) => {
        const pos = positions[i];
        const room = rooms.find((r) => r.id === roomId);
        return {
          ...s,
          x_pct: pos.x,
          y_pct: pos.y,
          wall: room ? deriveWall(pos.x, pos.y, room) : s.wall,
        };
      });

      setSockets((prev) => [...prev, ...newSockets]);
      setPlacedRoomIds((prev) => new Set([...prev, roomId]));
      setPlacing(null);
    }
  }, [placing, stageSize, rooms, socketsByRoom]);

  // ── Socket drag ──
  const handleSocketDragEnd = useCallback((socketId: string, e: KonvaEventObject<DragEvent>) => {
    const xPct = pixelToPct(e.target.x(), stageSize.width);
    const yPct = pixelToPct(e.target.y(), stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    setSockets((prev) => prev.map((s) =>
      s.socket_id === socketId
        ? { ...s, x_pct: xPct, y_pct: yPct, wall: room ? deriveWall(xPct, yPct, room) : s.wall, room_id: room?.id ?? s.room_id, room_name: room?.name ?? s.room_name }
        : s,
    ));
  }, [stageSize, rooms]);

  const handleDbDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const xPct = pixelToPct(e.target.x(), stageSize.width);
    const yPct = pixelToPct(e.target.y(), stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    setSwitchboard((prev) => ({
      ...prev, x_pct: xPct, y_pct: yPct,
      room_id: room?.id ?? prev.room_id, room_name: room?.name ?? prev.room_name,
      wall: room ? deriveWall(xPct, yPct, room) : prev.wall,
    }));
  }, [stageSize, rooms]);

  // ── Actions ──
  const updateSocket = useCallback((socketId: string, updates: Partial<SocketPlacement>) => {
    setSockets((prev) => prev.map((s) => s.socket_id === socketId ? { ...s, ...updates } : s));
  }, []);

  const deleteSocket = useCallback((socketId: string) => {
    setSockets((prev) => prev.filter((s) => s.socket_id !== socketId));
    setSelectedSocket(null);
  }, []);

  const addSocketToRoom = useCallback((roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    const id = nextId(room);
    const existing = sockets.filter((s) => s.room_id === roomId);
    // Place near existing sockets or at room center
    const p = room.position;
    let x = p.x_pct + p.w_pct / 2, y = p.y_pct + p.h_pct / 2;
    if (existing.length > 0) {
      const last = existing[existing.length - 1];
      x = last.x_pct + 3;
      y = last.y_pct + 2;
    }
    setSockets((prev) => [...prev, {
      room_id: roomId, room_name: room.name, socket_id: id,
      x_pct: x, y_pct: y, wall: deriveWall(x, y, room),
      height_mm: 300, type: "standard_16a", gang: 1,
    }]);
  }, [rooms, sockets, nextId]);

  const resetAll = useCallback(() => {
    setSockets([]);
    setPlacedRoomIds(new Set());
    setDbPlaced(false);
    setPlacing(null);
    setSelectedSocket(null);
    const pos = switchboardPct(initialSwitchboard, rooms);
    setSwitchboard({ ...initialSwitchboard, x_pct: pos.x, y_pct: pos.y });
  }, [initialSwitchboard, rooms]);

  const selectedData = sockets.find((s) => s.socket_id === selectedSocket);
  const { width: W, height: H } = stageSize;

  // Count unplaced rooms
  const unplacedRooms = rooms.filter((r) => !placedRoomIds.has(r.id) && (socketsByRoom.get(r.id)?.length || 0) > 0);

  return (
    <section className="card fade-in placement-editor">
      <h2>Place sockets &amp; distribution board</h2>

      {/* Placement mode banner */}
      {placing && (
        <div className="placing-banner">
          <span>👆 Click on the floor plan to place{' '}
            <strong>{placing.type === 'db' ? 'Distribution Board' : rooms.find((r) => r.id === (placing as any).roomId)?.name || 'room'} sockets</strong>
          </span>
          <button className="banner-cancel" onClick={() => setPlacing(null)}>Cancel</button>
        </div>
      )}

      {/* Room cards strip + DB — above the plan */}
      <div className="room-strip">
        {rooms.map((room) => {
          const proposed = socketsByRoom.get(room.id)?.length || 0;
          const placed = placedByRoom.get(room.id)?.length || 0;
          const isPlaced = placedRoomIds.has(room.id);
          const isPlacing = placing?.type === 'room' && (placing as any).roomId === room.id;

          return (
            <div key={room.id} className={`room-card ${isPlaced ? "done" : ""} ${isPlacing ? "active" : ""}`}>
              <div className="room-card-name">{room.name}</div>
              <div className="room-card-count">
                {isPlaced ? `${placed} placed` : `${proposed} sockets`}
              </div>
              {!isPlaced && proposed > 0 && (
                <button className={`room-card-btn ${isPlacing ? "active" : ""}`}
                  onClick={() => setPlacing(isPlacing ? null : { type: 'room', roomId: room.id })}>
                  {isPlacing ? "Click map ▸" : "Place ▸"}
                </button>
              )}
              {isPlaced && (
                <button className="room-card-btn add" onClick={() => addSocketToRoom(room.id)}>+ Add</button>
              )}
            </div>
          );
        })}

        {/* Distribution board card */}
        <div className={`room-card db-card ${dbPlaced ? "done" : ""} ${placing?.type === 'db' ? "active" : ""}`}>
          <div className="room-card-name">⚡ DB</div>
          <div className="room-card-count">{dbPlaced ? switchboard.room_name : "Not placed"}</div>
          {!dbPlaced ? (
            <button className={`room-card-btn ${placing?.type === 'db' ? "active" : ""}`}
              onClick={() => setPlacing(placing?.type === 'db' ? null : { type: 'db' })}>
              {placing?.type === 'db' ? "Click map ▸" : "Place ▸"}
            </button>
          ) : (
            <span className="room-card-check">✓</span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="placement-toolbar">
        <button className="btn outline" onClick={resetAll}>↺ Reset all</button>
        <span className="muted sm">{sockets.length} sockets · {unplacedRooms.length} rooms to place</span>
      </div>

      {/* Floor plan */}
      <div ref={containerRef} className="placement-canvas-wrap" style={placing ? { cursor: "crosshair" } : undefined}>
        {image && (
          <Stage width={W} height={H} onClick={handleStageClick} onTap={handleStageClick}>
            <Layer><KonvaImage image={image} width={W} height={H} /></Layer>

            {/* Room name labels */}
            <Layer listening={false}>
              {rooms.map((room) => (
                <Text key={`lbl-${room.id}`}
                  x={pctToPixel(room.position.x_pct, W) + 4}
                  y={pctToPixel(room.position.y_pct, H) + 4}
                  text={room.name}
                  fontSize={Math.max(9, Math.min(13, pctToPixel(room.position.w_pct, W) * 0.08))}
                  fontFamily="Inter, system-ui, sans-serif" fontStyle="600"
                  fill="#1e293b" opacity={0.7} />
              ))}
            </Layer>

            {/* Socket markers */}
            <Layer>
              {sockets.map((s) => {
                const sx = pctToPixel(s.x_pct, W), sy = pctToPixel(s.y_pct, H);
                const isSel = s.socket_id === selectedSocket;
                const color = SOCKET_COLORS[s.type] ?? SOCKET_COLORS.standard_16a;
                const r = isSel ? 10 : 8;
                const gang = s.gang || 1;
                const gangLines: number[][] = [];
                if (gang === 1) { gangLines.push([0, 1, 0, -r + 2]); }
                else {
                  const sp = Math.min(r - 2, gang * 2.5);
                  for (let g = 0; g < gang; g++) {
                    const lx = -sp / 2 + (sp / (gang - 1)) * g;
                    gangLines.push([lx, 1, lx, -r + 2]);
                  }
                }
                const wallRot: Record<string, number> = { north: 0, south: 180, east: 270, west: 90 };
                const rot = wallRot[(s.wall || 'north').toLowerCase()] ?? 0;
                return (
                  <Group key={s.socket_id} x={sx} y={sy} draggable
                    onDragEnd={(e) => handleSocketDragEnd(s.socket_id, e)}
                    onClick={(e) => { e.cancelBubble = true; setSelectedSocket(s.socket_id); setShowDbPanel(false); setPlacing(null); }}
                    onTap={(e) => { e.cancelBubble = true; setSelectedSocket(s.socket_id); setShowDbPanel(false); setPlacing(null); }}>
                    {isSel && <Circle radius={r + 5} fill={color} opacity={0.15} />}
                    <Group rotation={rot}>
                      <Circle radius={r + 2} fill="white" opacity={0.9} />
                      <Arc angle={180} rotation={180} innerRadius={0} outerRadius={r} fill="none" stroke={color} strokeWidth={2} />
                      <Line points={[-r, 0, r, 0]} stroke={color} strokeWidth={2} />
                      <Line points={[-r + 2, 3, r - 2, 3]} stroke={color} strokeWidth={1.2} />
                      {gangLines.map((pts, idx) => <Line key={idx} points={pts} stroke={color} strokeWidth={1.5} />)}
                    </Group>
                    <Text x={-16} y={-r - 16} text={s.socket_id} fontSize={9}
                      fontFamily="Inter, system-ui, sans-serif" fontStyle="700" fill={color} width={32} align="center" />
                    {gang > 1 && (<>
                      <Circle x={r + 2} y={-r} radius={6} fill={color} />
                      <Text x={r - 1} y={-r - 4} text={String(gang)} fontSize={8}
                        fontFamily="Inter, system-ui, sans-serif" fontStyle="700" fill="white" width={6} align="center" />
                    </>)}
                  </Group>
                );
              })}
            </Layer>

            {/* Distribution board */}
            <Layer>
              {dbPlaced && switchboard.x_pct !== undefined && switchboard.y_pct !== undefined && (
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
        {!image && <div className="placement-loading"><div className="pulse-ring" /><p className="muted">Loading…</p></div>}
      </div>

      {/* Socket detail panel (below plan) */}
      {selectedData && (
        <div className="placement-panel" onClick={(e) => e.stopPropagation()}>
          <div className="placement-panel-head">
            <strong>{selectedData.socket_id}</strong>
            <span className="muted sm">{selectedData.room_name} · {selectedData.wall} wall</span>
            <button className="modal-close" onClick={() => setSelectedSocket(null)} aria-label="Close">×</button>
          </div>
          <div className="placement-panel-body">
            <div className="panel-row">
              <label className="form-field" style={{ flex: 1 }}>
                <span>Type</span>
                <select value={selectedData.type}
                  onChange={(e) => updateSocket(selectedData.socket_id, { type: e.target.value })}>
                  {SOCKET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="form-field" style={{ flex: 1 }}>
                <span>Height</span>
                <div className="height-presets">
                  {HEIGHT_PRESETS.map((h) => (
                    <button key={h} className={`btn ${selectedData.height_mm === h ? "primary" : "outline"}`}
                      onClick={() => updateSocket(selectedData.socket_id, { height_mm: h })}>{h}mm</button>
                  ))}
                </div>
              </label>
            </div>
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
            <button className="btn ghost" style={{ color: "var(--err)", alignSelf: "flex-start" }}
              onClick={() => deleteSocket(selectedData.socket_id)}>🗑 Delete this socket</button>
          </div>
        </div>
      )}

      {/* DB detail panel */}
      {showDbPanel && dbPlaced && (
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

      {/* Legend */}
      <div className="placement-legend">
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#4f46e5" }} /> Standard 16A</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#f59e0b" }} /> Dedicated</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#ef4444" }} /> Oven 32A</div>
        <div className="placement-legend-item"><span className="placement-legend-swatch" style={{ background: "#1e293b" }} /> DB</div>
      </div>

      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <button className="btn primary" disabled={sockets.length === 0}
          onClick={() => onConfirm(sockets, switchboard)}>
          Confirm placement →
        </button>
      </div>
    </section>
  );
}
