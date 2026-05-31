import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import { mediaApi } from '../../api/projectApi.js';

/**
 * HotspotModal
 *
 * Opens when the admin clicks the sphere in [Place Hotspot] mode.
 * Allows configuring: target node, transition video, playMode, scale.
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
  const [videoInitialYawOffset, setVideoInitialYawOffset] = useState(initialData?.videoInitialYawOffset ?? 0);
  const [videoFile, setVideoFile]                 = useState(null);
  const [uploading, setUploading]                 = useState(false);
  const [error, setError]                         = useState('');

  const nodeOptions = Object.values(nodes || {}).filter((n) => n.id !== sourceNodeId);

  const handleSave = async () => {
    if (!targetNodeId) { setError('Select a target node.'); return; }
    setError('');
    setUploading(true);

    try {
      const transitionId = initialData?.transitionId || `trans_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      let videoUrl = '';
      let reverseVideoUrl = '';

      if (videoFile) {
        const result = await mediaApi.uploadVideo(projectId, transitionId, videoFile);
        videoUrl = result.videoUrl;
        reverseVideoUrl = result.reverseVideoUrl || '';
      }

      // Use newly uploaded URL, or keep the existing one when editing without re-upload
      const finalVideoUrl = videoUrl || currentVideoUrl || '';

      const hotspot = {
        position2D: { x_deg: coords.x_deg, y_deg: coords.y_deg },
        targetNodeId,
        transitionId,
        transitionVideoUrl: finalVideoUrl,
        reverseTransitionVideoUrl: reverseVideoUrl || '',
        playMode,
        scale: { width: parseFloat(scale.width), height: parseFloat(scale.height) },
        videoInitialYawOffset: parseFloat(videoInitialYawOffset) || 0,
        iconType: 'arrow_dynamic',
        _transitionData: finalVideoUrl
          ? { id: transitionId, videoUrl: finalVideoUrl, reverseVideoUrl }
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
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

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
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

          {/* Transition video */}
          <div>
            <label className="admin-label">Transition Video (optional)</label>
            {currentVideoUrl && !videoFile && (
              <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded px-3 py-2 mb-2">
                ✓ Video already set — upload a new file to replace it.
              </p>
            )}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="admin-input text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0
                         file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              onChange={(e) => setVideoFile(e.target.files[0] || null)}
            />
            {videoFile && (
              <p className="text-xs text-gray-500 mt-1">
                {videoFile.name} — Reversed copy will be auto-generated server-side.
              </p>
            )}
          </div>

          {/* Video Initial Yaw Offset */}
          {(currentVideoUrl || videoFile) && (
            <div>
              <label className="admin-label">Video Initial Yaw Offset (°)</label>
              <input
                type="number"
                step="1"
                min="-180"
                max="180"
                className="admin-input"
                value={videoInitialYawOffset}
                onChange={(e) => setVideoInitialYawOffset(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Camera yaw direction when the transition video starts playing.
              </p>
            </div>
          )}

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
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="admin-btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={uploading} className="admin-btn-primary flex-1">
            {uploading ? 'Uploading…' : 'Place Hotspot'}
          </button>
        </div>
      </div>
    </div>
  );
}
