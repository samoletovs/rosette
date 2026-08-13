import { describe, it, expect } from 'vitest';
import { STANDARDS_DATA } from '../api/src/standardsData';
import { checkCompliance, mapRoomType } from '../src/complianceChecker';
import type { Room, SocketPlacement, Switchboard } from '../src/types';

const LV = STANDARDS_DATA.LV;

function room(id: string, type: string, overrides: Partial<Room> = {}): Room {
  return {
    id,
    type,
    name: type,
    width_m: 4,
    height_m: 3,
    area_m2: 12,
    position: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 },
    features: [],
    ...overrides,
  };
}

function socket(
  id: string,
  roomId: string,
  overrides: Partial<SocketPlacement> = {},
): SocketPlacement {
  return {
    room_id: roomId,
    room_name: roomId,
    socket_id: id,
    x_pct: 50,
    y_pct: 50,
    wall: 'north',
    height_mm: 300,
    type: 'standard_16a',
    gang: 1,
    ...overrides,
  };
}

const db: Switchboard = {
  room_id: 'hall',
  room_name: 'hallway',
  wall: 'north',
  height_mm: 1600,
  reason: 'central',
  x_pct: 10,
  y_pct: 10,
};

function nSockets(roomId: string, count: number, overrides: Partial<SocketPlacement> = {}) {
  return Array.from({ length: count }, (_, i) => socket(`${roomId}${i + 1}`, roomId, overrides));
}

describe('complianceChecker — mapRoomType', () => {
  it('normalises aliases to standards keys', () => {
    expect(mapRoomType('Living Area')).toBe('living_room');
    expect(mapRoomType('shower-room')).toBe('bathroom');
    expect(mapRoomType('Toilet')).toBe('wc');
  });

  it('falls back to the normalised input for unknown types', () => {
    expect(mapRoomType('Wine Cellar')).toBe('wine_cellar');
    expect(mapRoomType('')).toBe('');
  });
});

describe('complianceChecker — minimum sockets', () => {
  it('warns when a room has no sockets yet', () => {
    const report = checkCompliance({
      rooms: [room('bed', 'bedroom')],
      placements: [],
      switchboard: db,
      standards: LV,
    });
    const issue = report.issues.find((i) => i.id === 'min-sockets:bed');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('4 required');
  });

  it('errors when a room is under the country minimum', () => {
    const report = checkCompliance({
      rooms: [room('bed', 'bedroom')],
      placements: nSockets('bed', 2),
      switchboard: db,
      standards: LV,
    });
    const issue = report.issues.find((i) => i.id === 'min-sockets:bed');
    expect(issue?.severity).toBe('error');
    expect(report.errors).toBeGreaterThan(0);
    expect(report.compliant).toBe(false);
  });

  it('passes when the minimum is met', () => {
    const report = checkCompliance({
      rooms: [room('bed', 'bedroom')],
      placements: nSockets('bed', 4),
      switchboard: db,
      standards: LV,
    });
    expect(report.issues.find((i) => i.id === 'min-sockets:bed')).toBeUndefined();
  });

  it('skips the rule for room types without standards rules', () => {
    const report = checkCompliance({
      rooms: [room('x', 'wine_cellar')],
      placements: [],
      switchboard: db,
      standards: LV,
    });
    expect(report.issues.some((i) => i.id.startsWith('min-sockets'))).toBe(false);
  });
});

describe('complianceChecker — wet rooms', () => {
  it('requires IP44 sockets in a bathroom', () => {
    const report = checkCompliance({
      rooms: [room('bath', 'bathroom')],
      placements: [socket('B1', 'bath', { height_mm: 1100 })],
      switchboard: db,
      standards: LV,
    });
    const issue = report.issues.find((i) => i.id === 'wet-ip44:bath');
    expect(issue?.severity).toBe('error');
    expect(issue?.socketIds).toEqual(['B1']);
  });

  it('accepts IP44 sockets mounted above the wet zones', () => {
    const report = checkCompliance({
      rooms: [room('bath', 'bathroom')],
      placements: [socket('B1', 'bath', { type: 'ip44', height_mm: 1100 })],
      switchboard: db,
      standards: LV,
    });
    expect(report.issues.some((i) => i.roomId === 'bath')).toBe(false);
  });

  it('warns about low sockets in wet zones', () => {
    const report = checkCompliance({
      rooms: [room('bath', 'bathroom')],
      placements: [socket('B1', 'bath', { type: 'ip44', height_mm: 300 })],
      switchboard: db,
      standards: LV,
    });
    expect(report.issues.find((i) => i.id === 'wet-height:bath')?.severity).toBe('warning');
  });

  it('allows an EV charger in the garage', () => {
    const report = checkCompliance({
      rooms: [room('gar', 'garage')],
      placements: [
        socket('G1', 'gar', { type: 'ev_charger', height_mm: 1100 }),
        socket('G2', 'gar', { type: 'ip44' }),
      ],
      switchboard: db,
      standards: LV,
    });
    expect(report.issues.some((i) => i.id === 'wet-ip44:gar')).toBe(false);
  });
});

describe('complianceChecker — kitchen worktop and heights', () => {
  it('warns when the kitchen has no worktop-height socket', () => {
    const report = checkCompliance({
      rooms: [room('kit', 'kitchen')],
      placements: nSockets('kit', 6),
      switchboard: db,
      standards: LV,
    });
    expect(report.issues.find((i) => i.id === 'worktop:kit')?.severity).toBe('warning');
  });

  it('passes when a socket sits in the worktop band', () => {
    const report = checkCompliance({
      rooms: [room('kit', 'kitchen')],
      placements: [...nSockets('kit', 5), socket('kit6', 'kit', { height_mm: 1100 })],
      switchboard: db,
      standards: LV,
    });
    expect(report.issues.some((i) => i.id === 'worktop:kit')).toBe(false);
  });

  it('flags sockets outside the mounting height window', () => {
    const report = checkCompliance({
      rooms: [room('liv', 'living_room')],
      placements: [...nSockets('liv', 4), socket('liv5', 'liv', { height_mm: 1900 })],
      switchboard: db,
      standards: LV,
    });
    const issue = report.issues.find((i) => i.id === 'height-range');
    expect(issue?.severity).toBe('warning');
    expect(issue?.socketIds).toEqual(['liv5']);
  });
});

describe('complianceChecker — positions and distribution board', () => {
  it('flags sockets placed outside every room', () => {
    const rooms = [
      room('liv', 'living_room', { position: { x_pct: 0, y_pct: 0, w_pct: 40, h_pct: 40 } }),
    ];
    const report = checkCompliance({
      rooms,
      placements: [
        ...nSockets('liv', 4, { x_pct: 10, y_pct: 10 }),
        socket('liv5', 'liv', { x_pct: 90, y_pct: 90 }),
      ],
      switchboard: db,
      standards: LV,
    });
    expect(report.issues.find((i) => i.id === 'outside-rooms')?.socketIds).toEqual(['liv5']);
  });

  it('errors when the distribution board is missing', () => {
    const report = checkCompliance({ rooms: [], placements: [], switchboard: null, standards: LV });
    expect(report.issues.find((i) => i.id === 'db-missing')?.severity).toBe('error');
  });

  it('warns when the distribution board height is outside the standard range', () => {
    const report = checkCompliance({
      rooms: [],
      placements: [],
      switchboard: { ...db, height_mm: 900 },
      standards: LV,
    });
    const issue = report.issues.find((i) => i.id === 'db-height');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('1400–1800');
  });

  it('suggests a preferred room for the distribution board', () => {
    const report = checkCompliance({
      rooms: [room('bed', 'bedroom')],
      placements: nSockets('bed', 4),
      switchboard: { ...db, room_id: 'bed' },
      standards: LV,
    });
    const issue = report.issues.find((i) => i.id === 'db-room');
    expect(issue?.severity).toBe('info');
    expect(report.infos).toBe(1);
  });

  it('accepts a distribution board in a preferred room', () => {
    const report = checkCompliance({
      rooms: [room('hall', 'hallway')],
      placements: nSockets('hall', 2),
      switchboard: { ...db, room_id: 'hall' },
      standards: LV,
    });
    expect(report.issues.some((i) => i.id === 'db-room')).toBe(false);
  });
});

describe('complianceChecker — report totals', () => {
  it('reports a fully compliant plan', () => {
    const rooms = [room('hall', 'hallway'), room('bed', 'bedroom')];
    const report = checkCompliance({
      rooms,
      placements: [...nSockets('hall', 2), ...nSockets('bed', 4)],
      switchboard: { ...db, room_id: 'hall' },
      standards: LV,
    });
    expect(report.issues).toEqual([]);
    expect(report.compliant).toBe(true);
    expect(report.score).toBe(100);
    expect(report.passed).toBe(report.checks);
  });

  it('lowers the score as issues appear', () => {
    const rooms = [room('bath', 'bathroom'), room('bed', 'bedroom')];
    const report = checkCompliance({
      rooms,
      placements: [socket('B1', 'bath'), ...nSockets('bed', 1)],
      switchboard: null,
      standards: LV,
    });
    expect(report.score).toBeLessThan(100);
    expect(report.errors).toBeGreaterThan(0);
    expect(report.compliant).toBe(false);
  });

  it('adds a circuit hint once the plan exceeds one socket circuit', () => {
    const rooms = [room('liv', 'living_room')];
    const report = checkCompliance({
      rooms,
      placements: nSockets('liv', 12),
      switchboard: { ...db, room_id: 'liv' },
      standards: LV,
    });
    const issue = report.issues.find((i) => i.id === 'circuit-count');
    expect(issue?.severity).toBe('info');
    expect(issue?.message).toContain('2 socket circuits');
  });

  it('works without standards loaded', () => {
    const report = checkCompliance({
      rooms: [room('liv', 'living_room')],
      placements: [],
      switchboard: db,
    });
    expect(report.issues.some((i) => i.id.startsWith('min-sockets'))).toBe(false);
    expect(report.checks).toBeGreaterThan(0);
  });

  it.each(Object.keys(STANDARDS_DATA))('%s standards drive the same rule set', (code) => {
    const rooms = [room('kit', 'kitchen')];
    const report = checkCompliance({
      rooms,
      placements: nSockets('kit', 1),
      switchboard: db,
      standards: STANDARDS_DATA[code],
    });
    expect(report.issues.find((i) => i.id === 'min-sockets:kit')?.severity).toBe('error');
    expect(report.issues.some((i) => i.id === 'worktop:kit')).toBe(true);
  });
});
