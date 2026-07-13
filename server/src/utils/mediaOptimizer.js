import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

// Panorama output settings. 7680 keeps full source detail on desktop GPUs
// (most 2018+ mobile GPUs also accept 8192 textures). The preview is small
// enough (~100 KB) to decode near-instantly for the blur-up first paint.
const PANORAMA_MAX_WIDTH = 7680;
const PANORAMA_QUALITY = 82;
const PREVIEW_WIDTH = 1536;
const PREVIEW_QUALITY = 60;

// Transition clips: cap resolution at 4K-equirect and target ~CRF 25. Audio is
// stripped — the viewer always plays transition clips muted.
const VIDEO_MAX_WIDTH = 3840;
const VIDEO_CRF = 25;
// Re-encode only when the source is heavier than this (bits/sec); already
// optimized files pass through untouched.
const VIDEO_BITRATE_THRESHOLD = 7_000_000;

/** Move a file into a backup directory (created on demand) instead of deleting it */
function backupFile(filePath, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  fs.renameSync(filePath, path.join(backupDir, path.basename(filePath)));
}

/**
 * Convert an uploaded panorama to WebP and generate a low-res preview.
 * Replaces the original file (deleted, or moved to options.backupDir if
 * given, unless it was already the .webp target). Returns { filePath, previewPath }.
 */
export async function optimizePanorama(inputPath, options = {}) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const fullPath = path.join(dir, `${base}.webp`);
  const previewPath = path.join(dir, `${base}_preview.webp`);

  const image = sharp(inputPath, { limitInputPixels: false });
  const meta = await image.metadata();
  const targetWidth = Math.min(meta.width || PANORAMA_MAX_WIDTH, PANORAMA_MAX_WIDTH);

  await image
    .clone()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality: PANORAMA_QUALITY, effort: 4 })
    .toFile(fullPath + '.tmp');

  await image
    .clone()
    .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
    .webp({ quality: PREVIEW_QUALITY, effort: 4 })
    .toFile(previewPath);

  // Atomic-ish swap: only remove the source after both outputs succeeded
  fs.renameSync(fullPath + '.tmp', fullPath);
  if (inputPath !== fullPath) {
    if (options.backupDir) backupFile(inputPath, options.backupDir);
    else fs.unlinkSync(inputPath);
  }

  return { filePath: fullPath, previewPath };
}

/** Probe a video's stream info; returns { width, bitrate, sizeBytes } */
export function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(err);
      const stream = (data.streams || []).find((s) => s.codec_type === 'video') || {};
      resolve({
        width: stream.width || 0,
        bitrate:
          parseInt(stream.bit_rate, 10) ||
          parseInt(data.format?.bit_rate, 10) ||
          0,
        sizeBytes: parseInt(data.format?.size, 10) || fs.statSync(inputPath).size,
      });
    });
  });
}

/**
 * Re-encode a transition video in place (same filename, so stored URLs stay
 * valid): H.264 CRF 25, faststart for progressive playback, audio stripped,
 * downscaled to max 3840 wide. Skips files already at a sane bitrate.
 * Returns true if the file was re-encoded.
 */
export async function optimizeVideoInPlace(inputPath, options = {}) {
  const { bitrate, width } = await probeVideo(inputPath);
  if (bitrate > 0 && bitrate <= VIDEO_BITRATE_THRESHOLD && width <= VIDEO_MAX_WIDTH) {
    return false;
  }

  const tmpPath = `${inputPath}.opt.mp4`;
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noAudio()
      .outputOptions([
        '-c:v', 'libx264',
        '-crf', String(VIDEO_CRF),
        '-preset', 'fast',
        '-vf', `scale='min(${VIDEO_MAX_WIDTH},iw)':-2`,
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ])
      .output(tmpPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  if (options.backupDir) backupFile(inputPath, options.backupDir);
  fs.renameSync(tmpPath, inputPath);
  return true;
}
