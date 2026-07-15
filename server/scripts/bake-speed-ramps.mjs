// Bakes the transition speed ramp (server/src/config/speedRamp.js) into every
// transition video that doesn't have a `_ramped` variant yet, and patches the
// matching `ramped*` URL fields on transitions / hotspots / multi-video
// segments.
//
//   node scripts/bake-speed-ramps.mjs           # bake missing variants only
//   node scripts/bake-speed-ramps.mjs --force   # re-bake EVERYTHING
//                                               # (run this after editing the ramp)
//
// Requires FFmpeg on PATH (or FFMPEG_PATH in .env), like the server itself.
// Run from server/.
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const FORCE = process.argv.includes('--force');

await mongoose.connect(process.env.MONGO_URI);
const { default: Project } = await import('../src/models/Project.js');
const { bakeSpeedRamp } = await import('../src/controllers/mediaController.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');

const urlToPath = (url) =>
  path.join(UPLOADS_ROOT, url.slice('/uploads/'.length));
const toPublicUrl = (filePath) =>
  `/uploads/${path.relative(UPLOADS_ROOT, filePath).replace(/\\/g, '/')}`;

// source url → ramped url ('' when the source is missing or FFmpeg failed)
const rampedUrlCache = new Map();

async function rampedVariantFor(url) {
  if (!url || !url.startsWith('/uploads/')) return '';
  // Never bake a ramped file again — it IS the output
  if (/_ramped\.[^.]+$/.test(url)) return '';
  if (rampedUrlCache.has(url)) return rampedUrlCache.get(url);

  let rampedUrl = '';
  const inputPath = urlToPath(url);
  if (!fs.existsSync(inputPath)) {
    console.warn(`  missing on disk, skipped: ${url}`);
  } else {
    const ext = path.extname(inputPath);
    const expected = path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, ext)}_ramped${ext}`,
    );
    if (!FORCE && fs.existsSync(expected)) {
      rampedUrl = toPublicUrl(expected); // done on a previous run
    } else {
      try {
        console.log(`  baking ramp: ${url}`);
        rampedUrl = toPublicUrl(await bakeSpeedRamp(inputPath));
      } catch (err) {
        console.error(`  FFmpeg failed for ${url}: ${err.message}`);
      }
    }
  }
  rampedUrlCache.set(url, rampedUrl);
  return rampedUrl;
}

// Sets obj[rampedField] from obj[srcField]'s baked variant; true if changed
async function patch(obj, srcField, rampedField) {
  if (!obj?.[srcField]) return false;
  if (obj[rampedField] && !FORCE) return false;
  const rampedUrl = await rampedVariantFor(obj[srcField]);
  if (!rampedUrl || obj[rampedField] === rampedUrl) return false;
  obj[rampedField] = rampedUrl;
  return true;
}

const projects = await Project.find();
console.log(`Scanning ${projects.length} project(s)…${FORCE ? ' (--force)' : ''}`);

for (const project of projects) {
  let changed = false;
  console.log(`Project ${project._id} ("${project.info?.title}")`);

  for (const [id, transition] of project.transitions) {
    let tChanged = false;
    if (await patch(transition, 'videoUrl', 'rampedVideoUrl')) tChanged = true;
    if (await patch(transition, 'reverseVideoUrl', 'reverseRampedVideoUrl'))
      tChanged = true;
    if (tChanged) {
      project.transitions.set(id, transition);
      changed = true;
    }
  }

  for (const node of project.nodes.values()) {
    for (const hs of node.navigationHotspots) {
      if (await patch(hs, 'transitionVideoUrl', 'rampedTransitionVideoUrl'))
        changed = true;
      if (
        await patch(
          hs,
          'reverseTransitionVideoUrl',
          'reverseRampedTransitionVideoUrl',
        )
      )
        changed = true;
      for (const item of hs.transitionVideos || []) {
        if (await patch(item, 'videoUrl', 'rampedVideoUrl')) changed = true;
        if (await patch(item, 'reverseVideoUrl', 'reverseRampedVideoUrl'))
          changed = true;
      }
    }
  }

  if (changed) {
    project.markModified('nodes');
    project.markModified('transitions');
    await project.save();
    console.log('  saved.');
  } else {
    console.log('  nothing to do.');
  }
}

console.log(`Done. ${rampedUrlCache.size} unique video URL(s) processed.`);
await mongoose.disconnect();
