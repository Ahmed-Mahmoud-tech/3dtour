import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  setUploadDir,
  uploadPanorama,
  uploadVideo,
  uploadAudio,
  uploadImage,
} from "../middleware/upload.js";
import {
  uploadPanoramaHandler,
  uploadAudioHandler,
  uploadImageHandler,
  uploadTransitionVideo,
  streamVideo,
} from "../controllers/mediaController.js";

const router = Router();

// Public video streaming endpoint (supports HTTP Range)
router.get("/stream/:folder/:filename", streamVideo);

// Protected upload endpoints
router.post(
  "/panorama",
  protect,
  setUploadDir("panoramas"),
  (req, res, next) => uploadPanorama(req, res, next),
  uploadPanoramaHandler,
);

router.post(
  "/audio",
  protect,
  setUploadDir("audio"),
  (req, res, next) => uploadAudio(req, res, next),
  uploadAudioHandler,
);

router.post(
  "/image",
  protect,
  setUploadDir("images"),
  (req, res, next) => uploadImage(req, res, next),
  uploadImageHandler,
);

router.post(
  "/video/:projectId",
  protect,
  setUploadDir("videos"),
  (req, res, next) => uploadVideo(req, res, next),
  uploadTransitionVideo,
);

export default router;
