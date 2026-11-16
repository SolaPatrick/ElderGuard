import { useRef, useState, type PointerEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import VideocamOffOutlined from '@mui/icons-material/VideocamOffOutlined';
import { MAX_REST_ZONES, restZoneInputSchema, type Camera, type RestZoneInput } from '@elderguard/shared';
import { ApiError } from '../../api/client';
import { useCameraPicture, useRestZones, useSaveRestZones } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { useToast } from '../../components/toastContext';
import { SectionCard } from '../dashboard/DashboardCards';
import { boxBetween, isBigEnough, toFraction, type Box as ZoneBox, type Point } from './zoneGeometry';

const pct = (v: number) => `${v * 100}%`;

/** The picture to draw on: the live stream when the server sends one, otherwise the newest still. */
function usePictureToDrawOn(camera: Camera): string | null {
  const still = useCameraPicture(camera);
  const working = camera.status === 'online' || camera.status === 'paused';
  if (working && camera.liveUrl && camera.liveFormat === 'mjpeg') return camera.liveUrl;
  return still;
}

function ZoneRect({ box, name, draft = false }: { box: ZoneBox; name?: string; draft?: boolean }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: pct(box.x),
        top: pct(box.y),
        width: pct(box.width),
        height: pct(box.height),
        border: 2,
        borderStyle: draft ? 'dashed' : 'solid',
        borderColor: 'eg.comp.cameraOverlayText',
        bgcolor: 'rgba(255,255,255,0.12)',
        pointerEvents: 'none',
      }}
    >
      {name && (
        <Box
          component="span"
          sx={{
            position: 'absolute',
            top: 4,
            left: 4,
            px: 1.5,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.6)',
            color: 'eg.comp.cameraOverlayText',
            typography: 'caption',
          }}
        >
          {name}
        </Box>
      )}
    </Box>
  );
}

/** Asks for the new zone's name after it is drawn. */
function NameDialog({
  taken,
  onAdd,
  onCancel,
}: {
  taken: string[];
  onAdd: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const checked = restZoneInputSchema.shape.name.safeParse(name);
    if (!checked.success) return setError(checked.error.issues[0]?.message ?? 'Name the zone');
    if (taken.some((t) => t.toLowerCase() === checked.data.toLowerCase()))
      return setError(`There is already a zone called ${checked.data}`);
    onAdd(checked.data);
  };
  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <DialogTitle>Name this zone</DialogTitle>
        <DialogContent>
          <TextField
            label="Zone name"
            autoFocus
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!error}
            helperText={error ?? 'For example Bed, Sofa or Armchair'}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="contained">
            Add zone
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/** Draws zones on the picture: press, drag and let go. Mouse, pen and touch all work. */
function DrawingArea({
  picture,
  cameraCode,
  zones,
  canDraw,
  onDrawn,
}: {
  picture: string;
  cameraCode: string;
  zones: RestZoneInput[];
  canDraw: boolean;
  onDrawn: (box: ZoneBox) => void;
}) {
  const start = useRef<Point | null>(null);
  const [draft, setDraft] = useState<ZoneBox | null>(null);
  const at = (e: PointerEvent<HTMLDivElement>) =>
    toFraction(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canDraw || e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    start.current = at(e);
    setDraft(null);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current) setDraft(boxBetween(start.current, at(e)));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const box = boxBetween(start.current, at(e));
    start.current = null;
    setDraft(null);
    if (isBigEnough(box)) onDrawn(box);
  };

  return (
    <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'eg.comp.cameraWell' }}>
      <Box
        component="img"
        src={picture}
        alt={`Picture from ${cameraCode}`}
        draggable={false}
        sx={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none' }}
      />
      <Box
        data-testid="zone-drawing-area"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDraft(null);
        }}
        sx={{
          position: 'absolute',
          inset: 0,
          cursor: canDraw ? 'crosshair' : 'default',
          touchAction: 'none',
        }}
      >
        {zones.map((z) => (
          <ZoneRect key={z.name} box={z} name={z.name} />
        ))}
        {draft && <ZoneRect box={draft} draft />}
      </Box>
    </Box>
  );
}

/**
 * CAM-08 Rest zones (Admin/Head, not for bathroom cameras): mark where lying down is normal, such
 * as a bed or sofa. Zones are kept as shares of the picture (0 to 1), so they fit any picture size.
 */
export function RestZonesTab({ camera }: { camera: Camera }) {
  const saved = useRestZones(camera.id);
  const save = useSaveRestZones(camera.id);
  const toast = useToast();
  const picture = usePictureToDrawOn(camera);
  // Unsaved edits; null while the list is the same as the saved one.
  const [edited, setEdited] = useState<RestZoneInput[] | null>(null);
  const [pending, setPending] = useState<ZoneBox | null>(null);

  if (saved.isPending) return <LoadingBlock label="Loading rest zones" />;
  if (saved.isError) {
    if (saved.error instanceof ApiError && saved.error.status === 501)
      return (
        <Alert severity="info">
          This server can&rsquo;t keep rest zones yet, so they can&rsquo;t be drawn from the app.
        </Alert>
      );
    return <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />;
  }

  const zones: RestZoneInput[] =
    edited ?? saved.data.map(({ name, x, y, width, height }) => ({ name, x, y, width, height }));
  const full = zones.length >= MAX_REST_ZONES;
  const dirty = edited !== null;

  const onSave = () =>
    save.mutate(
      { zones },
      {
        onSuccess: () => {
          setEdited(null);
          toast({ message: `Rest zones saved for ${camera.code}` });
        },
      },
    );

  return (
    <Grid container spacing={5}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Mark where residents lie down to rest, such as a bed or sofa, so fall detection can tell resting
            from a fall. Press on the picture, drag over the area and let go, then name it.
          </Typography>
          {picture ? (
            <DrawingArea
              picture={picture}
              cameraCode={camera.code}
              zones={zones}
              canDraw={!full && !save.isPending}
              onDrawn={setPending}
            />
          ) : (
            <Box
              sx={{
                aspectRatio: '16 / 9',
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                alignContent: 'center',
                gap: 2,
                bgcolor: 'eg.comp.cameraWell',
                color: 'eg.comp.cameraOverlayText',
                p: 4,
                textAlign: 'center',
              }}
            >
              <VideocamOffOutlined sx={{ fontSize: 48 }} aria-hidden />
              <Typography variant="body2">
                {camera.code} isn&rsquo;t sending a picture right now, so zones can&rsquo;t be drawn. Saved
                zones are listed here and can still be deleted.
              </Typography>
            </Box>
          )}
          {full && (
            <Typography variant="body2" color="text.secondary">
              A camera can have at most {MAX_REST_ZONES} rest zones. Delete one to draw another.
            </Typography>
          )}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <SectionCard title={`Zones (${zones.length})`}>
          {save.error && (
            <Alert severity="error" role="alert" sx={{ mb: 3 }}>
              {errorMessage(save.error)}
            </Alert>
          )}
          {zones.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              No rest zones yet.
            </Typography>
          ) : (
            <List dense disablePadding aria-label="Rest zones" sx={{ mb: 3 }}>
              {zones.map((z) => (
                <ListItem
                  key={z.name}
                  disableGutters
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label={`Delete ${z.name}`}
                      disabled={save.isPending}
                      onClick={() => setEdited(zones.filter((other) => other !== z))}
                    >
                      <DeleteOutlined />
                    </IconButton>
                  }
                >
                  <ListItemText primary={z.name} />
                </ListItem>
              ))}
            </List>
          )}
          {dirty && (
            <Typography variant="body2" color="warning.main" role="status" sx={{ mb: 3 }}>
              Changes not saved yet.
            </Typography>
          )}
          <Stack direction="row" spacing={3}>
            <Button variant="contained" loading={save.isPending} disabled={!dirty} onClick={onSave}>
              Save
            </Button>
            <Button disabled={!dirty || save.isPending} onClick={() => setEdited(null)}>
              Undo changes
            </Button>
          </Stack>
        </SectionCard>
      </Grid>
      {pending && (
        <NameDialog
          taken={zones.map((z) => z.name)}
          onCancel={() => setPending(null)}
          onAdd={(name) => {
            setEdited([...zones, { ...pending, name }]);
            setPending(null);
          }}
        />
      )}
    </Grid>
  );
}
