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
// ⚠ EDITING A RATE ABOVE DOES NOTHING UNTIL YOU RE-BAKE. The speed lives in
// the baked video files, not in the viewer. To make a change take effect:
//   1. make sure MongoDB is running
//   2. cd server && node scripts/bake-speed-ramps.mjs
//      (the baked filename includes a hash of these settings, so this run
//       detects the change, re-bakes, and the new URLs bypass browser cache —
//       no --force and no hard-refresh needed)
//   3. restart the server so new uploads use the edited ramp
//
// ── THE CONTROLS ──
// `speedRate` is the master knob: it multiplies the WHOLE wave below.
// The wave takes off at real speed, cruises at 4x, brakes back to real
// speed — at 60fps output that cruise hits the blending sweet spot:
//
// RULE OF THUMB (30fps sources → 60fps output): a steady rate blends
// uniformly only when rate/2 is a whole number — 2x, 4x, 6x, 8x. Rates in
// between (3x, 5x…) make output frames ALTERNATE between blurred blends
// and sharp single frames, which plays back as visible shimmer; and the
// higher the rate, the farther each displayed frame jumps (4x ≈ 2 source
// frames per displayed frame is comfortably smooth; 8x+ reads as steps).
// So pick speedRate so the cruise lands on an even rate:
//   1 = 4x cruise (default, smoothest), 1.5 = 6x, 2 = 8x (fast, stepped).
// Each keyframe's `scaled(base)` sets the wave SHAPE: the speed at that
// point is base × speedRate, floored at 1x — slow motion (rate < 1)
// judders (see RAMP_MOTION_BLUR note below), so it's never emitted.
const speedRate = 1.5;
const scaled = (base) => Math.max(1, base * speedRate);
export const SPEED_RAMP = [
  { at: 0.0, rate: scaled(1) }, // take-off at real speed
  { at: 0.15, rate: scaled(4) }, // cruise (uniform 2-frame blend @60fps)
  { at: 0.35, rate: scaled(4) },
  { at: 0.65, rate: scaled(4) },
  { at: 0.85, rate: scaled(2) }, // braking (1 source frame per frame)
  { at: 1.0, rate: scaled(1) }, // landing at real speed
];
// export const SPEED_RAMP = [
//   { at: 0.0, rate: scaled(1) }, // take-off at real speed
//   { at: 0.15, rate: scaled(4) }, // cruise (uniform 2-frame blend @60fps)
//   { at: 0.35, rate: scaled(4) },
//   { at: 0.65, rate: scaled(4) },
//   { at: 0.85, rate: scaled(2) }, // braking (1 source frame per frame)
//   { at: 1.0, rate: scaled(1) }, // landing at real speed
// ];

// Frame rate of the baked output files. 60, not 30: sped-up footage is only
// as smooth as the display cadence — at 30fps each displayed frame covers
// twice the camera travel and the glide turns into visible steps. Every
// browser plays 60fps H.264.
export const RAMP_OUTPUT_FPS = 60;

// Motion blur — how smooth fast parts look. Speeding video up leaves gaps
// between frames (that's the "roughness"); the baker oversamples the sped-up
// timeline this many times per output frame and averages the samples into
// ONE continuous streak per frame (like a real camera shutter).
// 8 = smooth blur; lower values leave visible discrete ghost copies at high
// speed; 1 = off. Automatically DISABLED when the ramp never goes above
// ~1.5x (blur is pointless at normal speed, clips come out clean).
// NOTE: this only smooths SPEED-UPS (rate > 1). It cannot smooth slow-motion
// (rate < 1) — a ramp with rates below 1x will still judder; keep rates >= 1x.
export const RAMP_MOTION_BLUR = 8;

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
