// Device-tier selection for panorama textures.
//
// Panorama uploads produce two serving tiers (see server/src/utils/
// mediaOptimizer.js — keep FULL_PANORAMA_WIDTH in sync with
// PANORAMA_MAX_WIDTH there):
//   panoramaUrl        full tier, up to 7680px wide
//   panoramaMobileUrl  4096px tier, "" when the source was already ≤4096
//
// A GPU whose MAX_TEXTURE_SIZE is below the full width can't display the full
// file anyway — three.js would silently CPU-downscale it (slow, big memory
// spike, wasted bandwidth). Those devices get the mobile tier; everyone else
// the full one. Both the viewer and the preloader pick through this module so
// they always agree on which URL ends up in the browser cache.

const FULL_PANORAMA_WIDTH = 7680;

let cachedMaxTextureSize = null;

function getMaxTextureSize() {
  if (cachedMaxTextureSize !== null) return cachedMaxTextureSize;
  // Conservative fallback (SSR, WebGL unavailable): assume a small cap so we
  // never feed a texture the device might reject.
  cachedMaxTextureSize = 4096;
  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      if (gl) {
        cachedMaxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    } catch {
      /* keep the conservative fallback */
    }
  }
  return cachedMaxTextureSize;
}

/**
 * The panorama URL this device should load for a node: the mobile tier when
 * one exists and the GPU can't take the full-width texture, otherwise the
 * full panorama. Falls back safely for legacy nodes without a mobile tier.
 */
export function pickPanoramaUrl(node) {
  if (!node) return null;
  if (node.panoramaMobileUrl && getMaxTextureSize() < FULL_PANORAMA_WIDTH) {
    return node.panoramaMobileUrl;
  }
  return node.panoramaUrl;
}
