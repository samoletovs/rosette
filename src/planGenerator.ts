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
    <text x="${x}" y="${y - 13}" text-anchor="middle" font-size="8" font-weight="700" fill="${fill}">${id}</text>
    <text x="${x}" y="${y + 18}" text-anchor="middle" font-size="6.5" fill="#6b7280">${height}</text>
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
    svg += `<text x="${rx + roomW / 2}" y="${oy + 16}" text-anchor="middle" font-size="10" font-weight="700" fill="#111827">${room.name || room.type}</text>`;
    svg += `<text x="${rx + roomW / 2}" y="${oy + 26}" text-anchor="middle" font-size="7.5" fill="#6b7280">${room.area_m2 || "?"} m² · ${room.width_m || "?"}×${room.height_m || "?"}m</text>`;

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

// Generate single-line circuit diagram
export function generateCircuitDiagram(circuits: any[], totalSockets: number): string {
  const circuitCount = circuits.length || 1;
  const svgW = Math.max(600, circuitCount * 100 + 120);
  const svgH = 320;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:Inter,system-ui,sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="#fafbfc" rx="6"/>`;

  // Title
  svg += `<text x="${svgW / 2}" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">Single-Line Circuit Diagram</text>`;
  svg += `<text x="${svgW / 2}" y="36" text-anchor="middle" font-size="9" fill="#6b7280">Distribution Board → RCD → MCB → Sockets</text>`;

  // Supply line
  const topY = 55;
  const dbX = 40, dbW = 50, dbH = 30;
  svg += `<rect x="${dbX}" y="${topY}" width="${dbW}" height="${dbH}" fill="#4f46e5" rx="4"/>`;
  svg += `<text x="${dbX + dbW / 2}" y="${topY + 12}" text-anchor="middle" font-size="7" font-weight="700" fill="white">SUPPLY</text>`;
  svg += `<text x="${dbX + dbW / 2}" y="${topY + 22}" text-anchor="middle" font-size="6" fill="white">230V/400V</text>`;

  // Main bus line
  const busY = topY + dbH / 2;
  const busStartX = dbX + dbW;
  const busEndX = svgW - 30;
  svg += `<line x1="${busStartX}" y1="${busY}" x2="${busEndX}" y2="${busY}" stroke="#111827" stroke-width="2"/>`;

  // RCD
  const rcdX = busStartX + 30;
  svg += `<rect x="${rcdX}" y="${busY - 14}" width="36" height="28" fill="#fff" stroke="#10b981" stroke-width="1.5" rx="3"/>`;
  svg += `<text x="${rcdX + 18}" y="${busY - 2}" text-anchor="middle" font-size="7" font-weight="700" fill="#10b981">RCD</text>`;
  svg += `<text x="${rcdX + 18}" y="${busY + 9}" text-anchor="middle" font-size="6" fill="#6b7280">30mA</text>`;

  // After RCD, draw circuits
  const circuitStartX = rcdX + 56;
  const circuitSpacing = Math.min(90, (busEndX - circuitStartX) / circuitCount);

  circuits.forEach((circuit: any, i: number) => {
    const cx = circuitStartX + i * circuitSpacing;
    const socketIds: string[] = circuit.sockets || [];
    const socketCount = socketIds.length;

    // Vertical line from bus bar
    svg += `<line x1="${cx}" y1="${busY}" x2="${cx}" y2="${busY + 40}" stroke="#374151" stroke-width="1.5"/>`;

    // MCB symbol (box with X)
    const mcbY = busY + 40;
    svg += `<rect x="${cx - 14}" y="${mcbY}" width="28" height="22" fill="#fff" stroke="#4f46e5" stroke-width="1.5" rx="2"/>`;
    svg += `<text x="${cx}" y="${mcbY + 10}" text-anchor="middle" font-size="6.5" font-weight="700" fill="#4f46e5">${circuit.breaker || "16A"}</text>`;
    svg += `<text x="${cx}" y="${mcbY + 19}" text-anchor="middle" font-size="5.5" fill="#6b7280">MCB</text>`;

    // Circuit ID
    svg += `<text x="${cx}" y="${mcbY - 4}" text-anchor="middle" font-size="7" font-weight="600" fill="#374151">${circuit.id || `C${i + 1}`}</text>`;

    // Vertical line to sockets
    svg += `<line x1="${cx}" y1="${mcbY + 22}" x2="${cx}" y2="${mcbY + 50}" stroke="#374151" stroke-width="1"/>`;

    // Socket group
    const sockY = mcbY + 55;
    const sockGroupW = Math.max(30, socketCount * 16);
    svg += `<rect x="${cx - sockGroupW / 2}" y="${sockY}" width="${sockGroupW}" height="40" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1" rx="4"/>`;

    // Socket symbols in group
    const startX = cx - (socketCount - 1) * 7;
    socketIds.forEach((sid: string, j: number) => {
      const ssx = startX + j * 14;
      const ssy = sockY + 14;
      svg += `<circle cx="${ssx}" cy="${ssy}" r="5" fill="none" stroke="#4f46e5" stroke-width="1"/>`;
      svg += `<line x1="${ssx - 2}" y1="${ssy}" x2="${ssx + 2}" y2="${ssy}" stroke="#4f46e5" stroke-width="1"/>`;
    });

    // Socket count + cable
    svg += `<text x="${cx}" y="${sockY + 35}" text-anchor="middle" font-size="6.5" font-weight="600" fill="#4f46e5">${socketCount}× socket</text>`;
    svg += `<text x="${cx}" y="${sockY + 52}" text-anchor="middle" font-size="6" fill="#6b7280">${circuit.cable || "3×2.5mm²"}</text>`;

    // Room label
    const roomName = typeof circuit.sockets === "object" ? "" : "";
    const label = circuit.id || `Circuit ${i + 1}`;
    svg += `<text x="${cx}" y="${sockY + 62}" text-anchor="middle" font-size="6" fill="#9ca3af">${socketIds.join(", ")}</text>`;
  });

  // Legend
  svg += `<text x="20" y="${svgH - 12}" font-size="7" fill="#9ca3af">Standard: IEC 60364 | All circuits RCD protected (30mA Type A)</text>`;

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
