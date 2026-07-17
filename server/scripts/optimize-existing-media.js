/**
 * One-time migration: optimize all existing uploaded media and update
 * project documents to point at the new files.
 *
 *   node scripts/optimize-existing-media.js
 *
 * - Panoramas: PNG/JPEG → WebP (q82) + generates `_preview.webp` blur-up
 *   preview; updates each node's panoramaUrl / panoramaPreviewUrl.
 * - Videos (forward + reversed): re-encoded in place (H.264 CRF 25,
 *   faststart, audio stripped) — same filenames, so stored URLs stay valid.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';
import Project from '../src/models/Project.js';
import { optimizePanorama, optimizeVideoInPlace } from '../src/utils/mediaOptimizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '../uploads');
// Originals are moved here instead of deleted — remove the folder manually
// once the migrated tour is verified.
const BACKUP_DIR = path.join(UPLOADS_ROOT, '_originals');

const toPublicUrl = (filePath) =>
  `/uploads/${path.relative(UPLOADS_ROOT, filePath).replace(/\\/g, '/')}`;
const toLocalPath = (url) => path.join(UPLOADS_ROOT, url.replace(/^\/uploads\//, ''));
const mb = (bytes) => (bytes / 1048576).toFixed(1) + ' MB';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const projects = await Project.find({});
  console.log(`${projects.length} project(s) found\n`);

  const processedPanoramas = new Map(); // old URL -> { url, previewUrl }
  const processedVideos = new Set();
  let savedBytes = 0;

  for (const project of projects) {
    let modified = false;

    // ── Panoramas ──
    for (const [nodeKey, node] of project.nodes) {
      const oldUrl = node.panoramaUrl;
      if (!oldUrl || !oldUrl.startsWith('/uploads/')) continue;

      let result = processedPanoramas.get(oldUrl);
      if (!result) {
        const localPath = toLocalPath(oldUrl);
        if (!fs.existsSync(localPath)) {
          console.warn(`  ⚠ missing file, skipped: ${oldUrl}`);
          continue;
        }
        const isWebp = path.extname(localPath).toLowerCase() === '.webp';
        if (isWebp && node.panoramaPreviewUrl) continue; // already migrated

        const before = fs.statSync(localPath).size;
        console.log(`  Panorama ${path.basename(localPath)} (${mb(before)}) …`);
        const { filePath, previewPath } = await optimizePanorama(localPath, { backupDir: BACKUP_DIR });
        const after = fs.statSync(filePath).size;
        savedBytes += before - after;
        console.log(`    → ${path.basename(filePath)} (${mb(after)}) + preview (${mb(fs.statSync(previewPath).size)})`);
        result = { url: toPublicUrl(filePath), previewUrl: toPublicUrl(previewPath) };
        processedPanoramas.set(oldUrl, result);
      }

      node.panoramaUrl = result.url;
      node.panoramaPreviewUrl = result.previewUrl;
      project.nodes.set(nodeKey, node);
      modified = true;
    }

    // ── Videos: collect every referenced clip, then re-encode in place ──
    const videoUrls = new Set();
    project.nodes.forEach((node) => {
      (node.navigationHotspots || []).forEach((hs) => {
        if (hs.transitionVideoUrl) videoUrls.add(hs.transitionVideoUrl);
        (hs.transitionVideos || []).forEach((v) => {
          if (v.videoUrl) videoUrls.add(v.videoUrl);
        });
      });
    });
    project.transitions.forEach((t) => {
      if (t.videoUrl) videoUrls.add(t.videoUrl);
    });

    for (const url of videoUrls) {
      if (!url.startsWith('/uploads/') || processedVideos.has(url)) continue;
      processedVideos.add(url);
      const localPath = toLocalPath(url);
      if (!fs.existsSync(localPath)) {
        console.warn(`  ⚠ missing file, skipped: ${url}`);
        continue;
      }
      const before = fs.statSync(localPath).size;
      process.stdout.write(`  Video ${path.basename(localPath)} (${mb(before)}) … `);
      try {
        const reencoded = await optimizeVideoInPlace(localPath, { backupDir: BACKUP_DIR });
        const after = fs.statSync(localPath).size;
        savedBytes += before - after;
        console.log(reencoded ? `→ ${mb(after)}` : 'already optimized, skipped');
      } catch (err) {
        console.log(`FAILED (kept original): ${err.message}`);
      }
    }

    if (modified) {
      project.markModified('nodes');
      await project.save();
      console.log(`  ✔ project ${project._id} updated\n`);
    }
  }

  console.log(`Done. Total space saved: ${mb(savedBytes)}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
