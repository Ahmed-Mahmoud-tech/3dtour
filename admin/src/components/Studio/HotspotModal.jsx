import { useState } from 'react';
import { FaTimes, FaPlus, FaTrash, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import { mediaApi } from '../../api/projectApi.js';

/**
 * HotspotModal
 *
 * Opens when the admin clicks the sphere in [Place Hotspot] mode.
 * Allows configuring: target node, transition videos (multiple), playMode, scale.
 *
 * Each video entry has:
 *  - A file upload (or shows existing URL)
 *  - A yaw offset (°)
 *  - An order number (auto-assigned, reorderable)
 *
 * @param {{
 *   projectId: string,
 *   coords: { x_deg: number, y_deg: number },
 *   nodes: object,
 *   sourceNodeId: string,
 *   onSave: (hotspot: object) => void,
 *   onClose: () => void,
 * }} props
 */
export default function HotspotModal({ projectId, coords, nodes, sourceNodeId, onSave, onClose, initialData, currentVideoUrl }) {
  const [targetNodeId, setTargetNodeId]           = useState(initialData?.targetNodeId || '');
  const [playMode, setPlayMode]                   = useState(initialData?.playMode || 'forward');
  const [scale, setScale]                         = useState(initialData?.scale || { width: 1.0, height: 1.0 });
  const [uploading, setUploading]                 = useState(false);
  const [error, setError]                         = useState('');

  // ─── Multi-video state ─────────────────────────────────────────────────────
  // Initialise from existing transitionVideos array, or migrate from single video fields
  const buildInitialVideos = () => {
    if (initialData?.transitionVideos?.length) {
      return initialData.transitionVideos
        .sort((a, b) => a.order - b.order)
        .map((v, i) => ({
          id: uuidv4(),
          videoUrl: v.videoUrl || '',
          reverseVideoUrl: v.reverseVideoUrl || '',
          yawOffset: v.yawOffset ?? 0,
          order: i,
          transitionId: v.transitionId || '',
          file: null, // no new file selected yet
        }));
    }
    // Backward compat: migrate single-video fields into array
    if (currentVideoUrl || initialData?.transitionVideoUrl) {
      return [{
        id: uuidv4(),
        videoUrl: currentVideoUrl || initialData?.transitionVideoUrl || '',
        reverseVideoUrl: initialData?.reverseTransitionVideoUrl || '',
        yawOffset: initialData?.videoInitialYawOffset ?? 0,
        order: 0,
        transitionId: initialData?.transitionId || '',
        file: null,
      }];
    }
    return [];
  };

  const [videoEntries, setVideoEntries] = useState(buildInitialVideos);

  const nodeOptions = Object.values(nodes || {}).filter((n) => n.id !== sourceNodeId);

  // ─── Video list helpers ────────────────────────────────────────────────────
  const addVideoEntry = () => {
    setVideoEntries(prev => [...prev, {
      id: uuidv4(),
      videoUrl: '',
      reverseVideoUrl: '',
      yawOffset: 0,
      order: prev.length,
      transitionId: '',
      file: null,
    }]);
  };

  const removeVideoEntry = (id) => {
    setVideoEntries(prev => prev.filter(v => v.id !== id).map((v, i) => ({ ...v, order: i })));
  };

  const moveVideoEntry = (index, direction) => {
    setVideoEntries(prev => {
      const next = [...prev];
      const swapIdx = index + direction;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next.map((v, i) => ({ ...v, order: i }));
    });
  };

  const updateVideoEntry = (id, field, value) => {
    setVideoEntries(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!targetNodeId) { setError('Select a target node.'); return; }
    setError('');
    setUploading(true);

    try {
      // Upload any new video files
      const uploadedVideos = [];
      for (const entry of videoEntries) {
        const transId = entry.transitionId || `trans_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
        let videoUrl = entry.videoUrl || '';
        let reverseVideoUrl = entry.reverseVideoUrl || '';

        if (entry.file) {
          const result = await mediaApi.uploadVideo(projectId, transId, entry.file);
          videoUrl = result.videoUrl;
          reverseVideoUrl = result.reverseVideoUrl || '';
        }

        if (videoUrl) {
          uploadedVideos.push({
            videoUrl,
            reverseVideoUrl,
            yawOffset: parseFloat(entry.yawOffset) || 0,
            order: entry.order,
            transitionId: transId,
          });
        }
      }

      // For backward compatibility, also populate the legacy single-video fields
      // from the first video in the list
      const firstVideo = uploadedVideos[0] || null;

      const hotspot = {
        position2D: { x_deg: coords.x_deg, y_deg: coords.y_deg },
        targetNodeId,
        transitionId: firstVideo?.transitionId || initialData?.transitionId || `trans_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
        transitionVideoUrl: firstVideo?.videoUrl || '',
        reverseTransitionVideoUrl: firstVideo?.reverseVideoUrl || '',
        playMode,
        scale: { width: parseFloat(scale.width), height: parseFloat(scale.height) },
        videoInitialYawOffset: firstVideo?.yawOffset || 0,
        iconType: 'arrow_dynamic',
        // Multi-video array
        transitionVideos: uploadedVideos,
        _transitionData: firstVideo?.videoUrl
          ? { id: firstVideo.transitionId, videoUrl: firstVideo.videoUrl, reverseVideoUrl: firstVideo.reverseVideoUrl }
          : null,
      };

      onSave(hotspot);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-white">{initialData ? 'Edit Hotspot' : 'Place Navigation Hotspot'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              X: {coords.x_deg}° &nbsp;|&nbsp; Y: {coords.y_deg}°
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white">
            <FaTimes size={13} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          {/* Target node */}
          <div>
            <label className="admin-label">Target Node *</label>
            <select
              className="admin-input"
              value={targetNodeId}
              onChange={(e) => setTargetNodeId(e.target.value)}
            >
              <option value="">— Select destination node —</option>
              {nodeOptions.map((n) => (
                <option key={n.id} value={n.id}>{n.displayName}</option>
              ))}
            </select>
          </div>

          {/* ─── Transition Videos List ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="admin-label mb-0">Transition Videos</label>
              <button
                type="button"
                onClick={addVideoEntry}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                           bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <FaPlus size={9} /> Add Video
              </button>
            </div>

            {videoEntries.length === 0 && (
              <p className="text-xs text-gray-600 bg-gray-800/50 rounded-lg px-3 py-3 text-center border border-gray-800">
                No transition videos. Click "Add Video" to add one.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {videoEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3 flex flex-col gap-2"
                >
                  {/* Video header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-300">
                      Video #{index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveVideoEntry(index, -1)}
                        disabled={index === 0}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white
                                   hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <FaArrowUp size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveVideoEntry(index, 1)}
                        disabled={index === videoEntries.length - 1}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white
                                   hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <FaArrowDown size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVideoEntry(entry.id)}
                        className="w-6 h-6 flex items-center justify-center rounded text-red-500 hover:text-red-400
                                   hover:bg-red-500/10 transition-colors"
                        title="Remove video"
                      >
                        <FaTrash size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Existing video indicator */}
                  {entry.videoUrl && !entry.file && (
                    <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded px-2 py-1.5">
                      ✓ Video set — upload a new file to replace it.
                    </p>
                  )}

                  {/* File upload */}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="admin-input text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0
                               file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer text-xs"
                    onChange={(e) => updateVideoEntry(entry.id, 'file', e.target.files[0] || null)}
                  />
                  {entry.file && (
                    <p className="text-[10px] text-gray-500">
                      {entry.file.name} — Reversed copy will be auto-generated.
                    </p>
                  )}

                  {/* Yaw offset */}
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider">Yaw Offset (°)</label>
                    <input
                      type="number"
                      step="1"
                      min="-180"
                      max="180"
                      className="admin-input mt-0.5"
                      value={entry.yawOffset}
                      onChange={(e) => updateVideoEntry(entry.id, 'yawOffset', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Play mode */}
          <div>
            <label className="admin-label">Default Play Direction</label>
            <div className="flex gap-3">
              {['forward', 'backward'].map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                  <input
                    type="radio"
                    name="playMode"
                    value={m}
                    checked={playMode === m}
                    onChange={() => setPlayMode(m)}
                    className="accent-blue-500"
                  />
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Scale */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="admin-label">Scale Width</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                className="admin-input"
                value={scale.width}
                onChange={(e) => setScale((s) => ({ ...s, width: e.target.value }))}
              />
            </div>
            <div>
              <label className="admin-label">Scale Height</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                className="admin-input"
                value={scale.height}
                onChange={(e) => setScale((s) => ({ ...s, height: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5 pt-3 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose} className="admin-btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={uploading} className="admin-btn-primary flex-1">
            {uploading ? 'Uploading…' : (initialData ? 'Update Hotspot' : 'Place Hotspot')}
          </button>
        </div>
      </div>
    </div>
  );
}
