import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AddNoteRequest,
  Camera,
  ClassifyRequest,
  CreateStaffRequest,
  RoomRequest,
  CameraRequest,
  ArchiveRequest,
  ResidentDetail,
  ResidentRequest,
  UpdateStaffRequest,
  StaffAssignmentsRequest,
  IncidentDetail,
  ResolveRequest,
  SosRequest,
  CancelSosRequest,
  ReportRange,
  FacilitySettings,
  SettingsSection,
} from '@elderguard/shared';
import { rangeBounds } from '@elderguard/shared';
import { ALERT_POLL_MS, CAMERA_PICTURE_MS, HISTORY_LIMIT } from './config';
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
  settings: ['settings'] as const,
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

/** RPT-01: every incident detected inside the report's whole days. */
export function useIncidentsBetween(range: ReportRange, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.incidents, 'between', range.from, range.to] as const,
    queryFn: () => {
      const { start, end } = rangeBounds(range);
      return api.incidentsBetween(start.toISOString(), end.toISOString());
    },
    enabled,
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
    queryFn: () => api.residents(),
    refetchInterval: ALERT_POLL_MS * 2,
  });
}

/** Former residents (RES-07), for the Admin/Head to look up or restore. */
export function useArchivedResidents(enabled: boolean) {
  return useQuery({
    queryKey: ['residents', { archived: true }] as const,
    queryFn: () => api.residents(true),
    enabled,
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

/** Turns a picture into a data: link, which needs no clean-up, unlike a blob: link. */
async function toDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
}

/** True when the camera is sending live video. */
export const hasLiveVideo = (camera: Camera) =>
  camera.liveUrl !== null && (camera.status === 'online' || camera.status === 'paused');

/** The camera's newest picture, fetched again every few seconds while `enabled` and the tab is visible. */
export function useCameraPictureQuery(camera: Camera, enabled: boolean) {
  return useQuery({
    queryKey: ['camera-picture', camera.id],
    queryFn: async ({ signal }) => toDataUrl(await api.cameraPicture(camera.id, signal)),
    enabled,
    refetchInterval: CAMERA_PICTURE_MS,
    refetchIntervalInBackground: false,
    retry: false,
    gcTime: 0,
  });
}

/**
 * The picture shown on a camera tile (MON-01). Off when the camera has no live video. Null until a
 * picture arrives, and after a failed refresh, so a frozen picture is never shown as live.
 */
export function useCameraPicture(camera: Camera): string | null {
  const live = hasLiveVideo(camera);
  const picture = useCameraPictureQuery(camera, live);
  return live && !picture.isError ? (picture.data ?? null) : null;
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

export function useCancelSos(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CancelSosRequest) => api.cancelSos(code, body),
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

/** USR-10. Rooms change what the employee sees, so their alerts, residents and cameras refresh too. */
export function useAssignStaff(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StaffAssignmentsRequest) => api.assignStaff(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.staffMember(id), updated);
      refreshStaff(qc);
      void qc.invalidateQueries({ queryKey: queryKeys.residents });
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

// ---------- Resident editing (Admin/Head) ----------

/** After a resident changes, keep the new profile and refresh lists, counts and the log. */
function applyResidentUpdate(qc: QueryClient, updated: ResidentDetail) {
  qc.setQueryData(queryKeys.resident(updated.id), updated);
  void qc.invalidateQueries({ queryKey: queryKeys.residents });
  void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  void qc.invalidateQueries({ queryKey: ['activity'] });
}

/** RES-02 add (id null) and RES-04 / RES-05 edit or transfer. */
export function useSaveResident(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ResidentRequest) =>
      id === null ? api.createResident(body) : api.updateResident(id, body),
    onSuccess: (saved) => applyResidentUpdate(qc, saved),
  });
}

/** RES-07 archive (body null when the server keeps no reason). */
export function useArchiveResident(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ArchiveRequest | null) => api.archiveResident(id, body),
    onSuccess: (saved) => applyResidentUpdate(qc, saved),
  });
}

export function useRestoreResident(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.restoreResident(id),
    onSuccess: (saved) => applyResidentUpdate(qc, saved),
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

/** SET-01 to SET-04. Not retried: on a server without settings the 501 answer will not change. */
export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: api.settings,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useSaveSettings<S extends SettingsSection>(section: S) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FacilitySettings[S]) => api.saveSettings(section, body),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.settings, data);
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
