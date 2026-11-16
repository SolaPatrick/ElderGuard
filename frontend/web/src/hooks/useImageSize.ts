import { useEffect, useState, type RefObject } from 'react';

/**
 * The picture's own size in pixels, once it is known. An MJPEG stream may never fire "load", so this
 * also checks every half second until the first frame has arrived.
 */
export function useImageSize(img: RefObject<HTMLImageElement | null>, src: string | null) {
  // Kept with the picture it belongs to, so a new picture never shows the old one's size.
  const [found, setFound] = useState<{ src: string; width: number; height: number } | null>(null);
  useEffect(() => {
    if (!src) return;
    const read = () => {
      const el = img.current;
      if (!el || el.naturalWidth <= 0 || el.naturalHeight <= 0) return false;
      const { naturalWidth: width, naturalHeight: height } = el;
      setFound((old) =>
        old && old.src === src && old.width === width && old.height === height ? old : { src, width, height },
      );
      return true;
    };
    const first = window.setTimeout(read, 0);
    const id = window.setInterval(() => read() && window.clearInterval(id), 500);
    const el = img.current;
    const onLoad = () => void read();
    el?.addEventListener('load', onLoad);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      el?.removeEventListener('load', onLoad);
    };
  }, [img, src]);
  return found && found.src === src ? { width: found.width, height: found.height } : null;
}
