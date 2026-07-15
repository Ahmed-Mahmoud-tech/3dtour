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

// Transition clips: cap resolution at 4K-equirect and target ~CRF 26. Audio is
// ALWAYS stripped — the viewer plays transition clips muted, so sound is dead
// weight in every file.
const VIDEO_MAX_WIDTH = 3840;
const VIDEO_CRF = 26;
// Re-encode only when the source is heavier than this (bits/sec); already
// optimized files just get their audio track remuxed away.
const VIDEO_BITRATE_THRESHOLD = 5_000_000;

// Popup cover images / logos: WebP, capped — they render in small overlays,
// nothing above this width is ever visible.
const IMAGE_MAX_WIDTH = 2048;
const IMAGE_QUALITY = 80;

// Background audio: anything heavier than this (WAV, 320k MP3…) is
// re-encoded to AAC 128k (.m4a) — transparent quality for ambient music at a
// fraction of the size.
const AUDIO_BITRATE_THRESHOLD = 160_000;
const AUDIO_TARGET_BITRATE = '128k';

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

/** Probe a media file's stream info; returns { width, bitrate, sizeBytes, hasAudio } */
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
        hasAudio: (data.streams || []).some((s) => s.codec_type === 'audio'),
        duration:
          parseFloat(stream.duration) || parseFloat(data.format?.duration) || 0,
      });
    });
  });
}

/**
 * Re-encode a transition video in place (same filename, so stored URLs stay
 * valid): H.264 CRF 26, faststart for progressive playback, audio stripped,
 * downscaled to max 3840 wide. Files already at a sane bitrate skip the
 * re-encode but still get their audio track removed (lossless remux).
 * Returns true if the file was rewritten.
 */
export async function optimizeVideoInPlace(inputPath, options = {}) {
  const { bitrate, width, hasAudio } = await probeVideo(inputPath);
  const alreadyLean =
    bitrate > 0 && bitrate <= VIDEO_BITRATE_THRESHOLD && width <= VIDEO_MAX_WIDTH;
  if (alreadyLean && !hasAudio) return false;

  const tmpPath = `${inputPath}.opt.mp4`;
  await new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath).noAudio();
    if (alreadyLean) {
      // Only the audio track has to go — copy the video stream untouched
      cmd.outputOptions(['-c:v', 'copy', '-movflags', '+faststart']);
    } else {
      cmd.outputOptions([
        '-c:v', 'libx264',
        '-crf', String(VIDEO_CRF),
        '-preset', 'fast',
        '-vf', `scale='min(${VIDEO_MAX_WIDTH},iw)':-2`,
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ]);
    }
    cmd
      .output(tmpPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  if (options.backupDir) backupFile(inputPath, options.backupDir);
  fs.renameSync(tmpPath, inputPath);
  return true;
}

/**
 * Convert an uploaded popup/logo image to WebP (max 2048 wide), replacing the
 * original. Returns the new file path; on failure, the original is kept and
 * returned unchanged.
 */
export async function optimizeImage(inputPath, options = {}) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const outPath = path.join(dir, `${base}.webp`);

  try {
    await sharp(inputPath, { limitInputPixels: false })
      .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: IMAGE_QUALITY, effort: 4 })
      .toFile(outPath + '.tmp');
    fs.renameSync(outPath + '.tmp', outPath);
    if (inputPath !== outPath) {
      if (options.backupDir) backupFile(inputPath, options.backupDir);
      else fs.unlinkSync(inputPath);
    }
    return outPath;
  } catch (err) {
    console.error('Image optimization failed (keeping original):', err.message);
    try { fs.unlinkSync(outPath + '.tmp'); } catch { /* never existed */ }
    return inputPath;
  }
}

/**
 * Re-encode heavy background audio (WAV, high-bitrate MP3…) to AAC 128k
 * (.m4a), replacing the original. Files already at/below the threshold are
 * kept as-is. Returns the final file path; on failure, the original is kept.
 */
export async function optimizeAudio(inputPath, options = {}) {
  try {
    const { bitrate } = await probeVideo(inputPath); // format-level probe works for audio too
    const ext = path.extname(inputPath).toLowerCase();
    if (ext !== '.wav' && bitrate > 0 && bitrate <= AUDIO_BITRATE_THRESHOLD) {
      return inputPath;
    }

    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, path.extname(inputPath));
    const outPath = path.join(dir, `${base}.m4a`);
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo() // drop embedded cover art — it's dead weight
        .outputOptions(['-c:a', 'aac', '-b:a', AUDIO_TARGET_BITRATE, '-movflags', '+faststart'])
        .output(outPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    if (inputPath !== outPath) {
      if (options.backupDir) backupFile(inputPath, options.backupDir);
      else fs.unlinkSync(inputPath);
    }
    return outPath;
  } catch (err) {
    console.error('Audio optimization failed (keeping original):', err.message);
    return inputPath;
  }
}
