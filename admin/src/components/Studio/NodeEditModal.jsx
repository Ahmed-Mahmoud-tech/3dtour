import { useState, useEffect } from "react";
import { FaTimes, FaSave, FaSyncAlt, FaImage } from "react-icons/fa";
import { mediaApi } from "../../api/projectApi.js";

/**
 * NodeEditModal
 *
 * Modal for editing existing panorama node properties:
 * - Display name
 * - Initial yaw offset
 * - Panorama image (optional replacement)
 */
export default function NodeEditModal({ node, onClose, onSave, saving }) {
  const [displayName, setDisplayName] = useState(node?.displayName || "");
  const [initialYawOffset, setInitialYawOffset] = useState(
    node?.initialYawOffset || 0,
  );
  const [newPanoramaFile, setNewPanoramaFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (node) {
      setDisplayName(node.displayName || "");
      setInitialYawOffset(node.initialYawOffset || 0);
      setNewPanoramaFile(null);
    }
  }, [node]);

  if (!node) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updateData = {
      displayName,
      initialYawOffset: parseFloat(initialYawOffset) || 0,
    };

    // If user selected a new panorama image, upload it first
    if (newPanoramaFile) {
      setUploading(true);
      try {
        const { url, previewUrl, mobileUrl } = await mediaApi.uploadPanorama(newPanoramaFile);
        updateData.panoramaUrl = url;
        updateData.panoramaPreviewUrl = previewUrl || "";
        // Always send the key (even "") so a replacement pano with no mobile
        // tier clears the old node's stale panoramaMobileUrl on merge
        updateData.panoramaMobileUrl = mobileUrl || "";
      } catch (err) {
        console.error("Failed to upload panorama:", err);
        alert("Failed to upload new panorama image");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSave(updateData);
  };

  const isProcessing = saving || uploading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="admin-card max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">
            Edit Panorama Node
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Display Name */}
          <div>
            <label className="admin-label">Room Name *</label>
            <input
              type="text"
              className="admin-input"
              placeholder="e.g. Main Reception"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={isProcessing}
            />
          </div>

          {/* Initial Yaw Offset */}
          <div>
            <label className="admin-label">
              Initial Yaw Offset (°)
              <span className="text-gray-600 ml-2 text-xs font-normal">
                Rotation when node loads
              </span>
            </label>
            <input
              type="number"
              step="0.5"
              className="admin-input"
              value={initialYawOffset}
              onChange={(e) => setInitialYawOffset(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          {/* Current Panorama Preview */}
          <div>
            <label className="admin-label">Current Panorama</label>
            <div className="w-full h-24 rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
              <img
                src={node.panoramaUrl}
                alt={node.displayName}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Replace Panorama */}
          <div>
            <label className="admin-label flex items-center gap-2">
              <FaImage size={12} />
              Replace Panorama Image (Optional)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="admin-input text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white file:cursor-pointer cursor-pointer"
              onChange={(e) => setNewPanoramaFile(e.target.files[0] || null)}
              disabled={isProcessing}
            />
            {newPanoramaFile && (
              <p className="text-xs text-green-400 mt-1">
                New image selected: {newPanoramaFile.name}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="admin-btn-secondary"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn-primary flex items-center gap-2"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <FaSyncAlt size={12} className="animate-spin" />
                  {uploading ? "Uploading..." : "Saving..."}
                </>
              ) : (
                <>
                  <FaSave size={12} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
