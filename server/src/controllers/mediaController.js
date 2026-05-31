import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import Project from '../models/Project.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

// Configure FFmpeg path from env if provided
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a local filesystem path to a public URL path */
const toPublicUrl = (filePath) => {
  const relative = path.relative(UPLOADS_ROOT, filePath).replace(/\\/g, '/');
  return `/uploads/${relative}`;
};

/** Reverse a video using FFmpeg, returns a Promise<outputPath> */
const reverseVideo = (inputPath) =>
  new Promise((resolve, reject) => {
    const ext = path.extname(inputPath);
    const uniqueName = `${Date.now()}-${uuidv4().slice(0, 8)}_reversed${ext}`;
    const outputPath = path.join(path.dirname(inputPath), uniqueName);

    ffmpeg(inputPath)
      .videoFilters('reverse')
      .audioFilters('areverse')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });

// ─── Upload Panorama ──────────────────────────────────────────────────────────

// POST /api/media/panorama
export const uploadPanoramaHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = toPublicUrl(req.file.path);
    res.status(201).json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Upload Audio ─────────────────────────────────────────────────────────────

// POST /api/media/audio
export const uploadAudioHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = toPublicUrl(req.file.path);
    res.status(201).json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Upload Image (popup cover) ───────────────────────────────────────────────

// POST /api/media/image
export const uploadImageHandler = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = toPublicUrl(req.file.path);
    res.status(201).json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Upload Transition Video (auto-generates reversed copy) ──────────────────

// POST /api/media/video/:projectId
export const uploadTransitionVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { projectId } = req.params;
    const { transitionId } = req.body;

    const videoUrl = toPublicUrl(req.file.path);

    // Start FFmpeg reverse in background — respond immediately with forward URL
    // Reversed URL will be patched into the project once FFmpeg finishes
    res.status(201).json({ videoUrl, reverseVideoUrl: '', message: 'Reverse processing started' });

    // Async reverse processing
    try {
      const reversedPath = await reverseVideo(req.file.path);
      const reverseVideoUrl = toPublicUrl(reversedPath);

      if (projectId && transitionId) {
        const project = await Project.findById(projectId);
        if (project && project.transitions.has(transitionId)) {
          const transition = project.transitions.get(transitionId);
          transition.reverseVideoUrl = reverseVideoUrl;
          project.transitions.set(transitionId, transition);
          await project.save();
        }
      }
    } catch (ffmpegErr) {
      console.error('FFmpeg reverse failed:', ffmpegErr.message);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Video Streaming (HTTP Range support) ─────────────────────────────────────

// GET /api/media/stream/:folder/:filename
export const streamVideo = (req, res) => {
  const { folder, filename } = req.params;

  // Prevent path traversal attacks
  const safeFolder = path.basename(folder);
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOADS_ROOT, safeFolder, safeFilename);

  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(filePath).pipe(res);
  }
};

// GET /api/media/reverse-status/:projectId/:transitionId
export const getReverseStatus = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const transition = project.transitions.get(req.params.transitionId);
    if (!transition) return res.status(404).json({ message: 'Transition not found' });

    res.json({
      reverseVideoUrl: transition.reverseVideoUrl || '',
      ready: Boolean(transition.reverseVideoUrl),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
