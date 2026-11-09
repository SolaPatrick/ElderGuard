import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';

/**
 * A button that only fires after it has been held down for `holdMs`
 * (mouse, touch, or Space/Enter on the keyboard). Letting go early cancels.
 * Used for SOS so a stray tap never alerts the whole staff.
 */
export function HoldToConfirmButton({
  holdMs,
  onConfirm,
  disabled = false,
  icon,
  label,
  hint,
}: {
  holdMs: number;
  onConfirm: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  hint: string;
}) {
  /** When the current hold started (performance.now()), or null when not held. */
  const [holdStart, setHoldStart] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  });

  useEffect(() => {
    if (holdStart === null) return;
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - holdStart) / holdMs);
      setProgress(p);
      if (p >= 1) {
        setHoldStart(null);
        setProgress(0);
        confirmRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Letting go (or the dialog closing) cancels the hold.
    return () => cancelAnimationFrame(frame);
  }, [holdStart, holdMs]);

  const start = () => {
    if (disabled || holdStart !== null) return;
    setHoldStart(performance.now());
  };
  const stop = () => {
    setHoldStart(null);
    setProgress(0);
  };

  const holding = holdStart !== null;
  const secondsLeft = ((1 - progress) * holdMs) / 1000;

  return (
    <ButtonBase
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') stop();
      }}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${label}. ${hint}`}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        minHeight: 72,
        borderRadius: 2,
        bgcolor: 'eg.comp.sosFill',
        color: 'eg.comp.sosLabel',
        touchAction: 'none',
        userSelect: 'none',
        '&.Mui-disabled': { opacity: 0.5 },
        '&.Mui-focusVisible': { outline: 3, outlineColor: 'eg.sys.primary', outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          width: `${progress * 100}%`,
          bgcolor: 'rgba(0,0,0,0.25)',
        }}
      />
      <Box sx={{ position: 'relative', display: 'grid', justifyItems: 'center', py: 3, px: 4 }}>
        <Typography component="span" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
          {icon}
          {holding ? `Keep holding… ${secondsLeft.toFixed(1)} s` : label}
        </Typography>
        <Typography component="span" variant="caption">
          {holding ? `${Math.round(progress * 100)}% · release to cancel` : hint}
        </Typography>
      </Box>
    </ButtonBase>
  );
}
