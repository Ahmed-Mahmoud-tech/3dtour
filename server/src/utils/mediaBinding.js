import Upload from '../models/Upload.js';
import { safeUploadPath } from './uploadPaths.js';

/**
 * Recursively collect every '/uploads/...' string in an arbitrary value
 * (request body, node map, hotspot, etc.) into a Set.
 */
export const extractUploadUrls = (value, out = new Set()) => {
  if (typeof value === 'string') {
    if (value.startsWith('/uploads/')) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) extractUploadUrls(v, out);
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) extractUploadUrls(value[k], out);
  }
  return out;
};

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

/**
 * Validate and claim every media URL a project write is trying to store.
 *
 * For each '/uploads/...' URL in `body`:
 *  - reject it if it isn't a traversal-safe upload path;
 *  - reject it if the ledger says another tour already owns it (this is the
 *    cross-project attach/delete guard);
 *  - otherwise bind it to this project (claiming legacy/unowned URLs on first
 *    reference). `shared` ledger rows (legacy demo media) are never gated.
 *
 * Throws a 400-status Error on a foreign or malformed URL; asyncHandler routes
 * that to the global handler.
 */
export const bindIncomingMedia = async (body, projectId, userId = null) => {
  const urls = extractUploadUrls(body);
  const pid = String(projectId);

  for (const url of urls) {
    if (!safeUploadPath(url)) throw badRequest(`Invalid media URL: ${url}`);

    // Upsert the ledger row without racing on create (url is unique).
    const row = await Upload.findOneAndUpdate(
      { url },
      { $setOnInsert: { url, project: null, uploadedBy: userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (row.shared) continue; // legacy media reused across tours — not gated

    if (row.project && String(row.project) !== pid)
      throw badRequest('That media file belongs to another tour');

    if (!row.project) {
      row.project = projectId;
      if (!row.uploadedBy && userId) row.uploadedBy = userId;
      await row.save();
    }
  }
};

/**
 * Record a freshly uploaded file in the ledger. Bound to `project` when the
 * upload route already knows it (e.g. the transition-video route carries a
 * verified :projectId); otherwise unbound until first attach. Upsert so retries
 * don't collide on the unique url. Best-effort: if this fails, bindIncomingMedia
 * still lazily creates/claims the row on first attach.
 */
export const recordUpload = (url, userId = null, project = null) =>
  Upload.findOneAndUpdate(
    { url },
    { $setOnInsert: { url, project, uploadedBy: userId } },
    { upsert: true, setDefaultsOnInsert: true }
  ).catch((err) => console.error('Failed to record upload', url, err.message));

/** Drop a ledger row when its file is deleted (keeps the ledger from growing stale). */
export const forgetUpload = (url) =>
  Upload.deleteOne({ url }).catch((err) =>
    console.error('Failed to remove upload ledger row for', url, err.message)
  );
