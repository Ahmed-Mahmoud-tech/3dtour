import path from 'path';
import fs from 'fs';
import {
  optimizePanorama,
  optimizeVideoInPlace,
  optimizeImage,
  optimizeAudio,
  LOGO_MAX_WIDTH,
} from '../utils/mediaOptimizer.js';
import { UPLOADS_ROOT } from '../utils/uploadPaths.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recordUpload } from '../utils/mediaBinding.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a local filesystem path to a public URL path */
const toPublicUrl = (filePath) => {
  const relative = path.relative(UPLOADS_ROOT, filePath).replace(/\\/g, '/');
  return `/uploads/${relative}`;
};

// ─── Upload Panorama ──────────────────────────────────────────────────────────

// POST /api/media/panorama
export const uploadPanoramaHandler = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  // Convert to WebP (~10x smaller than PNG) + tiny preview for blur-up loading
  // + a 4096-wide mobile tier for GPUs that can't take the full texture.
  // The uploaded original is deleted once the derived files exist.
  const { filePath, previewPath, mobilePath } = await optimizePanorama(req.file.path);
  const url = toPublicUrl(filePath);
  const previewUrl = toPublicUrl(previewPath);
  const mobileUrl = mobilePath ? toPublicUrl(mobilePath) : '';
  await Promise.all([
    recordUpload(url, req.user._id),
    recordUpload(previewUrl, req.user._id),
    mobileUrl ? recordUpload(mobileUrl, req.user._id) : Promise.resolve(),
  ]);
  res.status(201).json({ url, previewUrl, mobileUrl });
});

// ─── Upload Audio ─────────────────────────────────────────────────────────────

// POST /api/media/audio
export const uploadAudioHandler = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  // Heavy sources (WAV, 320k MP3…) are re-encoded to AAC 128k
  const finalPath = await optimizeAudio(req.file.path);
  const url = toPublicUrl(finalPath);
  await recordUpload(url, req.user._id);
  res.status(201).json({ url });
});

// ─── Upload Image (popup cover / nadir logo) ──────────────────────────────────

// POST /api/media/image[?kind=logo]
export const uploadImageHandler = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  // Convert to WebP. Popup covers cap at 2048 wide (they render in overlays);
  // logos render on the small nadir floor disc, so ?kind=logo caps at 200 wide
  // with icon-tuned encoding.
  const isLogo = req.query.kind === 'logo';
  const finalPath = await optimizeImage(
    req.file.path,
    isLogo ? { maxWidth: LOGO_MAX_WIDTH, preset: 'icon' } : {},
  );
  const url = toPublicUrl(finalPath);
  await recordUpload(url, req.user._id);
  res.status(201).json({ url });
});

// ─── Upload Transition Video ──────────────────────────────────────────────────

// POST /api/media/video/:projectId
export const uploadTransitionVideo = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const videoUrl = toPublicUrl(req.file.path);

  // Bind to the project from the (access-checked) route param so it's owned
  // before the client attaches it to a hotspot.
  await recordUpload(videoUrl, req.user._id, req.params.projectId);

  // Respond immediately; the clip is shrunk in place in the background
  res.status(201).json({ videoUrl });

  // Shrink the clip in place (same filename, so the URL we just returned
  // stays valid). The camera original is DELETED after the transcode passes
  // its sanity check (policy 2026-07-19: originals are unused weight on disk).
  // Set KEEP_ORIGINALS=1 to archive masters in _originals instead — that
  // archive is what made the July 2026 frame-corruption recovery possible
  // (see scripts/restore-originals.mjs), so flip it back on if transcodes
  // ever look suspect.
  const keepOriginals = process.env.KEEP_ORIGINALS === '1';
  await optimizeVideoInPlace(req.file.path, {
    ...(keepOriginals ? { backupDir: path.join(UPLOADS_ROOT, '_originals') } : {}),
  }).catch((err) =>
    console.error('Video optimization failed (continuing with original):', err.message),
  );
});

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

export const streamVideo = asyncHandler(async (req, res) => {
  const { folder, filename } = req.params;

  // Prevent path traversal attacks; only real upload folders are streamable
  const safeFolder = path.basename(folder);
  const safeFilename = path.basename(filename);
  if (!STREAM_FOLDERS.has(safeFolder)) return res.status(404).json({ message: 'File not found' });
  const filePath = path.join(UPLOADS_ROOT, safeFolder, safeFilename);

  let stat;
  try {
    stat = await fs.promises.stat(filePath); // async — never block the event loop per request
  } catch {
    return res.status(404).json({ message: 'File not found' });
  }

  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = STREAM_TYPES[path.extname(safeFilename).toLowerCase()] || 'video/mp4';

  // A mid-stream disk error can't become a JSON 500 (headers are gone) —
  // just tear the connection down.
  const pipeSafely = (stream) => {
    stream.on('error', (err) => {
      console.error('Stream error for', filePath, err.message);
      res.destroy(err);
    });
    stream.pipe(res);
  };

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10) || 0;
    const end = Math.min(parts[1] ? parseInt(parts[1], 10) : fileSize - 1, fileSize - 1);

    if (start >= fileSize || start > end) {
      return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    }

    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    pipeSafely(fs.createReadStream(filePath, { start, end }));
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
    });
    pipeSafely(fs.createReadStream(filePath));
  }
});
