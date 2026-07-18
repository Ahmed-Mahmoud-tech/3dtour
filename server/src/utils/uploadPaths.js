import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path of the uploads directory (server/uploads). */
export const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

/**
 * Resolve a public '/uploads/...' URL to an absolute path guaranteed to be
 * inside UPLOADS_ROOT. Returns null for anything else — non-upload URLs,
 * non-strings, and traversal attempts ('/uploads/../.env').
 *
 * Every piece of code that turns a stored media URL back into a filesystem
 * path (deletion, export) MUST go through this — never hand-roll it.
 */
export const safeUploadPath = (url) => {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const rel = url.slice('/uploads/'.length);
  const abs = path.resolve(UPLOADS_ROOT, rel);
  if (!abs.startsWith(UPLOADS_ROOT + path.sep)) return null;
  return abs;
};
