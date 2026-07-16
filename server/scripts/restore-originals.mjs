// Repairs the July 2026 frame-corruption in served transition videos: a past
// optimization run produced transcodes with periodic TIME-MISPLACED frames
// (every ~4th frame showed content from ~0.5s away → visible stutter at any
// playback speed). Today's optimizer is clean, so:
//
//   1. every DB-referenced forward clip with a preserved master in
//      uploads/_originals is re-optimized from that master (same filename,
//      URLs stay valid);
//   2. clips WITHOUT a master (uploaded while the upload path discarded
//      originals) are salvaged in place: the misplaced frames are detected
//      from the frame-difference signature (isolated spike pairs), dropped,
//      and the survivors re-timed evenly;
//   3. every DB-referenced reverse clip is regenerated from its restored
//      forward clip (reverses were derived from corrupted files).
//
// Run AFTER this from server/:  node scripts/bake-speed-ramps.mjs
// (BAKE_VERSION 3 gives the re-bake fresh cache-busting filenames.)
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import ffmpeg from 'fluent-ffmpeg';

await mongoose.connect(process.env.MONGO_URI);
const { default: Project } = await import('../src/models/Project.js');
const { optimizeVideoInPlace, probeVideo } = await import(
  '../src/utils/mediaOptimizer.js'
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');
const ORIGINALS_DIR = path.join(UPLOADS_ROOT, '_originals');
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

const urlToPath = (url) =>
  path.join(UPLOADS_ROOT, url.slice('/uploads/'.length));
const isRampedUrl = (url) => /_ramped(-[0-9a-f]+)?\.[^.]+$/.test(url);

// ── Collect referenced forward/reverse URL pairs from all projects ──────────
const forwardUrls = new Set();
const reversePairs = new Map(); // reverseUrl -> forwardUrl it derives from
const consider = (fwd, rev) => {
  if (fwd && fwd.startsWith('/uploads/') && !isRampedUrl(fwd))
    forwardUrls.add(fwd);
  if (rev && rev.startsWith('/uploads/') && !isRampedUrl(rev) && fwd)
    reversePairs.set(rev, fwd);
};
const projects = await Project.find();
for (const project of projects) {
  for (const [, t] of project.transitions) consider(t.videoUrl, t.reverseVideoUrl);
  for (const node of project.nodes.values())
    for (const hs of node.navigationHotspots) {
      consider(hs.transitionVideoUrl, hs.reverseTransitionVideoUrl);
      for (const item of hs.transitionVideos || [])
        consider(item.videoUrl, item.reverseVideoUrl);
    }
}
console.log(
  `${forwardUrls.size} forward clip(s), ${reversePairs.size} reverse clip(s) referenced.`,
);

// ── Frame-difference series (signalstats YDIF) of a video ──────────────────
// movie= chokes on drive-letter colons, so run ffprobe from the file's dir.
function ydifSeries(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      FFPROBE,
      [
        '-v', 'error',
        '-f', 'lavfi',
        '-i', `movie=${path.basename(filePath)},signalstats`,
        '-show_entries', 'frame_tags=lavfi.signalstats.YDIF',
        '-of', 'csv=p=0',
      ],
      { cwd: path.dirname(filePath), maxBuffer: 32 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(
          stdout
            .split(/\r?\n/)
            .filter(Boolean)
            .map((l) => parseFloat(l)),
        );
      },
    );
  });
}

// Misplaced frame f shows up as spikes on BOTH sides: d[f] and d[f+1] big
// while the surroundings are small. Returns the 0-based frame indexes.
function detectMisplacedFrames(d) {
  const sorted = [...d].filter((x) => x > 0).sort((a, b) => a - b);
  if (sorted.length < 12) return [];
  const lo = sorted[Math.floor(sorted.length * 0.25)];
  const hi = sorted[Math.floor(sorted.length * 0.95)];
  if (hi < lo * 2.5) return []; // no bimodal split → clip looks healthy
  const thr = (lo + hi) / 2;
  const big = d.map((x) => x > thr);
  const bad = [];
  for (let f = 1; f < d.length - 1; f++) {
    if (big[f] && big[f + 1] && !big[f - 1] && !big[f + 2]) bad.push(f);
  }
  return bad;
}

// Re-encode a clip dropping the given frames, re-timing survivors evenly so
// the duration is preserved. Overwrites the file (tmp + rename).
async function salvageInPlace(filePath, badFrames) {
  const { duration } = await probeVideo(filePath);
  const total = (await ydifSeriesLenCache.get(filePath)) ?? 0;
  const kept = total - badFrames.length;
  const fr = kept / duration;
  const drop = badFrames.map((f) => `eq(n,${f})`).join('+');
  const tmp = `${filePath}.salvage.mp4`;
  await new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .videoFilters([`select='not(${drop})'`, `setpts=N/(${fr.toFixed(6)}*TB)`])
      .noAudio()
      .outputOptions([
        '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264',
        '-crf', '26',
        '-preset', 'fast',
        '-movflags', '+faststart',
      ])
      .output(tmp)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  fs.renameSync(tmp, filePath);
}
const ydifSeriesLenCache = new Map();

// Reverse `srcPath` into EXACTLY `destPath` (same settings as the server's
// reverseVideo, but overwriting the existing reverse file to keep its URL).
async function regenerateReverse(srcPath, destPath) {
  const tmp = `${destPath}.rev.mp4`;
  await new Promise((resolve, reject) => {
    ffmpeg(srcPath)
      .videoFilters('reverse')
      .noAudio()
      .outputOptions([
        '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264',
        '-crf', '25',
        '-preset', 'fast',
        '-movflags', '+faststart',
      ])
      .output(tmp)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  fs.renameSync(tmp, destPath);
}

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

// ── Phase 1: restore/salvage forward clips ──────────────────────────────────
let restored = 0;
let salvaged = 0;
let untouched = 0;
await runPool([...forwardUrls], 2, async (url) => {
  const served = urlToPath(url);
  if (!fs.existsSync(served)) {
    console.warn(`  missing on disk, skipped: ${url}`);
    return;
  }
  const original = path.join(ORIGINALS_DIR, path.basename(served));
  if (fs.existsSync(original)) {
    console.log(`  restoring from master: ${url}`);
    fs.copyFileSync(original, served);
    await optimizeVideoInPlace(served); // no backupDir — master stays put
    restored++;
    return;
  }
  const d = await ydifSeries(served);
  ydifSeriesLenCache.set(served, d.length);
  const bad = detectMisplacedFrames(d);
  if (bad.length >= 3 && bad.length <= d.length * 0.35) {
    console.log(
      `  no master — salvaging (${bad.length}/${d.length} misplaced frames): ${url}`,
    );
    // Salvage drops frames for good, and this file is the only copy — stash
    // it first. The suffix keeps it out of the master lookup above, so a
    // re-run sees the salvaged (now healthy-looking) clip and skips it.
    fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
    const stash = path.join(
      ORIGINALS_DIR,
      `${path.basename(served)}.pre-salvage.mp4`,
    );
    if (!fs.existsSync(stash)) fs.copyFileSync(served, stash);
    await salvageInPlace(served, bad);
    salvaged++;
  } else {
    console.log(`  no master, looks healthy (${bad.length} outliers): ${url}`);
    untouched++;
  }
});

// ── Phase 2: regenerate reverse clips from the (now clean) forwards ─────────
let reversed = 0;
await runPool([...reversePairs.entries()], 2, async ([revUrl, fwdUrl]) => {
  const fwd = urlToPath(fwdUrl);
  const rev = urlToPath(revUrl);
  if (!fs.existsSync(fwd)) {
    console.warn(`  forward missing, reverse skipped: ${revUrl}`);
    return;
  }
  console.log(`  reversing: ${revUrl}`);
  await regenerateReverse(fwd, rev);
  reversed++;
});

console.log(
  `Done. ${restored} restored from masters, ${salvaged} salvaged, ${untouched} left as-is; ${reversed} reverse clip(s) regenerated.`,
);
console.log('Now run: node scripts/bake-speed-ramps.mjs');
await mongoose.disconnect();
