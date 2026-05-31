import { useCallback } from 'react';

/**
 * usePreloader — Background preload of images and videos.
 *
 * Guarantees buffer-free transitions by downloading assets before
 * the transition begins. Uses the browser's native cache.
 */
export function usePreloader() {
  /**
   * Preload a single image URL.
   * @param {string} url
   * @returns {Promise<void>}
   */
  const preloadImage = useCallback((url) => {
    if (!url) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Silently continue on error
      img.src = url;
    });
  }, []);

  /**
   * Preload a video URL by fetching the first chunk (triggers browser cache).
   * @param {string} url
   * @returns {Promise<void>}
   */
  const preloadVideo = useCallback((url) => {
    if (!url) return Promise.resolve();
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;

      const cleanup = () => {
        video.src = '';
        video.load();
        resolve();
      };

      video.addEventListener('canplaythrough', cleanup, { once: true });
      video.addEventListener('error', cleanup, { once: true });

      // Timeout fallback — don't wait longer than 10 seconds
      const timer = setTimeout(cleanup, 10_000);
      video.addEventListener('canplaythrough', () => clearTimeout(timer), { once: true });

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
    (targetNode, transitionData) => {
      const tasks = [];

      if (targetNode?.panoramaUrl) tasks.push(preloadImage(targetNode.panoramaUrl));
      if (transitionData?.videoUrl) tasks.push(preloadVideo(transitionData.videoUrl));
      if (transitionData?.reverseVideoUrl) tasks.push(preloadVideo(transitionData.reverseVideoUrl));

      return Promise.all(tasks);
    },
    [preloadImage, preloadVideo]
  );

  return { preloadImage, preloadVideo, preloadNextAssets };
}
