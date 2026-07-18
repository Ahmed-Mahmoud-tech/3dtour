import { Router } from "express";
import { protect, requireRole } from "../middleware/auth.js";
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
import { scopeFilter } from "../controllers/projectController.js";
import Project from "../models/Project.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Public video streaming endpoint (supports HTTP Range)
router.get("/stream/:folder/:filename", streamVideo);

// Uploads are for staff building tours — owner tokens must never be able to
// write to the server's disk.
router.use(protect, requireRole("admin", "employee"));

// Size/type rejections from multer are client errors, not server faults —
// surface the real reason as a 400 instead of a masked 500.
const runUpload = (uploader) => (req, res, next) =>
  uploader(req, res, (err) => {
    if (!err) return next();
    err.status = 400;
    next(err);
  });

// The transition-video route names a project — verify the caller may edit it
// (same scoping as the studio) BEFORE multer writes anything to disk.
const requireProjectAccess = asyncHandler(async (req, _res, next) => {
  const project = await Project.findOne({
    _id: req.params.projectId,
    ...scopeFilter(req),
  }).select("_id");
  if (!project) {
    const err = new Error("Project not found");
    err.status = 404;
    throw err;
  }
  next();
});

router.post(
  "/panorama",
  setUploadDir("panoramas"),
  runUpload(uploadPanorama),
  uploadPanoramaHandler,
);

router.post(
  "/audio",
  setUploadDir("audio"),
  runUpload(uploadAudio),
  uploadAudioHandler,
);

router.post(
  "/image",
  setUploadDir("images"),
  runUpload(uploadImage),
  uploadImageHandler,
);

router.post(
  "/video/:projectId",
  requireProjectAccess,
  setUploadDir("videos"),
  runUpload(uploadVideo),
  uploadTransitionVideo,
);

export default router;
