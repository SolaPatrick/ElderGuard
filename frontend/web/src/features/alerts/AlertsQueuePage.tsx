import { useActiveIncidents } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { IncidentTable } from '../incidents/IncidentTable';

/** ALT-01 */
export function AlertsQueuePage() {
  const active = useActiveIncidents();
  return (
    <>
      <PageHeader title="Active alerts" subtitle="Open alerts, oldest first. Refreshes automatically." />
      {active.isPending ? (
        <SkeletonRows rows={4} />
      ) : active.isError && !active.data ? (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      ) : (
        <IncidentTable
          basePath="/alerts"
          showElapsed
          incidents={(active.data ?? []).toSorted(
            (a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt),
          )}
          emptyText="All clear. No open alerts right now."
        />
      )}
    </>
  );
}
