// One-off removal of the reverse-video system (2026-07-17): backward hotspots
// and auto-generated reversed clips are gone; transitions only play forward.
//
//   1. Unsets reverseVideoUrl / reverseTransitionVideoUrl / playMode on
//      transitions, hotspots and multi-video items across all projects
//      (works on the raw collection, so it runs fine after the schema
//      fields were deleted).
//   2. Deletes every generated `*_reversed.*` file from uploads/videos.
//      (uploads/_originals is never touched — reversed clips were derived,
//      never archived there.)
//
// Run from server/:  node scripts/remove-reverse-videos.mjs
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = path.join(__dirname, '../uploads/videos');

// ── 1. Unset reverse fields on the raw collection ───────────────────────────
const col = mongoose.connection.collection('projects');
let cleaned = 0;
for await (const doc of col.find()) {
  const unset = {};
  for (const key of Object.keys(doc.transitions || {})) {
    if (doc.transitions[key]?.reverseVideoUrl !== undefined)
      unset[`transitions.${key}.reverseVideoUrl`] = '';
  }
  for (const [nodeKey, node] of Object.entries(doc.nodes || {})) {
    (node.navigationHotspots || []).forEach((hs, i) => {
      const base = `nodes.${nodeKey}.navigationHotspots.${i}`;
      if (hs.reverseTransitionVideoUrl !== undefined)
        unset[`${base}.reverseTransitionVideoUrl`] = '';
      if (hs.playMode !== undefined) unset[`${base}.playMode`] = '';
      (hs.transitionVideos || []).forEach((item, j) => {
        if (item.reverseVideoUrl !== undefined)
          unset[`${base}.transitionVideos.${j}.reverseVideoUrl`] = '';
      });
    });
  }
  if (Object.keys(unset).length > 0) {
    await col.updateOne({ _id: doc._id }, { $unset: unset });
    cleaned++;
    console.log(`Project ${doc._id} ("${doc.info?.title}") — cleaned.`);
  }
}
console.log(`${cleaned} project(s) cleaned.`);

// ── 2. Delete generated reversed clips from disk ────────────────────────────
let removed = 0;
let bytes = 0;
if (fs.existsSync(VIDEOS_DIR)) {
  for (const name of fs.readdirSync(VIDEOS_DIR)) {
    if (!/_reversed\.[^.]+$/.test(name)) continue;
    const p = path.join(VIDEOS_DIR, name);
    bytes += fs.statSync(p).size;
    fs.unlinkSync(p);
    removed++;
  }
}
console.log(
  `Removed ${removed} reversed file(s) (${(bytes / 1024 / 1024).toFixed(0)} MB).`,
);
await mongoose.disconnect();
console.log('Reverse-video system removed.');
