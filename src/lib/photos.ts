export const MAX_PHOTO_BYTES = 400 * 1024;

/** URL clients should use for a counselor's picture: uploaded photo wins over an external link. */
export function effectivePhotoUrl(c: {
  id: string;
  photoUrl?: string | null;
  photoUpdatedAt?: Date | null;
}) {
  if (c.photoUpdatedAt) return `/api/counselors/${c.id}/photo?v=${c.photoUpdatedAt.getTime()}`;
  return c.photoUrl ?? null;
}

/** Decode a `data:image/jpeg;base64,...` string produced by the browser-side resizer. */
export function parsePhotoDataUrl(dataUrl: string): { data: Buffer; contentType: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const data = Buffer.from(m[2], "base64");
  if (data.length === 0 || data.length > MAX_PHOTO_BYTES) return null;
  return { data, contentType: m[1] };
}
