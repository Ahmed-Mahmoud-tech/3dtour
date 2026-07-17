/**
 * Tiny color helpers for tinting markers from a stored hex color.
 * Duplicated in client/ and admin/ (like coordUtils) — keep both in sync.
 */

/** "#rrggbb" → "rgba(r,g,b,a)"; falls back to white on bad input. */
export function hexToRgba(hex, alpha = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return `rgba(255,255,255,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Darken "#rrggbb" toward black by factor 0–1 (for gradient bottoms). */
export function darkenHex(hex, factor = 0.4) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const d = (c) => Math.round(c * (1 - factor));
  const r = d((n >> 16) & 255);
  const g = d((n >> 8) & 255);
  const b = d(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
