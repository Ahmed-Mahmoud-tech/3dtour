import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { ZipArchive } from 'archiver';
import Project from '../models/Project.js';
import { UPLOADS_ROOT, safeUploadPath } from '../utils/uploadPaths.js';
import { logActivity } from '../utils/activityLog.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prebuilt static player (client/: `npm run build:static` → dist-static/)
const PLAYER_DIR =
  process.env.STATIC_PLAYER_DIR || path.join(__dirname, '../../../client/dist-static');
const CLIENT_DIR = path.join(__dirname, '../../../client');
const PLAYER_INDEX = path.join(PLAYER_DIR, 'index.html');
const AUTOBUILD_STATIC_PLAYER = process.env.STATIC_PLAYER_AUTOBUILD !== '0';

const SOURCE_PATHS = [
  path.join(CLIENT_DIR, 'src'),
  path.join(CLIENT_DIR, 'index.html'),
  path.join(CLIENT_DIR, 'vite.config.js'),
  path.join(CLIENT_DIR, 'package.json'),
];

const newestMtimeMs = (targetPath) => {
  if (!fs.existsSync(targetPath)) return 0;
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = stat.mtimeMs;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    newest = Math.max(newest, newestMtimeMs(path.join(targetPath, entry.name)));
  }
  return newest;
};

const staticPlayerIsStale = () => {
  if (!fs.existsSync(PLAYER_INDEX)) return true;
  const playerMtime = fs.statSync(PLAYER_INDEX).mtimeMs;
  let sourceNewest = 0;
  for (const sourcePath of SOURCE_PATHS) {
    sourceNewest = Math.max(sourceNewest, newestMtimeMs(sourcePath));
  }
  return sourceNewest > playerMtime;
};

const rebuildStaticPlayer = async () => {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const { stdout, stderr } = await execFileAsync(npmCmd, ['run', 'build:static'], {
      cwd: CLIENT_DIR,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    if (stdout) console.log('[export] build:static output:', stdout.trim());
    if (stderr) console.warn('[export] build:static warnings:', stderr.trim());
    return;
  } catch (err) {
    // Some Windows environments reject execFile for cmd wrappers (spawn EINVAL).
    // Fallback to shell execution, which handles npm.cmd resolution reliably.
    const code = err?.code;
    if (process.platform !== 'win32' || (code !== 'EINVAL' && code !== 'ENOENT')) {
      throw err;
    }
    const { stdout, stderr } = await execAsync('npm run build:static', {
      cwd: CLIENT_DIR,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    if (stdout) console.log('[export] build:static output:', stdout.trim());
    if (stderr) console.warn('[export] build:static warnings:', stderr.trim());
  }
};

const ensureStaticPlayerReady = async () => {
  const stale = staticPlayerIsStale();
  if (!stale && fs.existsSync(PLAYER_INDEX)) return;
  if (!AUTOBUILD_STATIC_PLAYER) {
    throw new Error(
      'Static player build is missing or stale. Run "npm run build:static" in client/ first (or set STATIC_PLAYER_AUTOBUILD=1).',
    );
  }
  await rebuildStaticPlayer();
  if (!fs.existsSync(PLAYER_INDEX)) {
    throw new Error('Static player build did not produce dist-static/index.html');
  }
};

/**
 * Recursively rewrites every '/uploads/...' URL in the tour JSON to a
 * relative 'media/...' path and records the underlying file, so the zip is
 * fully self-contained. Non-upload strings (icon names, external URLs) are
 * left untouched. safeUploadPath rejects traversal, so a stored URL like
 * '/uploads/../.env' can neither read outside the uploads dir nor create a
 * zip-slip entry in the archive.
 */
const rewriteMediaUrls = (value, files) => {
  if (typeof value === 'string') {
    const abs = safeUploadPath(value);
    if (abs) {
      const rel = path.relative(UPLOADS_ROOT, abs).replace(/\\/g, '/');
      files.set(`media/${rel}`, abs);
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

    try {
      await ensureStaticPlayerReady();
    } catch (buildErr) {
      console.error('Static player build check failed:', buildErr);
      return res.status(500).json({
        message: `Static player build failed: ${buildErr.message}`,
      });
    }

    const tour = project.toJSON();
    // Internal fields that mean nothing outside the platform
    delete tour.createdBy;
    delete tour.owner;
    delete tour.assignedTo;
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
      if (!res.headersSent) res.status(500).json({ message: 'Export failed' });
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
    logActivity(req.user, {
      action: 'project_exported',
      project: project._id,
      projectTitle: project.info?.title || '',
    });
  } catch (err) {
    console.error('Export failed:', err);
    // Never leak internal error details (paths, driver messages) to the client
    if (!res.headersSent) res.status(500).json({ message: 'Export failed' });
  }
};
