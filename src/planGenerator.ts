export function generateSocketSVG(
  rooms: any[],
  placements: any[],
  width: number = 800,
  height: number = 600
): string {
  const roomColors: Record<string, string> = {
    kitchen: "#fef3c7",
    living_room: "#dbeafe",
    bedroom: "#ede9fe",
    bathroom: "#d1fae5",
    hallway: "#f1f5f9",
    wc: "#d1fae5",
    home_office: "#fce7f3",
    utility_room: "#e0e7ff",
    garage: "#f5f5f4",
    balcony: "#ecfdf5",
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#f8fafc" rx="4"/>`;
  svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">Socket Placement Plan</text>`;

  // Draw rooms
  for (const room of rooms) {
    const pos = room.position || { x_pct: 10, y_pct: 10, w_pct: 30, h_pct: 30 };
    const x = (pos.x_pct / 100) * width;
    const y = 40 + (pos.y_pct / 100) * (height - 60);
    const w = (pos.w_pct / 100) * width;
    const h = (pos.h_pct / 100) * (height - 60);
    const fill = roomColors[room.type] || "#f1f5f9";

    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#94a3b8" stroke-width="1.5" rx="2"/>`;
    svg += `<text x="${x + w / 2}" y="${y + 18}" text-anchor="middle" font-size="11" font-weight="600" fill="#334155">${room.name || room.type}</text>`;
    svg += `<text x="${x + w / 2}" y="${y + 32}" text-anchor="middle" font-size="9" fill="#64748b">${room.area_m2 || "?"} m²</text>`;
  }

  // Draw sockets
  for (const s of placements) {
    const sx = (s.x_pct / 100) * width;
    const sy = 40 + (s.y_pct / 100) * (height - 60);
    const isSpecial = s.type !== "standard_16a";

    svg += `<circle cx="${sx}" cy="${sy}" r="5" fill="${isSpecial ? "#f59e0b" : "#2563eb"}" stroke="white" stroke-width="1.5"/>`;
    svg += `<text x="${sx}" y="${sy - 8}" text-anchor="middle" font-size="7" fill="#475569">${s.socket_id}</text>`;
  }

  // Legend
  const legendY = height - 30;
  svg += `<circle cx="20" cy="${legendY}" r="5" fill="#2563eb"/>`;
  svg += `<text x="30" y="${legendY + 4}" font-size="10" fill="#475569">Standard 16A socket</text>`;
  svg += `<circle cx="180" cy="${legendY}" r="5" fill="#f59e0b"/>`;
  svg += `<text x="190" y="${legendY + 4}" font-size="10" fill="#475569">Special / dedicated socket</text>`;

  svg += `</svg>`;
  return svg;
}

export function drawAnnotatedPlan(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  placements: any[]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  ctx.drawImage(image, 0, 0);

  for (const s of placements) {
    const x = (s.x_pct / 100) * canvas.width;
    const y = (s.y_pct / 100) * canvas.height;
    const isSpecial = s.type !== "standard_16a";

    // Socket marker
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = isSpecial ? "#f59e0b" : "#2563eb";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.socket_id, x, y);
  }
}
