import {
  xmlEsc,
  socketOutlet,
  mcbSymbol,
  rcdSymbol,
  mainSwitchSymbol,
  distributionBoardBox,
  titleBlock,
  symbolLegend,
  standardsFooter,
  COLORS,
  WIRE_COLORS,
  ROOM_COLORS,
  LEGEND_ITEMS,
} from './symbolLibrary';

export { xmlEsc, WIRE_COLORS, ROOM_COLORS };

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

// Generate per-room wall layout diagrams with IEC 60617 symbols
export function generateRoomLayouts(rooms: any[], placements: any[]): string {
  const roomW = 240, roomH = 160, pad = 16, labelH = 32;
  const cols = Math.min(rooms.length, 3);
  const rows = Math.ceil(rooms.length / cols);
  const cellW = roomW + pad * 2;
  const cellH = roomH + pad * 2 + labelH + 40;
  const svgW = cols * cellW + pad;
  const legendH = 80;
  const titleH = 48;
  const svgH = titleH + rows * cellH + legendH + 20;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:Inter,system-ui,sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="${COLORS.bg}" rx="6"/>`;

  svg += titleBlock(svgW, {
    title: 'Room Socket Layouts',
    subtitle: 'IEC 60617 symbols · Per-room socket summary',
    date: new Date().toISOString().slice(0, 10),
    drawingNumber: 'E-01',
  });

  rooms.forEach((room: any, i: number) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = pad + col * cellW;
    const oy = titleH + 4 + row * cellH;
    const rx = ox + pad;
    const ry = oy + labelH;
    const type = room.type?.toLowerCase().replace(/[\s-]+/g, "_") || "other";
    const fill = ROOM_COLORS[type] || "#f1f5f9";

    // Room label
    svg += `<text x="${rx + roomW / 2}" y="${oy + 16}" text-anchor="middle" font-size="11" font-weight="700" fill="${COLORS.text}">${xmlEsc(room.name || room.type)}</text>`;
    svg += `<text x="${rx + roomW / 2}" y="${oy + 28}" text-anchor="middle" font-size="8" fill="${COLORS.muted}">${xmlEsc(`${room.area_m2 || "?"} m² · ${room.width_m || "?"}×${room.height_m || "?"}m`)}</text>`;

    // Room rectangle
    svg += `<rect x="${rx}" y="${ry}" width="${roomW}" height="${roomH}" fill="${fill}" stroke="${COLORS.wall}" stroke-width="1.5" rx="3"/>`;

    // Wall labels
    svg += `<text x="${rx + roomW / 2}" y="${ry - 3}" text-anchor="middle" font-size="7" fill="${COLORS.faint}">N</text>`;
    svg += `<text x="${rx + roomW / 2}" y="${ry + roomH + 10}" text-anchor="middle" font-size="7" fill="${COLORS.faint}">S</text>`;
    svg += `<text x="${rx - 8}" y="${ry + roomH / 2 + 3}" text-anchor="middle" font-size="7" fill="${COLORS.faint}">W</text>`;
    svg += `<text x="${rx + roomW + 8}" y="${ry + roomH / 2 + 3}" text-anchor="middle" font-size="7" fill="${COLORS.faint}">E</text>`;

    // Get sockets for this room
    const roomSockets = placements.filter((p: any) => p.room_id === room.id || p.room_name === room.name);

    // Socket count summary inside room
    const totalOutlets = roomSockets.reduce((sum: number, s: any) => sum + (s.gang || 1), 0);
    svg += `<text x="${rx + roomW / 2}" y="${ry + roomH / 2 - 8}" text-anchor="middle" font-size="22" font-weight="700" fill="${COLORS.text}" opacity="0.15">${roomSockets.length}</text>`;
    svg += `<text x="${rx + roomW / 2}" y="${ry + roomH / 2 + 8}" text-anchor="middle" font-size="8" fill="${COLORS.muted}" opacity="0.4">${roomSockets.length} points · ${totalOutlets} outlets</text>`;

    // Place sockets on walls using IEC symbols
    const wallGroups: Record<string, any[]> = { N: [], S: [], E: [], W: [] };
    roomSockets.forEach((s: any) => { wallGroups[normalizeWall(s.wall || "north")].push(s); });

    for (const [wall, sockets] of Object.entries(wallGroups)) {
      sockets.forEach((s: any, idx: number) => {
        const count = sockets.length;
        const spacing = wall === "N" || wall === "S" ? roomW / (count + 1) : roomH / (count + 1);
        let sx: number, sy: number;
        if (wall === "N") { sx = rx + spacing * (idx + 1); sy = ry + 16; }
        else if (wall === "S") { sx = rx + spacing * (idx + 1); sy = ry + roomH - 16; }
        else if (wall === "W") { sx = rx + 16; sy = ry + spacing * (idx + 1); }
        else { sx = rx + roomW - 16; sy = ry + spacing * (idx + 1); }

        const h = s.height_mm ? `${s.height_mm}mm` : "";
        // Room layout diagram: rotate based on wall (semicircle opens into room)
        const wallRot: Record<string, number> = { N: 180, S: 0, E: 270, W: 90 };
        svg += socketOutlet(sx, sy, s.socket_id, s.type || "standard_16a", h, s.gang || 1, wallRot[wall] ?? 0);
      });
    }

    // Socket list below room (compact table)
    const listY = ry + roomH + 4;
    roomSockets.forEach((s: any, idx: number) => {
      if (idx >= 6) return; // max 6 in the summary
      const lx = rx + (idx % 3) * 80;
      const ly = listY + Math.floor(idx / 3) * 12;
      const typeLabel = s.type === 'standard_16a' ? '' : ` · ${s.type?.replace(/_/g, ' ') || ''}`;
      const gangLabel = (s.gang || 1) > 1 ? ` ${s.gang}×` : '';
      svg += `<text x="${lx}" y="${ly + 9}" font-size="6" fill="${COLORS.muted}">${xmlEsc(s.socket_id)}${gangLabel} ${s.height_mm || 300}mm${typeLabel}</text>`;
    });
    if (roomSockets.length > 6) {
      svg += `<text x="${rx}" y="${listY + 33}" font-size="6" fill="${COLORS.faint}">+${roomSockets.length - 6} more</text>`;
    }
  });

  svg += symbolLegend(svgW, svgH - legendH - 14, [
    LEGEND_ITEMS.singleSocket,
    LEGEND_ITEMS.specialSocket,
    LEGEND_ITEMS.ip44Socket,
  ]);
  svg += standardsFooter(svgW, svgH);
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

// Generate single-line circuit diagram with IEC 60617 symbols
export function generateCircuitDiagram(circuits: any[], totalSockets: number, rcdGroups?: any[]): string {
  const groups = buildRcdGroups(circuits, rcdGroups);
  const circuitCount = circuits.length || 1;
  const groupCount = groups.length || 1;
  const circuitW = 80;
  const groupGap = 28;
  const svgW = Math.max(650, circuitCount * circuitW + groupCount * groupGap + 160);
  const legendH = 60;
  const titleH = 48;
  const svgH = 360 + legendH + titleH;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:Inter,system-ui,sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="${COLORS.bg}" rx="6"/>`;

  // IEC 61082 title block
  svg += titleBlock(svgW, {
    title: 'Single-Line Circuit Diagram',
    subtitle: 'Distribution Board → RCDs (30mA, max 3–4 circuits each) → MCBs → Sockets',
    date: new Date().toISOString().slice(0, 10),
    drawingNumber: 'E-02',
  });

  // Supply box — IEC main switch symbol
  const topY = titleH + 10;
  const dbX = 30;
  svg += mainSwitchSymbol(dbX + 25, topY, 'SUPPLY');

  // Main bus bar from supply to end
  const busY = topY + 15;
  const busStartX = dbX + 50;

  // Calculate total width needed for groups
  let totalGroupW = 0;
  groups.forEach(g => { totalGroupW += g.circuits.length * circuitW + groupGap; });
  const groupStartX = busStartX + 20;
  const busEndX = groupStartX + totalGroupW + 10;

  svg += `<line x1="${busStartX}" y1="${busY}" x2="${busEndX}" y2="${busY}" stroke="${COLORS.supply}" stroke-width="2.5"/>`;

  // Draw each RCD group with IEC 60617 symbols
  const _rcdY = busY + 40;
  let curX = groupStartX;
  const rcdColors = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6"];

  groups.forEach((group, gi) => {
    const gCircuits = group.circuits;
    const gCount = gCircuits.length;
    const gWidth = gCount * circuitW;
    const gCenterX = curX + gWidth / 2;
    const rcdColor = rcdColors[gi % rcdColors.length];

    // Vertical line from bus bar down to RCD
    svg += `<line x1="${gCenterX}" y1="${busY}" x2="${gCenterX}" y2="${busY + 16}" stroke="${COLORS.supply}" stroke-width="2"/>`;

    // IEC 60617 RCD symbol with delta (Δ)
    svg += rcdSymbol(gCenterX, busY + 16, group.label, '30mA Type A', rcdColor);

    // Sub-bus line from RCD to its circuits
    const subBusY = busY + 68;
    const subBusStartX = curX + circuitW / 2 - 10;
    const subBusEndX = curX + gWidth - circuitW / 2 + 10;
    svg += `<line x1="${gCenterX}" y1="${busY + 50}" x2="${gCenterX}" y2="${subBusY}" stroke="${rcdColor}" stroke-width="1.5"/>`;
    if (gCount > 1) {
      svg += `<line x1="${subBusStartX}" y1="${subBusY}" x2="${subBusEndX}" y2="${subBusY}" stroke="${rcdColor}" stroke-width="1.5"/>`;
    }

    // Background group area
    svg += `<rect x="${curX - 4}" y="${subBusY - 4}" width="${gWidth + 8}" height="${svgH - legendH - subBusY - 40}" fill="${rcdColor}08" stroke="${rcdColor}30" stroke-width="1" rx="6" stroke-dasharray="4 2"/>`;

    // Draw circuits within this group with IEC 60617 MCB symbols
    gCircuits.forEach((circuit: any, ci: number) => {
      const cx = curX + ci * circuitW + circuitW / 2;
      const socketIds: string[] = circuit.sockets || [];
      const socketCount = socketIds.length;

      // Vertical line from sub-bus to MCB
      svg += `<line x1="${cx}" y1="${subBusY}" x2="${cx}" y2="${subBusY + 18}" stroke="${COLORS.supply}" stroke-width="1.5"/>`;

      // IEC 60617 MCB symbol
      const mcbY = subBusY + 18;
      svg += mcbSymbol(cx, mcbY, circuit.breaker || '16A', circuit.id || `C${ci + 1}`);

      // Vertical line to sockets
      const mcbBottom = mcbY + 26;
      svg += `<line x1="${cx}" y1="${mcbBottom}" x2="${cx}" y2="${mcbBottom + 16}" stroke="${COLORS.supply}" stroke-width="1"/>`;

      // Socket group — IEC 60617 socket symbols
      const sockY = mcbBottom + 20;
      const sockGroupW = Math.max(30, socketCount * 14 + 4);
      svg += `<rect x="${cx - sockGroupW / 2}" y="${sockY}" width="${sockGroupW}" height="40" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1" rx="4"/>`;

      // IEC 60617 socket symbols (small semicircles)
      const startSX = cx - (socketCount - 1) * 6;
      socketIds.forEach((_sid: string, j: number) => {
        const ssx = startSX + j * 12;
        const ssy = sockY + 14;
        const r = 5;
        // Miniature semicircle socket
        svg += `<path d="M${ssx - r},${ssy} A${r},${r} 0 0,1 ${ssx + r},${ssy}" fill="none" stroke="${COLORS.primary}" stroke-width="1"/>`;
        svg += `<line x1="${ssx - r}" y1="${ssy}" x2="${ssx + r}" y2="${ssy}" stroke="${COLORS.primary}" stroke-width="1"/>`;
        svg += `<line x1="${ssx}" y1="${ssy}" x2="${ssx}" y2="${ssy - r + 1}" stroke="${COLORS.primary}" stroke-width="0.8"/>`;
      });

      // Socket count + cable
      svg += `<text x="${cx}" y="${sockY + 32}" text-anchor="middle" font-size="6" font-weight="600" fill="${COLORS.primary}">${socketCount}× socket</text>`;
      svg += `<text x="${cx}" y="${sockY + 44}" text-anchor="middle" font-size="5.5" fill="${COLORS.muted}">${xmlEsc(circuit.cable || "3×2.5mm²")}</text>`;

      // Socket IDs
      svg += `<text x="${cx}" y="${sockY + 54}" text-anchor="middle" font-size="5" fill="${COLORS.faint}">${xmlEsc(socketIds.join(", "))}</text>`;
    });

    curX += gWidth + groupGap;
  });

  // IEC 61082 symbol legend
  const legendY = svgH - legendH - 14;
  svg += symbolLegend(svgW, legendY, [
    LEGEND_ITEMS.singleSocket,
    LEGEND_ITEMS.mcb,
    LEGEND_ITEMS.rcd,
  ]);

  // Standards footer
  svg += standardsFooter(svgW, svgH, 'Each RCD protects max 3–4 circuits · Selectivity: fault trips one RCD, rest stays live');

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

const CABLE_THICKNESS: Record<string, number> = {
  "1.5": 1, "2.5": 1.5, "4": 2, "6": 2.5,
};

function getCableSize(cableType: string): string {
  const m = cableType.match(/(\d+(?:\.\d+)?)\s*mm/);
  return m ? m[1] : "2.5";
}

// Generate wiring diagram with IEC 60617 symbols showing cables from switchboard to rooms
export function generateWiringDiagram(
  wiring: any[],
  rooms: any[],
  circuits: any[],
  switchboard?: any
): string {
  if (!wiring || wiring.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200" style="font-family:Inter,system-ui,sans-serif">
      <rect width="600" height="200" fill="${COLORS.bg}" rx="6"/>
      <text x="300" y="100" text-anchor="middle" font-size="13" fill="${COLORS.muted}">No wiring data available</text>
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
  const titleH = 48;
  const dbX = 60, dbY = titleH + 30;
  const dbW = 100, dbH = Math.max(120, wiring.length * 22 + 40);
  const roomStartX = 320;
  const roomSpacingY = Math.max(52, dbH / Math.max(roomCount, 1));
  const roomStartY = dbY + 10;
  const svgW = 700;
  const legendH = 46;
  const svgH = Math.max(dbY + dbH + 100, roomStartY + roomCount * roomSpacingY + 80) + legendH;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:Inter,system-ui,sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="${COLORS.bg}" rx="6"/>`;

  // IEC 61082 title block
  svg += titleBlock(svgW, {
    title: 'Wiring Plan — Switchboard to Rooms',
    subtitle: 'Cable routes from distribution board · IEC 60446 wire colors',
    date: new Date().toISOString().slice(0, 10),
    drawingNumber: 'E-03',
  });

  // IEC 60617 Distribution Board symbol
  const dbRoom = switchboard?.room_name || "Hallway";
  svg += distributionBoardBox(dbX, dbY, dbW, dbH, dbRoom);

  // Draw DIN rail slots (MCB breakers inside the DB box)
  const slotStartY = dbY + 32;
  wiring.forEach((w: any, i: number) => {
    const sy = slotStartY + i * 20;
    if (sy + 16 > dbY + dbH - 4) return;
    // MCB slot
    svg += `<rect x="${dbX + 6}" y="${sy}" width="30" height="14" fill="#eef2ff" stroke="#c7d2fe" stroke-width="0.8" rx="2"/>`;
    svg += `<text x="${dbX + 21}" y="${sy + 10}" text-anchor="middle" font-size="5.5" font-weight="600" fill="${COLORS.primary}">${xmlEsc(w.circuit_id || `C${i + 1}`)}</text>`;
    // Breaker rating
    const breaker = circuits.find((c: any) => c.id === w.circuit_id)?.breaker || "16A";
    svg += `<text x="${dbX + 42}" y="${sy + 10}" font-size="5" fill="${COLORS.muted}">${xmlEsc(breaker)}</text>`;
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
    svg += `<rect x="${rx}" y="${ry}" width="120" height="36" fill="${fill}" stroke="${COLORS.wall}" stroke-width="1.2" rx="4"/>`;
    svg += `<text x="${rx + 60}" y="${ry + 15}" text-anchor="middle" font-size="9" font-weight="600" fill="${COLORS.text}">${xmlEsc(room.name)}</text>`;

    // Show socket count from wiring entries for this room
    const roomWires = wiring.filter((w: any) => (w.to_room_id || w.to_room) === room.id || w.to_room === room.name);
    const socketCount = roomWires.reduce((sum: number, w: any) => {
      const circuit = circuits.find((c: any) => c.id === w.circuit_id);
      return sum + (circuit?.sockets?.length || 0);
    }, 0);
    if (socketCount > 0) {
      svg += `<text x="${rx + 60}" y="${ry + 28}" text-anchor="middle" font-size="7" fill="${COLORS.muted}">${socketCount} sockets</text>`;
    }
  });

  // Draw cable lines from DB to rooms with IEC 60446 wire colors
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
      const svgColor = WIRE_COLORS[color] || WIRE_COLORS[color.split(" ")[0]] || COLORS.supply;
      const fy = fromY + offset;
      const ty = toY + offset;
      svg += `<path d="M${fromX},${fy} C${midX},${fy} ${midX},${ty} ${toX},${ty}" fill="none" stroke="${svgColor}" stroke-width="${thickness * 0.6}" opacity="0.85"/>`;
    });

    // Cable label on the line
    const labelX = fromX + (toX - fromX) * 0.5;
    const labelY = (fromY + toY) / 2 - bundleSpread - 4;
    svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="6" fill="${COLORS.supply}" font-weight="500">${xmlEsc(w.cable_type || "")}</text>`;

    // Length label
    if (w.estimated_length_m) {
      svg += `<text x="${labelX}" y="${labelY + 8}" text-anchor="middle" font-size="5.5" fill="${COLORS.faint}">~${w.estimated_length_m}m</text>`;
    }
  });

  // Total cable length
  const totalCable = wiring.reduce((sum: number, w: any) => sum + (w.estimated_length_m || 0), 0);
  if (totalCable > 0) {
    svg += `<text x="${svgW / 2}" y="${svgH - legendH - 36}" text-anchor="middle" font-size="9" font-weight="600" fill="${COLORS.supply}">Total estimated cable: ~${totalCable}m</text>`;
  }

  // Wire color legend (IEC 60446)
  const legendY = svgH - legendH - 6;
  const legendItems = [
    { color: COLORS.line, label: "Brown (L)" },
    { color: COLORS.neutral, label: "Blue (N)" },
    { color: COLORS.earth, label: "GY (PE)" },
    { color: COLORS.line2, label: "Black (L2)" },
    { color: COLORS.line3, label: "Grey (L3)" },
  ];
  const legendStartX = svgW / 2 - (legendItems.length * 65) / 2;
  legendItems.forEach((item, i) => {
    const lx = legendStartX + i * 65;
    svg += `<line x1="${lx}" y1="${legendY}" x2="${lx + 16}" y2="${legendY}" stroke="${item.color}" stroke-width="2.5"/>`;
    svg += `<text x="${lx + 20}" y="${legendY + 3}" font-size="6.5" fill="${COLORS.muted}">${item.label}</text>`;
  });

  // Standards footer
  svg += standardsFooter(svgW, svgH, 'NYM-J cable · Verify lengths on-site');

  svg += `</svg>`;
  return svg;
}

// ── Annotated Floor Plan ──
// Renders user-confirmed sockets and distribution board as an SVG overlay
// on top of the original floor plan image. This is the key electrician output.

export function generateAnnotatedFloorPlan(
  imageDataUrl: string,
  imageWidth: number,
  imageHeight: number,
  placements: any[],
  rooms: any[],
  switchboardData?: { x_pct?: number; y_pct?: number; room_name?: string; wall?: string; height_mm?: number },
): string {
  const svgW = imageWidth;
  const svgH = imageHeight;
  const pct = (v: number, total: number) => (v / 100) * total;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:Inter,system-ui,sans-serif">`;

  // Floor plan as background
  svg += `<image href="${xmlEsc(imageDataUrl)}" x="0" y="0" width="${svgW}" height="${svgH}" />`;

  // Room name labels only (no colored rectangles)
  rooms.forEach((room: any) => {
    if (!room.position) return;
    const p = room.position;
    const x = pct(p.x_pct, svgW) + 4, y = pct(p.y_pct, svgH) + 12;
    svg += `<text x="${x}" y="${y}" font-size="9" font-weight="600" fill="#1e293b" opacity="0.7">${xmlEsc(room.name || room.type)}</text>`;
  });

  // Wiring lines from switchboard to sockets (subtle dashed)
  if (switchboardData?.x_pct !== undefined && switchboardData?.y_pct !== undefined) {
    const dbX = pct(switchboardData.x_pct, svgW);
    const dbY = pct(switchboardData.y_pct, svgH);

    placements.forEach((s: any) => {
      const sx = pct(s.x_pct, svgW), sy = pct(s.y_pct, svgH);
      svg += `<line x1="${dbX}" y1="${dbY}" x2="${sx}" y2="${sy}" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="4 3" opacity="0.4"/>`;
    });
  }

  // Socket symbols at their confirmed positions — use the rotation the user set in the editor
  placements.forEach((s: any) => {
    const sx = pct(s.x_pct, svgW);
    const sy = pct(s.y_pct, svgH);
    const gang = s.gang || 1;
    const rot = s.rotation ?? 0;
    const h = s.height_mm ? `${s.height_mm}mm` : '';
    const socketType = s.type || 'standard_16a';
    svg += socketOutlet(sx, sy, s.socket_id, socketType, h, gang, rot);
  });

  // Distribution board marker — reflects user's type/rating/IP settings
  if (switchboardData?.x_pct !== undefined && switchboardData?.y_pct !== undefined) {
    const dbX = pct(switchboardData.x_pct, svgW);
    const dbY = pct(switchboardData.y_pct, svgH);
    const dbType = (switchboardData as any).type || 'flush';
    const dbRating = (switchboardData as any).rating || '63A';
    const dbIp = (switchboardData as any).ip_rating || 'IP30';
    const dbRot = (switchboardData as any).rotation ?? 0;
    // Size based on rating
    const sizeMap: Record<string, { w: number; h: number }> = {
      '40A': { w: 24, h: 16 }, '63A': { w: 30, h: 20 }, '80A': { w: 36, h: 22 }, '100A': { w: 40, h: 24 },
    };
    const sz = sizeMap[dbRating] || sizeMap['63A'];
    const fillColor = dbType === 'surface' ? '#334155' : dbType === 'floor_standing' ? '#1e293b' : '#475569';
    const strokeColor = dbIp === 'IP65' ? '#10b981' : dbIp === 'IP44' ? '#f59e0b' : '#0f172a';
    const strokeW = dbType === 'surface' ? 2 : 1;

    svg += `<g transform="rotate(${dbRot},${dbX},${dbY})">`;
    if (dbIp === 'IP65') {
      svg += `<rect x="${dbX - sz.w / 2 - 2}" y="${dbY - sz.h / 2 - 2}" width="${sz.w + 4}" height="${sz.h + 4}" fill="none" stroke="#10b981" stroke-width="0.8" rx="4" stroke-dasharray="2 1"/>`;
    }
    svg += `<rect x="${dbX - sz.w / 2}" y="${dbY - sz.h / 2}" width="${sz.w}" height="${sz.h}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeW}" rx="3"/>`;
    if (dbType === 'surface') {
      svg += `<rect x="${dbX - sz.w / 2 + 1.5}" y="${dbY - sz.h / 2 + 1.5}" width="${sz.w - 3}" height="${sz.h - 3}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" rx="2"/>`;
    }
    if (dbType === 'floor_standing') {
      svg += `<line x1="${dbX - sz.w / 2 - 3}" y1="${dbY + sz.h / 2}" x2="${dbX + sz.w / 2 + 3}" y2="${dbY + sz.h / 2}" stroke="#0f172a" stroke-width="2"/>`;
    }
    svg += `</g>`;
    // Labels (always horizontal)
    svg += `<text x="${dbX}" y="${dbY - sz.h / 2 - 4}" text-anchor="middle" font-size="8" font-weight="700" fill="#1e293b">DB</text>`;
    svg += `<text x="${dbX}" y="${dbY + sz.h / 2 + 10}" text-anchor="middle" font-size="5.5" fill="${COLORS.muted}">${dbRating} · ${dbIp} · ${switchboardData.height_mm || 1600}mm</text>`;
  }

  // Title strip at bottom
  svg += `<rect x="0" y="${svgH - 22}" width="${svgW}" height="22" fill="rgba(30,41,59,0.85)"/>`;
  svg += `<text x="${svgW / 2}" y="${svgH - 7}" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">`;
  svg += `rosette — Socket Placement Plan · ${placements.length} sockets · IEC 60617</text>`;

  svg += `</svg>`;
  return svg;
}
