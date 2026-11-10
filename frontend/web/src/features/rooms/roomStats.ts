import type { Camera, Resident, RoomRef } from '@elderguard/shared';

export type RoomStatus = 'active' | 'paused' | 'offline' | 'no_camera';

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  active: 'Active',
  paused: 'Detection paused',
  offline: 'Camera offline',
  no_camera: 'No camera',
};

export interface RoomRow {
  room: RoomRef;
  residents: Resident[];
  cameras: Camera[];
  status: RoomStatus;
}

/** Whether falls in this room can be detected right now, worst problem first. */
export function roomStatus(cameras: Camera[]): RoomStatus {
  if (cameras.length === 0) return 'no_camera';
  if (cameras.some((c) => c.status === 'offline' || c.status === 'error')) return 'offline';
  if (cameras.some((c) => c.status === 'paused' || !c.detectionEnabled)) return 'paused';
  return 'active';
}

export function roomRows(rooms: RoomRef[], residents: Resident[], cameras: Camera[]): RoomRow[] {
  return rooms.map((room) => {
    const here = cameras.filter((c) => c.roomId === room.id);
    return {
      room,
      residents: residents.filter((r) => r.room?.id === room.id),
      cameras: here,
      status: roomStatus(here),
    };
  });
}

export const NO_WING = 'No wing';
export const wingOf = (r: RoomRef) => r.wing ?? NO_WING;

export function filterRooms(rows: RoomRow[], { search, wing }: { search: string; wing: string }): RoomRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter(
    ({ room }) =>
      (wing === '' || wingOf(room) === wing) &&
      (q === '' || `${room.name} ${room.wing ?? ''}`.toLowerCase().includes(q)),
  );
}

export const roomLabel = (r: { name: string; wing: string | null }) =>
  r.wing ? `${r.name} · ${r.wing}` : r.name;
