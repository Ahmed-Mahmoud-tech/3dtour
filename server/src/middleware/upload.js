import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UPLOADS_ROOT } from '../utils/uploadPaths.js';

// ─── Ensure upload directories exist ─────────────────────────────────────────
const dirs = ['panoramas', 'videos', 'audio', 'images'];
dirs.forEach((dir) => {
  const fullPath = path.join(UPLOADS_ROOT, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

// ─── Storage engine (disk) ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // Route sets req.uploadDir before calling multer
    const dest = path.join(UPLOADS_ROOT, req.uploadDir || 'images');
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

// ─── File type filters ─────────────────────────────────────────────────────────
// Anchored: the whole extension must match, so 'x.svgpng' can't sneak through.
const imageFilter = (_req, file, cb) => {
  const ext = /^\.(jpe?g|png|webp)$/.test(path.extname(file.originalname).toLowerCase());
  if (ext && /jpeg|jpg|png|webp/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

const videoFilter = (_req, file, cb) => {
  const ext = /^\.(mp4|webm|mov)$/.test(path.extname(file.originalname).toLowerCase());
  if (ext && file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only MP4, WebM, and MOV video files are allowed'));
  }
};

const audioFilter = (_req, file, cb) => {
  const ext = /^\.(mp3|wav|ogg|aac)$/.test(path.extname(file.originalname).toLowerCase());
  if (ext && file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only MP3, WAV, OGG, and AAC audio files are allowed'));
  }
};

// ─── Exported multer instances ────────────────────────────────────────────────
export const uploadPanorama = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_IMAGE_SIZE) || 52_428_800 },
  fileFilter: imageFilter,
}).single('panorama');

export const uploadVideo = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_VIDEO_SIZE) || 524_288_000 },
  fileFilter: videoFilter,
}).single('video');

export const uploadAudio = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_VIDEO_SIZE) || 524_288_000 },
  fileFilter: audioFilter,
}).single('audio');

export const uploadImage = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_IMAGE_SIZE) || 52_428_800 },
  fileFilter: imageFilter,
}).single('image');

// Middleware to set the upload directory before multer runs
export const setUploadDir = (dir) => (req, _res, next) => {
  req.uploadDir = dir;
  next();
};
