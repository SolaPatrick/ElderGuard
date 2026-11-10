import { useMutation } from '@tanstack/react-query';
import type { Camera } from '@elderguard/shared';
import { api } from '../../api/endpoints';

/** "CAM-21 2026-11-10 14-41-08.jpg", in local time. Characters a file name can't hold become "-". */
export function snapshotFileName(cameraCode: string, at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}`;
  const code = cameraCode.replace(/[^\w .-]/g, '-').trim() || 'camera';
  return `${code} ${date} ${time}.jpg`;
}

/** Saves a picture to the user's Downloads folder. */
export function saveSnapshot(blob: Blob, cameraCode: string, at: Date = new Date()): string {
  const name = snapshotFileName(cameraCode, at);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // The download has started by now; give the browser a moment before freeing the picture.
  window.setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  return name;
}

/** MON-02 Snapshot: downloads the camera's newest picture and saves it as a JPEG. */
export function useCameraSnapshot() {
  return useMutation({
    mutationFn: async (camera: Camera) => saveSnapshot(await api.cameraPicture(camera.id), camera.code),
  });
}
