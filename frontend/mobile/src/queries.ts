import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { ALERT_POLL_MS } from './config';

/** Open alerts, checked every few seconds (the backend has no push yet). */
export function useActiveIncidents() {
  return useQuery({
    queryKey: ['incidents', 'active'],
    queryFn: () => api.activeIncidents(),
    refetchInterval: ALERT_POLL_MS,
  });
}
