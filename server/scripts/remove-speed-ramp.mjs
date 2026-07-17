// One-off removal of the speed-ramp system (2026-07-17, user decision):
// transitions play the filmed clips at natural speed from now on.
//
//   1. Unsets every ramped* field on transitions / hotspots / multi-video
//      items across all projects (run BEFORE the schema fields are deleted).
//   2. Deletes all `_ramped*` variants and 0-byte junk (failed .opt.mp4)
//      from uploads/videos.
//   3. Repairs clips whose upload-time processing crashed: re-optimizes
//      oversized sources (8K HEVC that never got transcoded).
//
// (The missing-reverse-clip repair this script used to do was removed
// 2026-07-17 along with the reverse-video feature.)
//
// Run from server/:  node scripts/remove-speed-ramp.mjs
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);
const { default: Project } = await import('../src/models/Project.js');
const { optimizeVideoInPlace, probeVideo } = await import(
  '../src/utils/mediaOptimizer.js'
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');
const VIDEOS_DIR = path.join(UPLOADS_ROOT, 'videos');
const ORIGINALS_DIR = path.join(UPLOADS_ROOT, '_originals');

const urlToPath = (url) =>
  path.join(UPLOADS_ROOT, url.slice('/uploads/'.length));

const fileOk = (p) => {
  try {
    return fs.statSync(p).size > 0;
  } catch {
    return false;
  }
};

// ── 1+3. Per project: unset ramped fields, repair broken clips ──────────────
const allProjects = await Project.find();
for (const project of allProjects) {
  let changed = false;
  const unset = (obj, ...fields) => {
    for (const f of fields) {
      if (obj[f] !== undefined && obj[f] !== '') changed = true;
      obj[f] = undefined;
    }
  };

  for (const [id, t] of project.transitions) {
    unset(t, 'rampedVideoUrl', 'reverseRampedVideoUrl');

    // Repair: source never optimized (still 8K/HEVC) after a crashed upload
    if (t.videoUrl && fileOk(urlToPath(t.videoUrl))) {
      const srcPath = urlToPath(t.videoUrl);
      const { width, bitrate } = await probeVideo(srcPath).catch(() => ({}));
      if (width > 3840 || bitrate > 20_000_000) {
        console.log(`  optimizing oversized source: ${t.videoUrl}`);
        await optimizeVideoInPlace(srcPath, { backupDir: ORIGINALS_DIR }).catch(
          (e) => console.error(`  optimize failed: ${e.message}`),
        );
      }
    }
    project.transitions.set(id, t);
  }

  for (const node of project.nodes.values())
    for (const hs of node.navigationHotspots) {
      unset(hs, 'rampedTransitionVideoUrl', 'reverseRampedTransitionVideoUrl');
      for (const item of hs.transitionVideos || [])
        unset(item, 'rampedVideoUrl', 'reverseRampedVideoUrl');
    }

  if (changed) {
    project.markModified('transitions');
    project.markModified('nodes');
    await project.save();
    console.log(`Project ${project._id} ("${project.info?.title}") — cleaned.`);
  }
}

// ── 2. Disk cleanup: ramped variants + 0-byte junk ──────────────────────────
let removed = 0;
let bytes = 0;
for (const name of fs.readdirSync(VIDEOS_DIR)) {
  const p = path.join(VIDEOS_DIR, name);
  const size = fs.statSync(p).size;
  const isRamped = /_ramped(-[0-9a-f]+)?\.[^.]+$/.test(name);
  const isJunk = size === 0 || name.endsWith('.opt.mp4');
  if (isRamped || isJunk) {
    bytes += size;
    fs.unlinkSync(p);
    removed++;
  }
}
console.log(
  `Removed ${removed} ramped/junk file(s) (${(bytes / 1024 / 1024).toFixed(0)} MB).`,
);
await mongoose.disconnect();
console.log('Speed ramp removed. Transitions now play at natural speed.');
