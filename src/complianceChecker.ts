// ── Interactive compliance checker ──
// Pure rule engine evaluating planned socket placements against country standards.

import type { Room, SocketPlacement, StandardsData, Switchboard } from './types';

export const ROOM_TYPE_MAP: Record<string, string> = {
  kitchen: 'kitchen',
  living_room: 'living_room',
  living_area: 'living_room',
  lounge: 'living_room',
  sitting_room: 'living_room',
  dining_room: 'dining_room',
  dining_area: 'dining_room',
  dining: 'dining_room',
  bedroom: 'bedroom',
  bedroom_1: 'bedroom',
  bedroom_2: 'bedroom',
  bedroom_3: 'bedroom',
  master_bedroom: 'bedroom',
  bathroom: 'bathroom',
  bath: 'bathroom',
  shower_room: 'bathroom',
  hallway: 'hallway',
  corridor: 'hallway',
  entrance: 'hallway',
  foyer: 'hallway',
  hall: 'hallway',
  home_office: 'home_office',
  study: 'home_office',
  office: 'home_office',
  wc: 'wc',
  toilet: 'wc',
  'c.r.': 'wc',
  cr: 'wc',
  comfort_room: 'wc',
  restroom: 'wc',
  utility_room: 'utility_room',
  laundry: 'utility_room',
  storage: 'utility_room',
  pantry: 'utility_room',
  garage: 'garage',
  carport: 'garage',
  balcony: 'balcony',
  terrace: 'balcony',
  patio: 'balcony',
  porch: 'balcony',
  veranda: 'balcony',
  loggia: 'balcony',
};

export function mapRoomType(type: string): string {
  const n = (type || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  return ROOM_TYPE_MAP[n] || ROOM_TYPE_MAP[(type || '').toLowerCase()] || n;
}

export type ComplianceSeverity = 'error' | 'warning' | 'info';

export interface ComplianceIssue {
  id: string;
  severity: ComplianceSeverity;
  rule: string;
  message: string;
  roomId?: string;
  socketIds?: string[];
}

export interface ComplianceReport {
  issues: ComplianceIssue[];
  errors: number;
  warnings: number;
  infos: number;
  checks: number;
  passed: number;
  score: number;
  compliant: boolean;
}

export interface ComplianceInput {
  rooms: Room[];
  placements: SocketPlacement[];
  switchboard?: Switchboard | null;
  standards?: StandardsData | null;
}

/** Rooms where splash protection (IP44) is mandatory. */
const WET_ROOMS = new Set(['bathroom', 'wc', 'balcony', 'garage']);
/** Socket types accepted in wet rooms. */
const WET_SOCKET_TYPES = new Set(['ip44', 'ev_charger']);
/** Generally accepted mounting height window for wall sockets. */
const MIN_HEIGHT_MM = 200;
const MAX_HEIGHT_MM = 1500;
/** Worktop socket band per Baltic standards. */
const WORKTOP_MIN_MM = 1000;
const WORKTOP_MAX_MM = 1200;

function roomLabel(room: Room): string {
  return room.name || room.type || room.id;
}

function minimumSockets(
  standards: StandardsData | null | undefined,
  roomKey: string,
): number | null {
  const rule = standards?.room_rules?.[roomKey];
  const min = rule?.minimum_sockets;
  return typeof min === 'number' ? min : null;
}

function parseRange(value: unknown): { min: number; max: number } | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return null;
  return { min: Number(m[1]), max: Number(m[2]) };
}

function isInsideRoom(socket: SocketPlacement, room: Room): boolean {
  const p = room.position;
  if (!p) return false;
  return (
    socket.x_pct >= p.x_pct &&
    socket.x_pct <= p.x_pct + p.w_pct &&
    socket.y_pct >= p.y_pct &&
    socket.y_pct <= p.y_pct + p.h_pct
  );
}

/**
 * Evaluate the planned placements against the selected country standards.
 * Pure and synchronous — safe to call on every editor interaction.
 */
export function checkCompliance({
  rooms,
  placements,
  switchboard,
  standards,
}: ComplianceInput): ComplianceReport {
  const issues: ComplianceIssue[] = [];
  let checks = 0;

  const add = (issue: ComplianceIssue) => issues.push(issue);

  const byRoom = new Map<string, SocketPlacement[]>();
  for (const s of placements) {
    const list = byRoom.get(s.room_id);
    if (list) list.push(s);
    else byRoom.set(s.room_id, [s]);
  }

  for (const room of rooms) {
    const roomKey = mapRoomType(room.type);
    const roomSockets = byRoom.get(room.id) || [];
    const label = roomLabel(room);

    // Rule: minimum socket count per room type.
    const min = minimumSockets(standards, roomKey);
    if (min !== null) {
      checks++;
      if (roomSockets.length === 0) {
        add({
          id: `min-sockets:${room.id}`,
          severity: 'warning',
          rule: 'Minimum sockets',
          roomId: room.id,
          message: `${label}: no sockets placed yet — ${min} required.`,
        });
      } else if (roomSockets.length < min) {
        add({
          id: `min-sockets:${room.id}`,
          severity: 'error',
          rule: 'Minimum sockets',
          roomId: room.id,
          message: `${label}: ${roomSockets.length} of ${min} required sockets placed.`,
        });
      }
    }

    if (roomSockets.length === 0) continue;

    // Rule: wet rooms need splash-proof sockets.
    if (WET_ROOMS.has(roomKey)) {
      checks++;
      const bad = roomSockets.filter((s) => !WET_SOCKET_TYPES.has(s.type));
      if (bad.length > 0) {
        add({
          id: `wet-ip44:${room.id}`,
          severity: 'error',
          rule: 'IP44 / RCD protection',
          roomId: room.id,
          socketIds: bad.map((s) => s.socket_id),
          message: `${label}: ${bad.length} socket(s) must be IP44 rated and RCD protected (30 mA).`,
        });
      }
    }

    // Rule: no sockets inside bathroom/WC wet zones 0–1 (kept above 1000 mm).
    if (roomKey === 'bathroom' || roomKey === 'wc') {
      checks++;
      const low = roomSockets.filter((s) => s.height_mm < WORKTOP_MIN_MM);
      if (low.length > 0) {
        add({
          id: `wet-height:${room.id}`,
          severity: 'warning',
          rule: 'Wet zone height',
          roomId: room.id,
          socketIds: low.map((s) => s.socket_id),
          message: `${label}: ${low.length} socket(s) below ${WORKTOP_MIN_MM} mm — keep outside zones 0/1.`,
        });
      }
    }

    // Rule: kitchens need worktop sockets at 1000–1200 mm.
    if (roomKey === 'kitchen') {
      checks++;
      const worktop = roomSockets.filter(
        (s) => s.height_mm >= WORKTOP_MIN_MM && s.height_mm <= WORKTOP_MAX_MM,
      );
      if (worktop.length === 0) {
        add({
          id: `worktop:${room.id}`,
          severity: 'warning',
          rule: 'Worktop sockets',
          roomId: room.id,
          message: `${label}: no socket at worktop height (${WORKTOP_MIN_MM}–${WORKTOP_MAX_MM} mm).`,
        });
      }
    }
  }

  // Rule: mounting height within the accepted window.
  checks++;
  const badHeight = placements.filter(
    (s) => s.height_mm < MIN_HEIGHT_MM || s.height_mm > MAX_HEIGHT_MM,
  );
  if (badHeight.length > 0) {
    add({
      id: 'height-range',
      severity: 'warning',
      rule: 'Mounting height',
      socketIds: badHeight.map((s) => s.socket_id),
      message: `${badHeight.length} socket(s) outside ${MIN_HEIGHT_MM}–${MAX_HEIGHT_MM} mm mounting range.`,
    });
  }

  // Rule: every socket must sit inside a detected room.
  checks++;
  const outside = placements.filter((s) => !rooms.some((r) => isInsideRoom(s, r)));
  if (outside.length > 0) {
    add({
      id: 'outside-rooms',
      severity: 'warning',
      rule: 'Socket position',
      socketIds: outside.map((s) => s.socket_id),
      message: `${outside.length} socket(s) placed outside any detected room.`,
    });
  }

  // Rule: distribution board placed, mounted at the standard height, in a suitable room.
  checks++;
  if (!switchboard || switchboard.x_pct === undefined || switchboard.y_pct === undefined) {
    add({
      id: 'db-missing',
      severity: 'error',
      rule: 'Distribution board',
      message: 'Distribution board is not placed on the plan.',
    });
  } else {
    const wiring = (standards as Record<string, unknown> | null | undefined)?.wiring as
      Record<string, unknown> | undefined;
    const range = parseRange(wiring?.db_height_mm) || { min: 1400, max: 1800 };
    checks++;
    const height = switchboard.height_mm;
    if (typeof height === 'number' && (height < range.min || height > range.max)) {
      add({
        id: 'db-height',
        severity: 'warning',
        rule: 'Distribution board',
        message: `Distribution board at ${height} mm — standard height is ${range.min}–${range.max} mm.`,
      });
    }
    const preferredRaw = wiring?.db_preferred_rooms;
    const preferred = Array.isArray(preferredRaw)
      ? preferredRaw.filter((v): v is string => typeof v === 'string')
      : [];
    if (preferred.length > 0) {
      checks++;
      const dbRoom = rooms.find((r) => r.id === switchboard.room_id);
      const dbKey = dbRoom ? mapRoomType(dbRoom.type) : '';
      if (!preferred.includes(dbKey)) {
        add({
          id: 'db-room',
          severity: 'info',
          rule: 'Distribution board',
          roomId: dbRoom?.id,
          message: `Distribution board in ${dbRoom ? roomLabel(dbRoom) : 'an undetected room'} — preferred: ${preferred
            .map((p) => p.replace(/_/g, ' '))
            .join(', ')}.`,
        });
      }
    }
  }

  // Informational: how many standard socket circuits the plan needs.
  const maxPerCircuit = (
    (standards as Record<string, unknown> | null | undefined)?.circuit_requirements as
      Record<string, { max_sockets?: number }> | undefined
  )?.standard?.max_sockets;
  if (typeof maxPerCircuit === 'number' && maxPerCircuit > 0 && placements.length > maxPerCircuit) {
    add({
      id: 'circuit-count',
      severity: 'info',
      rule: 'Circuits',
      message: `${placements.length} sockets need at least ${Math.ceil(
        placements.length / maxPerCircuit,
      )} socket circuits (max ${maxPerCircuit} per circuit).`,
    });
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;
  const failed = errors + warnings;
  const passed = Math.max(0, checks - failed);
  const score = checks === 0 ? 100 : Math.round((passed / checks) * 100);

  return { issues, errors, warnings, infos, checks, passed, score, compliant: failed === 0 };
}
