import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Project from "../models/Project.js";
import Subscription from "../models/Subscription.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

const deleteUploadByUrl = (url) => {
  try {
    if (!url || typeof url !== 'string') return;
    // Expect public urls like '/uploads/panoramas/xyz.jpg'
    if (!url.startsWith('/uploads/')) return;
    const rel = url.replace(/^\/uploads\//, '');
    const filePath = path.join(UPLOADS_ROOT, rel);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error('Failed to delete file for url', url, err.message);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nodeId = () => `node_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

// Studio access scope: admins see the projects they created, employees only
// the projects assigned to them (any other role matches nothing).
const scopeFilter = (req) =>
  req.user.role === "employee"
    ? { assignedTo: req.user._id }
    : { createdBy: req.user._id };
const signId = () => `sign_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
const hotspotId = () => `nav_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

// ─── Projects ────────────────────────────────────────────────────────────────

// Escape user input before embedding it in a $regex
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/projects?q&page&limit&noOwner&noEmployee
// q searches the title; noOwner=1 / noEmployee=1 keep only unassigned projects
// (used by the admin assign pickers). Without `page` the response is the
// legacy plain array; with it, { items, total, page, pages }.
export const getProjects = async (req, res) => {
  try {
    const filter = { ...scopeFilter(req) };
    if (req.query.q)
      filter["info.title"] = { $regex: escapeRegex(String(req.query.q).slice(0, 100)), $options: "i" };
    if (req.query.noOwner === "1") filter.owner = null;
    if (req.query.noEmployee === "1") filter.assignedTo = null;

    const select =
      "info settings.initialNodeId owner assignedTo suspended expiry createdAt updatedAt";

    if (req.query.page === undefined) {
      const projects = await Project.find(filter).select(select).sort("-createdAt");
      return res.json(projects);
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 100);
    const [items, total] = await Promise.all([
      Project.find(filter)
        .select(select)
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit),
      Project.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/projects/:id  (protected — studio reads)
export const getProject = async (req, res) => {
  try {
    const project =
      req.user.role === "employee"
        ? await Project.findOne({ _id: req.params.id, ...scopeFilter(req) })
        : await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Grace period the default expiry mode adds on top of the project's
// subscription expiry before the public route stops serving the tour.
const SUBSCRIPTION_GRACE_MONTHS = 3;

// GET /api/projects/:id/public  (viewer — no auth, but access-gated)
// A suspended tour is never served. Otherwise expiry.mode decides:
//  - 'lifetime': always served
//  - 'date': served until the admin-chosen date
//  - 'subscription' (default): each PROJECT carries its own subscription.
//    Tours assigned to an owner are served while the project's subscription
//    is active, plus a 3-month grace after its expiry date (a canceled
//    subscription blocks immediately; no subscription record blocks too).
//    Unassigned tours (admin-internal/demos) are always served.
export const getPublicProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (project.suspended) {
      return res.status(403).json({
        message: "This tour is currently unavailable",
        reason: "project_suspended",
      });
    }

    const mode = project.expiry?.mode || "subscription";

    if (mode === "date") {
      if (project.expiry?.date && project.expiry.date <= new Date()) {
        return res.status(403).json({
          message: "This tour is currently unavailable",
          reason: "project_expired",
        });
      }
    } else if (mode === "subscription" && project.owner) {
      const sub = await Subscription.findOne({ project: project._id })
        .select("status expiresAt")
        .lean();
      let active = false;
      if (sub && sub.status === "active") {
        const graceEnd = new Date(sub.expiresAt);
        graceEnd.setMonth(graceEnd.getMonth() + SUBSCRIPTION_GRACE_MONTHS);
        active = graceEnd > new Date();
      }
      if (!active) {
        return res.status(403).json({
          message: "This tour is currently unavailable",
          reason: "subscription_expired",
        });
      }
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/projects  (admins only — employees work on assigned projects)
export const createProject = async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admin access required" });

    const { title, author, nadirLogoUrl } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });

    const project = await Project.create({
      info: {
        title,
        author: author || req.user.name,
        nadirLogoUrl: nadirLogoUrl || "",
      },
      createdBy: req.user._id,
    });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/projects/:id  (full project update)
export const updateProject = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { info, settings, nodes, transitions } = req.body;
    if (info) {
      // Logo replaced (or cleared) — remove the previous uploaded file
      if (
        info.nadirLogoUrl !== undefined &&
        project.info.nadirLogoUrl &&
        info.nadirLogoUrl !== project.info.nadirLogoUrl
      ) {
        deleteUploadByUrl(project.info.nadirLogoUrl);
      }
      project.info = { ...project.info, ...info };
    }
    if (settings) project.settings = { ...project.settings, ...settings };
    if (nodes) {
      project.nodes = nodes;
      project.markModified("nodes");
    }
    if (transitions) {
      project.transitions = transitions;
      project.markModified("transitions");
    }

    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/projects/:id  (admins only)
export const deleteProject = async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admin access required" });

    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    // Collect all uploaded URLs referenced by this project
    const urls = new Set();

    if (project.info?.nadirLogoUrl) urls.add(project.info.nadirLogoUrl);

    project.nodes.forEach((node) => {
      if (!node) return;
      if (node.panoramaUrl) urls.add(node.panoramaUrl);
      if (node.panoramaPreviewUrl) urls.add(node.panoramaPreviewUrl);
      (node.navigationHotspots || []).forEach((hs) => {
        if (hs.transitionVideoUrl) urls.add(hs.transitionVideoUrl);
        if (hs.reverseTransitionVideoUrl) urls.add(hs.reverseTransitionVideoUrl);
      });
      (node.infoSigns || []).forEach((s) => {
        if (s?.popupContent?.coverImage) urls.add(s.popupContent.coverImage);
      });
    });

    project.transitions.forEach((t) => {
      if (!t) return;
      if (t.videoUrl) urls.add(t.videoUrl);
      if (t.reverseVideoUrl) urls.add(t.reverseVideoUrl);
    });

    // Delete files from disk
    urls.forEach((u) => deleteUploadByUrl(u));

    // Finally remove the project document + its subscription
    await Promise.all([
      Project.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id }),
      Subscription.deleteOne({ project: req.params.id }),
    ]);
    res.json({ message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Nodes ────────────────────────────────────────────────────────────────────

// POST /api/projects/:id/nodes
export const addNode = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { displayName, panoramaUrl, panoramaPreviewUrl, initialYawOffset } = req.body;
    if (!displayName || !panoramaUrl)
      return res
        .status(400)
        .json({ message: "displayName and panoramaUrl are required" });

    const id = nodeId();
    const node = {
      id,
      displayName,
      panoramaUrl,
      panoramaPreviewUrl: panoramaPreviewUrl || "",
      initialYawOffset: initialYawOffset || 0,
    };
    project.nodes.set(id, node);
    await project.save();

    // Auto-set initialNodeId if this is the first node
    if (project.nodes.size === 1) {
      project.settings.initialNodeId = id;
      await project.save();
    }

    res.status(201).json({ id, node: project.nodes.get(id) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/projects/:id/nodes/:nodeId
export const updateNode = async (req, res) => {
  try {
    console.log("updateNode req.body:", req.body);
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId } = req.params;
    if (!project.nodes.has(nodeId))
      return res.status(404).json({ message: "Node not found" });

    // 1. Convert the Mongoose Map document to a plain JavaScript object
    const existingNode = project.nodes.get(nodeId);
    const existing = existingNode.toObject
      ? existingNode.toObject()
      : existingNode;

    const updateData = { ...req.body };
    console.log("Parsed updateData:", updateData);

    // Ensure initialYawOffset is properly parsed as a number
    if (updateData.initialYawOffset !== undefined) {
      updateData.initialYawOffset =
        parseFloat(updateData.initialYawOffset) || 0;
    }

    // 2. Remove any replaced uploads (panorama + its preview)
    if (updateData.panoramaUrl && existing.panoramaUrl && updateData.panoramaUrl !== existing.panoramaUrl) {
      deleteUploadByUrl(existing.panoramaUrl);
      if (existing.panoramaPreviewUrl) deleteUploadByUrl(existing.panoramaPreviewUrl);
    }

    // 3. Merge the plain 'existing' object with the new 'updateData'
    project.nodes.set(nodeId, { ...existing, ...updateData, id: nodeId });

    // Required for Mongoose to detect Map changes
    project.markModified("nodes");

    await project.save();

    res.json(project.nodes.get(nodeId));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// DELETE /api/projects/:id/nodes/:nodeId
export const deleteNode = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId } = req.params;
    if (!project.nodes.has(nodeId))
      return res.status(404).json({ message: "Node not found" });

    // Before deleting node, collect and remove its uploads
    const node = project.nodes.get(nodeId);
    if (node) {
      if (node.panoramaUrl) deleteUploadByUrl(node.panoramaUrl);
      if (node.panoramaPreviewUrl) deleteUploadByUrl(node.panoramaPreviewUrl);
      (node.navigationHotspots || []).forEach((hs) => {
        if (hs.transitionVideoUrl) deleteUploadByUrl(hs.transitionVideoUrl);
        if (hs.reverseTransitionVideoUrl) deleteUploadByUrl(hs.reverseTransitionVideoUrl);

        // Also remove any shared transition record referenced by this hotspot
        if (hs.transitionId && project.transitions.has(hs.transitionId)) {
          const tr = project.transitions.get(hs.transitionId);
          if (tr?.videoUrl) deleteUploadByUrl(tr.videoUrl);
          if (tr?.reverseVideoUrl) deleteUploadByUrl(tr.reverseVideoUrl);
          project.transitions.delete(hs.transitionId);
        }
      });
      (node.infoSigns || []).forEach((s) => {
        if (s?.popupContent?.coverImage) deleteUploadByUrl(s.popupContent.coverImage);
      });
      project.markModified('transitions');
    }

    project.nodes.delete(nodeId);
    if (project.settings.initialNodeId === nodeId) {
      const firstKey = project.nodes.keys().next().value;
      project.settings.initialNodeId = firstKey || "";
    }
    await project.save();
    res.json({ message: "Node deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Navigation Hotspots ──────────────────────────────────────────────────────

// POST /api/projects/:id/nodes/:nodeId/hotspots
export const addHotspot = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId } = req.params;
    const node = project.nodes.get(nodeId);
    if (!node) return res.status(404).json({ message: "Node not found" });

    // Separate transition data from hotspot fields
    const { _transitionData, ...hotspotBody } = req.body;

    const hotspot = { id: hotspotId(), ...hotspotBody };
    node.navigationHotspots = [...(node.navigationHotspots || []), hotspot];
    project.nodes.set(nodeId, node);

    // Save transition atomically in the same save() call
    if (_transitionData && _transitionData.id && _transitionData.videoUrl) {
      project.transitions.set(_transitionData.id, _transitionData);
    }

    await project.save();
    res.status(201).json(hotspot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/projects/:id/nodes/:nodeId/hotspots/:hotspotId
export const updateHotspot = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId, hotspotId } = req.params;
    const node = project.nodes.get(nodeId);
    if (!node) return res.status(404).json({ message: "Node not found" });

    const idx = node.navigationHotspots.findIndex((h) => h.id === hotspotId);
    if (idx === -1)
      return res.status(404).json({ message: "Hotspot not found" });

    // Separate transition data from hotspot fields
    const { _transitionData, ...hotspotBody } = req.body;

    const existingHotspot = node.navigationHotspots[idx];

    // If hotspot is replacing an uploaded video, remove the old file
    if (
      hotspotBody.transitionVideoUrl &&
      existingHotspot.transitionVideoUrl &&
      hotspotBody.transitionVideoUrl !== existingHotspot.transitionVideoUrl
    ) {
      deleteUploadByUrl(existingHotspot.transitionVideoUrl);
    }
    if (
      hotspotBody.reverseTransitionVideoUrl &&
      existingHotspot.reverseTransitionVideoUrl &&
      hotspotBody.reverseTransitionVideoUrl !== existingHotspot.reverseTransitionVideoUrl
    ) {
      deleteUploadByUrl(existingHotspot.reverseTransitionVideoUrl);
    }

    node.navigationHotspots[idx] = {
      ...node.navigationHotspots[idx],
      ...hotspotBody,
      id: hotspotId,
    };
    project.nodes.set(nodeId, node);

    // Save transition atomically in the same save() call
    if (_transitionData && _transitionData.id && _transitionData.videoUrl) {
      // If replacing an existing transition video, delete the old file
      const existingTransition = project.transitions.get(_transitionData.id);
      if (
        existingTransition &&
        existingTransition.videoUrl &&
        existingTransition.videoUrl !== _transitionData.videoUrl
      ) {
        deleteUploadByUrl(existingTransition.videoUrl);
      }
      if (
        existingTransition &&
        existingTransition.reverseVideoUrl &&
        _transitionData.reverseVideoUrl &&
        existingTransition.reverseVideoUrl !== _transitionData.reverseVideoUrl
      ) {
        deleteUploadByUrl(existingTransition.reverseVideoUrl);
      }

      project.transitions.set(_transitionData.id, _transitionData);
    }

    await project.save();
    res.json(node.navigationHotspots[idx]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/projects/:id/nodes/:nodeId/hotspots/:hotspotId
export const deleteHotspot = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId, hotspotId } = req.params;
    const node = project.nodes.get(nodeId);
    if (!node) return res.status(404).json({ message: "Node not found" });

    node.navigationHotspots = node.navigationHotspots.filter(
      (h) => h.id !== hotspotId,
    );
    project.nodes.set(nodeId, node);
    await project.save();
    res.json({ message: "Hotspot deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Info Signs ───────────────────────────────────────────────────────────────

// POST /api/projects/:id/nodes/:nodeId/signs
export const addSign = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId } = req.params;
    const node = project.nodes.get(nodeId);
    if (!node) return res.status(404).json({ message: "Node not found" });

    const sign = { id: signId(), ...req.body };
    node.infoSigns = [...(node.infoSigns || []), sign];
    project.nodes.set(nodeId, node);
    await project.save();
    res.status(201).json(sign);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/projects/:id/nodes/:nodeId/signs/:signId
export const updateSign = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId, signId } = req.params;
    const node = project.nodes.get(nodeId);
    if (!node) return res.status(404).json({ message: "Node not found" });

    const idx = node.infoSigns.findIndex((s) => s.id === signId);
    if (idx === -1) return res.status(404).json({ message: "Sign not found" });

    // If updating popup cover image, delete the previous uploaded file
    const existingSign = node.infoSigns[idx];
    const newCover = req.body?.popupContent?.coverImage;
    if (newCover && existingSign?.popupContent?.coverImage && newCover !== existingSign.popupContent.coverImage) {
      deleteUploadByUrl(existingSign.popupContent.coverImage);
    }

    node.infoSigns[idx] = { ...node.infoSigns[idx], ...req.body, id: signId };
    project.nodes.set(nodeId, node);
    await project.save();
    res.json(node.infoSigns[idx]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/projects/:id/nodes/:nodeId/signs/:signId
export const deleteSign = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId, signId } = req.params;
    const node = project.nodes.get(nodeId);
    if (!node) return res.status(404).json({ message: "Node not found" });

    node.infoSigns = node.infoSigns.filter((s) => s.id !== signId);
    project.nodes.set(nodeId, node);
    await project.save();
    res.json({ message: "Sign deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── Transitions ──────────────────────────────────────────────────────────────

// DELETE /api/projects/:id/transitions/:transitionId
export const deleteTransition = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      ...scopeFilter(req),
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { transitionId } = req.params;
    if (!project.transitions.has(transitionId))
      return res.status(404).json({ message: "Transition not found" });

    project.transitions.delete(transitionId);
    await project.save();
    res.json({ message: "Transition deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
