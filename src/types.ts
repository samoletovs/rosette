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
