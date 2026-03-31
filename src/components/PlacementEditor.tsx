import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Group, Text, Line, Arc } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Room, SocketPlacement, Switchboard } from "../types";

const SOCKET_COLORS: Record<string, string> = {
  standard_16a: "#4f46e5", dedicated: "#f59e0b", oven: "#ef4444",
  ip44: "#10b981", usb: "#8b5cf6", tv_data: "#6366f1", ev_charger: "#dc2626",
};
const HEIGHT_PRESETS = [300, 600, 1100] as const;
const SOCKET_TYPES = [
  { value: "standard_16a", label: "Standard 16A" },
  { value: "dedicated", label: "Dedicated" },
  { value: "ip44", label: "IP44 Waterproof" },
  { value: "usb", label: "USB Socket" },
  { value: "tv_data", label: "TV / Data" },
  { value: "oven", label: "Oven (32A)" },
  { value: "ev_charger", label: "EV Charger (32A)" },
] as const;
const OUTLET_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
const OUTLET_LABELS: Record<number, string> = {
  1: "Single", 2: "Double", 3: "Triple", 4: "Quad", 5: "5-gang", 6: "6-gang",
};
const ROTATION_OPTIONS = [
  { value: 0, label: "↑ N" }, { value: 90, label: "→ E" },
  { value: 180, label: "↓ S" }, { value: 270, label: "← W" },
];

interface PlacementEditorProps {
  imageUrl: string;
  rooms: Room[];
  placements: SocketPlacement[];
  switchboard: Switchboard;
  onConfirm: (placements: SocketPlacement[], switchboard: Switchboard) => void;
  onBack: () => void;
}

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
  return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
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

function fanFromPoint(cx: number, cy: number, count: number, spacing: number): { x: number; y: number }[] {
  if (count === 1) return [{ x: cx, y: cy }];
  const cols = Math.min(count, 4), rows = Math.ceil(count / cols);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    points.push({ x: cx - ((cols - 1) * spacing) / 2 + col * spacing, y: cy - ((rows - 1) * spacing) / 2 + row * spacing });
  }
  return points;
}

export function PlacementEditor({
  imageUrl, rooms, placements: initialPlacements, switchboard: initialSwitchboard, onConfirm, onBack,
}: PlacementEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);

  const prefixedPlacements = useMemo(() => assignPrefixedIds(initialPlacements, rooms), [initialPlacements, rooms]);

  const [sockets, setSockets] = useState<SocketPlacement[]>([]);
  const [placedRoomIds, setPlacedRoomIds] = useState<Set<string>>(new Set());
  const [dbPlaced, setDbPlaced] = useState(false);
  const [switchboard, setSwitchboard] = useState<Switchboard>(() => {
    const pos = switchboardPct(initialSwitchboard, rooms);
    return { ...initialSwitchboard, x_pct: pos.x, y_pct: pos.y };
  });
  const [placing, setPlacing] = useState<{ type: 'room'; roomId: string } | { type: 'db' } | null>(null);
  const [selectedSocket, setSelectedSocket] = useState<string | null>(null);
  const [showDbPanel, setShowDbPanel] = useState(false);

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

  const socketsByRoom = useMemo(() => {
    const map = new Map<string, SocketPlacement[]>();
    for (const s of prefixedPlacements) { if (!map.has(s.room_id)) map.set(s.room_id, []); map.get(s.room_id)!.push(s); }
    return map;
  }, [prefixedPlacements]);

  const placedByRoom = useMemo(() => {
    const map = new Map<string, SocketPlacement[]>();
    for (const s of sockets) { if (!map.has(s.room_id)) map.set(s.room_id, []); map.get(s.room_id)!.push(s); }
    return map;
  }, [sockets]);

  const nextId = useCallback((room: Room): string => {
    const prefix = roomPrefix(room);
    return `${prefix}${sockets.filter((s) => s.room_id === room.id).length + 1}`;
  }, [sockets]);

  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!placing) { setSelectedSocket(null); setShowDbPanel(false); return; }
    const stage = e.target.getStage(); if (!stage) return;
    const pointer = stage.getPointerPosition(); if (!pointer) return;
    const xPct = pixelToPct(pointer.x / zoom, stageSize.width);
    const yPct = pixelToPct(pointer.y / zoom, stageSize.height);

    if (placing.type === 'db') {
      const room = findContainingRoom(xPct, yPct, rooms);
      setSwitchboard((prev) => ({ ...prev, x_pct: xPct, y_pct: yPct, room_id: room?.id ?? prev.room_id, room_name: room?.name ?? prev.room_name, wall: room ? deriveWall(xPct, yPct, room) : prev.wall }));
      setDbPlaced(true); setPlacing(null); setShowDbPanel(true); setSelectedSocket(null); return;
    }

    if (placing.type === 'room') {
      const roomId = placing.roomId;
      const roomSockets = socketsByRoom.get(roomId) || [];
      if (roomSockets.length === 0) { setPlacing(null); return; }
      const positions = fanFromPoint(xPct, yPct, roomSockets.length, 4);
      const room = rooms.find((r) => r.id === roomId);
      const newSockets = roomSockets.map((s, i) => ({
        ...s, x_pct: positions[i].x, y_pct: positions[i].y,
        wall: room ? deriveWall(positions[i].x, positions[i].y, room) : s.wall,
      }));
      setSockets((prev) => [...prev, ...newSockets]);
      setPlacedRoomIds((prev) => new Set([...prev, roomId]));
      setPlacing(null);
      // Focus on the first socket of the newly placed room
      if (newSockets.length > 0) { setSelectedSocket(newSockets[0].socket_id); setShowDbPanel(false); }
    }
  }, [placing, stageSize, rooms, socketsByRoom, zoom]);

  const handleSocketDragEnd = useCallback((socketId: string, e: KonvaEventObject<DragEvent>) => {
    const xPct = pixelToPct(e.target.x() / zoom, stageSize.width);
    const yPct = pixelToPct(e.target.y() / zoom, stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    setSockets((prev) => prev.map((s) => s.socket_id === socketId ? { ...s, x_pct: xPct, y_pct: yPct, wall: room ? deriveWall(xPct, yPct, room) : s.wall, room_id: room?.id ?? s.room_id, room_name: room?.name ?? s.room_name } : s));
  }, [stageSize, rooms, zoom]);

  const handleDbDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
    const xPct = pixelToPct(e.target.x() / zoom, stageSize.width);
    const yPct = pixelToPct(e.target.y() / zoom, stageSize.height);
    const room = findContainingRoom(xPct, yPct, rooms);
    setSwitchboard((prev) => ({ ...prev, x_pct: xPct, y_pct: yPct, room_id: room?.id ?? prev.room_id, room_name: room?.name ?? prev.room_name, wall: room ? deriveWall(xPct, yPct, room) : prev.wall }));
  }, [stageSize, rooms, zoom]);

  const updateSocket = useCallback((socketId: string, updates: Partial<SocketPlacement>) => {
    setSockets((prev) => prev.map((s) => s.socket_id === socketId ? { ...s, ...updates } : s));
  }, []);

  const deleteSocket = useCallback((socketId: string) => {
    setSockets((prev) => prev.filter((s) => s.socket_id !== socketId));
    setSelectedSocket(null);
  }, []);

  const addSocketToRoom = useCallback((roomId: string) => {
    const room = rooms.find((r) => r.id === roomId); if (!room) return;
    const id = nextId(room);
    const existing = sockets.filter((s) => s.room_id === roomId);
    const p = room.position;
    let x = p.x_pct + p.w_pct / 2, y = p.y_pct + p.h_pct / 2;
    if (existing.length > 0) { const last = existing[existing.length - 1]; x = last.x_pct + 3; y = last.y_pct + 2; }
    setSockets((prev) => [...prev, { room_id: roomId, room_name: room.name, socket_id: id, x_pct: x, y_pct: y, wall: deriveWall(x, y, room), height_mm: 300, type: "standard_16a", gang: 1 }]);
  }, [rooms, sockets, nextId]);

  const resetAll = useCallback(() => {
    setSockets([]); setPlacedRoomIds(new Set()); setDbPlaced(false); setPlacing(null); setSelectedSocket(null);
    const pos = switchboardPct(initialSwitchboard, rooms);
    setSwitchboard({ ...initialSwitchboard, x_pct: pos.x, y_pct: pos.y });
  }, [initialSwitchboard, rooms]);

  const selectedData = sockets.find((s) => s.socket_id === selectedSocket);
  const W = stageSize.width, H = stageSize.height;
  const unplacedRooms = rooms.filter((r) => !placedRoomIds.has(r.id) && (socketsByRoom.get(r.id)?.length || 0) > 0);

  // Instruction text (always visible — no layout shift)
  let instructionText = "Click Place on a room, then click on the plan to position its sockets.";
  if (placing?.type === 'room') {
    const rName = rooms.find((r) => r.id === (placing as any).roomId)?.name || "room";
    instructionText = `👆 Click on the floor plan to place ${rName} sockets`;
  } else if (placing?.type === 'db') {
    instructionText = "👆 Click on the floor plan to place the Distribution Board";
  } else if (selectedSocket) {
    instructionText = `Selected ${selectedSocket} — edit below or drag to reposition.`;
  } else if (sockets.length > 0 && unplacedRooms.length === 0) {
    instructionText = "All rooms placed! Drag sockets to adjust. Click a socket to edit.";
  }

  return (
    <section className="card fade-in placement-editor">
      <h2>Place sockets &amp; distribution board</h2>

      {/* Static instruction bar — always visible */}
      <div className={`instruction-bar ${placing ? "active" : ""}`}>
        <span>{instructionText}</span>
        {placing && <button className="banner-cancel" onClick={() => setPlacing(null)}>Cancel</button>}
      </div>

      {/* Room cards strip */}
      <div className="room-strip">
        {rooms.map((room) => {
          const proposed = socketsByRoom.get(room.id)?.length || 0;
          const placed = placedByRoom.get(room.id)?.length || 0;
          const isPlaced = placedRoomIds.has(room.id);
          const isPlacing = placing?.type === 'room' && (placing as any).roomId === room.id;
          return (
            <div key={room.id} className={`room-card ${isPlaced ? "done" : ""} ${isPlacing ? "active" : ""}`}>
              <div className="room-card-name">{room.name}</div>
              <div className="room-card-count">{isPlaced ? `${placed} placed` : `${proposed} sockets`}</div>
              {!isPlaced && proposed > 0 && (
                <button className={`room-card-btn ${isPlacing ? "active" : ""}`}
                  onClick={() => setPlacing(isPlacing ? null : { type: 'room', roomId: room.id })}>
                  {isPlacing ? "Click map ▸" : "Place ▸"}
                </button>
              )}
              {isPlaced && <button className="room-card-btn add" onClick={() => addSocketToRoom(room.id)}>+ Add</button>}
            </div>
          );
        })}
        <div className={`room-card db-card ${dbPlaced ? "done" : ""} ${placing?.type === 'db' ? "active" : ""}`}>
          <div className="room-card-name">⚡ DB</div>
          <div className="room-card-count">{dbPlaced ? "✓ Placed" : "Not placed"}</div>
          {!dbPlaced && (
            <button className={`room-card-btn ${placing?.type === 'db' ? "active" : ""}`}
              onClick={() => setPlacing(placing?.type === 'db' ? null : { type: 'db' })}>
              {placing?.type === 'db' ? "Click map ▸" : "Place ▸"}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar with zoom */}
      <div className="placement-toolbar">
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button className="btn outline" onClick={resetAll}>↺ Reset</button>
          <span className="toolbar-sep" />
          <button className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} title="Zoom out">−</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} title="Zoom in">+</button>
        </div>
        <span className="muted sm">{sockets.length} sockets · {unplacedRooms.length} rooms to place</span>
      </div>

      {/* Floor plan with zoom */}
      <div ref={containerRef} className="placement-canvas-wrap" style={placing ? { cursor: "crosshair" } : undefined}>
        <div style={{ overflow: "auto", maxHeight: `${H + 20}px` }}>
          {image && (
            <Stage width={W * zoom} height={H * zoom} scaleX={zoom} scaleY={zoom}
              onClick={handleStageClick} onTap={handleStageClick}>
              <Layer><KonvaImage image={image} width={W} height={H} /></Layer>
              <Layer listening={false}>
                {rooms.map((room) => (
                  <Text key={`lbl-${room.id}`} x={pctToPixel(room.position.x_pct, W) + 4} y={pctToPixel(room.position.y_pct, H) + 4}
                    text={room.name} fontSize={Math.max(9, Math.min(13, pctToPixel(room.position.w_pct, W) * 0.08))}
                    fontFamily="Inter, system-ui, sans-serif" fontStyle="600" fill="#1e293b" opacity={0.7} />
                ))}
              </Layer>
              <Layer>
                {sockets.map((s) => {
                  const sx = pctToPixel(s.x_pct, W), sy = pctToPixel(s.y_pct, H);
                  const isSel = s.socket_id === selectedSocket;
                  const color = SOCKET_COLORS[s.type] ?? SOCKET_COLORS.standard_16a;
                  const r = isSel ? 10 : 8;
                  const gang = s.gang || 1;
                  const gangLines: number[][] = [];
                  if (gang === 1) gangLines.push([0, 1, 0, -r + 2]);
                  else { const sp = Math.min(r - 2, gang * 2.5); for (let g = 0; g < gang; g++) { const lx = -sp / 2 + (sp / (gang - 1)) * g; gangLines.push([lx, 1, lx, -r + 2]); } }
                  // Manual rotation only (no auto-rotate from wall)
                  const rot = s.rotation ?? 0;
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
                      <Text x={-16} y={-r - 16} text={s.socket_id} fontSize={9} fontFamily="Inter, system-ui, sans-serif" fontStyle="700" fill={color} width={32} align="center" />
                      {gang > 1 && (<><Circle x={r + 2} y={-r} radius={6} fill={color} /><Text x={r - 1} y={-r - 4} text={String(gang)} fontSize={8} fontFamily="Inter, system-ui, sans-serif" fontStyle="700" fill="white" width={6} align="center" /></>)}
                    </Group>
                  );
                })}
              </Layer>
              <Layer>
                {dbPlaced && switchboard.x_pct !== undefined && switchboard.y_pct !== undefined && (() => {
                  const dbRot = switchboard.rotation ?? 0;
                  const dbType = switchboard.type || 'flush';
                  const dbRating = switchboard.rating || '63A';
                  const dbIp = switchboard.ip_rating || 'IP30';
                  // Size based on rating
                  const sizeMap: Record<string, { w: number; h: number }> = {
                    '40A': { w: 32, h: 22 }, '63A': { w: 40, h: 26 }, '80A': { w: 48, h: 30 }, '100A': { w: 54, h: 32 },
                  };
                  const sz = sizeMap[dbRating] || sizeMap['63A'];
                  // Color based on type
                  const fillColor = dbType === 'surface' ? '#334155' : dbType === 'floor_standing' ? '#1e293b' : '#475569';
                  const strokeColor = dbIp === 'IP65' ? '#10b981' : dbIp === 'IP44' ? '#f59e0b' : '#0f172a';
                  const strokeW = dbType === 'surface' ? 2.5 : 1.5;

                  return (
                    <Group x={pctToPixel(switchboard.x_pct!, W)} y={pctToPixel(switchboard.y_pct!, H)} draggable
                      onDragEnd={handleDbDragEnd}
                      onClick={(e) => { e.cancelBubble = true; setShowDbPanel(true); setSelectedSocket(null); }}
                      onTap={(e) => { e.cancelBubble = true; setShowDbPanel(true); setSelectedSocket(null); }}>
                      {/* Rotation group */}
                      <Group rotation={dbRot}>
                        {/* IP65 weather shield indicator */}
                        {dbIp === 'IP65' && <Rect x={-sz.w / 2 - 3} y={-sz.h / 2 - 3} width={sz.w + 6} height={sz.h + 6} fill="none" stroke="#10b981" strokeWidth={1} cornerRadius={5} dash={[3, 2]} />}
                        {/* Main box */}
                        <Rect x={-sz.w / 2} y={-sz.h / 2} width={sz.w} height={sz.h}
                          fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} cornerRadius={3} />
                        {/* Surface-mounted: double border */}
                        {dbType === 'surface' && <Rect x={-sz.w / 2 + 2} y={-sz.h / 2 + 2} width={sz.w - 4} height={sz.h - 4} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} cornerRadius={2} />}
                        {/* Floor-standing: base line */}
                        {dbType === 'floor_standing' && <Line points={[-sz.w / 2 - 4, sz.h / 2, sz.w / 2 + 4, sz.h / 2]} stroke="#0f172a" strokeWidth={2.5} />}
                        {/* Internal MCB slot lines */}
                        {Array.from({ length: Math.min(4, parseInt(dbRating) / 20) }).map((_, i) => {
                          const slotX = -sz.w / 2 + 4 + i * ((sz.w - 8) / Math.min(4, parseInt(dbRating) / 20));
                          return <Line key={i} points={[slotX, -sz.h / 2 + 4, slotX, sz.h / 2 - 4]} stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />;
                        })}
                      </Group>
                      {/* Labels outside rotation */}
                      <Text x={-sz.w / 2} y={-sz.h / 2 - 14} text="DB" fontSize={10}
                        fontFamily="Inter, system-ui, sans-serif" fontStyle="700" fill="white" width={sz.w} align="center" />
                      <Text x={-sz.w / 2} y={sz.h / 2 + 3} text={dbRating} fontSize={7}
                        fontFamily="Inter, system-ui, sans-serif" fontStyle="600" fill="#94a3b8" width={sz.w} align="center" />
                      {/* Lightning bolt */}
                      <Text x={-sz.w / 2} y={-4} text="⚡" fontSize={8}
                        fontFamily="Inter, system-ui, sans-serif" fill="#fbbf24" width={sz.w} align="center" />
                    </Group>
                  );
                })()}
              </Layer>
            </Stage>
          )}
        </div>
        {!image && <div className="placement-loading"><div className="pulse-ring" /><p className="muted">Loading…</p></div>}
      </div>

      {/* Socket detail panel */}
      {selectedData && (
        <div className="placement-panel" onClick={(e) => e.stopPropagation()}>
          <div className="placement-panel-head">
            <strong>{selectedData.socket_id}</strong>
            <span className="muted sm">{selectedData.room_name} · {selectedData.wall}</span>
            <button className="modal-close" onClick={() => setSelectedSocket(null)} aria-label="Close">×</button>
          </div>
          <div className="placement-panel-body">
            <div className="panel-row">
              <label className="form-field" style={{ flex: 1 }}>
                <span>Type</span>
                <select value={selectedData.type} onChange={(e) => updateSocket(selectedData.socket_id, { type: e.target.value })}>
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
            <div className="panel-row">
              <label className="form-field" style={{ flex: 1 }}>
                <span>Outlets</span>
                <div className="outlet-grid">
                  {OUTLET_OPTIONS.map((g) => (
                    <button key={g} className={`outlet-btn ${(selectedData.gang || 1) === g ? "active" : ""}`}
                      onClick={() => updateSocket(selectedData.socket_id, { gang: g })} title={OUTLET_LABELS[g]}>
                      <span className="outlet-num">{g}</span>
                    </button>
                  ))}
                </div>
              </label>
              <label className="form-field" style={{ flex: 1 }}>
                <span>Rotation</span>
                <div className="rotation-presets">
                  {ROTATION_OPTIONS.map((r) => {
                    const current = selectedData.rotation ?? 0;
                    return (
                      <button key={r.value} className={`btn ${current === r.value ? "primary" : "outline"}`}
                        onClick={() => updateSocket(selectedData.socket_id, { rotation: r.value })}>{r.label}</button>
                    );
                  })}
                </div>
              </label>
            </div>
            <button className="btn ghost" style={{ color: "var(--err)", alignSelf: "flex-start" }}
              onClick={() => deleteSocket(selectedData.socket_id)}>🗑 Delete</button>
          </div>
        </div>
      )}

      {showDbPanel && dbPlaced && (
        <div className="placement-panel" onClick={(e) => e.stopPropagation()}>
          <div className="placement-panel-head">
            <strong>Distribution Board</strong>
            <span className="muted sm">{switchboard.room_name} · {switchboard.wall}</span>
            <button className="modal-close" onClick={() => setShowDbPanel(false)} aria-label="Close">×</button>
          </div>
          <div className="placement-panel-body">
            <div className="panel-row">
              <label className="form-field" style={{ flex: 1 }}>
                <span>Type</span>
                <select value={switchboard.type || "flush"}
                  onChange={(e) => setSwitchboard((prev) => ({ ...prev, type: e.target.value }))}>
                  <option value="flush">Flush-mounted (recessed)</option>
                  <option value="surface">Surface-mounted</option>
                  <option value="floor_standing">Floor-standing</option>
                </select>
              </label>
              <label className="form-field" style={{ flex: 1 }}>
                <span>Rating</span>
                <select value={switchboard.rating || "63A"}
                  onChange={(e) => setSwitchboard((prev) => ({ ...prev, rating: e.target.value }))}>
                  <option value="40A">40A (small apartment)</option>
                  <option value="63A">63A (standard residential)</option>
                  <option value="80A">80A (large house)</option>
                  <option value="100A">100A (large + EV)</option>
                </select>
              </label>
            </div>
            <div className="panel-row">
              <label className="form-field" style={{ flex: 1 }}>
                <span>Height from floor</span>
                <div className="height-presets">
                  {([1400, 1500, 1600, 1800] as const).map((h) => (
                    <button key={h} className={`btn ${switchboard.height_mm === h ? "primary" : "outline"}`}
                      onClick={() => setSwitchboard((prev) => ({ ...prev, height_mm: h }))}>{h}mm</button>
                  ))}
                </div>
              </label>
              <label className="form-field" style={{ flex: 1 }}>
                <span>IP Rating</span>
                <select value={switchboard.ip_rating || "IP30"}
                  onChange={(e) => setSwitchboard((prev) => ({ ...prev, ip_rating: e.target.value }))}>
                  <option value="IP30">IP30 (indoor dry)</option>
                  <option value="IP44">IP44 (semi-outdoor)</option>
                  <option value="IP65">IP65 (outdoor / garage)</option>
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>Rotation</span>
              <div className="rotation-presets">
                {ROTATION_OPTIONS.map((r) => (
                  <button key={r.value} className={`btn ${(switchboard.rotation ?? 0) === r.value ? "primary" : "outline"}`}
                    onClick={() => setSwitchboard((prev) => ({ ...prev, rotation: r.value }))}>{r.label}</button>
                ))}
              </div>
            </label>
            <p className="muted sm" style={{ lineHeight: 1.4, marginTop: 4 }}>
              IEC 60364-5-51: Mount 1400–1800mm from floor. Accessible, dry location.
              {switchboard.reason ? ` ${switchboard.reason}` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="placement-legend">
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#4f46e5" }} /> Standard</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#f59e0b" }} /> Dedicated</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#10b981" }} /> IP44</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#8b5cf6" }} /> USB</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#6366f1" }} /> TV/Data</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#ef4444" }} /> Oven</div>
        <div className="placement-legend-item"><span className="placement-legend-dot" style={{ background: "#dc2626" }} /> EV</div>
        <div className="placement-legend-item"><span className="placement-legend-swatch" style={{ background: "#1e293b" }} /> DB</div>
      </div>

      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <button className="btn primary" disabled={sockets.length === 0} onClick={() => onConfirm(sockets, switchboard)}>Confirm placement →</button>
      </div>
    </section>
  );
}
