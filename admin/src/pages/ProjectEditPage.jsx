import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { projectApi, nodeApi, mediaApi } from "../api/projectApi.js";
import NodeEditModal from "../components/Studio/NodeEditModal.jsx";
import {
  FaArrowLeft,
  FaPlus,
  FaTrash,
  FaCube,
  FaGlobe,
  FaSave,
  FaSyncAlt,
  FaExternalLinkAlt,
  FaEdit,
} from "react-icons/fa";

/**
 * ProjectEditPage
 *
 * Allows the admin to:
 *  - Edit project metadata (title, author)
 *  - Manage nodes: add/delete panorama nodes, set initial node
 *  - Upload global background audio
 *  - Navigate to the 3D Studio for hotspot/sign placement
 */
export default function ProjectEditPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({ title: "", author: "" });
  const [audioFile, setAudioFile] = useState(null);
  const [audioUploading, setAudioUploading] = useState(false);

  // New node form
  const [newNode, setNewNode] = useState({
    displayName: "",
    initialYawOffset: 0,
  });
  const [panoramaFile, setPanoramaFile] = useState(null);
  const [nodeUploading, setNodeUploading] = useState(false);

  // Edit node state
  const [editingNode, setEditingNode] = useState(null);
  const [nodeUpdating, setNodeUpdating] = useState(false);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const data = await projectApi.get(projectId);
      setProject(data);
      setMeta({
        title: data.info?.title || "",
        author: data.info?.author || "",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  // ─── Save metadata ──────────────────────────────────────────────────────
  const handleSaveMeta = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await projectApi.update(projectId, { info: meta });
      setProject(updated);
    } finally {
      setSaving(false);
    }
  };

  // ─── Upload audio ───────────────────────────────────────────────────────
  const handleAudioUpload = async () => {
    if (!audioFile) return;
    setAudioUploading(true);
    try {
      const { url } = await mediaApi.uploadAudio(audioFile);
      await projectApi.update(projectId, {
        settings: {
          ...project.settings,
          globalBackgroundAudio: {
            ...project.settings?.globalBackgroundAudio,
            src: url,
          },
        },
      });
      await fetchProject();
      setAudioFile(null);
    } finally {
      setAudioUploading(false);
    }
  };

  // ─── Add node ───────────────────────────────────────────────────────────
  const handleAddNode = async (e) => {
    e.preventDefault();
    if (!newNode.displayName || !panoramaFile) return;
    setNodeUploading(true);
    try {
      const { url } = await mediaApi.uploadPanorama(panoramaFile);
      await nodeApi.add(projectId, {
        displayName: newNode.displayName,
        panoramaUrl: url,
        initialYawOffset: parseFloat(newNode.initialYawOffset) || 0,
      });
      await fetchProject();
      setNewNode({ displayName: "", initialYawOffset: 0 });
      setPanoramaFile(null);
    } finally {
      setNodeUploading(false);
    }
  };

  // ─── Set initial node ───────────────────────────────────────────────────
  const handleSetInitialNode = async (nodeId) => {
    await projectApi.update(projectId, {
      settings: { ...project.settings, initialNodeId: nodeId },
    });
    await fetchProject();
  };

  // ─── Edit node ───────────────────────────────────────────────────────────
  const handleEditNode = (node) => {
    setEditingNode(node);
  };

  const handleUpdateNode = async (updateData) => {
    setNodeUpdating(true);
    try {
      await nodeApi.update(projectId, editingNode.id, updateData);
      await fetchProject();
      setEditingNode(null);
    } catch (err) {
      console.error("Failed to update node:", err);
      alert("Failed to update node");
    } finally {
      setNodeUpdating(false);
    }
  };

  // ─── Delete node ─────────────────────────────────────────────────────────
  const handleDeleteNode = async (nodeId) => {
    if (!window.confirm("Delete this node and all its hotspots/signs?")) return;
    await nodeApi.delete(projectId, nodeId);
    await fetchProject();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const nodes = Object.values(project?.nodes || {});
  const initialNodeId = project?.settings?.initialNodeId;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-950 z-10">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <FaArrowLeft size={12} />
          </Link>
          <FaGlobe className="text-blue-400" size={18} />
          <h1 className="font-bold text-white truncate max-w-xs">
            {project?.info?.title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`http://localhost:5173/tour/${projectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn-secondary flex items-center gap-2 text-xs"
          >
            <FaExternalLinkAlt size={11} />
            Preview Tour
          </a>
          <Link
            to={`/projects/${projectId}/studio`}
            className="admin-btn-primary flex items-center gap-2 text-xs"
          >
            <FaCube size={11} />
            Open 3D Studio
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* ── Section: Project Metadata ── */}
        <section className="admin-card">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <FaGlobe size={14} className="text-blue-400" /> Project Info
          </h2>
          <form onSubmit={handleSaveMeta} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="admin-label">Title</label>
                <input
                  className="admin-input"
                  value={meta.title}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, title: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="admin-label">Author</label>
                <input
                  className="admin-input"
                  value={meta.author}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, author: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="admin-btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <FaSyncAlt size={12} className="animate-spin" />
                ) : (
                  <FaSave size={12} />
                )}
                Save
              </button>
            </div>
          </form>
        </section>

        {/* ── Section: Background Audio ── */}
        <section className="admin-card">
          <h2 className="text-sm font-semibold text-white mb-4">
            Background Audio
          </h2>
          {project?.settings?.globalBackgroundAudio?.src && (
            <p className="text-xs text-green-400 mb-3 break-all">
              Current: {project.settings.globalBackgroundAudio.src}
            </p>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="admin-label">Upload New Audio</label>
              <input
                type="file"
                accept="audio/mp3,audio/wav,audio/ogg,audio/aac"
                className="admin-input text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white cursor-pointer"
                onChange={(e) => setAudioFile(e.target.files[0] || null)}
              />
            </div>
            <button
              onClick={handleAudioUpload}
              disabled={!audioFile || audioUploading}
              className="admin-btn-primary flex items-center gap-2"
            >
              {audioUploading ? (
                <FaSyncAlt size={12} className="animate-spin" />
              ) : null}
              Upload
            </button>
          </div>
        </section>

        {/* ── Section: Nodes ── */}
        <section className="admin-card">
          <h2 className="text-sm font-semibold text-white mb-4">
            Panorama Nodes ({nodes.length})
          </h2>

          {/* Node list */}
          {nodes.length === 0 ? (
            <p className="text-gray-600 text-sm mb-4">
              No nodes yet. Add your first 360° room below.
            </p>
          ) : (
            <div className="space-y-2 mb-6">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-800"
                >
                  <div className="w-12 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-700">
                    <img
                      src={node.panoramaUrl}
                      alt={node.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {node.displayName}
                    </p>
                    <p className="text-xs text-gray-500">
                      Yaw offset: {node.initialYawOffset}° &nbsp;·&nbsp;
                      {node.navigationHotspots?.length || 0} hotspots
                      &nbsp;·&nbsp;
                      {node.infoSigns?.length || 0} signs
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {node.id === initialNodeId ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                        Start
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetInitialNode(node.id)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400
                                   hover:bg-gray-600 hover:text-white transition-colors"
                      >
                        Set Start
                      </button>
                    )}
                    <button
                      onClick={() => handleEditNode(node)}
                      className="text-blue-500/60 hover:text-blue-400 transition-colors"
                      title="Edit node"
                    >
                      <FaEdit size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      className="text-red-500/60 hover:text-red-400 transition-colors"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add node form */}
          <form
            onSubmit={handleAddNode}
            className="border-t border-gray-800 pt-4 flex flex-col gap-3"
          >
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FaPlus size={10} /> Add New Node
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-label">Room Name *</label>
                <input
                  className="admin-input"
                  placeholder="e.g. Main Reception"
                  value={newNode.displayName}
                  onChange={(e) =>
                    setNewNode((n) => ({ ...n, displayName: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="admin-label">Initial Yaw Offset (°)</label>
                <input
                  type="number"
                  step="0.5"
                  className="admin-input"
                  value={newNode.initialYawOffset}
                  onChange={(e) =>
                    setNewNode((n) => ({
                      ...n,
                      initialYawOffset: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="admin-label">360° Panorama Image *</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="admin-input text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white cursor-pointer"
                onChange={(e) => setPanoramaFile(e.target.files[0] || null)}
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={nodeUploading || !panoramaFile}
                className="admin-btn-primary flex items-center gap-2"
              >
                {nodeUploading ? (
                  <FaSyncAlt size={12} className="animate-spin" />
                ) : (
                  <FaPlus size={12} />
                )}
                Add Node
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* Node Edit Modal */}
      {editingNode && (
        <NodeEditModal
          node={editingNode}
          onClose={() => setEditingNode(null)}
          onSave={handleUpdateNode}
          saving={nodeUpdating}
        />
      )}
    </div>
  );
}
