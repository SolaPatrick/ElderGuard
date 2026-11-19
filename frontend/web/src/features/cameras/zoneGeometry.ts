import { MIN_REST_ZONE_SIZE, type ZonePoint } from '@elderguard/shared';

export type Point = ZonePoint;

/** The rectangle shown while dragging out a new zone. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Four decimals is a tenth of a pixel on a 1000-pixel picture: plenty, and easy to read in the API. */
const round = (v: number) => Math.round(v * 10_000) / 10_000;

/** Where a pointer is on the picture, as shares of its width and height. Outside the picture counts as its edge. */
export function toFraction(clientX: number, clientY: number, rect: DOMRectReadOnly): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: round(clamp((clientX - rect.left) / rect.width)),
    y: round(clamp((clientY - rect.top) / rect.height)),
  };
}

/** The rectangle between two corners, whichever way the pointer was dragged. */
export function boxBetween(a: Point, b: Point): Box {
  const x = round(Math.min(a.x, b.x));
  const y = round(Math.min(a.y, b.y));
  return {
    x,
    y,
    width: round(Math.min(Math.abs(a.x - b.x), 1 - x)),
    height: round(Math.min(Math.abs(a.y - b.y), 1 - y)),
  };
}

/** A tiny box is a click or a slip of the mouse, not a zone. */
export const isBigEnough = (box: Box) => box.width >= MIN_REST_ZONE_SIZE && box.height >= MIN_REST_ZONE_SIZE;

/**
 * The 6 dots a drawn rectangle becomes, in order around its edge: the 4 corners, plus one in the middle of
 * each long side (a bed seen at an angle usually needs its long sides bent or slanted).
 */
export function dotsFromBox({ x, y, width, height }: Box): Point[] {
  const [r, b] = [round(x + width), round(y + height)];
  const [mx, my] = [round(x + width / 2), round(y + height / 2)];
  return width >= height
    ? [
        { x, y },
        { x: mx, y },
        { x: r, y },
        { x: r, y: b },
        { x: mx, y: b },
        { x, y: b },
      ]
    : [
        { x, y },
        { x: r, y },
        { x: r, y: my },
        { x: r, y: b },
        { x, y: b },
        { x, y: my },
      ];
}

/** Moves a dot by a small step (arrow keys), staying inside the picture. */
export const nudge = (p: Point, dx: number, dy: number): Point => ({
  x: round(clamp(p.x + dx)),
  y: round(clamp(p.y + dy)),
});

/** The SVG "points" attribute for a shape, scaled to a picture of w × h. */
export const svgPoints = (points: Point[], w = 1, h = 1) =>
  points.map((p) => `${round(p.x * w)},${round(p.y * h)}`).join(' ');
