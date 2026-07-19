import fs from 'fs';
import path from 'path';
import Project from '../models/Project.js';
import Upload from '../models/Upload.js';
import { extractUploadUrls } from '../utils/mediaBinding.js';
import { safeUploadPath, UPLOADS_ROOT } from '../utils/uploadPaths.js';

/**
 * Unused-uploads sweep (policy 2026-07-19: uploaded files that no tour uses
 * are dead weight and must be deleted).
 *
 * Two orphan classes are removed, both only after a 48h grace period so a
 * file uploaded mid-edit (node not saved yet) or mid-optimization is never
 * touched:
 *
 *  1. Ledger orphans — Upload rows still `project: null` (uploaded but never
 *     attached to any tour) whose URL no project references. The row is
 *     removed with the file.
 *  2. Disk strays — files in the media folders with NO ledger row and no
 *     project reference (pre-ledger leftovers, crashed `.opt.mp4` temps,
 *     files whose delete previously failed halfway).
 *
 * Never touched: anything referenced by any project (previews/mobile tiers
 * included — the reference set is built by walking every project document the
 * same way bindIncomingMedia walks a request body), `shared` ledger rows, and
 * the `_originals` archive (scripts/purge-originals.mjs handles that
 * explicitly).
 *
 * Empty-DB guard: if there are no projects AND no ledger rows, the sweep
 * aborts — that state means a fresh or misconfigured database, and deleting
 * every file on disk because Mongo came up empty would be catastrophic.
 */

const SWEEP_INTERVAL = 24 * 60 * 60 * 1000; // daily sweep is plenty
const MIN_AGE_MS = 48 * 60 * 60 * 1000; // grace: never delete anything younger
const STARTUP_DELAY_MS = 2 * 60 * 1000; // let DB connect + app settle first
const MEDIA_FOLDERS = ['panoramas', 'videos', 'audio', 'images'];

export async function sweepUnusedUploads() {
  const projects = await Project.find({})
    .select('info.nadirLogoUrl settings nodes transitions')
    .lean();
  const ledgerCount = await Upload.estimatedDocumentCount();
  if (projects.length === 0 && ledgerCount === 0) {
    return { skipped: true, deleted: 0 };
  }

  // Every '/uploads/...' URL any project references, wherever it hides
  // (nodes, hotspots, sign popup HTML, transitions, nadir logo, audio…).
  const used = new Set();
  for (const p of projects) extractUploadUrls(p, used);

  const cutoff = Date.now() - MIN_AGE_MS;
  let deleted = 0;

  // ── Pass 1: ledger orphans (uploaded ≥48h ago, never attached) ────────────
  const orphanRows = await Upload.find({
    project: null,
    shared: { $ne: true },
    createdAt: { $lt: new Date(cutoff) },
  }).lean();

  for (const row of orphanRows) {
    if (used.has(row.url)) continue; // referenced but not yet claimed — leave it
    const filePath = safeUploadPath(row.url);
    if (filePath) {
      try {
        await fs.promises.unlink(filePath);
        deleted++;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('[uploadCleanup] failed to delete', row.url, err.message);
          continue; // keep the row so a later sweep retries
        }
      }
    }
    await Upload.deleteOne({ _id: row._id });
  }

  // ── Pass 2: disk strays (no ledger row, no project reference) ─────────────
  for (const folder of MEDIA_FOLDERS) {
    const dir = path.join(UPLOADS_ROOT, folder);
    let entries;
    try {
      entries = await fs.promises.readdir(dir);
    } catch {
      continue; // folder doesn't exist yet
    }

    for (const name of entries) {
      const url = `/uploads/${folder}/${name}`;
      if (used.has(url)) continue;

      const fullPath = path.join(dir, name);
      let stat;
      try {
        stat = await fs.promises.stat(fullPath);
      } catch {
        continue;
      }
      if (!stat.isFile() || stat.mtimeMs > cutoff) continue; // fresh or not a file

      // Ledger knows it → it has (or had) an owner; pass 1 handles its lifecycle
      if (await Upload.exists({ url })) continue;

      try {
        await fs.promises.unlink(fullPath);
        deleted++;
      } catch (err) {
        console.error('[uploadCleanup] failed to delete stray', url, err.message);
      }
    }
  }

  return { skipped: false, deleted };
}

export function startUploadCleanupJob() {
  const run = () =>
    sweepUnusedUploads()
      .then(({ skipped, deleted }) => {
        if (skipped) {
          console.log('[uploadCleanup] skipped: empty database (fresh install or DB misconfigured)');
        } else if (deleted > 0) {
          console.log(`[uploadCleanup] removed ${deleted} unused upload file(s)`);
        }
      })
      .catch((err) => console.error('[uploadCleanup] sweep failed:', err.message));

  setTimeout(run, STARTUP_DELAY_MS);
  setInterval(run, SWEEP_INTERVAL);
}
