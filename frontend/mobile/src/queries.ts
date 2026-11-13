import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AddNoteRequest, ClassifyRequest, IncidentDetail, ResolveRequest } from '@elderguard/shared';
import { api } from './api';
import { ALERT_POLL_MS } from './config';

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

/** The latest incidents, open and closed, for the History list. */
export function useIncidentHistory() {
  return useQuery({ queryKey: queryKeys.history, queryFn: () => api.incidents(50) });
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
