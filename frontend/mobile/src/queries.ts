import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AddNoteRequest, ClassifyRequest, IncidentDetail, ResolveRequest } from '@elderguard/shared';
import { api } from './api';
import { ALERT_POLL_MS, HISTORY_LIMIT } from './config';

export const queryKeys = {
  active: ['incidents', 'active'] as const,
  history: ['incidents', 'history'] as const,
  incident: (code: string) => ['incident', code] as const,
};

/** Open alerts, checked every few seconds (the backend has no push yet). */
export function useActiveIncidents() {
  return useQuery({
    queryKey: queryKeys.active,
    queryFn: () => api.activeIncidents(),
    refetchInterval: ALERT_POLL_MS,
  });
}

/** The latest HISTORY_LIMIT incidents, open and closed. History searches and filters them. */
export function useIncidentHistory() {
  return useQuery({ queryKey: queryKeys.history, queryFn: () => api.incidents(HISTORY_LIMIT) });
}

export function useIncident(code: string) {
  return useQuery({
    queryKey: queryKeys.incident(code),
    queryFn: () => api.incident(code),
    refetchInterval: ALERT_POLL_MS,
  });
}

function applyIncidentUpdate(qc: QueryClient, updated: IncidentDetail) {
  qc.setQueryData(queryKeys.incident(updated.code), updated);
  void qc.invalidateQueries({ queryKey: ['incidents'] });
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

/** M-10 Admin/Head home figures (alerts, cameras, incidents today), refreshed with the alerts. */
export function useDashboardSummary(enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboardSummary(),
    refetchInterval: ALERT_POLL_MS * 2,
    enabled,
  });
}

/** Camera list and status, refreshed every 10 seconds. */
export function useCameras() {
  return useQuery({ queryKey: ['cameras'], queryFn: () => api.cameras(), refetchInterval: 10_000 });
}

/**
 * The camera's newest picture as a data URL, fetched every `everyMs` while `enabled`.
 * Den's server sends it with the login header, so a plain image link cannot load it.
 */
export function useCameraPicture(id: string, enabled: boolean, everyMs: number) {
  return useQuery({
    queryKey: ['camera-picture', id],
    queryFn: async ({ signal }) => blobToDataUrl(await api.cameraPicture(id, signal)),
    enabled,
    refetchInterval: enabled ? everyMs : false,
    retry: false,
    // Keep showing the last picture while the next one loads.
    placeholderData: (previous) => previous,
  });
}

/** React Native's Blob has no arrayBuffer(), but its FileReader can make a data URL (so can browsers). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the camera picture'));
    reader.readAsDataURL(blob);
  });
}

export function useResidents() {
  return useQuery({ queryKey: ['residents'], queryFn: () => api.residents() });
}

export function useResident(id: string) {
  return useQuery({ queryKey: ['resident', id], queryFn: () => api.resident(id) });
}

/** Enough history to list a resident's incidents on their profile. */
export function useRecentIncidents() {
  return useQuery({ queryKey: ['incidents', 'recent'], queryFn: () => api.incidents(500) });
}
