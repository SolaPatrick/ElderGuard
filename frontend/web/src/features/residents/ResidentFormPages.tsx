import { useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
} from '@mui/material';
import { Link as RouterLink, useBlocker, useNavigate, useParams } from 'react-router';
import type { ResidentRequest } from '@elderguard/shared';
import { ApiError } from '../../api/client';
import { useResident, useSaveResident } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { NotFoundPage } from '../system/NotFoundPage';
import { RESIDENT_FORM_ID, ResidentForm } from './ResidentForm';
import { EMPTY_RESIDENT, formValues } from './residentEditing';

const ListLink = () => (
  <Link component={RouterLink} to="/residents" color="inherit">
    Residents
  </Link>
);

/**
 * RES-04 Unsaved changes warning: asks before leaving a form with changes. Saving turns it off
 * (`saved.current`) so the page can move on to the profile.
 */
function useUnsavedChanges() {
  const [changed, setChanged] = useState(0);
  const saved = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      changed > 0 && !saved.current && currentLocation.pathname !== nextLocation.pathname,
  );
  const dialog = (name: string | null) =>
    blocker.state === 'blocked' ? (
      <Dialog open onClose={() => blocker.reset()} maxWidth="xs" fullWidth>
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You changed {changed} {changed === 1 ? 'field' : 'fields'}
            {name ? ` for ${name}` : ''}. If you leave now, the changes are lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button onClick={() => blocker.reset()}>Keep editing</Button>
          <Button variant="contained" color="error" onClick={() => blocker.proceed()}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
    ) : null;
  const markSaved = () => {
    saved.current = true;
  };
  return { setChanged, markSaved, dialog };
}

function useSubmit(id: string | null, after: (savedId: string) => string) {
  const navigate = useNavigate();
  const save = useSaveResident(id);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const unsaved = useUnsavedChanges();
  const submit = async (values: ResidentRequest) => {
    setSubmitError(null);
    try {
      const saved = await save.mutateAsync(values);
      unsaved.markSaved();
      void navigate(after(saved.id), { replace: id === null });
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  };
  return { save, submitError, submit, unsaved };
}

/** RES-02 Add resident (Admin/Head). */
export function AddResidentPage() {
  const { save, submitError, submit, unsaved } = useSubmit(null, (id) => `/residents/${id}`);
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <ListLink /> / Add resident
          </>
        }
        title="Add resident"
        actions={
          <>
            <Button component={RouterLink} to="/residents" disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={RESIDENT_FORM_ID} variant="contained" loading={save.isPending}>
              Save resident
            </Button>
          </>
        }
      />
      <ResidentForm
        initial={EMPTY_RESIDENT}
        submitError={submitError}
        onSubmit={submit}
        onDirtyChange={unsaved.setChanged}
      />
      {unsaved.dialog(null)}
    </>
  );
}

/** RES-04 Edit resident (Admin/Head). */
export function EditResidentPage() {
  const { id = '' } = useParams();
  const resident = useResident(id);
  const { save, submitError, submit, unsaved } = useSubmit(id, (savedId) => `/residents/${savedId}`);

  if (resident.isPending) return <LoadingBlock label="Loading resident" />;
  if (resident.isError) {
    if (resident.error instanceof ApiError && resident.error.status === 404) return <NotFoundPage />;
    return <ErrorState error={resident.error} onRetry={() => void resident.refetch()} />;
  }
  const r = resident.data;
  const back = `/residents/${r.id}`;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <ListLink /> /{' '}
            <Link component={RouterLink} to={back} color="inherit">
              {r.fullName}
            </Link>{' '}
            / Edit
          </>
        }
        title={`Edit ${r.fullName}`}
        actions={
          <>
            <Button component={RouterLink} to={back} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={RESIDENT_FORM_ID} variant="contained" loading={save.isPending}>
              Save changes
            </Button>
          </>
        }
      />
      <ResidentForm
        key={r.id}
        initial={formValues(r)}
        submitError={submitError}
        onSubmit={submit}
        onDirtyChange={unsaved.setChanged}
      />
      {unsaved.dialog(r.fullName)}
    </>
  );
}
