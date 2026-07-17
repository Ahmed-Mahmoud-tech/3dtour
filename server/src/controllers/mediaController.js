import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  optimizePanorama,
  optimizeVideoInPlace,
  optimizeImage,
  optimizeAudio,
} from '../utils/mediaOptimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a local filesystem path to a public URL path */
const toPublicUrl = (filePath) => {
  const relative = path.relative(UPLOADS_ROOT, filePath).replace(/\\/g, '/');
  return `/uploads/${relative}`;
};

// ─── Upload Panorama ──────────────────────────────────────────────────────────

// POST /api/media/panorama
export const uploadPanoramaHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Convert to WebP (~10x smaller than PNG) + tiny preview for blur-up loading
    const { filePath, previewPath } = await optimizePanorama(req.file.path);
    res.status(201).json({
      url: toPublicUrl(filePath),
      previewUrl: toPublicUrl(previewPath),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Upload Audio ─────────────────────────────────────────────────────────────

// POST /api/media/audio
export const uploadAudioHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Heavy sources (WAV, 320k MP3…) are re-encoded to AAC 128k
    const finalPath = await optimizeAudio(req.file.path);
    res.status(201).json({ url: toPublicUrl(finalPath) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Upload Image (popup cover) ───────────────────────────────────────────────

// POST /api/media/image
export const uploadImageHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Convert to WebP, cap at 2048 wide — popup covers/logos never need more
    const finalPath = await optimizeImage(req.file.path);
    res.status(201).json({ url: toPublicUrl(finalPath) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Upload Transition Video ──────────────────────────────────────────────────

// POST /api/media/video/:projectId
export const uploadTransitionVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const videoUrl = toPublicUrl(req.file.path);

    // Respond immediately; the clip is shrunk in place in the background
    res.status(201).json({ videoUrl });

    // Shrink the clip in place (same filename, so the URL we just returned
    // stays valid).
    // backupDir keeps the camera master in _originals — the served file is
    // a lossy transcode, and having the master is what made the July 2026
    // frame-corruption recovery possible (see scripts/restore-originals.mjs)
    await optimizeVideoInPlace(req.file.path, {
      backupDir: path.join(UPLOADS_ROOT, '_originals'),
    }).catch((err) =>
      console.error('Video optimization failed (continuing with original):', err.message),
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Video Streaming (HTTP Range support) ─────────────────────────────────────

// GET /api/media/stream/:folder/:filename
const STREAM_FOLDERS = new Set(['videos', 'audio', 'panoramas', 'images']);
const STREAM_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
};

export const streamVideo = (req, res) => {
  const { folder, filename } = req.params;

  // Prevent path traversal attacks; only real upload folders are streamable
  const safeFolder = path.basename(folder);
  const safeFilename = path.basename(filename);
  if (!STREAM_FOLDERS.has(safeFolder)) return res.status(404).json({ message: 'File not found' });
  const filePath = path.join(UPLOADS_ROOT, safeFolder, safeFilename);

  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = STREAM_TYPES[path.extname(safeFilename).toLowerCase()] || 'video/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10) || 0;
    const end = Math.min(parts[1] ? parseInt(parts[1], 10) : fileSize - 1, fileSize - 1);

    if (start >= fileSize || start > end) {
      return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
};
