import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Ensure upload directories exist ─────────────────────────────────────────
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
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
const imageFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

const videoFilter = (_req, file, cb) => {
  const allowed = /mp4|webm|mov/;
  if (allowed.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only MP4, WebM, and MOV video files are allowed'));
  }
};

const audioFilter = (_req, file, cb) => {
  const allowed = /mp3|wav|ogg|aac/;
  if (allowed.test(path.extname(file.originalname).toLowerCase())) {
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
