import { useState, lazy, Suspense } from "react";
import { FaTimes } from "react-icons/fa";
import { mediaApi } from "../../api/projectApi.js";

// IconPicker star-imports 8 react-icons bundles (~5 MB raw) — lazy-load it so
// the studio chunk stays lean; the icons only download when this modal renders.
const IconPicker = lazy(() => import("../IconPicker/IconPicker.jsx"));
const IconPreview = lazy(() =>
  import("../IconPicker/IconPicker.jsx").then((m) => ({ default: m.IconPreview })),
);

/**
 * SignModal
 *
 * Opens when the admin clicks the sphere in [Place Info Sign] mode.
 * Allows configuring: popup content, icon/image appearance, scale.
 *
 * @param {{
 *   coords: { x_deg: number, y_deg: number },
 *   onSave: (sign: object) => void,
 *   onClose: () => void,
 * }} props
 */
export default function SignModal({ coords, onSave, onClose, initialData }) {
  const [iconName, setIconName] = useState(
    initialData?.appearance?.assetUrl || "FaInfoCircle",
  );
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState(initialData?.popupContent?.title || "");
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [htmlContent, setHtmlContent] = useState(
    initialData?.popupContent?.htmlContent || "",
  );
  const [scale, setScale] = useState(
    initialData?.scale || { width: 1.0, height: 1.0 },
  );
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    setUploading(true);
    try {
      const assetUrl = iconName;
      let coverImageUrl = "";

      if (coverImageFile) {
        const res = await mediaApi.uploadImage(coverImageFile);
        coverImageUrl = res.url;
      }

      const sign = {
        position2D: { x_deg: coords.x_deg, y_deg: coords.y_deg },
        scale: {
          width: parseFloat(scale.width),
          height: parseFloat(scale.height),
        },
        appearance: { renderType: "icon", assetUrl },
        popupContent: { title, coverImage: coverImageUrl, htmlContent },
      };

      onSave(sign);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-white">
              {initialData ? "Edit Info Sign" : "Place Info Sign"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              X: {coords.x_deg}° &nbsp;|&nbsp; Y: {coords.y_deg}°
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white"
          >
            <FaTimes size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          {/* Appearance — icon only */}
          <div>
            <label className="admin-label">Sign Icon</label>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-300">
                <Suspense fallback={<span className="text-gray-600 text-xs">…</span>}>
                  <IconPreview name={iconName} size={22} />
                </Suspense>
              </div>
              <div className="flex-1">
                <button
                  onClick={() => setShowPicker((v) => !v)}
                  className="admin-btn-secondary text-xs w-full"
                >
                  {iconName || "Pick an icon"}
                </button>
              </div>
            </div>
          </div>

          {/* Icon Picker Dropdown */}
          {showPicker && (
            <div
              className="border border-gray-700 rounded-xl overflow-hidden"
              style={{ minHeight: "320px" }}
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full text-gray-500 text-xs" style={{ minHeight: '320px' }}>
                    Loading icons…
                  </div>
                }
              >
                <IconPicker
                  value={iconName}
                  onSelect={(name) => {
                    setIconName(name);
                  }}
                  onClose={() => setShowPicker(false)}
                />
              </Suspense>
            </div>
          )}

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
                onChange={(e) =>
                  setScale((s) => ({ ...s, width: e.target.value }))
                }
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
                onChange={(e) =>
                  setScale((s) => ({ ...s, height: e.target.value }))
                }
              />
            </div>
          </div>

          <hr className="border-gray-800" />

          {/* Popup content */}
          <div>
            <label className="admin-label">Popup Title</label>
            <input
              type="text"
              className="admin-input"
              placeholder="Smart TV 65 Inch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="admin-label">Popup Cover Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              className="admin-input text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white cursor-pointer"
              onChange={(e) => setCoverImageFile(e.target.files[0] || null)}
            />
          </div>

          <div>
            <label className="admin-label">HTML Content</label>
            <textarea
              className="admin-input font-mono text-xs resize-none"
              rows={6}
              placeholder={
                "<div class='card'><h3>Title</h3><p>Description</p></div>"
              }
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
            />
            <p className="text-gray-600 text-xs mt-1">
              HTML is sanitized (DOMPurify) before rendering to the viewer.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5 flex-shrink-0 border-t border-gray-800 pt-4">
          <button onClick={onClose} className="admin-btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={uploading}
            className="admin-btn-primary flex-1"
          >
            {uploading ? "Uploading…" : "Place Sign"}
          </button>
        </div>
      </div>
    </div>
  );
}
