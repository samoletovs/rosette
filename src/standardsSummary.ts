// ── Pure helpers for presenting country electrical standards ──

import type { StandardsData } from './types';

export interface StandardsSummary {
  code: string;
  country: string;
  standard: string;
  voltage: string;
  frequency: string;
  socketType: string;
}

export interface RoomRuleSummary {
  key: string;
  label: string;
  minimumSockets: number | null;
  notes: string;
}

export interface CircuitSummary {
  key: string;
  label: string;
  breaker: string;
  cable: string;
}

const UNKNOWN = '—';

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '';
}

export function formatKeyLabel(key: string): string {
  if (key.toLowerCase() === 'wc') return 'WC / Toilet';
  return key
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function summarizeStandards(
  standards: StandardsData | null,
  code: string,
): StandardsSummary {
  const std = (standards || {}) as Record<string, unknown>;
  return {
    code,
    country: text(std.country) || code,
    standard: text(std.standard) || UNKNOWN,
    voltage: text(std.voltage) || UNKNOWN,
    frequency: text(std.frequency) || UNKNOWN,
    socketType: text(std.socket_type) || UNKNOWN,
  };
}

export function roomRuleSummaries(standards: StandardsData | null): RoomRuleSummary[] {
  const rules = standards?.room_rules;
  if (!rules) return [];
  return Object.entries(rules)
    .map(([key, rule]) => {
      const r = (rule || {}) as Record<string, unknown>;
      const min = typeof r.minimum_sockets === 'number' ? r.minimum_sockets : null;
      return { key, label: formatKeyLabel(key), minimumSockets: min, notes: text(r.notes) };
    })
    .sort(
      (a, b) =>
        (b.minimumSockets ?? -1) - (a.minimumSockets ?? -1) || a.label.localeCompare(b.label),
    );
}

export function circuitSummaries(standards: StandardsData | null): CircuitSummary[] {
  const circuits = (standards as Record<string, unknown> | null)?.circuit_requirements;
  if (!circuits || typeof circuits !== 'object') return [];
  return Object.entries(circuits as Record<string, unknown>).map(([key, circuit]) => {
    const c = (circuit || {}) as Record<string, unknown>;
    return {
      key,
      label: formatKeyLabel(key),
      breaker: text(c.breaker) || UNKNOWN,
      cable: text(c.cable) || UNKNOWN,
    };
  });
}

export function findRoomRule(
  standards: StandardsData | null,
  roomKey: string,
): RoomRuleSummary | null {
  return roomRuleSummaries(standards).find((r) => r.key === roomKey) || null;
}
