import { useState } from 'react';
import { Button, Link } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useCameraSettings, useCameras, useSaveCamera } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { NotFoundPage } from '../system/NotFoundPage';
import { CAMERA_FORM_ID, CameraForm } from './CameraForm';

const ListLink = () => (
  <Link component={RouterLink} to="/cameras" color="inherit">
    Cameras &amp; Devices
  </Link>
);

/** CAM-02 Register camera. */
export function RegisterCameraPage() {
  const navigate = useNavigate();
  const cameras = useCameras();
  const save = useSaveCamera(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (cameras.isPending) return <LoadingBlock label="Loading cameras" />;
  if (cameras.isError) return <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <ListLink /> / Register camera
          </>
        }
        title="Register camera"
        actions={
          <>
            <Button component={RouterLink} to="/cameras" disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={CAMERA_FORM_ID} variant="contained" loading={save.isPending}>
              Register camera
            </Button>
          </>
        }
      />
      <CameraForm
        cameras={cameras.data}
        initial={{
          code: '',
          source: '',
          roomId: '',
          place: 'room',
          privacyBlur: 'off',
          detectionEnabled: true,
        }}
        submitError={submitError}
        onSubmit={async (values) => {
          setSubmitError(null);
          try {
            const saved = await save.mutateAsync(values);
            void navigate(`/cameras/${saved.id}`, { replace: true });
          } catch (err) {
            setSubmitError(errorMessage(err));
          }
        }}
      />
    </>
  );
}

/** CAM-04 Edit camera configuration (and CAM-05: moving it to another room). */
export function EditCameraPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const cameras = useCameras();
  const settings = useCameraSettings(id);
  const save = useSaveCamera(id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (settings.isPending || cameras.isPending) return <LoadingBlock label="Loading camera" />;
  if (settings.isError) {
    if (settings.error instanceof ApiError && settings.error.status === 404) return <NotFoundPage />;
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  }
  if (cameras.isError) return <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />;

  const s = settings.data;
  const back = `/cameras/${s.id}`;
  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <ListLink /> /{' '}
            <Link component={RouterLink} to={back} color="inherit">
              {s.code}
            </Link>{' '}
            / Edit
          </>
        }
        title={`Edit ${s.code}`}
        actions={
          <>
            <Button component={RouterLink} to={back} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={CAMERA_FORM_ID} variant="contained" loading={save.isPending}>
              Save changes
            </Button>
          </>
        }
      />
      <CameraForm
        key={s.id}
        cameras={cameras.data}
        editingId={s.id}
        initial={{
          code: s.code,
          source: s.source,
          roomId: s.roomId ?? '',
          place: s.place,
          privacyBlur: s.privacyBlur,
          detectionEnabled: s.detectionEnabled,
        }}
        submitError={submitError}
        onSubmit={async (values) => {
          setSubmitError(null);
          try {
            await save.mutateAsync(values);
            void navigate(back);
          } catch (err) {
            setSubmitError(errorMessage(err));
          }
        }}
      />
    </>
  );
}
