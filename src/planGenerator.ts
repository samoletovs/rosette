// Escape text for safe SVG/XML embedding
function xmlEsc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// IEC 60617-style socket symbol as SVG path
const SOCKET_SYMBOL = (x: number, y: number, id: string, type: string, height: string) => {
  const isSpecial = type !== "standard_16a";
  const fill = isSpecial ? "#f59e0b" : "#4f46e5";
  const r = 8;
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${fill}" stroke-width="1.5"/>
    <line x1="${x - 3}" y1="${y}" x2="${x + 3}" y2="${y}" stroke="${fill}" stroke-width="1.5"/>
    <line x1="${x}" y1="${y - 3}" x2="${x}" y2="${y + 3}" stroke="${fill}" stroke-width="1.5"/>
    ${isSpecial ? `<line x1="${x - r - 2}" y1="${y + r + 2}" x2="${x + r + 2}" y2="${y - r - 2}" stroke="${fill}" stroke-width="1"/>` : ""}
    <text x="${x}" y="${y - 13}" text-anchor="middle" font-size="8" font-weight="700" fill="${fill}">${xmlEsc(id)}</text>
    <text x="${x}" y="${y + 18}" text-anchor="middle" font-size="6.5" fill="#6b7280">${xmlEsc(height)}</text>
  </g>`;
};

const WALL_NAMES: Record<string, string> = {
  north: "N", south: "S", east: "E", west: "W",
  top: "N", bottom: "S", right: "E", left: "W",
};

function normalizeWall(wall: string): string {
  const w = wall.toLowerCase().trim();
  for (const [key, val] of Object.entries(WALL_NAMES)) {
    if (w.includes(key)) return val;
  }
  return "N";
}

const ROOM_COLORS: Record<string, string> = {
  kitchen: "#fef3c7", living_room: "#dbeafe", bedroom: "#ede9fe",
  bathroom: "#d1fae5", hallway: "#f1f5f9", wc: "#d1fae5",
  home_office: "#fce7f3", utility_room: "#e0e7ff", garage: "#f5f5f4",
  balcony: "#ecfdf5", dining_room: "#fff7ed",
};

// Generate per-room wall layout diagrams
export function generateRoomLayouts(rooms: any[], placements: any[]): string {
  const roomW = 200, roomH = 140, pad = 16, labelH = 28;
  const cols = Math.min(rooms.length, 3);
  const rows = Math.ceil(rooms.length / cols);
  const cellW = roomW + pad * 2;
  const cellH = roomH + pad * 2 + labelH + 30;
  const svgW = cols * cellW + pad;
  const svgH = rows * cellH + 50;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:Inter,system-ui,sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="#fafbfc" rx="6"/>`;
  svg += `<text x="${svgW / 2}" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">Room Socket Layouts</text>`;
  svg += `<text x="${svgW / 2}" y="36" text-anchor="middle" font-size="9" fill="#6b7280">IEC 60617 socket symbols — ⊕ Standard 16A — ⊕╱ Dedicated/Special</text>`;

  rooms.forEach((room: any, i: number) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = pad + col * cellW;
    const oy = 50 + row * cellH;
    const rx = ox + pad;
    const ry = oy + labelH;
    const type = room.type?.toLowerCase().replace(/[\s-]+/g, "_") || "other";
    const fill = ROOM_COLORS[type] || "#f1f5f9";

    // Room label
    svg += `<text x="${rx + roomW / 2}" y="${oy + 16}" text-anchor="middle" font-size="10" font-weight="700" fill="#111827">${xmlEsc(room.name || room.type)}</text>`;
    svg += `<text x="${rx + roomW / 2}" y="${oy + 26}" text-anchor="middle" font-size="7.5" fill="#6b7280">${xmlEsc(`${room.area_m2 || "?"} m² · ${room.width_m || "?"}×${room.height_m || "?"}m`)}</text>`;

    // Room rectangle with wall labels
    svg += `<rect x="${rx}" y="${ry}" width="${roomW}" height="${roomH}" fill="${fill}" stroke="#94a3b8" stroke-width="1.5" rx="2"/>`;

    // Wall labels (compass)
    svg += `<text x="${rx + roomW / 2}" y="${ry - 3}" text-anchor="middle" font-size="7" fill="#9ca3af">N</text>`;
    svg += `<text x="${rx + roomW / 2}" y="${ry + roomH + 10}" text-anchor="middle" font-size="7" fill="#9ca3af">S</text>`;
    svg += `<text x="${rx - 8}" y="${ry + roomH / 2 + 3}" text-anchor="middle" font-size="7" fill="#9ca3af">W</text>`;
    svg += `<text x="${rx + roomW + 8}" y="${ry + roomH / 2 + 3}" text-anchor="middle" font-size="7" fill="#9ca3af">E</text>`;

    // Get sockets for this room
    const roomSockets = placements.filter((p: any) => p.room_id === room.id || p.room_name === room.name);

    // Place sockets on walls
    const wallGroups: Record<string, any[]> = { N: [], S: [], E: [], W: [] };
    roomSockets.forEach((s: any) => {
      const wall = normalizeWall(s.wall || "north");
      wallGroups[wall].push(s);
    });

    // Position sockets along each wall
    for (const [wall, sockets] of Object.entries(wallGroups)) {
      sockets.forEach((s: any, idx: number) => {
        const count = sockets.length;
        const spacing = wall === "N" || wall === "S" ? roomW / (count + 1) : roomH / (count + 1);
        let sx: number, sy: number;

        if (wall === "N") {
          sx = rx + spacing * (idx + 1);
          sy = ry + 14;
        } else if (wall === "S") {
          sx = rx + spacing * (idx + 1);
          sy = ry + roomH - 14;
        } else if (wall === "W") {
          sx = rx + 14;
          sy = ry + spacing * (idx + 1);
        } else {
          sx = rx + roomW - 14;
          sy = ry + spacing * (idx + 1);
        }

        const h = s.height_mm ? `${s.height_mm}mm` : "";
        svg += SOCKET_SYMBOL(sx, sy, s.socket_id, s.type || "standard_16a", h);
      });
    }
  });

  svg += `</svg>`;
  return svg;
}

// Build RCD groups from circuit data. If the AI provided rcd_groups, use them;
// otherwise auto-group circuits into chunks of max 3-4 per RCD.
function buildRcdGroups(circuits: any[], rcdGroups?: any[]): { id: string; label: string; rcd: string; circuits: any[] }[] {
  if (rcdGroups && rcdGroups.length > 0) {
    const circuitMap = new Map(circuits.map(c => [c.id, c]));
    return rcdGroups.map((g: any) => ({
      id: g.id,
      label: g.label || g.id,
      rcd: g.rcd || "30mA Type A",
      circuits: (g.circuits || []).map((cid: string) => circuitMap.get(cid)).filter(Boolean),
    }));
  }
  // Fallback: group by rcd_group field on circuits, or auto-chunk max 4
  const groupMap = new Map<string, any[]>();
  circuits.forEach(c => {
    const key = c.rcd_group || "auto";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(c);
  });
  if (groupMap.size === 1 && groupMap.has("auto")) {
    // No grouping info — split into chunks of 4
    const groups: { id: string; label: string; rcd: string; circuits: any[] }[] = [];
    const all = circuits.slice();
    let idx = 1;
    while (all.length > 0) {
      groups.push({ id: `rcd_${idx}`, label: `RCD ${idx}`, rcd: "30mA Type A", circuits: all.splice(0, 4) });
      idx++;
    }
    return groups;
  }
  let idx = 1;
  return Array.from(groupMap.entries()).map(([key, circs]) => ({
    id: key === "auto" ? `rcd_${idx}` : key,
    label: key === "auto" ? `RCD ${idx++}` : key.replace(/_/g, " ").replace(/^rcd /i, "RCD "),
    rcd: "30mA Type A",
    circuits: circs,
  }));
}

// Generate single-line circuit diagram with multiple RCD groups
export function generateCircuitDiagram(circuits: any[], totalSockets: number, rcdGroups?: any[]): string {
  const groups = buildRcdGroups(circuits, rcdGroups);
  const circuitCount = circuits.length || 1;
  const groupCount = groups.length || 1;
  const circuitW = 80;
  const groupGap = 28;
  const svgW = Math.max(650, circuitCount * circuitW + groupCount * groupGap + 160);
  const svgH = 360;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:Inter,system-ui,sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="#fafbfc" rx="6"/>`;

  // Title
  svg += `<text x="${svgW / 2}" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">Single-Line Circuit Diagram</text>`;
  svg += `<text x="${svgW / 2}" y="36" text-anchor="middle" font-size="9" fill="#6b7280">Distribution Board → RCDs (30mA, max 3–4 circuits each) → MCBs → Sockets</text>`;

  // Supply box
  const topY = 55;
  const dbX = 30, dbW = 50, dbH = 30;
  svg += `<rect x="${dbX}" y="${topY}" width="${dbW}" height="${dbH}" fill="#4f46e5" rx="4"/>`;
  svg += `<text x="${dbX + dbW / 2}" y="${topY + 12}" text-anchor="middle" font-size="7" font-weight="700" fill="white">SUPPLY</text>`;
  svg += `<text x="${dbX + dbW / 2}" y="${topY + 22}" text-anchor="middle" font-size="6" fill="white">230V/400V</text>`;

  // Main bus bar from supply to end
  const busY = topY + dbH / 2;
  const busStartX = dbX + dbW;

  // Calculate total width needed for groups
  let totalGroupW = 0;
  groups.forEach(g => { totalGroupW += g.circuits.length * circuitW + groupGap; });
  const groupStartX = busStartX + 20;
  const busEndX = groupStartX + totalGroupW + 10;

  svg += `<line x1="${busStartX}" y1="${busY}" x2="${busEndX}" y2="${busY}" stroke="#111827" stroke-width="2.5"/>`;

  // Draw each RCD group
  const rcdY = busY + 40;
  let curX = groupStartX;
  const rcdColors = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6"];

  groups.forEach((group, gi) => {
    const gCircuits = group.circuits;
    const gCount = gCircuits.length;
    const gWidth = gCount * circuitW;
    const gCenterX = curX + gWidth / 2;
    const rcdColor = rcdColors[gi % rcdColors.length];

    // Vertical line from bus bar down to RCD
    svg += `<line x1="${gCenterX}" y1="${busY}" x2="${gCenterX}" y2="${busY + 16}" stroke="#374151" stroke-width="2"/>`;

    // RCD box
    const rcdBoxW = 44;
    svg += `<rect x="${gCenterX - rcdBoxW / 2}" y="${busY + 16}" width="${rcdBoxW}" height="32" fill="#fff" stroke="${rcdColor}" stroke-width="1.5" rx="3"/>`;
    svg += `<text x="${gCenterX}" y="${busY + 28}" text-anchor="middle" font-size="7" font-weight="700" fill="${rcdColor}">RCD</text>`;
    svg += `<text x="${gCenterX}" y="${busY + 38}" text-anchor="middle" font-size="5.5" fill="#6b7280">30mA</text>`;

    // RCD label below
    svg += `<text x="${gCenterX}" y="${busY + 58}" text-anchor="middle" font-size="6.5" font-weight="600" fill="${rcdColor}">${xmlEsc(group.label)}</text>`;

    // Sub-bus line from RCD to its circuits
    const subBusY = busY + 68;
    const subBusStartX = curX + circuitW / 2 - 10;
    const subBusEndX = curX + gWidth - circuitW / 2 + 10;
    svg += `<line x1="${gCenterX}" y1="${busY + 48}" x2="${gCenterX}" y2="${subBusY}" stroke="${rcdColor}" stroke-width="1.5"/>`;
    if (gCount > 1) {
      svg += `<line x1="${subBusStartX}" y1="${subBusY}" x2="${subBusEndX}" y2="${subBusY}" stroke="${rcdColor}" stroke-width="1.5"/>`;
    }

    // Background group area
    svg += `<rect x="${curX - 4}" y="${subBusY - 4}" width="${gWidth + 8}" height="${svgH - subBusY - 30}" fill="${rcdColor}08" stroke="${rcdColor}30" stroke-width="1" rx="6" stroke-dasharray="4 2"/>`;

    // Draw circuits within this group
    gCircuits.forEach((circuit: any, ci: number) => {
      const cx = curX + ci * circuitW + circuitW / 2;
      const socketIds: string[] = circuit.sockets || [];
      const socketCount = socketIds.length;

      // Vertical line from sub-bus to MCB
      svg += `<line x1="${cx}" y1="${subBusY}" x2="${cx}" y2="${subBusY + 30}" stroke="#374151" stroke-width="1.5"/>`;

      // Circuit ID label
      svg += `<text x="${cx}" y="${subBusY + 22}" text-anchor="middle" font-size="7" font-weight="600" fill="#374151">${xmlEsc(circuit.id || `C${ci + 1}`)}</text>`;

      // MCB box
      const mcbY = subBusY + 30;
      svg += `<rect x="${cx - 14}" y="${mcbY}" width="28" height="22" fill="#fff" stroke="#4f46e5" stroke-width="1.5" rx="2"/>`;
      svg += `<text x="${cx}" y="${mcbY + 10}" text-anchor="middle" font-size="6.5" font-weight="700" fill="#4f46e5">${xmlEsc(circuit.breaker || "16A")}</text>`;
      svg += `<text x="${cx}" y="${mcbY + 19}" text-anchor="middle" font-size="5.5" fill="#6b7280">MCB</text>`;

      // Vertical line to sockets
      svg += `<line x1="${cx}" y1="${mcbY + 22}" x2="${cx}" y2="${mcbY + 42}" stroke="#374151" stroke-width="1"/>`;

      // Socket group box
      const sockY = mcbY + 46;
      const sockGroupW = Math.max(30, socketCount * 14 + 4);
      svg += `<rect x="${cx - sockGroupW / 2}" y="${sockY}" width="${sockGroupW}" height="36" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1" rx="4"/>`;

      // Socket symbols
      const startSX = cx - (socketCount - 1) * 6;
      socketIds.forEach((_sid: string, j: number) => {
        const ssx = startSX + j * 12;
        const ssy = sockY + 12;
        svg += `<circle cx="${ssx}" cy="${ssy}" r="4.5" fill="none" stroke="#4f46e5" stroke-width="1"/>`;
        svg += `<line x1="${ssx - 2}" y1="${ssy}" x2="${ssx + 2}" y2="${ssy}" stroke="#4f46e5" stroke-width="1"/>`;
      });

      // Socket count + cable
      svg += `<text x="${cx}" y="${sockY + 30}" text-anchor="middle" font-size="6" font-weight="600" fill="#4f46e5">${socketCount}× socket</text>`;
      svg += `<text x="${cx}" y="${sockY + 44}" text-anchor="middle" font-size="5.5" fill="#6b7280">${xmlEsc(circuit.cable || "3×2.5mm²")}</text>`;

      // Socket IDs
      svg += `<text x="${cx}" y="${sockY + 54}" text-anchor="middle" font-size="5" fill="#9ca3af">${xmlEsc(socketIds.join(", "))}</text>`;
    });

    curX += gWidth + groupGap;
  });

  // Legend
  svg += `<text x="20" y="${svgH - 12}" font-size="7" fill="#9ca3af">Standard: IEC 60364 | Each RCD protects max 3–4 circuits (30mA Type A) | Selectivity: fault trips one RCD, rest stays live</text>`;

  svg += `</svg>`;
  return svg;
}

// Keep drawAnnotatedPlan but mark it as reference-only (no socket dots)
export function drawReferencePlan(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  ctx.drawImage(image, 0, 0);

  // Add "Reference Plan" watermark
  ctx.font = "bold 14px Inter, sans-serif";
  ctx.fillStyle = "rgba(79, 70, 229, 0.7)";
  ctx.textAlign = "right";
  ctx.fillText("Reference Floor Plan", canvas.width - 12, canvas.height - 12);
}

// IEC 60446 wire colors for SVG rendering
const WIRE_COLORS: Record<string, string> = {
  "Brown (L)": "#8B4513", "Blue (N)": "#1E90FF", "Green-Yellow (PE)": "#228B22",
  "Black (L2)": "#1a1a1a", "Grey (L3)": "#808080",
  Brown: "#8B4513", Blue: "#1E90FF", "Green-Yellow": "#228B22",
  Black: "#1a1a1a", Grey: "#808080",
};

const CABLE_THICKNESS: Record<string, number> = {
  "1.5": 1, "2.5": 1.5, "4": 2, "6": 2.5,
};

function getCableSize(cableType: string): string {
  const m = cableType.match(/(\d+(?:\.\d+)?)\s*mm/);
  return m ? m[1] : "2.5";
}

// Generate wiring diagram showing cables from switchboard to rooms
export function generateWiringDiagram(
  wiring: any[],
  rooms: any[],
  circuits: any[],
  switchboard?: any
): string {
  if (!wiring || wiring.length === 0) {
    // Fallback: no wiring data
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200" style="font-family:Inter,system-ui,sans-serif">
      <rect width="600" height="200" fill="#fafbfc" rx="6"/>
      <text x="300" y="100" text-anchor="middle" font-size="13" fill="#6b7280">No wiring data available</text>
    </svg>`;
  }

  // Collect unique destination rooms from wiring
  const destRooms = new Map<string, { name: string; id: string }>();
  for (const w of wiring) {
    const key = w.to_room_id || w.to_room || w.circuit_id;
    if (!destRooms.has(key)) {
      destRooms.set(key, { name: w.to_room || key, id: w.to_room_id || key });
    }
  }
  const roomList = Array.from(destRooms.values());
  const roomCount = roomList.length;

  // Layout calculations
  const dbX = 60, dbY = 80;
  const dbW = 100, dbH = Math.max(120, wiring.length * 22 + 40);
  const roomStartX = 320;
  const roomSpacingY = Math.max(52, dbH / Math.max(roomCount, 1));
  const roomStartY = dbY + 10;
  const svgW = 700;
  const svgH = Math.max(dbY + dbH + 100, roomStartY + roomCount * roomSpacingY + 80);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:Inter,system-ui,sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="#fafbfc" rx="6"/>`;

  // Title
  svg += `<text x="${svgW / 2}" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">Wiring Plan — Switchboard to Rooms</text>`;
  svg += `<text x="${svgW / 2}" y="36" text-anchor="middle" font-size="9" fill="#6b7280">Cable routes from distribution board · IEC 60446 wire colors</text>`;

  // Switchboard / Distribution Board box
  svg += `<rect x="${dbX}" y="${dbY}" width="${dbW}" height="${dbH}" fill="#fff" stroke="#4f46e5" stroke-width="2" rx="4"/>`;
  svg += `<rect x="${dbX}" y="${dbY}" width="${dbW}" height="24" fill="#4f46e5" rx="4"/>`;
  svg += `<rect x="${dbX}" y="${dbY + 12}" width="${dbW}" height="12" fill="#4f46e5"/>`;
  svg += `<text x="${dbX + dbW / 2}" y="${dbY + 15}" text-anchor="middle" font-size="8" font-weight="700" fill="white">DISTRIBUTION</text>`;
  svg += `<text x="${dbX + dbW / 2}" y="${dbY + 23}" text-anchor="middle" font-size="7" fill="white">BOARD</text>`;

  // Switchboard location label
  const dbRoom = switchboard?.room_name || "Hallway";
  svg += `<text x="${dbX + dbW / 2}" y="${dbY - 6}" text-anchor="middle" font-size="7.5" fill="#6b7280">📍 ${xmlEsc(dbRoom)}</text>`;

  // Draw DIN rail slots (MCB breakers inside the DB box)
  const slotStartY = dbY + 32;
  wiring.forEach((w: any, i: number) => {
    const sy = slotStartY + i * 20;
    if (sy + 16 > dbY + dbH - 4) return;
    // MCB slot
    svg += `<rect x="${dbX + 6}" y="${sy}" width="30" height="14" fill="#eef2ff" stroke="#c7d2fe" stroke-width="0.8" rx="2"/>`;
    svg += `<text x="${dbX + 21}" y="${sy + 10}" text-anchor="middle" font-size="5.5" font-weight="600" fill="#4f46e5">${xmlEsc(w.circuit_id || `C${i + 1}`)}</text>`;
    // Breaker rating
    const breaker = circuits.find((c: any) => c.id === w.circuit_id)?.breaker || "16A";
    svg += `<text x="${dbX + 42}" y="${sy + 10}" font-size="5" fill="#6b7280">${xmlEsc(breaker)}</text>`;
  });

  // Draw room boxes and cable lines
  const roomPositions: { x: number; y: number; name: string }[] = [];
  roomList.forEach((room, i) => {
    const rx = roomStartX;
    const ry = roomStartY + i * roomSpacingY;
    roomPositions.push({ x: rx, y: ry, name: room.name });

    // Room box
    const rType = rooms.find((r: any) => r.id === room.id || r.name === room.name)?.type?.toLowerCase().replace(/[\s-]+/g, "_") || "other";
    const fill = ROOM_COLORS[rType] || "#f1f5f9";
    svg += `<rect x="${rx}" y="${ry}" width="120" height="36" fill="${fill}" stroke="#94a3b8" stroke-width="1.2" rx="4"/>`;
    svg += `<text x="${rx + 60}" y="${ry + 15}" text-anchor="middle" font-size="9" font-weight="600" fill="#111827">${xmlEsc(room.name)}</text>`;

    // Show socket count from wiring entries for this room
    const roomWires = wiring.filter((w: any) => (w.to_room_id || w.to_room) === room.id || w.to_room === room.name);
    const socketCount = roomWires.reduce((sum: number, w: any) => {
      const circuit = circuits.find((c: any) => c.id === w.circuit_id);
      return sum + (circuit?.sockets?.length || 0);
    }, 0);
    if (socketCount > 0) {
      svg += `<text x="${rx + 60}" y="${ry + 28}" text-anchor="middle" font-size="7" fill="#6b7280">${socketCount} sockets</text>`;
    }
  });

  // Draw cable lines from DB to rooms
  wiring.forEach((w: any, i: number) => {
    const roomTarget = roomPositions.find((r) => r.name === w.to_room) ||
      roomPositions.find((r) => r.name === destRooms.get(w.to_room_id || w.to_room)?.name);
    if (!roomTarget) return;

    const fromX = dbX + dbW;
    const fromY = slotStartY + i * 20 + 7;
    const toX = roomTarget.x;
    const toY = roomTarget.y + 18;

    // Cable size determines thickness
    const cableSize = getCableSize(w.cable_type || "3×2.5mm²");
    const thickness = CABLE_THICKNESS[cableSize] || 1.5;
    const wireColors = w.wire_colors || ["Brown (L)", "Blue (N)", "Green-Yellow (PE)"];
    const wireCount = wireColors.length;

    // Draw multi-wire bundle: parallel lines offset vertically
    const bundleSpread = wireCount * 2;
    const midX = fromX + (toX - fromX) * 0.5 + (i % 2 === 0 ? 10 : -10);

    wireColors.forEach((color: string, wi: number) => {
      const offset = (wi - (wireCount - 1) / 2) * 2;
      const svgColor = WIRE_COLORS[color] || WIRE_COLORS[color.split(" ")[0]] || "#374151";
      const fy = fromY + offset;
      const ty = toY + offset;
      svg += `<path d="M${fromX},${fy} C${midX},${fy} ${midX},${ty} ${toX},${ty}" fill="none" stroke="${svgColor}" stroke-width="${thickness * 0.6}" opacity="0.85"/>`;
    });

    // Cable label on the line
    const labelX = fromX + (toX - fromX) * 0.5;
    const labelY = (fromY + toY) / 2 - bundleSpread - 4;
    svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="6" fill="#374151" font-weight="500">${xmlEsc(w.cable_type || "")}</text>`;

    // Length label
    if (w.estimated_length_m) {
      svg += `<text x="${labelX}" y="${labelY + 8}" text-anchor="middle" font-size="5.5" fill="#9ca3af">~${w.estimated_length_m}m</text>`;
    }
  });

  // Total cable length
  const totalCable = wiring.reduce((sum: number, w: any) => sum + (w.estimated_length_m || 0), 0);
  if (totalCable > 0) {
    svg += `<text x="${svgW / 2}" y="${svgH - 50}" text-anchor="middle" font-size="9" font-weight="600" fill="#374151">Total estimated cable: ~${totalCable}m</text>`;
  }

  // Wire color legend
  const legendY = svgH - 36;
  const legendItems = [
    { color: "#8B4513", label: "Brown (L)" },
    { color: "#1E90FF", label: "Blue (N)" },
    { color: "#228B22", label: "GY (PE)" },
    { color: "#1a1a1a", label: "Black (L2)" },
    { color: "#808080", label: "Grey (L3)" },
  ];
  const legendStartX = svgW / 2 - (legendItems.length * 65) / 2;
  legendItems.forEach((item, i) => {
    const lx = legendStartX + i * 65;
    svg += `<line x1="${lx}" y1="${legendY}" x2="${lx + 16}" y2="${legendY}" stroke="${item.color}" stroke-width="2.5"/>`;
    svg += `<text x="${lx + 20}" y="${legendY + 3}" font-size="6.5" fill="#6b7280">${item.label}</text>`;
  });

  svg += `<text x="${svgW / 2}" y="${svgH - 8}" text-anchor="middle" font-size="6.5" fill="#9ca3af">IEC 60446 / HD 308 S2 wire colors · NYM-J cable · Verify lengths on-site</text>`;

  svg += `</svg>`;
  return svg;
}
