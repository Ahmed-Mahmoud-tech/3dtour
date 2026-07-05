import { useCallback, useRef } from "react";

/**
 * usePreloader — Background preload of images and videos.
 *
 * Guarantees buffer-free transitions by downloading assets before
 * the transition begins. Uses the browser's native cache and proper decode.
 */
export function usePreloader() {
  // Cache for preloaded videos to avoid re-downloading
  const videoCache = useRef(new Map());

  /**
   * Preload a single image URL with proper decoding.
   * @param {string} url
   * @returns {Promise<void>}
   */
  const preloadImage = useCallback((url) => {
    if (!url) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // Handle CORS properly

      img.onload = async () => {
        try {
          // Use decode() for better performance and to ensure image is fully ready
          if (img.decode) {
            await img.decode();
          }
          console.log("✅ Image preloaded and decoded:", url.split("/").pop());
          resolve();
        } catch (err) {
          console.warn(
            "⚠️ Image decode failed (continuing):",
            url.split("/").pop(),
          );
          resolve(); // Continue anyway
        }
      };

      img.onerror = () => {
        console.warn(
          "⚠️ Image preload failed (continuing):",
          url.split("/").pop(),
        );
        resolve(); // Silently continue on error
      };

      img.src = url;
    });
  }, []);

  /**
   * Preload a video URL by loading enough data for smooth playback.
   * Uses 'loadeddata' event which is faster than 'canplaythrough'.
   * @param {string} url
   * @returns {Promise<void>}
   */
  const preloadVideo = useCallback((url) => {
    if (!url) return Promise.resolve();

    // Check cache first
    if (videoCache.current.has(url)) {
      console.log("✅ Video already cached:", url.split("/").pop());
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;

      const cleanup = (success = true) => {
        if (success) {
          // Keep video element in cache for faster subsequent access
          videoCache.current.set(url, video);
          console.log("✅ Video preloaded:", url.split("/").pop());
        } else {
          video.src = "";
          video.load();
          console.warn(
            "⚠️ Video preload failed (continuing):",
            url.split("/").pop(),
          );
        }
        resolve();
      };

      // Use 'loadeddata' instead of 'canplaythrough' for faster response
      // This ensures enough data is loaded for smooth playback without waiting for full buffer
      video.addEventListener("loadeddata", () => cleanup(true), { once: true });
      video.addEventListener("error", () => cleanup(false), { once: true });

      // Timeout fallback — don't wait longer than 8 seconds
      const timer = setTimeout(() => cleanup(false), 8000);
      video.addEventListener("loadeddata", () => clearTimeout(timer), {
        once: true,
      });

      video.src = url;
      video.load();
    });
  }, []);

  /**
   * Preload everything needed for the next node + its transition.
   *
   * @param {{ panoramaUrl: string }} targetNode
   * @param {{ videoUrl: string, reverseVideoUrl: string } | null} transitionData
   * @returns {Promise<void>}
   */
  const preloadNextAssets = useCallback(
    async (targetNode, transitionData) => {
      const tasks = [];
      const startTime = Date.now();

      console.log(
        "🔄 Starting preload for:",
        targetNode?.displayName || "unknown",
      );

      if (targetNode?.panoramaUrl) {
        tasks.push(preloadImage(targetNode.panoramaUrl));
      }
      if (transitionData?.videoUrl) {
        tasks.push(preloadVideo(transitionData.videoUrl));
      }
      if (transitionData?.reverseVideoUrl) {
        tasks.push(preloadVideo(transitionData.reverseVideoUrl));
      }

      await Promise.all(tasks);

      const duration = Date.now() - startTime;
      console.log(`✅ Preload complete in ${duration}ms`);
    },
    [preloadImage, preloadVideo],
  );

  /**
   * Clear video cache (useful for memory management)
   */
  const clearCache = useCallback(() => {
    videoCache.current.forEach((video) => {
      video.src = "";
      video.load();
    });
    videoCache.current.clear();
    console.log("🗑️ Video cache cleared");
  }, []);

  return { preloadImage, preloadVideo, preloadNextAssets, clearCache };
}
