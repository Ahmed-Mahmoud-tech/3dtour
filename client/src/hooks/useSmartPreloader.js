import { useCallback, useRef, useState } from "react";
import { pickPanoramaUrl } from "../utils/textureTier.js";

/**
 * useSmartPreloader — Intelligent asset preloading with proximity-based prioritization.
 *
 * Strategy (NO LAG - works exactly like old usePreloader + smart background loading):
 * 1. NO blocking initial load - tour starts instantly (like old usePreloader)
 * 2. On-demand loading when user navigates (via preloadNextAssets)
 * 3. Silent background loading of neighbors after 5 seconds (bonus feature)
 * 4. Cache everything to avoid re-downloading
 * 5. Cancel and re-prioritize when user navigates
 */
export function useSmartPreloader() {
  const imageCache = useRef(new Set());
  const videoCache = useRef(new Set());
  const loadedNodes = useRef(new Set());
  const loadingCancelledRef = useRef(false); // Flag to cancel background loading

  /**
   * Calculate graph distance between nodes using BFS.
   * Returns a map of nodeId -> distance from startNodeId.
   * @param {Object} nodes - All nodes in the project
   * @param {string} startNodeId - Starting node
   * @returns {Map<string, number>}
   */
  const calculateDistances = useCallback((nodes, startNodeId) => {
    const distances = new Map();
    const queue = [{ nodeId: startNodeId, distance: 0 }];
    const visited = new Set();

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift();

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      distances.set(nodeId, distance);

      const node = nodes[nodeId];
      if (!node?.navigationHotspots) continue;

      // Add all connected nodes to the queue
      node.navigationHotspots.forEach((hotspot) => {
        if (!visited.has(hotspot.targetNodeId)) {
          queue.push({
            nodeId: hotspot.targetNodeId,
            distance: distance + 1,
          });
        }
      });
    }

    return distances;
  }, []);

  /**
   * Get sorted list of nodes by proximity to the active node.
   * @param {Object} nodes - All nodes in the project
   * @param {string} activeNodeId - Current active node
   * @returns {Array<{nodeId: string, distance: number}>}
   */
  const getNodesByProximity = useCallback(
    (nodes, activeNodeId) => {
      const distances = calculateDistances(nodes, activeNodeId);

      // Sort by distance, then alphabetically for consistent ordering
      return Object.keys(nodes)
        .map((nodeId) => ({
          nodeId,
          distance: distances.get(nodeId) ?? Infinity,
        }))
        .sort((a, b) => {
          if (a.distance !== b.distance) return a.distance - b.distance;
          return a.nodeId.localeCompare(b.nodeId);
        });
    },
    [calculateDistances],
  );

  /**
   * Preload a single image URL with proper decoding.
   * @param {string} url
   * @returns {Promise<void>}
   */
  const preloadImage = useCallback((url) => {
    if (!url || imageCache.current.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = async () => {
        try {
          if (img.decode) {
            await img.decode();
          }
          imageCache.current.add(url);
          resolve();
        } catch (err) {
          console.warn("⚠️ Image decode failed:", url.split("/").pop());
          resolve();
        }
      };

      img.onerror = () => {
        console.warn("⚠️ Image preload failed:", url.split("/").pop());
        resolve();
      };

      img.src = url;
    });
  }, []);

  /**
   * Preload a video URL by fetching it fully into the browser's HTTP cache.
   * (The old approach kept a hidden <video> element per clip alive forever,
   * pinning every preloaded video's buffer in memory. A plain fetch warms the
   * disk cache — the server marks uploads immutable — and holds nothing.)
   * @param {string} url
   * @returns {Promise<void>}
   */
  const preloadVideo = useCallback((url) => {
    if (!url || videoCache.current.has(url)) {
      return Promise.resolve();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    return fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Drain the body chunk-by-chunk so the full file lands in the HTTP
        // cache WITHOUT ever holding the whole clip in JS memory (res.blob()
        // spiked the heap by the clip's full size — fatal on low-RAM phones
        // when several chain segments preload around a transition).
        const reader = res.body?.getReader?.();
        if (reader) {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } else {
          await res.blob(); // ancient-browser fallback
        }
      })
      .then(() => {
        videoCache.current.add(url);
      })
      .catch(() => {
        console.warn("⚠️ Video preload failed:", url.split("/").pop());
      })
      .finally(() => clearTimeout(timer));
  }, []);

  /**
   * Preload all assets for a single node (panorama + transition videos).
   * @param {Object} node - Node to preload
   * @param {Object} project - Full project object (to access transitions)
   * @param {boolean} videosOnly - If true, only load videos (panorama already loaded)
   * @returns {Promise<void>}
   */
  const preloadNode = useCallback(
    async (node, project, videosOnly = false) => {
      if (!node) return;

      const tasks = [];

      // Preload panorama (unless videosOnly mode) — the same device tier the
      // viewer will render, so the cache warms the right file
      const panoUrl = pickPanoramaUrl(node);
      if (!videosOnly && panoUrl && !imageCache.current.has(panoUrl)) {
        tasks.push(preloadImage(panoUrl));
      }

      // Preload transition videos from this node's hotspots
      if (node.navigationHotspots) {
        node.navigationHotspots.forEach((hotspot) => {
          // Direct video URLs on hotspot
          if (
            hotspot.transitionVideoUrl &&
            !videoCache.current.has(hotspot.transitionVideoUrl)
          ) {
            tasks.push(preloadVideo(hotspot.transitionVideoUrl));
          }

          // Also check project.transitions[transitionId] if available
          if (
            hotspot.transitionId &&
            project.transitions?.[hotspot.transitionId]
          ) {
            const transition = project.transitions[hotspot.transitionId];
            if (
              transition.videoUrl &&
              !videoCache.current.has(transition.videoUrl)
            ) {
              tasks.push(preloadVideo(transition.videoUrl));
            }
          }
        });
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }

      if (!videosOnly) {
        loadedNodes.current.add(node.id);
      }
    },
    [preloadImage, preloadVideo],
  );

  /**
   * Preload remaining nodes based on proximity to active node.
   * This runs SILENTLY in the background - never blocks user interaction.
   * Only loads immediate neighbors (distance 1) with long delays.
   * @param {Object} project - Full project object
   * @param {string} activeNodeId - Current active node
   */
  const preloadRemaining = useCallback(
    async (project, activeNodeId) => {
      // Reset cancellation flag
      loadingCancelledRef.current = false;

      const sortedNodes = getNodesByProximity(project.nodes, activeNodeId);

      // Filter: only immediate neighbors (distance 1), not already loaded
      const remaining = sortedNodes.filter(
        ({ nodeId, distance }) =>
          !loadedNodes.current.has(nodeId) && distance === 1,
      );

      if (remaining.length === 0) {
        return; // Silent - no console spam
      }

      // Load ONE node at a time with 3-second delays (very gentle)
      for (let i = 0; i < remaining.length; i++) {
        // Check if loading was cancelled
        if (loadingCancelledRef.current) {
          return;
        }

        const { nodeId } = remaining[i];
        const node = project.nodes[nodeId];

        // Load just the panorama (videos will load on-demand during navigation)
        const neighborUrl = pickPanoramaUrl(node);
        if (neighborUrl && !imageCache.current.has(neighborUrl)) {
          await preloadImage(neighborUrl);
        }
        loadedNodes.current.add(nodeId);

        // 3 second delay between each node to prevent any lag
        if (i < remaining.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    },
    [getNodesByProximity, preloadImage],
  );

  /**
   * Cancel any ongoing background preloading.
   * Call this when the active node changes to re-prioritize.
   */
  const cancelBackgroundLoading = useCallback(() => {
    loadingCancelledRef.current = true;
  }, []);

  /**
   * Preload assets for a specific next node (used during navigation hover).
   * @param {Object} targetNode
   * @param {Object} transitionData - { videoUrl? }
   * @returns {Promise<void>}
   */
  const preloadNextAssets = useCallback(
    async (targetNode, transitionData) => {
      const tasks = [];

      const targetUrl = pickPanoramaUrl(targetNode);
      if (targetUrl) {
        tasks.push(preloadImage(targetUrl));
      }
      if (transitionData?.videoUrl) {
        tasks.push(preloadVideo(transitionData.videoUrl));
      }

      await Promise.all(tasks);
    },
    [preloadImage, preloadVideo],
  );

  /**
   * Clear all caches (useful for memory management).
   */
  const clearCache = useCallback(() => {
    imageCache.current.clear();
    videoCache.current.clear();
    loadedNodes.current.clear();
  }, []);

  return {
    preloadRemaining,
    cancelBackgroundLoading,
    preloadNextAssets,
    clearCache,
  };
}
