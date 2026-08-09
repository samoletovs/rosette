import { describe, it, expect } from 'vitest';
import { STANDARDS_DATA } from '../api/src/standardsData';
import {
  circuitSummaries,
  findRoomRule,
  formatKeyLabel,
  roomRuleSummaries,
  summarizeStandards,
} from '../src/standardsSummary';

describe('standardsSummary — formatKeyLabel', () => {
  it('title-cases snake_case keys', () => {
    expect(formatKeyLabel('living_room')).toBe('Living Room');
    expect(formatKeyLabel('kitchen')).toBe('Kitchen');
  });

  it('special-cases wc', () => {
    expect(formatKeyLabel('wc')).toBe('WC / Toilet');
  });
});

describe('standardsSummary — summarizeStandards', () => {
  it.each(Object.keys(STANDARDS_DATA))('%s summary exposes headline facts', (code) => {
    const s = summarizeStandards(STANDARDS_DATA[code], code);
    expect(s.code).toBe(code);
    expect(s.country).toBe(STANDARDS_DATA[code].country);
    expect(s.standard).toBe(STANDARDS_DATA[code].standard);
    expect(s.voltage).toContain('230V');
    expect(s.frequency).toBe('50 Hz');
    expect(s.socketType).toContain('Schuko');
  });

  it('falls back to placeholders when standards are missing', () => {
    const s = summarizeStandards(null, 'LV');
    expect(s.country).toBe('LV');
    expect(s.standard).toBe('—');
    expect(s.voltage).toBe('—');
  });
});

describe('standardsSummary — roomRuleSummaries', () => {
  it('returns an empty list without standards', () => {
    expect(roomRuleSummaries(null)).toEqual([]);
    expect(roomRuleSummaries({})).toEqual([]);
  });

  it.each(Object.keys(STANDARDS_DATA))('%s room rules are sorted by minimum sockets', (code) => {
    const rules = roomRuleSummaries(STANDARDS_DATA[code]);
    expect(rules.length).toBeGreaterThan(0);
    const mins = rules.map((r) => r.minimumSockets ?? -1);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
    expect(rules.map((r) => r.key)).toContain('kitchen');
  });

  it('finds a specific room rule with notes', () => {
    const rule = findRoomRule(STANDARDS_DATA.LV, 'bathroom');
    expect(rule).not.toBeNull();
    expect(rule?.label).toBe('Bathroom');
    expect(rule?.minimumSockets).toBe(1);
    expect(rule?.notes.toLowerCase()).toContain('rcd');
  });

  it('returns null for unknown room keys', () => {
    expect(findRoomRule(STANDARDS_DATA.LV, 'not_a_room')).toBeNull();
  });
});

describe('standardsSummary — circuitSummaries', () => {
  it('returns an empty list without standards', () => {
    expect(circuitSummaries(null)).toEqual([]);
  });

  it.each(Object.keys(STANDARDS_DATA))('%s circuits include breaker and cable', (code) => {
    const circuits = circuitSummaries(STANDARDS_DATA[code]);
    const oven = circuits.find((c) => c.key === 'oven');
    expect(oven?.label).toBe('Oven');
    expect(oven?.breaker).toContain('32A');
    expect(oven?.cable).toBeTruthy();
    const washing = circuits.find((c) => c.key === 'washing_machine');
    expect(washing?.label).toBe('Washing Machine');
  });
});
