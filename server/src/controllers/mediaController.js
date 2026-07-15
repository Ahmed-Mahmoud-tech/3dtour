import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import Project from '../models/Project.js';
import {
  optimizePanorama,
  optimizeVideoInPlace,
  optimizeImage,
  optimizeAudio,
  probeVideo,
} from '../utils/mediaOptimizer.js';
import { rampRateAt, RAMP_OUTPUT_FPS } from '../config/speedRamp.js';

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

    // Strip audio entirely — transition clips are always muted in the viewer,
    // and `areverse` fails when the source has no audio track.
    ffmpeg(inputPath)
      .videoFilters('reverse')
      .noAudio()
      .outputOptions([
        '-pix_fmt', 'yuv420p', // broad browser compatibility
        '-c:v', 'libx264',
        '-crf', '25',
        '-preset', 'fast',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });

/**
 * Bake the transition speed ramp (server/src/config/speedRamp.js) INTO a
 * video file: every input frame gets a new timestamp so the clip itself
 * plays the wave — slow/fast exactly as configured — at plain 1x in any
 * browser. No runtime speed logic exists in the viewer.
 *
 * The time-warp t_out(t_in) = ∫ dt/rate is integrated numerically and
 * approximated as a piecewise-linear `setpts` expression (64 pieces), then
 * `fps` resamples to a constant frame rate.
 *
 * Output: `<name>_ramped<ext>` next to the input. Promise<outputPath>
 */
export const bakeSpeedRamp = async (inputPath) => {
  const { duration } = await probeVideo(inputPath);
  if (!duration || !Number.isFinite(duration)) {
    throw new Error(`cannot determine duration of ${inputPath}`);
  }

  // Numerically integrate output time over N linear pieces (midpoint rule)
  const N = 64;
  const tIn = [];
  const tOut = [];
  let acc = 0;
  for (let i = 0; i <= N; i++) {
    tIn.push((duration * i) / N);
    tOut.push(acc);
    if (i < N) acc += duration / N / rampRateAt((i + 0.5) / N);
  }

  // Nested-if piecewise-linear mapping of T (input seconds) → output seconds
  let expr = `${tOut[N].toFixed(6)}+(T-${tIn[N].toFixed(6)})/${rampRateAt(1).toFixed(6)}`;
  for (let i = N - 1; i >= 0; i--) {
    const slope = (tOut[i + 1] - tOut[i]) / (tIn[i + 1] - tIn[i]);
    expr = `if(lt(T,${tIn[i + 1].toFixed(6)}),${tOut[i].toFixed(6)}+(T-${tIn[i].toFixed(6)})*${slope.toFixed(6)},${expr})`;
  }

  const ext = path.extname(inputPath);
  const outputPath = path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, ext)}_ramped${ext}`,
  );

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      // Single quotes protect the commas inside if(...) from the filtergraph parser
      .videoFilters([`setpts='(${expr})/TB'`, `fps=${RAMP_OUTPUT_FPS}`])
      .noAudio()
      .outputOptions([
        '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264',
        '-crf', '25',
        '-preset', 'fast',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return outputPath;
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

    // Async processing: first shrink the forward clip in place (same filename,
    // so the URL we just returned stays valid), then generate the reverse and
    // the speed-ramp-baked variants from the optimized file so they inherit
    // the smaller size.
    try {
      await optimizeVideoInPlace(req.file.path).catch((err) =>
        console.error('Video optimization failed (continuing with original):', err.message),
      );
      const rampedVideoUrl = await bakeSpeedRamp(req.file.path)
        .then(toPublicUrl)
        .catch((err) => {
          console.error('FFmpeg ramp bake failed:', err.message);
          return '';
        });
      const reversedPath = await reverseVideo(req.file.path);
      const reverseVideoUrl = toPublicUrl(reversedPath);
      const reverseRampedVideoUrl = await bakeSpeedRamp(reversedPath)
        .then(toPublicUrl)
        .catch((err) => {
          console.error('FFmpeg reverse ramp bake failed:', err.message);
          return '';
        });

      if (projectId && transitionId) {
        const project = await Project.findById(projectId);
        if (project) {
          // Patch the shared transition record
          if (project.transitions.has(transitionId)) {
            const transition = project.transitions.get(transitionId);
            transition.reverseVideoUrl = reverseVideoUrl;
            transition.rampedVideoUrl = rampedVideoUrl;
            transition.reverseRampedVideoUrl = reverseRampedVideoUrl;
            project.transitions.set(transitionId, transition);
          }
          // Also patch any hotspot (and multi-video segment) that embeds this
          // transitionId directly
          project.nodes.forEach((node) => {
            node.navigationHotspots.forEach((hs) => {
              if (hs.transitionId === transitionId) {
                hs.reverseTransitionVideoUrl = reverseVideoUrl;
                hs.rampedTransitionVideoUrl = rampedVideoUrl;
                hs.reverseRampedTransitionVideoUrl = reverseRampedVideoUrl;
              }
              hs.transitionVideos?.forEach((item) => {
                if (item.transitionId === transitionId) {
                  item.rampedVideoUrl = rampedVideoUrl;
                  item.reverseRampedVideoUrl = reverseRampedVideoUrl;
                }
              });
            });
          });
          project.markModified('nodes');
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

// GET /api/media/reverse-status/:projectId/:transitionId
export const getReverseStatus = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const transition = project.transitions.get(req.params.transitionId);
    if (!transition) return res.status(404).json({ message: 'Transition not found' });

    res.json({
      reverseVideoUrl: transition.reverseVideoUrl || '',
      rampedVideoUrl: transition.rampedVideoUrl || '',
      reverseRampedVideoUrl: transition.reverseRampedVideoUrl || '',
      ready: Boolean(transition.reverseVideoUrl),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
