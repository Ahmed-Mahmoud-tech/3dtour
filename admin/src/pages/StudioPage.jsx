import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectApi, hotspotApi, signApi } from '../api/projectApi.js';
import SphereStudio from '../components/Studio/SphereStudio.jsx';
import HotspotModal from '../components/Studio/HotspotModal.jsx';
import SignModal from '../components/Studio/SignModal.jsx';
import {
  FaArrowLeft, FaMousePointer, FaArrowRight, FaInfoCircle,
  FaTrash, FaChevronDown, FaChevronUp, FaSyncAlt,
} from 'react-icons/fa';

/**
 * StudioPage — The 3D Mapping Studio
 *
 * Admin selects a node → sees its 360 panorama in Three.js.
 * Switches mode to [Place Hotspot] or [Place Info Sign].
 * Clicking the sphere opens a context modal with auto-filled coordinates.
 * Placed items appear immediately as live preview pins.
 */
export default function StudioPage() {
  const { projectId } = useParams();
  const [project, setProject]           = useState(null);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [placementMode, setPlacementMode] = useState(null); // 'hotspot' | 'sign' | null
  const [pendingCoords, setPendingCoords] = useState(null);
  const [previewPin, setPreviewPin]     = useState(null);
  const [saving, setSaving]             = useState(false);
  const [nodeListOpen, setNodeListOpen] = useState(true);
  const [editingItem, setEditingItem]   = useState(null); // { type: 'hotspot'|'sign', item }

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectApi.get(projectId);
      setProject(data);
      // Auto-select initialNodeId or first node
      const firstKey = data.settings?.initialNodeId || Object.keys(data.nodes || {})[0];
      setActiveNodeId((prev) => prev || firstKey || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const activeNode = project?.nodes?.[activeNodeId] || null;

  // ─── Sphere click handler ─────────────────────────────────────────────────
  const handleSphereClick = useCallback((coords) => {
    if (!placementMode) return;
    setPendingCoords(coords);
    setPreviewPin({ ...coords, type: placementMode });
  }, [placementMode]);

  // ─── Save hotspot ─────────────────────────────────────────────────────────
  const handleSaveHotspot = async (hotspotData) => {
    setSaving(true);
    try {
      // Pass full hotspotData (including _transitionData) — server handles both atomically
      await hotspotApi.add(projectId, activeNodeId, hotspotData);
      await fetchProject();
    } finally {
      setSaving(false);
      setPendingCoords(null);
      setPreviewPin(null);
    }
  };

  // ─── Save sign ────────────────────────────────────────────────────────────
  const handleSaveSign = async (signData) => {
    setSaving(true);
    try {
      await signApi.add(projectId, activeNodeId, signData);
      await fetchProject();
    } finally {
      setSaving(false);
      setPendingCoords(null);
      setPreviewPin(null);
    }
  };

  // ─── Delete hotspot / sign ────────────────────────────────────────────────
  const deleteHotspot = async (hotspotId) => {
    if (!window.confirm('Delete this hotspot?')) return;
    await hotspotApi.delete(projectId, activeNodeId, hotspotId);
    await fetchProject();
  };

  const deleteSign = async (signId) => {
    if (!window.confirm('Delete this sign?')) return;
    await signApi.delete(projectId, activeNodeId, signId);
    await fetchProject();
  };

  // ─── Update hotspot / sign ────────────────────────────────────────────────
  const handleUpdateHotspot = async (hotspotData) => {
    setSaving(true);
    try {
      // Pass full hotspotData (including _transitionData) — server handles both atomically
      await hotspotApi.update(projectId, activeNodeId, editingItem.item.id, hotspotData);
      await fetchProject();
    } finally {
      setSaving(false);
      setEditingItem(null);
    }
  };

  const handleUpdateSign = async (signData) => {
    setSaving(true);
    try {
      await signApi.update(projectId, activeNodeId, editingItem.item.id, signData);
      await fetchProject();
    } finally {
      setSaving(false);
      setEditingItem(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-red-400">
        Project not found
      </div>
    );
  }

  const nodes = Object.values(project.nodes || {});

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
        {/* Back + title */}
        <div className="px-4 py-4 border-b border-gray-800 flex-shrink-0">
          <Link to={`/projects/${projectId}`} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-3 transition-colors">
            <FaArrowLeft size={12} />
            Back to Editor
          </Link>
          <h1 className="font-bold text-white truncate">{project.info?.title}</h1>
          <p className="text-xs text-gray-500 mt-1">3D Placement Studio</p>
        </div>

        {/* Placement mode selector */}
        <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <p className="admin-label mb-2">Placement Mode</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPlacementMode((m) => (m === 'hotspot' ? null : 'hotspot'))}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors border
                ${placementMode === 'hotspot'
                  ? 'bg-white/90 text-gray-900 border-white'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'}`}
            >
              <FaArrowRight size={11} />
              Hotspot
            </button>
            <button
              onClick={() => setPlacementMode((m) => (m === 'sign' ? null : 'sign'))}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors border
                ${placementMode === 'sign'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'}`}
            >
              <FaInfoCircle size={11} />
              Info Sign
            </button>
          </div>
          {placementMode && (
            <p className="text-xs text-yellow-400/80 mt-2 bg-yellow-400/5 px-2 py-1.5 rounded border border-yellow-400/20">
              Click anywhere on the sphere to place a {placementMode === 'hotspot' ? 'navigation hotspot' : 'info sign'}.
            </p>
          )}
          {!placementMode && (
            <p className="text-xs text-gray-600 mt-2">Select a mode then click the sphere.</p>
          )}
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setNodeListOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-400 hover:text-white border-b border-gray-800 transition-colors"
          >
            <span className="admin-label mb-0">Nodes ({nodes.length})</span>
            {nodeListOpen ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
          </button>

          {nodeListOpen && nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setActiveNodeId(node.id)}
              className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-800/50 transition-colors
                ${node.id === activeNodeId
                  ? 'bg-blue-600/20 text-white border-l-2 border-l-blue-500'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'}`}
            >
              {node.displayName}
            </button>
          ))}
        </div>

        {/* Active node info */}
        {activeNode && (
          <div className="p-4 border-t border-gray-800 flex-shrink-0">
            <p className="admin-label">Active Node</p>
            <p className="text-white text-sm font-medium truncate">{activeNode.displayName}</p>
            <div className="mt-2 flex gap-3 text-xs text-gray-500">
              <span>{activeNode.navigationHotspots?.length || 0} hotspots</span>
              <span>{activeNode.infoSigns?.length || 0} signs</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 3D Viewport ── */}
      <div className="flex-1 relative">
        {activeNode?.panoramaUrl ? (
          <SphereStudio
            panoramaUrl={activeNode.panoramaUrl}
            placementMode={placementMode}
            onSphereClick={handleSphereClick}
            node={activeNode}
            previewPin={previewPin}
            onEditItem={(type, item) => setEditingItem({ type, item })}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-600 flex-col gap-3">
            <FaMousePointer size={36} />
            <p className="text-sm">Select a node with a panorama image to begin</p>
          </div>
        )}

        {/* Mode indicator badge */}
        {placementMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full
                          bg-black/60 backdrop-blur-sm border border-white/10 text-white text-xs font-medium
                          pointer-events-none">
            {placementMode === 'hotspot' ? '🎯 Click to place Navigation Hotspot' : '📌 Click to place Info Sign'}
          </div>
        )}

        {/* Saving indicator */}
        {saving && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/70 text-white text-xs">
            <FaSyncAlt size={12} className="animate-spin" />
            Saving…
          </div>
        )}
      </div>

      {/* ── Right panel — placed items list ── */}
      <div className="w-64 flex-shrink-0 border-l border-gray-800 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <p className="admin-label">Placed Items</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {/* Hotspots */}
          {activeNode?.navigationHotspots?.map((h) => (
            <div
              key={h.id}
              onClick={() => setEditingItem({ type: 'hotspot', item: h })}
              className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50 group cursor-pointer hover:bg-gray-800/40"
            >
              <FaArrowRight size={11} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">→ {project.nodes?.[h.targetNodeId]?.displayName || h.targetNodeId}</p>
                <p className="text-[10px] text-gray-600">{h.position2D.x_deg}°, {h.position2D.y_deg}°</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteHotspot(h.id); }}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all"
              >
                <FaTrash size={10} />
              </button>
            </div>
          ))}

          {/* Signs */}
          {activeNode?.infoSigns?.map((s) => (
            <div
              key={s.id}
              onClick={() => setEditingItem({ type: 'sign', item: s })}
              className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50 group cursor-pointer hover:bg-gray-800/40"
            >
              <FaInfoCircle size={11} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{s.popupContent?.title || 'Info Sign'}</p>
                <p className="text-[10px] text-gray-600">{s.position2D.x_deg}°, {s.position2D.y_deg}°</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSign(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all"
              >
                <FaTrash size={10} />
              </button>
            </div>
          ))}

          {(!activeNode?.navigationHotspots?.length && !activeNode?.infoSigns?.length) && (
            <p className="text-gray-700 text-xs px-4 py-6 text-center">
              No items placed yet. Select a mode and click the sphere.
            </p>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {pendingCoords && placementMode === 'hotspot' && (
        <HotspotModal
          projectId={projectId}
          coords={pendingCoords}
          nodes={project.nodes}
          sourceNodeId={activeNodeId}
          onSave={handleSaveHotspot}
          onClose={() => { setPendingCoords(null); setPreviewPin(null); }}
        />
      )}
      {pendingCoords && placementMode === 'sign' && (
        <SignModal
          coords={pendingCoords}
          onSave={handleSaveSign}
          onClose={() => { setPendingCoords(null); setPreviewPin(null); }}
        />
      )}

      {/* ── Edit modals ── */}
      {editingItem?.type === 'hotspot' && (
        <HotspotModal
          projectId={projectId}
          coords={editingItem.item.position2D}
          nodes={project.nodes}
          sourceNodeId={activeNodeId}
          initialData={editingItem.item}
          currentVideoUrl={project.transitions?.[editingItem.item.transitionId]?.videoUrl || ''}
          onSave={handleUpdateHotspot}
          onClose={() => setEditingItem(null)}
        />
      )}
      {editingItem?.type === 'sign' && (
        <SignModal
          coords={editingItem.item.position2D}
          initialData={editingItem.item}
          onSave={handleUpdateSign}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
