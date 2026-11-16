import { MIN_REST_ZONE_SIZE, type RestZoneInput } from '@elderguard/shared';

export interface Point {
  /** 0 at the left edge of the picture, 1 at the right. */
  x: number;
  /** 0 at the top edge of the picture, 1 at the bottom. */
  y: number;
}

export type Box = Omit<RestZoneInput, 'name'>;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Four decimals is a tenth of a pixel on a 1000-pixel picture: plenty, and easy to read in the API. */
const round = (v: number) => Math.round(v * 10_000) / 10_000;

/** Where a pointer is on the picture, as shares of its width and height. Outside the picture counts as its edge. */
export function toFraction(clientX: number, clientY: number, rect: DOMRectReadOnly): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
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
