import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
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
import {
  MAX_REST_ZONES,
  restZoneInputSchema,
  zoneBounds,
  type Camera,
  type RestZoneInput,
} from '@elderguard/shared';
import { ApiError } from '../../api/client';
import { useCameraPicture, useRestZones, useSaveRestZones } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { useToast } from '../../components/toastContext';
import { SectionCard } from '../dashboard/DashboardCards';
import {
  boxBetween,
  dotsFromBox,
  isBigEnough,
  nudge,
  svgPoints,
  toFraction,
  type Box as ZoneBox,
  type Point,
} from './zoneGeometry';

const pct = (v: number) => `${v * 100}%`;
/** Arrow keys move a dot this share of the picture; with Shift, four times as far. */
const KEY_STEP = 0.005;

/** The picture to draw on: the live stream when the server sends one, otherwise the newest still. */
function usePictureToDrawOn(camera: Camera): string | null {
  const still = useCameraPicture(camera);
  const working = camera.status === 'online' || camera.status === 'paused';
  if (working && camera.liveUrl && camera.liveFormat === 'mjpeg') return camera.liveUrl;
  return still;
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

/**
 * Draws zones on the picture: press, drag and let go for a new zone, which becomes 6 dots. Each dot can then
 * be dragged (or moved with the arrow keys) so the shape fits the bed. Mouse, pen and touch all work.
 */
function DrawingArea({
  picture,
  cameraCode,
  zones,
  canDraw,
  canEdit,
  onDrawn,
  onMoveDot,
}: {
  picture: string;
  cameraCode: string;
  zones: RestZoneInput[];
  canDraw: boolean;
  canEdit: boolean;
  onDrawn: (box: ZoneBox) => void;
  onMoveDot: (zone: number, dot: number, to: Point) => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const start = useRef<Point | null>(null);
  const moving = useRef<{ zone: number; dot: number } | null>(null);
  const [draft, setDraft] = useState<ZoneBox | null>(null);
  const at = (e: PointerEvent<HTMLElement>) =>
    toFraction(e.clientX, e.clientY, area.current!.getBoundingClientRect());

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

  const dotDown = (zone: number, dot: number) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation(); // moving a dot, not drawing a new zone
    if (!canEdit || e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    moving.current = { zone, dot };
  };
  const dotMove = (zone: number, dot: number) => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (moving.current?.zone === zone && moving.current.dot === dot) onMoveDot(zone, dot, at(e));
  };
  const dotUp = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    moving.current = null;
  };
  const dotKey = (zone: number, dot: number, p: Point) => (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = by[e.key];
    if (!d || !canEdit) return;
    e.preventDefault();
    onMoveDot(zone, dot, nudge(p, d[0], d[1]));
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
        ref={area}
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
          color: 'eg.comp.cameraOverlayText',
        }}
      >
        <Box
          component="svg"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          aria-hidden
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {zones.map((z) => (
            <polygon
              key={z.name}
              data-testid={`zone-shape-${z.name}`}
              points={svgPoints(z.points)}
              fill="rgba(255,255,255,0.12)"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {draft && (
            <rect
              x={draft.x}
              y={draft.y}
              width={draft.width}
              height={draft.height}
              fill="rgba(255,255,255,0.12)"
              stroke="currentColor"
              strokeWidth={2}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </Box>
        {zones.map((z) => {
          const b = zoneBounds(z.points);
          return (
            <Box
              key={z.name}
              component="span"
              sx={{
                position: 'absolute',
                left: pct(b.x),
                top: pct(b.y),
                m: 1,
                px: 1.5,
                borderRadius: 1,
                bgcolor: 'rgba(0,0,0,0.6)',
                typography: 'caption',
                pointerEvents: 'none',
              }}
            >
              {z.name}
            </Box>
          );
        })}
        {zones.map((z, zi) =>
          z.points.map((p, di) => (
            <Box
              key={`${z.name}-${di}`}
              role="button"
              tabIndex={canEdit ? 0 : -1}
              aria-label={`Dot ${di + 1} of ${z.name}`}
              aria-disabled={!canEdit}
              onPointerDown={dotDown(zi, di)}
              onPointerMove={dotMove(zi, di)}
              onPointerUp={dotUp}
              onPointerCancel={dotUp}
              onKeyDown={dotKey(zi, di, p)}
              sx={{
                position: 'absolute',
                left: pct(p.x),
                top: pct(p.y),
                width: 16,
                height: 16,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: 2,
                borderColor: 'common.white',
                bgcolor: 'primary.main',
                boxShadow: 2,
                cursor: canEdit ? 'grab' : 'default',
                touchAction: 'none',
                '&:active': { cursor: canEdit ? 'grabbing' : 'default' },
                '&:focus-visible': { outline: 3, outlineColor: 'common.white', outlineOffset: 2 },
              }}
            />
          )),
        )}
      </Box>
    </Box>
  );
}

/**
 * CAM-08 Rest zones (Admin/Head, not for bathroom cameras): mark where lying down is normal, such
 * as a bed or sofa. Zones are shapes of dots kept as shares of the picture (0 to 1), so they fit any
 * picture size.
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

  const zones: RestZoneInput[] = edited ?? saved.data.map(({ name, points }) => ({ name, points }));
  const full = zones.length >= MAX_REST_ZONES;
  const dirty = edited !== null;
  // A dot dragged so the lines cross, or a shape squeezed too small: say which zone, and don't save it.
  const problems = zones.flatMap((z) => {
    const checked = restZoneInputSchema.safeParse(z);
    return checked.success ? [] : [`${z.name}: ${checked.error.issues[0]?.message ?? 'not a valid zone'}`];
  });

  const moveDot = (zone: number, dot: number, to: Point) =>
    setEdited(
      zones.map((z, zi) =>
        zi === zone ? { ...z, points: z.points.map((p, di) => (di === dot ? to : p)) } : z,
      ),
    );

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
            from a fall. Press on the picture, drag over the area and let go, then name it. Then drag the 6
            dots so the shape fits the bed. Keep the floor around the bed outside the shape.
          </Typography>
          {picture ? (
            <DrawingArea
              picture={picture}
              cameraCode={camera.code}
              zones={zones}
              canDraw={!full && !save.isPending}
              canEdit={!save.isPending}
              onDrawn={setPending}
              onMoveDot={moveDot}
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
          {problems.length > 0 && (
            <Alert severity="warning" role="alert" sx={{ mb: 3 }}>
              {problems.join(' ')}
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
            <Button
              variant="contained"
              loading={save.isPending}
              disabled={!dirty || problems.length > 0}
              onClick={onSave}
            >
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
            setEdited([...zones, { name, points: dotsFromBox(pending) }]);
            setPending(null);
          }}
        />
      )}
    </Grid>
  );
}
