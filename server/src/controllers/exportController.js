import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ZipArchive } from 'archiver';
import Project from '../models/Project.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
// Prebuilt static player (client/: `npm run build:static` → dist-static/)
const PLAYER_DIR =
  process.env.STATIC_PLAYER_DIR || path.join(__dirname, '../../../client/dist-static');

/**
 * Recursively rewrites every '/uploads/...' URL in the tour JSON to a
 * relative 'media/...' path and records the underlying file, so the zip is
 * fully self-contained. Non-upload strings (icon names, external URLs) are
 * left untouched.
 */
const rewriteMediaUrls = (value, files) => {
  if (typeof value === 'string') {
    if (value.startsWith('/uploads/')) {
      const rel = value.slice('/uploads/'.length); // e.g. panoramas/x.webp
      files.set(`media/${rel}`, path.join(UPLOADS_ROOT, rel));
      return `media/${rel}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => rewriteMediaUrls(v, files));
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = rewriteMediaUrls(value[k], files);
    return value;
  }
  return value;
};

// GET /api/admin/projects/:id/export  (admin only)
// Streams a zip that runs standalone on any static host:
//   index.html + assets/   ← static player build
//   tour.json              ← project data, media URLs rewritten
//   media/...              ← every referenced upload
export const exportProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!fs.existsSync(path.join(PLAYER_DIR, 'index.html'))) {
      return res.status(500).json({
        message:
          'Static player build not found. Run "npm run build:static" in the client/ package first (or set STATIC_PLAYER_DIR).',
      });
    }

    const tour = project.toJSON();
    // Internal fields that mean nothing outside the platform
    delete tour.createdBy;
    delete tour.owner;
    delete tour._id;
    delete tour.__v;

    const files = new Map(); // zip path → absolute path on disk
    rewriteMediaUrls(tour, files);

    const safeTitle = (project.info.title || 'tour')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

    res.attachment(`${safeTitle || 'tour'}-export.zip`);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('Export archive error:', err);
      if (!res.headersSent) res.status(500).json({ message: err.message });
      else res.destroy(err);
    });
    archive.on('warning', (err) => console.warn('Export warning:', err.message));
    archive.pipe(res);

    // 1. Static player
    archive.directory(PLAYER_DIR, false);
    // 2. Tour data
    archive.append(JSON.stringify(tour, null, 2), { name: 'tour.json' });
    // 3. Media files (skip anything missing on disk rather than failing the zip)
    const missing = [];
    for (const [zipPath, absPath] of files) {
      if (fs.existsSync(absPath)) archive.file(absPath, { name: zipPath });
      else missing.push(zipPath);
    }
    if (missing.length) {
      console.warn(`Export ${project._id}: ${missing.length} media file(s) missing:`, missing);
      archive.append(missing.join('\n'), { name: 'MISSING_MEDIA.txt' });
    }

    await archive.finalize();
  } catch (err) {
    console.error('Export failed:', err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};
