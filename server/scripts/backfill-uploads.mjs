/**
 * Backfill the Upload ownership ledger from existing projects.
 *
 * The ledger (models/Upload.js) binds each uploaded media URL to the tour that
 * owns it, so staff can't attach another tour's media to their own project.
 * New uploads populate it going forward; this one-off script seeds it from the
 * media already referenced by existing projects.
 *
 * A URL referenced by exactly one project is bound to it. A URL referenced by
 * several (legacy demo media reused across tours) is marked `shared` and left
 * unbound, so it's never gated.
 *
 * Run once after deploying the ledger:  node scripts/backfill-uploads.mjs
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Project from '../src/models/Project.js';
import Upload from '../src/models/Upload.js';
import { extractUploadUrls } from '../src/utils/mediaBinding.js';

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/photovideo360';

const run = async () => {
  await mongoose.connect(uri);
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const projects = await Project.find().lean();
  console.log(`Scanning ${projects.length} projects…`);

  // url -> Set(projectId)
  const refs = new Map();
  for (const p of projects) {
    for (const url of extractUploadUrls(p)) {
      if (!refs.has(url)) refs.set(url, new Set());
      refs.get(url).add(String(p._id));
    }
  }
  console.log(`Found ${refs.size} distinct media URLs.`);

  let bound = 0;
  let shared = 0;
  const ops = [];
  for (const [url, projectIds] of refs) {
    if (projectIds.size === 1) {
      const [pid] = [...projectIds];
      ops.push({
        updateOne: {
          filter: { url },
          update: { $set: { url, project: new mongoose.Types.ObjectId(pid), shared: false } },
          upsert: true,
        },
      });
      bound++;
    } else {
      ops.push({
        updateOne: {
          filter: { url },
          update: { $set: { url, project: null, shared: true } },
          upsert: true,
        },
      });
      shared++;
    }
  }

  if (ops.length) await Upload.bulkWrite(ops, { ordered: false });

  console.log(`Done. Bound ${bound} URL(s) to a single tour, flagged ${shared} shared URL(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
