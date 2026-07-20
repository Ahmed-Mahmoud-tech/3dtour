/**
 * Re-encode existing transition clips down to the current VIDEO_MAX_WIDTH.
 *
 * New uploads are capped at 2048-wide equirect (see utils/mediaOptimizer.js);
 * clips uploaded while the cap was 3840 stay 4K and stutter on decode + the
 * ~29 MB/frame GPU texture upload. This one-off pass shrinks them in place
 * (SAME filename, so every stored /uploads/... URL stays valid — no DB write).
 *
 * It reuses optimizeVideoInPlace, which now re-encodes any clip wider than the
 * cap and skips ones already at/below it, so the script is idempotent and safe
 * to re-run. Each transcode is sanity-checked (duration within 5%) before it
 * replaces the original; a failing transcode is discarded and the clip kept.
 *
 * DRY-RUN by default — prints what it WOULD do. Pass --yes to actually rewrite.
 * Optional --project=<id> limits the pass to one tour.
 *
 *   node scripts/reencode-transition-videos.mjs                 # dry run, all tours
 *   node scripts/reencode-transition-videos.mjs --yes           # rewrite all tours
 *   node scripts/reencode-transition-videos.mjs --project=<id> --yes
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Project from '../src/models/Project.js';
import { safeUploadPath } from '../src/utils/uploadPaths.js';
import { probeVideo, optimizeVideoInPlace } from '../src/utils/mediaOptimizer.js';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/photovideo360';
const APPLY = process.argv.includes('--yes');
const projectArg = process.argv.find((a) => a.startsWith('--project='));
const onlyProjectId = projectArg ? projectArg.split('=')[1] : null;

/** Every transition-video URL referenced anywhere in a project, de-duplicated. */
function collectVideoUrls(project) {
  const urls = new Set();
  for (const node of project.nodes.values()) {
    for (const hotspot of node.navigationHotspots || []) {
      if (hotspot.transitionVideoUrl) urls.add(hotspot.transitionVideoUrl);
      for (const seg of hotspot.transitionVideos || []) {
        if (seg?.videoUrl) urls.add(seg.videoUrl);
      }
    }
  }
  // Shared transitions map (legacy single-video path)
  if (project.transitions) {
    for (const t of project.transitions.values()) {
      if (t?.videoUrl) urls.add(t.videoUrl);
    }
  }
  return [...urls];
}

const run = async () => {
  await mongoose.connect(uri);
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  console.log(APPLY ? '── APPLYING (files will be rewritten) ──' : '── DRY RUN (no changes) ──');

  const query = onlyProjectId ? { _id: onlyProjectId } : {};
  const projects = await Project.find(query);

  // A clip file can be shared across projects (marked Upload.shared); only
  // process each on-disk path once.
  const seenPaths = new Set();
  let reencoded = 0;
  let skipped = 0;
  let failed = 0;

  for (const project of projects) {
    for (const url of collectVideoUrls(project)) {
      const filePath = safeUploadPath(url);
      if (!filePath) {
        console.warn(`  ! ${project.info?.title}: unsafe URL ${url}, skipping`);
        skipped++;
        continue;
      }
      if (seenPaths.has(filePath)) continue;
      seenPaths.add(filePath);

      let info;
      try {
        info = await probeVideo(filePath);
      } catch (err) {
        console.warn(`  ! unreadable ${url} (${err.message}), skipping`);
        skipped++;
        continue;
      }

      const name = url.split('/').pop();
      if (!APPLY) {
        // Mirror optimizeVideoInPlace's decision so the dry run is honest
        const willReencode = info.width > 2048;
        const willRemux = !willReencode && info.hasAudio;
        if (willReencode) {
          console.log(`  → would shrink ${name}: ${info.width}px → 2048px`);
          reencoded++;
        } else if (willRemux) {
          console.log(`  → would strip audio ${name} (${info.width}px)`);
          reencoded++;
        } else {
          skipped++;
        }
        continue;
      }

      try {
        const changed = await optimizeVideoInPlace(filePath);
        if (changed) {
          const after = await probeVideo(filePath);
          console.log(`  ✓ ${name}: ${info.width}px → ${after.width}px`);
          reencoded++;
        } else {
          skipped++; // already at/below cap, no audio
        }
      } catch (err) {
        console.error(`  ✗ ${name}: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(
    `\nDone: ${reencoded} ${APPLY ? 'rewritten' : 'to rewrite'}, ` +
    `${skipped} skipped, ${failed} failed.` +
    (APPLY ? '' : '\nRe-run with --yes to apply.')
  );
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
