import { useIncidents } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { IncidentTable } from './IncidentTable';

/** INC-01 (first version: no filters yet) */
export function IncidentListPage() {
  const incidents = useIncidents();
  return (
    <>
      <PageHeader title="Incident history" subtitle="All falls and SOS requests, newest first." />
      {incidents.isPending ? (
        <SkeletonRows rows={6} />
      ) : incidents.isError ? (
        <ErrorState error={incidents.error} onRetry={() => void incidents.refetch()} />
      ) : (
        <IncidentTable
          basePath="/incidents"
          incidents={incidents.data}
          emptyText="No incidents recorded yet."
        />
      )}
    </>
  );
}
