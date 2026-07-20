import { useState, lazy, Suspense } from "react";
import { FaTimes } from "react-icons/fa";
import { mediaApi } from "../../api/projectApi.js";
import { hexToRgba, darkenHex } from "../../utils/colorUtils.js";

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
  const [iconColor, setIconColor] = useState(
    initialData?.appearance?.iconColor || "#ffffff",
  );
  const [signColor, setSignColor] = useState(
    initialData?.appearance?.color || "#10c9b7",
  );
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [linkUrl, setLinkUrl] = useState(initialData?.linkUrl || "");
  const [tooltip, setTooltip] = useState(initialData?.tooltip || "");
  const [title, setTitle] = useState(initialData?.popupContent?.title || "");
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [htmlContent, setHtmlContent] = useState(
    initialData?.popupContent?.htmlContent || "",
  );
  const [scale, setScale] = useState(
    initialData?.scale || { width: 1.0, height: 1.0 },
  );
  // 'popup' → normal rich popup on click; 'url' → open a link on click.
  // An existing sign with a stored linkUrl opens in url mode.
  const [signType, setSignType] = useState(
    initialData?.linkUrl ? "url" : "popup",
  );
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");

    // URL is required in link mode.
    if (signType === "url" && !linkUrl.trim()) {
      setError("Please enter a link URL.");
      return;
    }

    setUploading(true);
    try {
      const assetUrl = iconName;
      const appearance = { renderType: "icon", assetUrl, iconColor, color: signColor };
      const position2D = { x_deg: coords.x_deg, y_deg: coords.y_deg };
      const scaleData = {
        width: parseFloat(scale.width),
        height: parseFloat(scale.height),
      };

      let sign;
      if (signType === "url") {
        // Link sign: store the URL + optional tooltip, clear any popup content.
        sign = {
          position2D,
          scale: scaleData,
          appearance,
          linkUrl: linkUrl.trim(),
          tooltip: tooltip.trim(),
          popupContent: { title: "", coverImage: "", htmlContent: "" },
        };
      } else {
        // Popup sign: keep the existing cover on edit unless a new file replaces it.
        let coverImageUrl = initialData?.popupContent?.coverImage || "";
        if (coverImageFile) {
          const res = await mediaApi.uploadImage(coverImageFile);
          coverImageUrl = res.url;
        }
        sign = {
          position2D,
          scale: scaleData,
          appearance,
          linkUrl: "",
          tooltip: "",
          popupContent: { title, coverImage: coverImageUrl, htmlContent },
        };
      }

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

          {/* Sign type — popup vs external link */}
          <div>
            <label className="admin-label">On Click</label>
            <div className="flex gap-2">
              {[
                { value: "popup", label: "Show Popup" },
                { value: "url", label: "Open Link" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer border transition-colors
                    ${signType === opt.value
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600"}`}
                >
                  <input
                    type="radio"
                    name="signType"
                    value={opt.value}
                    checked={signType === opt.value}
                    onChange={() => setSignType(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Appearance — icon only */}
          <div>
            <label className="admin-label">Sign Icon</label>
            <div className="flex items-center gap-3">
              {/* Live preview on the same badge gradient the viewer renders */}
              <div
                className="w-10 h-10 rounded-full border border-white/40 flex items-center justify-center flex-shrink-0"
                style={{
                  background: `radial-gradient(120% 120% at 30% 25%, ${hexToRgba(signColor, 0.88)}, ${hexToRgba(darkenHex(signColor, 0.45), 0.88)})`,
                }}
              >
                <Suspense fallback={<span className="text-gray-600 text-xs">…</span>}>
                  <IconPreview name={iconName} size={22} color={iconColor} />
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

          {/* Sign (badge) color */}
          <div>
            <label className="admin-label">Sign Color</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={signColor}
                onChange={(e) => setSignColor(e.target.value)}
                className="h-9 w-14 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer p-1"
                title="Pick any color"
              />
              <span className="text-xs text-gray-400 font-mono">{signColor}</span>
              <div className="flex items-center gap-1.5 ml-auto">
                {["#10c9b7", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#1f2937"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSignColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                      ${signColor.toLowerCase() === c ? "border-blue-400" : "border-gray-600"}`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <p className="text-gray-600 text-xs mt-1">
              Colors the whole sign badge (gradient and glow are derived from it).
            </p>
          </div>

          {/* Icon color */}
          <div>
            <label className="admin-label">Icon Color</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={iconColor}
                onChange={(e) => setIconColor(e.target.value)}
                className="h-9 w-14 rounded-lg border border-gray-700 bg-gray-800 cursor-pointer p-1"
                title="Pick any color"
              />
              <span className="text-xs text-gray-400 font-mono">{iconColor}</span>
              <div className="flex items-center gap-1.5 ml-auto">
                {["#ffffff", "#10c9b7", "#fbbf24", "#f87171", "#60a5fa", "#111827"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setIconColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                      ${iconColor.toLowerCase() === c ? "border-blue-400" : "border-gray-600"}`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
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

          {signType === "url" ? (
            <>
              {/* Link (required) + optional tooltip */}
              <div>
                <label className="admin-label">Link URL *</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <p className="text-gray-600 text-xs mt-1">
                  Clicking the sign opens this link in a new tab. Only http(s),
                  mailto and tel links are allowed.
                </p>
              </div>

              <div>
                <label className="admin-label">Hover Tooltip (optional)</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="Shown when the visitor hovers the sign"
                  value={tooltip}
                  onChange={(e) => setTooltip(e.target.value)}
                />
                <p className="text-gray-600 text-xs mt-1">
                  Small label shown on hover. Leave empty for no tooltip.
                </p>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
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
