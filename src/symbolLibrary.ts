/**
 * IEC 60617 compliant graphical symbols for electrical installation diagrams.
 *
 * All symbols follow IEC 60617 (EN 60617) — the international standard for
 * graphical symbols used in electrotechnical diagrams. This is the mandatory
 * standard across all EU/Baltic countries (Latvia, Lithuania, Estonia) for
 * professional electrical documentation.
 *
 * Reference: IEC 60617 "Graphical symbols for diagrams"
 *            IEC 61082 "Preparation of documents used in electrotechnology"
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function xmlEsc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Color palette (consistent across all diagrams)
// ---------------------------------------------------------------------------

export const COLORS = {
  primary: '#4f46e5',       // Indigo — sockets, MCBs
  special: '#f59e0b',       // Amber — dedicated/special sockets
  rcd: '#10b981',           // Emerald — RCD devices
  supply: '#1e293b',        // Slate-900 — supply/bus
  text: '#111827',          // Gray-900
  muted: '#6b7280',         // Gray-500
  faint: '#9ca3af',         // Gray-400
  bg: '#fafbfc',            // Off-white
  wall: '#94a3b8',          // Slate-400
  earth: '#228B22',         // Green — PE
  line: '#8B4513',          // Brown — L
  neutral: '#1E90FF',       // Blue — N
  line2: '#1a1a1a',         // Black — L2
  line3: '#808080',         // Grey — L3
} as const;

// IEC 60446 wire colors
export const WIRE_COLORS: Record<string, string> = {
  'Brown (L)': COLORS.line,
  'Blue (N)': COLORS.neutral,
  'Green-Yellow (PE)': COLORS.earth,
  'Black (L2)': COLORS.line2,
  'Grey (L3)': COLORS.line3,
  Brown: COLORS.line,
  Blue: COLORS.neutral,
  'Green-Yellow': COLORS.earth,
  Black: COLORS.line2,
  Grey: COLORS.line3,
};

// Room colors for diagram backgrounds
export const ROOM_COLORS: Record<string, string> = {
  kitchen: '#fef3c7',
  living_room: '#dbeafe',
  bedroom: '#ede9fe',
  bathroom: '#d1fae5',
  hallway: '#f1f5f9',
  wc: '#d1fae5',
  home_office: '#fce7f3',
  utility_room: '#e0e7ff',
  garage: '#f5f5f4',
  balcony: '#ecfdf5',
  dining_room: '#fff7ed',
};

// ---------------------------------------------------------------------------
// IEC 60617 Socket Outlet Symbols
// ---------------------------------------------------------------------------

/**
 * IEC 60617 socket outlet — semicircle with line(s).
 *
 * Standard single socket:  semicircle opening upward + single vertical line
 * Multi-gang:              semicircle + N vertical lines (1-5)
 * Special/dedicated:       semicircle + filled indicator
 * IP44 (waterproof):       symbol inside a circle
 *
 * @param x - center X
 * @param y - center Y
 * @param id - socket identifier (e.g. "S1")
 * @param type - "standard_16a" | "dedicated" | "ip44" | other
 * @param height - mounting height label (e.g. "300mm")
 * @param gang - number of connections (1-5, default 1)
 * @param rotation - degrees: 0=N (up), 90=E (right), 180=S (down), 270=W (left)
 */
export function socketOutlet(
  x: number,
  y: number,
  id: string,
  type: string,
  height: string,
  gang = 1,
  rotation = 0,
): string {
  const isIP44 = type === 'ip44' || type === 'waterproof';
  // Color per socket type
  const typeColors: Record<string, string> = {
    standard_16a: COLORS.primary, dedicated: COLORS.special, oven: '#ef4444',
    ip44: '#10b981', usb: '#8b5cf6', tv_data: '#6366f1', ev_charger: '#dc2626',
  };
  const color = typeColors[type] || COLORS.primary;
  const r = 9;
  const gangCount = Math.max(1, Math.min(5, gang));

  // Rotation in degrees: 0=N (up), 90=E (right), 180=S (down), 270=W (left)
  const rot = rotation;

  let symbol = `<g class="iec-socket" transform="rotate(${rot},${x},${y})">`;

  // IP44 outer circle (weather-protected)
  if (isIP44) {
    symbol += `<circle cx="${x}" cy="${y}" r="${r + 5}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="2 1"/>`;
  }

  // Semicircle (opening upward) — core IEC 60617 socket symbol
  symbol += `<path d="M${x - r},${y} A${r},${r} 0 0,1 ${x + r},${y}" fill="none" stroke="${color}" stroke-width="1.8"/>`;
  // Flat base line
  symbol += `<line x1="${x - r}" y1="${y}" x2="${x + r}" y2="${y}" stroke="${color}" stroke-width="1.8"/>`;

  // Gang lines — vertical lines from base up into semicircle
  if (gangCount === 1) {
    symbol += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - r + 1}" stroke="${color}" stroke-width="1.5"/>`;
  } else {
    const spread = Math.min(r - 2, gangCount * 2.5);
    for (let i = 0; i < gangCount; i++) {
      const lx = x - spread / 2 + (spread / (gangCount - 1)) * i;
      symbol += `<line x1="${lx}" y1="${y}" x2="${lx}" y2="${y - r + 1}" stroke="${color}" stroke-width="1.5"/>`;
    }
  }

  // Earth contact bar (horizontal bar below the base)
  symbol += `<line x1="${x - r + 2}" y1="${y + 3}" x2="${x + r - 2}" y2="${y + 3}" stroke="${color}" stroke-width="1.2"/>`;

  // Gang count badge (if > 1)
  if (gangCount > 1) {
    symbol += `<circle cx="${x + r + 4}" cy="${y - r + 2}" r="5" fill="${color}"/>`;
    symbol += `<text x="${x + r + 4}" y="${y - r + 5}" text-anchor="middle" font-size="6" font-weight="700" fill="#fff">${gangCount}</text>`;
  }

  symbol += `</g>`;

  // Labels outside the rotation group so they stay horizontal
  // ID label above
  symbol += `<text x="${x}" y="${y - r - 5}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${color}">${xmlEsc(id)}</text>`;
  // Height label below
  if (height) {
    symbol += `<text x="${x}" y="${y + 14}" text-anchor="middle" font-size="6" fill="${COLORS.muted}">${xmlEsc(height)}</text>`;
  }
  return symbol;
}

// ---------------------------------------------------------------------------
// IEC 60617 Protection Device Symbols
// ---------------------------------------------------------------------------

/**
 * IEC 60617 MCB (Miniature Circuit Breaker).
 *
 * Rectangle with internal switch symbol and rating label.
 * Overload trip indicator: small arc or "x" inside the box.
 */
export function mcbSymbol(
  x: number,
  y: number,
  rating: string,
  circuitId: string,
): string {
  const w = 30;
  const h = 26;
  const lx = x - w / 2;
  const ly = y;

  let s = `<g class="iec-mcb">`;
  s += `<rect x="${lx}" y="${ly}" width="${w}" height="${h}" fill="#fff" stroke="${COLORS.primary}" stroke-width="1.5" rx="2"/>`;

  // Internal switch symbol — angled line (IEC style breaker contact)
  s += `<line x1="${x - 4}" y1="${ly + 6}" x2="${x + 4}" y2="${ly + 14}" stroke="${COLORS.primary}" stroke-width="1.5" stroke-linecap="round"/>`;
  // Overload trip — small "x" symbol
  s += `<line x1="${x - 2}" y1="${ly + 16}" x2="${x + 2}" y2="${ly + 20}" stroke="${COLORS.primary}" stroke-width="0.8"/>`;
  s += `<line x1="${x + 2}" y1="${ly + 16}" x2="${x - 2}" y2="${ly + 20}" stroke="${COLORS.primary}" stroke-width="0.8"/>`;

  // Rating label to the right
  s += `<text x="${x + w / 2 + 3}" y="${ly + h / 2 + 3}" font-size="7" font-weight="700" fill="${COLORS.primary}">${xmlEsc(rating)}</text>`;
  // Circuit ID above
  s += `<text x="${x}" y="${ly - 3}" text-anchor="middle" font-size="6.5" font-weight="600" fill="${COLORS.text}">${xmlEsc(circuitId)}</text>`;

  s += `</g>`;
  return s;
}

/**
 * IEC 60617 RCD/RCCB (Residual Current Device).
 *
 * Rectangle with delta (Δ) symbol inside — the defining IEC marker for RCDs.
 */
export function rcdSymbol(
  x: number,
  y: number,
  label: string,
  rating: string,
  color: string,
): string {
  const w = 44;
  const h = 34;
  const lx = x - w / 2;
  const ly = y;

  let s = `<g class="iec-rcd">`;
  s += `<rect x="${lx}" y="${ly}" width="${w}" height="${h}" fill="#fff" stroke="${color}" stroke-width="1.8" rx="3"/>`;

  // IEC 60617 delta (Δ) — the key RCD identifier
  const triSize = 7;
  s += `<polygon points="${x},${ly + 6} ${x - triSize},${ly + 6 + triSize * 1.5} ${x + triSize},${ly + 6 + triSize * 1.5}" fill="none" stroke="${color}" stroke-width="1.5"/>`;

  // Rating below delta
  s += `<text x="${x}" y="${ly + h - 4}" text-anchor="middle" font-size="6" fill="${COLORS.muted}">${xmlEsc(rating)}</text>`;

  // Label below box
  s += `<text x="${x}" y="${ly + h + 12}" text-anchor="middle" font-size="7" font-weight="600" fill="${color}">${xmlEsc(label)}</text>`;

  s += `</g>`;
  return s;
}

/**
 * IEC 60617 Main Switch / Isolator.
 *
 * Knife-switch symbol: line with contact gap.
 */
export function mainSwitchSymbol(
  x: number,
  y: number,
  label: string,
): string {
  const w = 50;
  const h = 30;
  const lx = x - w / 2;
  const ly = y;

  let s = `<g class="iec-main-switch">`;
  s += `<rect x="${lx}" y="${ly}" width="${w}" height="${h}" fill="${COLORS.supply}" rx="4"/>`;
  s += `<text x="${x}" y="${ly + 12}" text-anchor="middle" font-size="7.5" font-weight="700" fill="white">${xmlEsc(label)}</text>`;
  s += `<text x="${x}" y="${ly + 22}" text-anchor="middle" font-size="6" fill="white">230V / 400V</text>`;
  s += `</g>`;
  return s;
}

// ---------------------------------------------------------------------------
// IEC 60617 Distribution Board Symbol
// ---------------------------------------------------------------------------

/**
 * Distribution board box with slot indicators.
 */
export function distributionBoardBox(
  x: number,
  y: number,
  w: number,
  h: number,
  location: string,
): string {
  let s = `<g class="iec-db">`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${COLORS.primary}" stroke-width="2" rx="4"/>`;
  // Header bar
  s += `<rect x="${x}" y="${y}" width="${w}" height="24" fill="${COLORS.primary}" rx="4"/>`;
  s += `<rect x="${x}" y="${y + 12}" width="${w}" height="12" fill="${COLORS.primary}"/>`;
  s += `<text x="${x + w / 2}" y="${y + 15}" text-anchor="middle" font-size="8" font-weight="700" fill="white">DISTRIBUTION</text>`;
  s += `<text x="${x + w / 2}" y="${y + 23}" text-anchor="middle" font-size="7" fill="white">BOARD</text>`;
  // Location label
  if (location) {
    s += `<text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" font-size="7.5" fill="${COLORS.muted}">📍 ${xmlEsc(location)}</text>`;
  }
  s += `</g>`;
  return s;
}

// ---------------------------------------------------------------------------
// IEC 60617 Light Switch Symbol (for future use)
// ---------------------------------------------------------------------------

/**
 * IEC 60617 single-pole switch — circle with angled line.
 */
export function lightSwitchSymbol(
  x: number,
  y: number,
  label: string,
): string {
  const r = 5;
  let s = `<g class="iec-switch">`;
  s += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${COLORS.text}" stroke-width="1.2"/>`;
  // Angled line from circle (switch arm)
  s += `<line x1="${x + r * 0.7}" y1="${y - r * 0.7}" x2="${x + r * 2}" y2="${y - r * 2}" stroke="${COLORS.text}" stroke-width="1.2"/>`;
  // Label
  if (label) {
    s += `<text x="${x}" y="${y + r + 10}" text-anchor="middle" font-size="6" fill="${COLORS.muted}">${xmlEsc(label)}</text>`;
  }
  s += `</g>`;
  return s;
}

// ---------------------------------------------------------------------------
// IEC 60617 Ceiling Light Symbol (for future use)
// ---------------------------------------------------------------------------

/**
 * IEC 60617 ceiling light point — circle with cross.
 */
export function ceilingLightSymbol(
  x: number,
  y: number,
  label: string,
): string {
  const r = 7;
  let s = `<g class="iec-ceiling-light">`;
  s += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${COLORS.text}" stroke-width="1.2"/>`;
  s += `<line x1="${x - r * 0.6}" y1="${y - r * 0.6}" x2="${x + r * 0.6}" y2="${y + r * 0.6}" stroke="${COLORS.text}" stroke-width="1"/>`;
  s += `<line x1="${x + r * 0.6}" y1="${y - r * 0.6}" x2="${x - r * 0.6}" y2="${y + r * 0.6}" stroke="${COLORS.text}" stroke-width="1"/>`;
  if (label) {
    s += `<text x="${x}" y="${y + r + 10}" text-anchor="middle" font-size="6" fill="${COLORS.muted}">${xmlEsc(label)}</text>`;
  }
  s += `</g>`;
  return s;
}

// ---------------------------------------------------------------------------
// Cable run with conductor count marks (IEC style)
// ---------------------------------------------------------------------------

/**
 * Draw a cable run with IEC-style hash marks showing conductor count.
 *
 * @param x1,y1 - start point
 * @param x2,y2 - end point
 * @param conductors - number of conductors (2, 3, 5)
 * @param cableLabel - e.g. "NYM-J 3×2.5mm²"
 */
export function cableRun(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  conductors: number,
  cableLabel: string,
): string {
  let s = `<g class="iec-cable">`;
  // Main cable line
  s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLORS.text}" stroke-width="1.2"/>`;

  // Hash marks at midpoint — short diagonal lines crossing the cable
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpAngle = angle + Math.PI / 2;
  const markLen = 4;
  const markSpacing = 3;

  for (let i = 0; i < conductors; i++) {
    const offset = (i - (conductors - 1) / 2) * markSpacing;
    const cx = mx + Math.cos(angle) * offset;
    const cy = my + Math.sin(angle) * offset;
    const dx = Math.cos(perpAngle) * markLen;
    const dy = Math.sin(perpAngle) * markLen;
    s += `<line x1="${cx - dx}" y1="${cy - dy}" x2="${cx + dx}" y2="${cy + dy}" stroke="${COLORS.text}" stroke-width="0.8"/>`;
  }

  // Cable label near midpoint
  if (cableLabel) {
    s += `<text x="${mx}" y="${my - 8}" text-anchor="middle" font-size="5.5" fill="${COLORS.muted}">${xmlEsc(cableLabel)}</text>`;
  }

  s += `</g>`;
  return s;
}

// ---------------------------------------------------------------------------
// Title Block (IEC 61082 / EN ISO 7519)
// ---------------------------------------------------------------------------

export interface TitleBlockData {
  title: string;
  subtitle?: string;
  projectName?: string;
  country?: string;
  standard?: string;
  date?: string;
  drawingNumber?: string;
  scale?: string;
}

/**
 * Render a professional title block per IEC 61082 at the top of a diagram.
 */
export function titleBlock(
  svgW: number,
  data: TitleBlockData,
): string {
  const h = 48;
  let s = `<g class="iec-title-block">`;
  s += `<rect x="0" y="0" width="${svgW}" height="${h}" fill="${COLORS.bg}"/>`;
  s += `<line x1="0" y1="${h}" x2="${svgW}" y2="${h}" stroke="#e5e7eb" stroke-width="0.5"/>`;

  // Main title
  s += `<text x="${svgW / 2}" y="20" text-anchor="middle" font-size="13" font-weight="700" fill="${COLORS.text}">${xmlEsc(data.title)}</text>`;

  // Subtitle / standard reference
  const sub = data.subtitle || `IEC 60617 symbols · ${data.standard || 'IEC 60364'} · ${data.country || 'Baltic'}`;
  s += `<text x="${svgW / 2}" y="34" text-anchor="middle" font-size="8.5" fill="${COLORS.muted}">${xmlEsc(sub)}</text>`;

  // Date on the right
  if (data.date) {
    s += `<text x="${svgW - 10}" y="16" text-anchor="end" font-size="6.5" fill="${COLORS.faint}">${xmlEsc(data.date)}</text>`;
  }

  // Drawing number on the left
  if (data.drawingNumber) {
    s += `<text x="10" y="16" font-size="6.5" fill="${COLORS.faint}">${xmlEsc(data.drawingNumber)}</text>`;
  }

  // Scale indicator
  if (data.scale) {
    s += `<text x="${svgW - 10}" y="44" text-anchor="end" font-size="6" fill="${COLORS.faint}">Scale ${xmlEsc(data.scale)}</text>`;
  }

  s += `</g>`;
  return s;
}

// ---------------------------------------------------------------------------
// Symbol Legend (IEC 61082 requirement — every diagram needs a key)
// ---------------------------------------------------------------------------

export interface LegendItem {
  symbolFn: (x: number, y: number) => string;
  label: string;
}

/**
 * Pre-built legend items for common electrical installation symbols.
 * Legend variants use compact, consistently-sized symbols (24×16 bounding box).
 */
export const LEGEND_ITEMS = {
  singleSocket: {
    label: 'Single socket outlet 16A',
    symbolFn: (x: number, y: number) => legendSocket(x, y, COLORS.primary, 1),
  },
  doubleSocket: {
    label: 'Double socket outlet 16A',
    symbolFn: (x: number, y: number) => legendSocket(x, y, COLORS.primary, 2),
  },
  tripleSocket: {
    label: 'Triple socket outlet 16A',
    symbolFn: (x: number, y: number) => legendSocket(x, y, COLORS.primary, 3),
  },
  specialSocket: {
    label: 'Dedicated / special socket',
    symbolFn: (x: number, y: number) => legendSocket(x, y, COLORS.special, 1),
  },
  ip44Socket: {
    label: 'Waterproof socket (IP44)',
    symbolFn: (x: number, y: number) => legendSocketIP44(x, y),
  },
  mcb: {
    label: 'MCB (Circuit breaker)',
    symbolFn: (x: number, y: number) => legendMCB(x, y),
  },
  rcd: {
    label: 'RCD / RCCB (30mA)',
    symbolFn: (x: number, y: number) => legendRCD(x, y),
  },
} as const;

/* ── Compact legend-only symbols (all fit a 24×16 box centered at x,y) ── */

function legendSocket(x: number, y: number, color: string, gang: number): string {
  const r = 7;
  let s = '';
  // Semicircle opening up
  s += `<path d="M${x - r},${y + 2} A${r},${r} 0 0,1 ${x + r},${y + 2}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
  s += `<line x1="${x - r}" y1="${y + 2}" x2="${x + r}" y2="${y + 2}" stroke="${color}" stroke-width="1.5"/>`;
  // Gang lines
  if (gang === 1) {
    s += `<line x1="${x}" y1="${y + 2}" x2="${x}" y2="${y - r + 3}" stroke="${color}" stroke-width="1.2"/>`;
  } else {
    const spread = Math.min(r - 2, gang * 2.4);
    for (let i = 0; i < gang; i++) {
      const lx = x - spread / 2 + (spread / Math.max(gang - 1, 1)) * i;
      s += `<line x1="${lx}" y1="${y + 2}" x2="${lx}" y2="${y - r + 3}" stroke="${color}" stroke-width="1.2"/>`;
    }
  }
  // Earth bar
  s += `<line x1="${x - r + 2}" y1="${y + 5}" x2="${x + r - 2}" y2="${y + 5}" stroke="${color}" stroke-width="1"/>`;
  return s;
}

function legendSocketIP44(x: number, y: number): string {
  const color = '#10b981';
  let s = legendSocket(x, y, color, 1);
  s += `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${color}" stroke-width="0.8" stroke-dasharray="2 1"/>`;
  return s;
}

function legendMCB(x: number, y: number): string {
  const w = 20, h = 18;
  let s = '';
  s += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#fff" stroke="${COLORS.primary}" stroke-width="1.2" rx="2"/>`;
  s += `<line x1="${x - 3}" y1="${y - 4}" x2="${x + 3}" y2="${y + 2}" stroke="${COLORS.primary}" stroke-width="1.2" stroke-linecap="round"/>`;
  s += `<line x1="${x - 2}" y1="${y + 3}" x2="${x + 2}" y2="${y + 6}" stroke="${COLORS.primary}" stroke-width="0.7"/>`;
  s += `<line x1="${x + 2}" y1="${y + 3}" x2="${x - 2}" y2="${y + 6}" stroke="${COLORS.primary}" stroke-width="0.7"/>`;
  return s;
}

function legendRCD(x: number, y: number): string {
  const w = 24, h = 20;
  const color = '#10b981';
  let s = '';
  s += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#fff" stroke="${color}" stroke-width="1.4" rx="2"/>`;
  // Delta triangle
  const ts = 5;
  s += `<polygon points="${x},${y - ts} ${x - ts},${y + ts * 0.6} ${x + ts},${y + ts * 0.6}" fill="none" stroke="${color}" stroke-width="1.2"/>`;
  return s;
}

/**
 * Render a symbol legend box at the bottom of a diagram.
 *
 * @param svgW - total SVG width
 * @param y - top Y position for the legend
 * @param items - array of legend items to show
 */
export function symbolLegend(
  svgW: number,
  y: number,
  items: LegendItem[],
): string {
  // Simple horizontal legend: symbol · label pairs in a row
  const itemW = Math.max(140, svgW / items.length);
  const legendW = items.length * itemW;
  const ox = Math.max(4, (svgW - legendW) / 2);
  const legendH = 40;

  let s = `<g class="iec-legend">`;
  s += `<rect x="${ox - 6}" y="${y}" width="${Math.min(legendW + 12, svgW - 8)}" height="${legendH}" fill="#fff" stroke="#e5e7eb" stroke-width="0.8" rx="4"/>`;
  s += `<text x="${svgW / 2}" y="${y + 12}" text-anchor="middle" font-size="7" font-weight="600" fill="${COLORS.text}">Symbol Legend (IEC 60617)</text>`;

  items.forEach((item, i) => {
    const cx = ox + i * itemW + 20;
    const cy = y + 28;

    // Symbol
    s += item.symbolFn(cx, cy);
    // Label to the right of symbol
    s += `<text x="${cx + 16}" y="${cy + 3}" font-size="6" fill="${COLORS.text}">${xmlEsc(item.label)}</text>`;
  });

  s += `</g>`;
  return s;
}

// ---------------------------------------------------------------------------
// Footer with standard references
// ---------------------------------------------------------------------------

export function standardsFooter(svgW: number, svgH: number, extra?: string): string {
  let s = `<text x="${svgW / 2}" y="${svgH - 6}" text-anchor="middle" font-size="6" fill="${COLORS.faint}">`;
  s += 'IEC 60617 graphical symbols · IEC 60364 installation standard · IEC 60446 wire colours';
  if (extra) s += ` · ${xmlEsc(extra)}`;
  s += `</text>`;
  return s;
}
