import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AddNoteRequest, ClassifyRequest, IncidentDetail, ResolveRequest } from '@elderguard/shared';
import { ALERT_POLL_MS } from './config';
import { api } from './endpoints';

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  activity: (limit: number) => ['activity', limit] as const,
  cameras: ['cameras'] as const,
  residents: ['residents'] as const,
  resident: (id: string) => ['residents', id] as const,
  activeIncidents: ['incidents', 'active'] as const,
  incidents: ['incidents', 'all'] as const,
  incident: (code: string) => ['incidents', 'detail', code] as const,
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
