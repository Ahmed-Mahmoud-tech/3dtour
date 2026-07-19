import { useCallback, useRef } from "react";
import { pickPanoramaUrl } from "../utils/textureTier.js";

// ─── Video preload tuning ─────────────────────────────────────────────────────
// Abort an attempt only when the connection STALLS (no bytes for this long) —
// a flat total timeout killed every clip that simply took longer than it to
// download, which is routine on mobile networks and was the main source of
// "requested but never loaded" videos.
const VIDEO_STALL_MS = 20_000;
// Absolute safety cap per attempt so a byte-per-second trickle can't pin a
// preload slot forever.
const VIDEO_TOTAL_MS = 180_000;
// Network attempts per preloadVideo call (with backoff between them).
const VIDEO_ATTEMPTS = 2;
// After this many FAILED preloadVideo calls for one URL, stop trying — the
// <video> element will stream it on demand if the user actually navigates.
const VIDEO_MAX_FAILED_CALLS = 3;

/**
 * useSmartPreloader — Intelligent asset preloading with proximity-based prioritization.
 *
 * Strategy:
 * 1. Blocking initial preload BEFORE the tour plays: the start node plus its
 *    nearest neighbors by graph distance, full assets each — panorama AND
 *    transition videos (preloadInitialNodes, with a progress callback driving
 *    the pre-play loading screen)
 * 2. On-demand loading when user navigates (via preloadNextAssets)
 * 3. Silent background loading of ALL remaining nodes by proximity after the
 *    user settles (preloadRemaining); nodes whose assets failed stay
 *    unmarked so a later sweep retries them
 * 4. Cache everything to avoid re-downloading; concurrent requests for the
 *    same URL share one in-flight fetch
 * 5. Cancel and re-prioritize when user navigates
 */
export function useSmartPreloader() {
  const imageCache = useRef(new Set());
  const videoCache = useRef(new Set());
  const loadedNodes = useRef(new Set());
  // In-flight dedupe: url -> Promise<boolean>. Without this, the background
  // sweep and a click/hover preload could download the same panorama or clip
  // twice in parallel, starving each other of bandwidth.
  const imageInflight = useRef(new Map());
  const videoInflight = useRef(new Map());
  // url -> count of failed preloadVideo calls (drives the give-up budget)
  const videoFailedCalls = useRef(new Map());
  // Background-sweep generation token. A plain boolean flag had a race: a new
  // sweep reset it while an old sweep was still awaiting a download, so the
  // old one resumed and BOTH swept in parallel. Bumping a generation makes
  // every older sweep see itself as stale at its next check.
  const sweepGenRef = useRef(0);

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
   * Preload a single image URL with proper decoding. Concurrent calls for the
   * same URL share one request.
   * @param {string} url
   * @returns {Promise<boolean>} true when the bytes are cached (even if the
   *   decode warm-up failed — the viewer's texture loader decodes again
   *   anyway); false when the network load failed and a retry may succeed
   */
  const preloadImage = useCallback((url) => {
    if (!url || imageCache.current.has(url)) {
      return Promise.resolve(true);
    }
    const inflight = imageInflight.current.get(url);
    if (inflight) return inflight;

    const p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = async () => {
        try {
          if (img.decode) {
            await img.decode();
          }
        } catch (err) {
          console.warn("⚠️ Image decode failed:", url.split("/").pop());
        }
        imageCache.current.add(url);
        resolve(true);
      };

      img.onerror = () => {
        console.warn("⚠️ Image preload failed:", url.split("/").pop());
        resolve(false);
      };

      img.src = url;
    }).finally(() => imageInflight.current.delete(url));

    imageInflight.current.set(url, p);
    return p;
  }, []);

  /**
   * One network attempt: fetch the clip and drain it into the HTTP cache.
   * Aborts on stall (no bytes for VIDEO_STALL_MS) or the absolute cap.
   * The body is drained chunk-by-chunk so the full file lands in the HTTP
   * cache WITHOUT ever holding the whole clip in JS memory (res.blob()
   * spiked the heap by the clip's full size — fatal on low-RAM phones
   * when several chain segments preload around a transition).
   * @param {string} url
   */
  const fetchVideoOnce = useCallback(async (url) => {
    const controller = new AbortController();
    let stallTimer;
    const armStall = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller.abort(), VIDEO_STALL_MS);
    };
    const totalTimer = setTimeout(() => controller.abort(), VIDEO_TOTAL_MS);

    try {
      armStall();
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader?.();
      if (reader) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          armStall();
          const { done } = await reader.read();
          if (done) break;
        }
      } else {
        await res.blob(); // ancient-browser fallback
      }
    } finally {
      clearTimeout(stallTimer);
      clearTimeout(totalTimer);
    }
  }, []);

  /**
   * Preload a video URL by fetching it fully into the browser's HTTP cache.
   * (A hidden <video> element per clip would pin every preloaded buffer in
   * memory forever; a drained fetch warms the disk cache and holds nothing.)
   * Concurrent calls for the same URL share one download; a failed call is
   * retried with backoff, and a URL that keeps failing across
   * VIDEO_MAX_FAILED_CALLS calls is given up on so sweeps never hammer a
   * dead file forever.
   * @param {string} url
   * @returns {Promise<boolean>} true when no further preload work is needed
   *   (cached, or permanently given up); false when this call failed but a
   *   later call may succeed
   */
  const preloadVideo = useCallback(
    (url) => {
      if (!url || videoCache.current.has(url)) {
        return Promise.resolve(true);
      }
      const inflight = videoInflight.current.get(url);
      if (inflight) return inflight;
      if ((videoFailedCalls.current.get(url) || 0) >= VIDEO_MAX_FAILED_CALLS) {
        return Promise.resolve(true); // given up — let <video> stream it live
      }

      const run = async () => {
        for (let attempt = 1; attempt <= VIDEO_ATTEMPTS; attempt++) {
          try {
            await fetchVideoOnce(url);
            videoCache.current.add(url);
            videoFailedCalls.current.delete(url);
            return true;
          } catch (err) {
            if (attempt < VIDEO_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, attempt * 2000));
            }
          }
        }
        const fails = (videoFailedCalls.current.get(url) || 0) + 1;
        videoFailedCalls.current.set(url, fails);
        console.warn(
          `⚠️ Video preload failed (call ${fails}/${VIDEO_MAX_FAILED_CALLS}):`,
          url.split("/").pop(),
        );
        return false;
      };

      const p = run().finally(() => videoInflight.current.delete(url));
      videoInflight.current.set(url, p);
      return p;
    },
    [fetchVideoOnce],
  );

  /**
   * Every transition-video URL reachable FROM a node: direct hotspot clips,
   * multi-video chain segments (hotspot.transitionVideos — what the viewer
   * actually plays for chains; these were previously never preloaded), and
   * shared project.transitions entries. De-duplicated, order preserved.
   * @param {Object} node
   * @param {Object} project
   * @returns {string[]}
   */
  const collectNodeVideoUrls = useCallback((node, project) => {
    const urls = new Set();
    node?.navigationHotspots?.forEach((hotspot) => {
      if (hotspot.transitionVideoUrl) urls.add(hotspot.transitionVideoUrl);
      if (Array.isArray(hotspot.transitionVideos)) {
        hotspot.transitionVideos.forEach((v) => {
          if (v?.videoUrl) urls.add(v.videoUrl);
        });
      }
      const shared = hotspot.transitionId
        ? project?.transitions?.[hotspot.transitionId]
        : null;
      if (shared?.videoUrl) urls.add(shared.videoUrl);
    });
    return [...urls];
  }, []);

  /**
   * Preload all assets for a single node: panorama first (it's what the user
   * sees on arrival), then its transition videos ONE AT A TIME — parallel
   * clip fetches starve each other of bandwidth and trip the stall watchdog
   * on slow links, which is exactly how videos ended up requested-but-never-
   * cached.
   * @param {Object} node - Node to preload
   * @param {Object} project - Full project object (to access transitions)
   * @returns {Promise<boolean>} true when every asset is cached (or given up
   *   on) — only then may the node be marked fully loaded
   */
  const preloadNode = useCallback(
    async (node, project) => {
      if (!node) return true;

      let ok = true;

      // Panorama — the same device tier the viewer will render, so the cache
      // warms the right file
      const panoUrl = pickPanoramaUrl(node);
      if (panoUrl) {
        ok = (await preloadImage(panoUrl)) && ok;
      }

      for (const url of collectNodeVideoUrls(node, project)) {
        ok = (await preloadVideo(url)) && ok;
      }

      return ok;
    },
    [preloadImage, preloadVideo, collectNodeVideoUrls],
  );

  /**
   * Blocking pre-play preload: the start node plus its nearest `neighborCount`
   * nodes by graph distance — FULL assets per node (panorama AND that node's
   * transition videos), so both looking around and the first navigations are
   * instant. Nodes load SEQUENTIALLY (a parallel burst of panoramas + clips
   * spikes memory on low-RAM phones and starves the first — most urgent —
   * download of bandwidth) and progress is reported after each node so the
   * loading screen can show a real bar.
   * Every underlying loader resolves even on failure, so this always settles;
   * a node with failed assets still counts toward progress but stays
   * unmarked, so the background sweep retries it later.
   * @param {Object} project - Full project object
   * @param {string} startNodeId - Node the tour opens on
   * @param {number} neighborCount - How many nearest nodes besides the start
   * @param {(loaded: number, total: number) => void} [onProgress]
   */
  const preloadInitialNodes = useCallback(
    async (project, startNodeId, neighborCount = 7, onProgress) => {
      // Proximity order includes the start node itself at distance 0; if the
      // graph has fewer reachable nodes than requested, unreachable ones
      // (distance Infinity) fill the tail — still worth warming.
      const targets = getNodesByProximity(project.nodes, startNodeId).slice(
        0,
        neighborCount + 1,
      );
      const total = targets.length;
      let loaded = 0;
      onProgress?.(loaded, total);

      for (const { nodeId } of targets) {
        const ok = await preloadNode(project.nodes[nodeId], project);
        if (ok) loadedNodes.current.add(nodeId);
        loaded += 1;
        onProgress?.(loaded, total);
      }
    },
    [getNodesByProximity, preloadNode],
  );

  /**
   * Preload ALL remaining nodes (panorama + transition videos) ordered by
   * proximity to the active node.
   * This runs SILENTLY in the background - never blocks user interaction.
   * @param {Object} project - Full project object
   * @param {string} activeNodeId - Current active node
   */
  const preloadRemaining = useCallback(
    async (project, activeNodeId) => {
      const gen = ++sweepGenRef.current;

      const sortedNodes = getNodesByProximity(project.nodes, activeNodeId);

      // Everything not already fully cached, nearest first (includes nodes
      // whose assets failed in an earlier pass — they get retried here)
      const remaining = sortedNodes.filter(
        ({ nodeId }) => !loadedNodes.current.has(nodeId),
      );

      if (remaining.length === 0) {
        return; // Silent - no console spam
      }

      // Load ONE node at a time with delays between them (gentle on the
      // network + main-thread decode; the whole tour eventually gets cached)
      for (let i = 0; i < remaining.length; i++) {
        // Superseded by a newer sweep or cancelled — stop immediately
        if (sweepGenRef.current !== gen) {
          return;
        }

        const { nodeId } = remaining[i];

        // Full node assets: panorama + this node's transition videos, so any
        // later navigation is instant. Only a fully-cached node is marked
        // loaded — partial failures stay eligible for the next sweep.
        const ok = await preloadNode(project.nodes[nodeId], project);
        if (ok) loadedNodes.current.add(nodeId);

        // Pause between nodes so the sweep never causes visible lag
        if (i < remaining.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    },
    [getNodesByProximity, preloadNode],
  );

  /**
   * Cancel any ongoing background preloading.
   * Call this when the active node changes to re-prioritize.
   */
  const cancelBackgroundLoading = useCallback(() => {
    sweepGenRef.current++;
  }, []);

  /**
   * Preload assets for a specific next node (used during navigation hover /
   * click). Panorama and clip load in PARALLEL here — this is the urgent
   * path, and it's at most two files. The in-flight maps make this share
   * (not duplicate) any download the background sweep already started.
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
    videoFailedCalls.current.clear();
  }, []);

  return {
    preloadInitialNodes,
    preloadRemaining,
    cancelBackgroundLoading,
    preloadNextAssets,
    clearCache,
  };
}
