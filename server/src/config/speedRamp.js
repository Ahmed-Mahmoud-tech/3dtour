// ═══════════════════════════════════════════════════════════════════════════
// TRANSITION SPEED RAMP — THIS IS THE FILE TO EDIT
// ═══════════════════════════════════════════════════════════════════════════
// The wave is BAKED INTO the video files by FFmpeg on upload (a `_ramped`
// copy of every transition clip, forward and reverse). The viewer always
// plays those files at normal 1x speed, so playback is identical in every
// browser — no runtime speed logic exists in the frontend.
//
// Keyframes: `at` = position in the clip (0 = start, 1 = end), `rate` =
// playback speed there (1 = normal, 10 = 10x fast). Points in between are
// smoothly (cosine) interpolated into one continuous wave. Add/remove points
// freely; `at` values must increase from 0 to 1, rates must be > 0.
//
// AFTER CHANGING THIS FILE:
//   - new uploads use it automatically (restart the server first)
//   - re-bake existing videos:  cd server && node scripts/bake-speed-ramps.mjs --force
export const SPEED_RAMP = [
  { at: 0.0, rate: 1 },
  { at: 0.15, rate: 10 },
  { at: 0.35, rate: 8 },
  { at: 0.65, rate: 6 },
  { at: 0.85, rate: 3 },
  { at: 1.0, rate: 1 },
];

// Frame rate of the baked output files.
export const RAMP_OUTPUT_FPS = 30;

/** Speed at clip progress p (0–1): cosine interpolation between keyframes */
export const rampRateAt = (p) => {
  const pts = SPEED_RAMP;
  if (p <= pts[0].at) return pts[0].rate;
  for (let i = 1; i < pts.length; i++) {
    if (p <= pts[i].at) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = (p - a.at) / (b.at - a.at || 1);
      const s = 0.5 - 0.5 * Math.cos(Math.PI * t);
      return a.rate + (b.rate - a.rate) * s;
    }
  }
  return pts[pts.length - 1].rate;
};
