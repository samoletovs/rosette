// ── Domain types for Rosette ──

export interface RoomPosition {
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
}

export interface Room {
  id: string;
  type: string;
  name: string;
  width_m: number;
  height_m: number;
  area_m2: number;
  position: RoomPosition;
  features: string[];
  requested_sockets?: number;
}

export interface Switchboard {
  room_id: string;
  room_name: string;
  wall: string;
  height_mm: number;
  reason: string;
  x_pct?: number;
  y_pct?: number;
  type?: string;
  rating?: string;
  ip_rating?: string;
  rotation?: number;
}

export interface SocketPlacement {
  room_id: string;
  room_name: string;
  socket_id: string;
  x_pct: number;
  y_pct: number;
  wall: string;
  height_mm: number;
  type: string;
  gang?: number; // 1-5 connections (default 1)
  rotation?: number; // degrees: 0=N, 90=E, 180=S, 270=W
  circuit?: string;
  notes?: string;
}

export interface PlacementProposal {
  switchboard: Switchboard;
  placements: SocketPlacement[];
}

export interface ConfirmedPlacement {
  switchboard: Switchboard;
  placements: SocketPlacement[];
}

export interface CountryItem {
  code: string;
  country: string;
}

export interface StandardsData {
  room_rules?: Record<string, { minimum_sockets?: number }>;
  [key: string]: unknown;
}

export interface AnalysisResult {
  rooms: Room[];
  switchboard?: Switchboard;
  [key: string]: unknown;
}

export interface CircuitInfo {
  id: string;
  sockets?: string[];
  breaker?: string;
  cable?: string;
  rcd_group?: string;
  [key: string]: unknown;
}

export interface RcdGroup {
  id: string;
  label?: string;
  rcd?: string;
  circuits?: string[];
  [key: string]: unknown;
}

export interface WiringEntry {
  circuit_id?: string;
  to_room_id?: string;
  to_room?: string;
  cable_type?: string;
  estimated_length_m?: number;
  wire_colors?: string[];
  [key: string]: unknown;
}

export interface CalculationResult {
  placements: SocketPlacement[];
  circuits?: CircuitInfo[];
  wiring?: WiringEntry[];
  rcd_groups?: RcdGroup[];
  summary?: string;
  total_sockets?: number;
  total_circuits?: number;
  total_cable_m?: number;
  [key: string]: unknown;
}

export interface DescriptionResponse {
  description_en: string;
  description_local: string;
  language?: {
    name?: string;
    code?: string;
  };
}
