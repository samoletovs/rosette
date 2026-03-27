import { describe, it, expect } from 'vitest';
import { STANDARDS_DATA } from '../api/src/standardsData';

describe('standardsData — structure validation', () => {
  const countryCodes = Object.keys(STANDARDS_DATA);

  it('has data for all three Baltic countries', () => {
    expect(countryCodes).toContain('LV');
    expect(countryCodes).toContain('LT');
    expect(countryCodes).toContain('EE');
  });

  it.each(countryCodes)('%s has required top-level fields', (code) => {
    const std = STANDARDS_DATA[code];
    expect(std.country).toBeTruthy();
    expect(std.country_code).toBe(code);
    expect(std.standard).toBeTruthy();
    expect(std.voltage).toContain('230V');
    expect(std.frequency).toBe('50 Hz');
    expect(std.socket_type).toContain('Schuko');
  });

  it.each(countryCodes)('%s has room rules for core rooms', (code) => {
    const rooms = STANDARDS_DATA[code].room_rules;
    const requiredRooms = ['kitchen', 'living_room', 'bedroom', 'bathroom', 'hallway'];
    for (const room of requiredRooms) {
      expect(rooms[room]).toBeDefined();
      expect(rooms[room].minimum_sockets).toBeGreaterThan(0);
    }
  });

  it.each(countryCodes)('%s has circuit requirements', (code) => {
    const circuits = STANDARDS_DATA[code].circuit_requirements;
    expect(circuits.standard).toBeDefined();
    expect(circuits.standard.breaker).toContain('16A');
    expect(circuits.lighting).toBeDefined();
    expect(circuits.oven).toBeDefined();
  });

  it.each(countryCodes)('%s has wiring specifications', (code) => {
    const wiring = STANDARDS_DATA[code].wiring;
    expect(wiring.wire_colors).toBeDefined();
    expect(wiring.wire_colors.L).toBe('Brown');
    expect(wiring.wire_colors.N).toBe('Blue');
    expect(wiring.wire_colors.PE).toBe('Green-Yellow');
    expect(wiring.db_height_mm).toBe('1400-1800');
  });

  it('kitchen requires at least 6 sockets in all countries', () => {
    for (const code of countryCodes) {
      expect(STANDARDS_DATA[code].room_rules.kitchen.minimum_sockets).toBeGreaterThanOrEqual(6);
    }
  });

  it('bathroom requires RCD protection in all countries', () => {
    for (const code of countryCodes) {
      const notes = STANDARDS_DATA[code].room_rules.bathroom.notes;
      expect(notes.toLowerCase()).toContain('rcd');
    }
  });
});

describe('standardsData — safety rules', () => {
  it('oven circuit is 32A in all countries', () => {
    for (const code of Object.keys(STANDARDS_DATA)) {
      expect(STANDARDS_DATA[code].circuit_requirements.oven.breaker).toContain('32A');
    }
  });

  it('washing machine has dedicated circuit in all countries', () => {
    for (const code of Object.keys(STANDARDS_DATA)) {
      expect(STANDARDS_DATA[code].circuit_requirements.washing_machine.dedicated).toBe(true);
    }
  });

  it('voltage drop limit is 3% in all countries', () => {
    for (const code of Object.keys(STANDARDS_DATA)) {
      expect(STANDARDS_DATA[code].wiring.voltage_drop_limit).toBe('3%');
    }
  });
});
