// Bakes the transition speed ramp (server/src/config/speedRamp.js) into every
// transition video that doesn't have a `_ramped` variant yet, and patches the
// matching `ramped*` URL fields on transitions / hotspots / multi-video
// segments.
//
// Clips are baked IN PARALLEL (several FFmpeg jobs at once), so a full run
// finishes far faster than one-at-a-time. Tune with --jobs=N.
//
//   node scripts/bake-speed-ramps.mjs             # bake missing variants only
//   node scripts/bake-speed-ramps.mjs --force     # re-bake EVERYTHING
//                                                 # (run this after editing the ramp)
//   node scripts/bake-speed-ramps.mjs --jobs=4    # cap parallelism at 4
//
// Requires FFmpeg on PATH (or FFMPEG_PATH in .env), like the server itself.
// Run from server/.
import 'dotenv/config';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const FORCE = process.argv.includes('--force');
const JOBS = (() => {
  const arg = process.argv.find((a) => a.startsWith('--jobs='));
  const n = arg ? parseInt(arg.split('=')[1], 10) : 0;
  if (n > 0) return n;
  // Conservative default. Each bake is a 4K H.264 encode with motion blur
  // (fps oversampling + tmix buffering several 4K frames) — already
  // multi-threaded and RAM-hungry, so a handful in parallel exhausts memory
  // and FFmpeg crashes at frame 0. 2 overlaps I/O with compute without that.
  // Bump with --jobs=N only if you have lots of free RAM (~2 GB per job).
  return Math.max(1, Math.min(os.cpus().length, 2));
})();

await mongoose.connect(process.env.MONGO_URI);
const { default: Project } = await import('../src/models/Project.js');
const { bakeSpeedRamp, rampedPathFor } = await import(
  '../src/controllers/mediaController.js'
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

const urlToPath = (url) =>
  path.join(UPLOADS_ROOT, url.slice('/uploads/'.length));
const toPublicUrl = (filePath) =>
  `/uploads/${path.relative(UPLOADS_ROOT, filePath).replace(/\\/g, '/')}`;
const isRampedUrl = (url) => /_ramped(-[0-9a-f]+)?\.[^.]+$/.test(url);

// Delete every generated variant of a source clip EXCEPT the current-hash
// ramped file: old-hash `_ramped-xxxx` files from previous ramp configs,
// no-hash `_ramped` files, obsolete `_fast4` variants and `.stabilized`
// markers from removed pipelines. Nothing in code or DB references them (the
// DB is repointed to the current hash by this script) — they only bloat
// uploads/ with dead 4K video. Returns bytes freed.
let staleBytesFreed = 0;
let staleFilesRemoved = 0;
function cleanStaleVariants(inputPath) {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const keep = path.basename(rampedPathFor(inputPath));
  for (const name of fs.readdirSync(dir)) {
    if (name === keep) continue;
    const isStale =
      name.startsWith(`${base}_ramped`) || // old-hash + no-hash ramped
      name.startsWith(`${base}_fast`) || // obsolete 4x fast variants
      name === `${base}${ext}.stabilized`; // stabilization-era marker
    if (!isStale) continue;
    const p = path.join(dir, name);
    try {
      staleBytesFreed += fs.statSync(p).size;
      fs.unlinkSync(p);
      staleFilesRemoved++;
    } catch (err) {
      console.warn(`  could not remove stale ${name}: ${err.message}`);
    }
  }
}

// Bake one source URL → its ramped URL ('' when missing on disk or FFmpeg
// failed). No dedup here — callers pass each unique URL exactly once.
async function bakeOne(url) {
  const inputPath = urlToPath(url);
  if (!fs.existsSync(inputPath)) {
    console.warn(`  missing on disk, skipped: ${url}`);
    return '';
  }
  // Name carries the ramp hash — after a ramp edit this path doesn't exist
  // yet, so it re-bakes and the new URL busts the browser cache.
  const expected = rampedPathFor(inputPath);
  if (!FORCE && fs.existsSync(expected)) {
    cleanStaleVariants(inputPath);
    return toPublicUrl(expected); // done on a previous run
  }
  try {
    console.log(`  baking: ${url}`);
    const out = toPublicUrl(await bakeSpeedRamp(inputPath));
    console.log(`  done:   ${url}`);
    cleanStaleVariants(inputPath);
    return out;
  } catch (err) {
    console.error(`  FFmpeg failed for ${url}: ${err.message}`);
    return '';
  }
}

// Run `worker` over `items` with at most `concurrency` in flight at once.
async function runPool(items, concurrency, worker) {
  const queue = [...items];
  const runners = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      while (queue.length) await worker(queue.shift());
    },
  );
  await Promise.all(runners);
}

const projects = await Project.find();
console.log(
  `Scanning ${projects.length} project(s)…${FORCE ? ' (--force)' : ''} [${JOBS} parallel job(s)]`,
);

// ── Phase 1: collect every unique bakeable source URL across all projects ──
const srcUrls = new Set();
const consider = (url) => {
  if (url && url.startsWith('/uploads/') && !isRampedUrl(url)) srcUrls.add(url);
};
for (const project of projects) {
  for (const [, t] of project.transitions) {
    consider(t.videoUrl);
    consider(t.reverseVideoUrl);
  }
  for (const node of project.nodes.values()) {
    for (const hs of node.navigationHotspots) {
      consider(hs.transitionVideoUrl);
      consider(hs.reverseTransitionVideoUrl);
      for (const item of hs.transitionVideos || []) {
        consider(item.videoUrl);
        consider(item.reverseVideoUrl);
      }
    }
  }
}
console.log(`${srcUrls.size} unique source clip(s) to process.`);

// ── Phase 2: bake them in parallel → source url → ramped url ──
const rampedUrlCache = new Map();
await runPool([...srcUrls], JOBS, async (url) => {
  rampedUrlCache.set(url, await bakeOne(url));
});

// ── Phase 3: patch the DB fields from the baked results and save ──
const lookup = (url) => (url ? rampedUrlCache.get(url) || '' : '');
function patch(obj, srcField, rampedField) {
  if (!obj?.[srcField]) return false;
  const rampedUrl = lookup(obj[srcField]);
  if (!rampedUrl || obj[rampedField] === rampedUrl) return false;
  obj[rampedField] = rampedUrl;
  return true;
}

for (const project of projects) {
  let changed = false;

  for (const [id, transition] of project.transitions) {
    let tChanged = false;
    if (patch(transition, 'videoUrl', 'rampedVideoUrl')) tChanged = true;
    if (patch(transition, 'reverseVideoUrl', 'reverseRampedVideoUrl'))
      tChanged = true;
    if (tChanged) {
      project.transitions.set(id, transition);
      changed = true;
    }
  }

  for (const node of project.nodes.values()) {
    for (const hs of node.navigationHotspots) {
      if (patch(hs, 'transitionVideoUrl', 'rampedTransitionVideoUrl'))
        changed = true;
      if (
        patch(
          hs,
          'reverseTransitionVideoUrl',
          'reverseRampedTransitionVideoUrl',
        )
      )
        changed = true;
      for (const item of hs.transitionVideos || []) {
        if (patch(item, 'videoUrl', 'rampedVideoUrl')) changed = true;
        if (patch(item, 'reverseVideoUrl', 'reverseRampedVideoUrl'))
          changed = true;
      }
    }
  }

  if (changed) {
    project.markModified('nodes');
    project.markModified('transitions');
    await project.save();
    console.log(`Project ${project._id} ("${project.info?.title}") — saved.`);
  }
}

console.log(
  `Done. ${rampedUrlCache.size} unique clip(s) processed; removed ${staleFilesRemoved} stale variant file(s) (${(staleBytesFreed / 1024 / 1024).toFixed(0)} MB freed).`,
);
await mongoose.disconnect();
