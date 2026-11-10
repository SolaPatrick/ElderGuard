import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AddNoteRequest,
  ClassifyRequest,
  CreateStaffRequest,
  RoomRequest,
  CameraRequest,
  UpdateStaffRequest,
  IncidentDetail,
  ResolveRequest,
  SosRequest,
} from '@elderguard/shared';
import { ALERT_POLL_MS, HISTORY_LIMIT } from './config';
import { api } from './endpoints';

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  activity: (limit: number) => ['activity', limit] as const,
  cameras: ['cameras'] as const,
  rooms: ['rooms'] as const,
  residents: ['residents'] as const,
  resident: (id: string) => ['residents', id] as const,
  activeIncidents: ['incidents', 'active'] as const,
  incidents: ['incidents', 'all'] as const,
  incident: (code: string) => ['incidents', 'detail', code] as const,
  staff: ['staff'] as const,
  staffMember: (id: string) => ['staff', id] as const,
};

/** Active alerts, refreshed every few seconds (also while the tab is in the background). */
export function useActiveIncidents() {
  return useQuery({
    queryKey: queryKeys.activeIncidents,
    queryFn: api.activeIncidents,
    refetchInterval: ALERT_POLL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useIncidents() {
  return useQuery({ queryKey: queryKeys.incidents, queryFn: () => api.incidents() });
}

/** INC-01: the latest HISTORY_LIMIT incidents; the page filters them. */
export function useIncidentHistory() {
  return useQuery({
    queryKey: [...queryKeys.incidents, 'history'] as const,
    queryFn: () => api.incidents(HISTORY_LIMIT),
    refetchInterval: 30_000,
  });
}

export function useIncident(code: string) {
  return useQuery({
    queryKey: queryKeys.incident(code),
    queryFn: () => api.incident(code),
    refetchInterval: ALERT_POLL_MS,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.dashboardSummary,
    refetchInterval: ALERT_POLL_MS * 2,
  });
}

export function useActivity(limit = 3) {
  return useQuery({ queryKey: queryKeys.activity(limit), queryFn: () => api.activity(limit) });
}

/** Residents the signed-in user may see (all for Admin/Head, assigned ones for caregivers). */
export function useResidents() {
  return useQuery({
    queryKey: queryKeys.residents,
    queryFn: api.residents,
    refetchInterval: ALERT_POLL_MS * 2,
  });
}

/** Rooms and areas the user may see (their assigned ones for caregivers). Changes rarely. */
export function useRooms() {
  return useQuery({ queryKey: queryKeys.rooms, queryFn: api.rooms, staleTime: 5 * 60_000 });
}

export function useResident(id: string) {
  return useQuery({
    queryKey: queryKeys.resident(id),
    queryFn: () => api.resident(id),
    refetchInterval: ALERT_POLL_MS * 2,
  });
}

export function useCameras() {
  return useQuery({ queryKey: queryKeys.cameras, queryFn: api.cameras, refetchInterval: 30_000 });
}

/** After any change to an incident, update its cache entry and refresh lists and counts. */
function applyIncidentUpdate(qc: QueryClient, updated: IncidentDetail) {
  qc.setQueryData(queryKeys.incident(updated.code), updated);
  void qc.invalidateQueries({ queryKey: ['incidents'] });
  void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  void qc.invalidateQueries({ queryKey: ['activity'] });
  void qc.invalidateQueries({ queryKey: queryKeys.residents });
}

export function useAcknowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.acknowledge(code),
    onSuccess: (data) => applyIncidentUpdate(qc, data),
  });
}

export function useClassify(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClassifyRequest) => api.classify(code, body),
    onSuccess: (data) => applyIncidentUpdate(qc, data),
  });
}

export function useResolve(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ResolveRequest) => api.resolve(code, body),
    onSuccess: (data) => applyIncidentUpdate(qc, data),
  });
}

export function useAddNote(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddNoteRequest) => api.addNote(code, body),
    onSuccess: (data) => applyIncidentUpdate(qc, data),
  });
}

/** SOS-01. Sending is never retried automatically, so one press is one SOS. */
export function useSendSos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SosRequest) => api.sendSos(body),
    onSuccess: (incident) => applyIncidentUpdate(qc, incident),
  });
}

// ---------- Users & Access (Admin/Head) ----------

export function useStaff() {
  return useQuery({ queryKey: queryKeys.staff, queryFn: api.staff });
}

export function useStaffMember(id: string) {
  return useQuery({ queryKey: queryKeys.staffMember(id), queryFn: () => api.staffMember(id) });
}

/** Staff names also appear on residents and in the activity log, so refresh those too. */
function refreshStaff(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: queryKeys.staff });
  void qc.invalidateQueries({ queryKey: queryKeys.residents });
  void qc.invalidateQueries({ queryKey: ['activity'] });
}

/** Creating an account is never retried automatically, so one click is one account. */
export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStaffRequest) => api.createStaff(body),
    onSuccess: () => refreshStaff(qc),
  });
}

export function useUpdateStaff(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateStaffRequest) => api.updateStaff(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.staffMember(id), updated);
      refreshStaff(qc);
    },
  });
}

type StaffAction = 'deactivate' | 'reactivate';

export function useSetStaffActive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: StaffAction) =>
      action === 'deactivate' ? api.deactivateStaff(id) : api.reactivateStaff(id),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.staffMember(id), updated);
      refreshStaff(qc);
    },
  });
}

export function useResetStaffPassword(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetStaffPassword(id),
    onSuccess: ({ user }) => {
      qc.setQueryData(queryKeys.staffMember(id), user);
      refreshStaff(qc);
    },
  });
}

// ---------- Rooms & Areas (Admin/Head) ----------

/** Room names appear on residents, cameras, incidents and staff, so refresh all of them. */
function refreshRooms(qc: QueryClient) {
  for (const key of [
    queryKeys.rooms,
    queryKeys.residents,
    queryKeys.cameras,
    ['incidents'],
    queryKeys.staff,
  ]) {
    void qc.invalidateQueries({ queryKey: key });
  }
  void qc.invalidateQueries({ queryKey: ['activity'] });
}

export function useSaveRoom(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RoomRequest) => (id === null ? api.createRoom(body) : api.updateRoom(id, body)),
    onSuccess: () => refreshRooms(qc),
  });
}

export function useDeleteRoom(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteRoom(id),
    onSuccess: () => refreshRooms(qc),
  });
}

// ---------- Cameras & Devices (Admin/Head) ----------

export function useCameraSettings(id: string) {
  return useQuery({ queryKey: ['cameras', 'settings', id] as const, queryFn: () => api.cameraSettings(id) });
}

/** Cameras appear on rooms, residents and the dashboard, so refresh those too. */
function refreshCameras(qc: QueryClient) {
  // Only the list: the settings of a camera that was just removed must not be fetched again.
  void qc.invalidateQueries({ queryKey: queryKeys.cameras, exact: true });
  void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  void qc.invalidateQueries({ queryKey: ['activity'] });
}

export function useSaveCamera(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CameraRequest) => (id === null ? api.createCamera(body) : api.updateCamera(id, body)),
    onSuccess: (saved) => {
      qc.setQueryData(['cameras', 'settings', saved.id], saved);
      refreshCameras(qc);
    },
  });
}

export function useDeleteCamera(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.deleteCamera(id), onSuccess: () => refreshCameras(qc) });
}

export function useTestCameraSource() {
  return useMutation({ mutationFn: (source: string) => api.testCameraSource(source) });
}
