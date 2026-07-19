/**
 * Backfill 4096-wide mobile panorama tiers for existing tours.
 *
 * New panorama uploads generate a mobile tier automatically (see
 * utils/mediaOptimizer.js); this one-off script creates the same tier for
 * panoramas uploaded before the feature existed, from the served 7680 WebP
 * (the camera originals are gone, so this is the best remaining source — and
 * 4096 from 7680 loses nothing visible on a 4096-capped screen).
 *
 * Idempotent: nodes that already have panoramaMobileUrl, or whose panorama is
 * already ≤4096 wide, are skipped. Ledger rows are created bound to the
 * owning project so the cleanup job never mistakes the new files for strays.
 *
 * Run once after deploying:  node scripts/backfill-mobile-panoramas.mjs
 */
import 'dotenv/config';
import path from 'path';
import mongoose from 'mongoose';
import sharp from 'sharp';
import Project from '../src/models/Project.js';
import Upload from '../src/models/Upload.js';
import { safeUploadPath } from '../src/utils/uploadPaths.js';
import { PANORAMA_MOBILE_WIDTH, PANORAMA_MOBILE_QUALITY } from '../src/utils/mediaOptimizer.js';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/photovideo360';

const run = async () => {
  await mongoose.connect(uri);
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const projects = await Project.find();
  let created = 0;
  let skipped = 0;

  for (const project of projects) {
    let touched = false;

    for (const [nodeId, node] of project.nodes.entries()) {
      if (!node?.panoramaUrl || node.panoramaMobileUrl) {
        skipped++;
        continue;
      }

      const srcPath = safeUploadPath(node.panoramaUrl);
      if (!srcPath) {
        console.warn(`  ! ${project.info.title} / ${nodeId}: unsafe URL, skipping`);
        skipped++;
        continue;
      }

      let meta;
      try {
        meta = await sharp(srcPath, { limitInputPixels: false }).metadata();
      } catch (err) {
        console.warn(`  ! ${project.info.title} / ${nodeId}: unreadable (${err.message}), skipping`);
        skipped++;
        continue;
      }
      if ((meta.width || 0) <= PANORAMA_MOBILE_WIDTH) {
        skipped++; // full file already serves every device
        continue;
      }

      const dir = path.dirname(srcPath);
      const base = path.basename(srcPath, path.extname(srcPath));
      const mobilePath = path.join(dir, `${base}_mobile.webp`);
      await sharp(srcPath, { limitInputPixels: false })
        .resize({ width: PANORAMA_MOBILE_WIDTH, withoutEnlargement: true })
        .webp({ quality: PANORAMA_MOBILE_QUALITY, effort: 4 })
        .toFile(mobilePath);

      // Derive the URL from its own parts (legacy panoramas may be .jpg/.png)
      const urlDir = node.panoramaUrl.slice(0, node.panoramaUrl.lastIndexOf('/'));
      const mobileUrl = `${urlDir}/${base}_mobile.webp`;
      node.panoramaMobileUrl = mobileUrl;
      touched = true;
      created++;

      await Upload.updateOne(
        { url: mobileUrl },
        { $set: { url: mobileUrl, project: project._id } },
        { upsert: true }
      );
      console.log(`  + ${project.info.title} / ${node.displayName} → ${mobileUrl}`);
    }

    if (touched) {
      project.markModified('nodes');
      await project.save();
    }
  }

  console.log(`\nDone: ${created} mobile tier(s) created, ${skipped} node(s) skipped.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
