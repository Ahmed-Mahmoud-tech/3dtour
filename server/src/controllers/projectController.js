import { v4 as uuidv4 } from "uuid";
import Project from "../models/Project.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nodeId = () => `node_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
const signId = () => `sign_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
const hotspotId = () => `nav_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

// ─── Projects ────────────────────────────────────────────────────────────────

// GET /api/projects
export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ createdBy: req.user._id })
      .select("info settings.initialNodeId createdAt updatedAt")
      .sort("-createdAt");
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/projects/:id  (public — no auth needed for viewer)
export const getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/projects
export const createProject = async (req, res) => {
  try {
    const { title, author } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });

    const project = await Project.create({
      info: { title, author: author || req.user.name },
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
      createdBy: req.user._id,
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { info, settings, nodes, transitions } = req.body;
    if (info) project.info = { ...project.info, ...info };
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

// DELETE /api/projects/:id
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id,
    });
    if (!project) return res.status(404).json({ message: "Project not found" });
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
      createdBy: req.user._id,
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { displayName, panoramaUrl, initialYawOffset } = req.body;
    if (!displayName || !panoramaUrl)
      return res
        .status(400)
        .json({ message: "displayName and panoramaUrl are required" });

    const id = nodeId();
    const node = {
      id,
      displayName,
      panoramaUrl,
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
      createdBy: req.user._id,
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

    // 2. Merge the plain 'existing' object with the new 'updateData'
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
      createdBy: req.user._id,
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId } = req.params;
    if (!project.nodes.has(nodeId))
      return res.status(404).json({ message: "Node not found" });

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
      createdBy: req.user._id,
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
      createdBy: req.user._id,
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

    node.navigationHotspots[idx] = {
      ...node.navigationHotspots[idx],
      ...hotspotBody,
      id: hotspotId,
    };
    project.nodes.set(nodeId, node);

    // Save transition atomically in the same save() call
    if (_transitionData && _transitionData.id && _transitionData.videoUrl) {
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
      createdBy: req.user._id,
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
      createdBy: req.user._id,
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
      createdBy: req.user._id,
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const { nodeId, signId } = req.params;
    const node = project.nodes.get(nodeId);
    if (!node) return res.status(404).json({ message: "Node not found" });

    const idx = node.infoSigns.findIndex((s) => s.id === signId);
    if (idx === -1) return res.status(404).json({ message: "Sign not found" });

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
      createdBy: req.user._id,
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
      createdBy: req.user._id,
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
