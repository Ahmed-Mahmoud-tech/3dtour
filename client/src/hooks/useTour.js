import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useSmartPreloader } from "./useSmartPreloader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
// Static (self-hosted export) build: the tour ships as ./tour.json next to
// index.html, with media rewritten to relative ./media/... paths.
// (process.env.NEXT_PUBLIC_* is inlined by Next; the Vite static build
// defines the same keys — see vite.config.js.)
const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_TOUR === "1";

// When a tour has no owner-set background track, the hosted viewer plays this
// default ambient loop (served from client/public/music/, mapped to /music).
// Not applied in the self-hosted static export: it runs from an arbitrary
// sub-path where an absolute "/music/..." URL wouldn't resolve, and a delivered
// tour should only play audio the owner explicitly bundled.
const DEFAULT_BACKGROUND_AUDIO_URL = IS_STATIC
  ? ""
  : "/music/quiet-reflections.mp3";

// Pre-play preload: the start node + its 7 nearest nodes by graph distance —
// panoramas AND their transition videos — must be cached before the tour is
// shown; everything else loads in the background afterwards.
const INITIAL_PRELOAD_NEIGHBORS = 7;
// A dead connection must not brick the tour behind the loading screen — after
// this long the tour starts anyway and the preload keeps going underneath.
// (Generous because the initial payload includes transition videos.)
const INITIAL_PRELOAD_WATCHDOG_MS = 90_000;

/**
 * useTour — Central state machine for the 360 tour viewer.
 *
 * Manages:
 *  - Project data fetching
 *  - Active node (current panorama)
 *  - Transition lifecycle (preload → play → complete)
 *  - Sequential multi-video queue playback
 *  - Audio state
 *  - UI visibility (hotspots/signs hidden during transitions)
 *  - Smart preloading (blocking pre-play load of the start node + 7 nearest,
 *    then background loading of the rest by proximity)
 */
export function useTour(projectId) {
  const [project, setProject] = useState(null);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorReason, setErrorReason] = useState(null); // e.g. 'subscription_expired'

  // Pre-play preload phase (between fetch completing and the tour showing)
  const [preloading, setPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState({
    loaded: 0,
    total: 0,
  });

  // Smart preloader
  const {
    preloadInitialNodes,
    preloadRemaining,
    cancelBackgroundLoading,
    preloadNextAssets,
  } = useSmartPreloader();

  // Transition state
  const [transition, setTransition] = useState(null); // { videoUrl, targetNodeId }
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hotspotVisible, setHotspotVisible] = useState(true);

  // ─── Multi-video queue ─────────────────────────────────────────────────────
  // videoQueue: array of { videoUrl, yawOffset } sorted by order
  // videoQueueIndex: index of the currently playing video in the queue
  const [videoQueue, setVideoQueue] = useState([]);
  const [videoQueueIndex, setVideoQueueIndex] = useState(0);

  // Audio
  const [audioMuted, setAudioMuted] = useState(false);
  const audioRef = useRef(null);

  // ─── Blocking pre-play preload (start node + nearest neighbors) ────────────
  // Fire-and-forget from fetchProject; preloadInitialNodes always settles
  // (individual asset failures resolve, never reject), and the watchdog
  // guarantees the loading screen can't outlive a dead connection.
  const runInitialPreload = useCallback(
    async (proj, startNodeId) => {
      setPreloading(true);
      const watchdog = setTimeout(() => {
        console.warn("Initial preload watchdog: starting tour anyway");
        setPreloading(false);
      }, INITIAL_PRELOAD_WATCHDOG_MS);
      try {
        await preloadInitialNodes(
          proj,
          startNodeId,
          INITIAL_PRELOAD_NEIGHBORS,
          (loaded, total) => setPreloadProgress({ loaded, total }),
        );
      } finally {
        clearTimeout(watchdog);
        setPreloading(false);
      }
    },
    [preloadInitialNodes],
  );

  // ─── Fetch project, then preload before the tour shows ────────────────────
  useEffect(() => {
    if (!projectId && !IS_STATIC) return;

    const fetchProject = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(
          IS_STATIC ? "./tour.json" : `${API_BASE}/projects/${projectId}/public`,
        );

        // Shape-check before touching data.nodes: a truncated response or a
        // malformed tour.json (static export) must produce a clear message,
        // not a TypeError mislabeled as a network failure.
        if (!data || typeof data !== "object" || typeof data.nodes !== "object" || data.nodes === null) {
          setError("This tour's data is malformed or incomplete.");
          return;
        }

        const nodeIds = Object.keys(data.nodes);
        if (nodeIds.length === 0) {
          setError("This tour has no scenes yet.");
          return;
        }

        setProject(data);

        // initialNodeId can go stale (node deleted after it was set) — only
        // trust it when the node actually exists, else start at the first one.
        const configured = data.settings?.initialNodeId;
        const initialId =
          configured && data.nodes[configured] ? configured : nodeIds[0];
        setActiveNodeId(initialId);

        // Hold the tour behind the preloader until the nearest nodes are
        // cached (not awaited — `loading` must clear so progress can render).
        runInitialPreload(data, initialId);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load tour");
        setErrorReason(err.response?.data?.reason || null);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, runInitialPreload]);

  // ─── Background audio management ───────────────────────────────────────────
  useEffect(() => {
    const audioCfg = project?.settings?.globalBackgroundAudio;
    // Explicit "silent tour" opt-out: no audio at all, not even the default.
    if (audioCfg?.disabled) return;

    const audioSrc = audioCfg?.src || DEFAULT_BACKGROUND_AUDIO_URL;
    const defaultVolume = audioCfg?.defaultVolume ?? 0.4;

    if (!audioSrc) return;

    const audio = new Audio(audioSrc);
    audio.loop = true;
    audio.volume = defaultVolume;
    audioRef.current = audio;
    audio.play().catch(() => {
      // Auto-play policy: play on first user interaction
      const unlock = () => {
        audio.play();
        window.removeEventListener("click", unlock);
      };
      window.addEventListener("click", unlock, { once: true });
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [project]);

  // ─── Background preload of all remaining nodes (silent, non-blocking) ─────
  useEffect(() => {
    if (!project || !activeNodeId) return;
    // Don't compete with the blocking pre-play preload for bandwidth — the
    // sweep starts once the tour is actually showing.
    if (preloading) return;

    // Cancel any previous background loading to re-prioritize from current node
    cancelBackgroundLoading();

    // Silent background sweep of everything not yet cached, nearest first.
    // This runs in the background and never blocks user interaction.
    const timer = setTimeout(() => {
      preloadRemaining(project, activeNodeId);
    }, 5000); // 5 seconds - user has settled, start preloading the rest

    return () => {
      clearTimeout(timer);
      cancelBackgroundLoading();
    };
  }, [project, activeNodeId, preloading, preloadRemaining, cancelBackgroundLoading]);

  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return;
    const next = !audioMuted;
    setAudioMuted(next);
    audioRef.current.muted = next;
  }, [audioMuted]);

  // ─── Navigation ────────────────────────────────────────────────────────────
  /**
   * Navigate to a new node, optionally via a transition video or video queue.
   * @param {string} targetNodeId
   * @param {string} [videoUrl]           - Single video URL (legacy / first video)
   * @param {{ videoUrl: string, yawOffset: number }[]} [queue=[]] - Multi-video queue
   */
  const navigateTo = useCallback(
    (targetNodeId, videoUrl, queue = []) => {
      if (!project) return;
      if (targetNodeId === activeNodeId) return;
      // Defensive: a hotspot can point at a node that no longer exists (tour
      // edited after this session loaded it). Navigating there would unmount
      // the whole viewer — stay where we are instead.
      if (!project.nodes?.[targetNodeId]) {
        console.warn("Navigation target no longer exists:", targetNodeId);
        return;
      }

      if (queue.length > 0) {
        // Multi-video queue: start playing the first video
        setVideoQueue(queue);
        setVideoQueueIndex(0);
        setTransition({
          videoUrl: queue[0].videoUrl,
          targetNodeId,
        });
        setIsTransitioning(true);
        setHotspotVisible(false);
      } else if (videoUrl) {
        // Single video (legacy path)
        setVideoQueue([]);
        setVideoQueueIndex(0);
        setTransition({ videoUrl, targetNodeId });
        setIsTransitioning(true);
        setHotspotVisible(false);
      } else {
        // No transition video — jump directly (caller handles fade overlay)
        setVideoQueue([]);
        setVideoQueueIndex(0);
        setTransition(null);
        setIsTransitioning(false);
        setActiveNodeId(targetNodeId);
      }
    },
    [project, activeNodeId],
  );

  /** Cancel an in-progress video transition without changing the active node */
  const cancelTransition = useCallback(() => {
    setTransition(null);
    setIsTransitioning(false);
    setHotspotVisible(true);
    setVideoQueue([]);
    setVideoQueueIndex(0);
  }, []);

  /**
   * Called by VideoSphere when the current video finishes.
   * If there are more videos in the queue, advance to the next one.
   * Otherwise, complete the transition.
   */
  const onTransitionComplete = useCallback(() => {
    if (!transition) return;

    const nextIndex = videoQueueIndex + 1;

    if (videoQueue.length > 0 && nextIndex < videoQueue.length) {
      // More videos in the queue — arrive at the intermediate waypoint (the
      // node the NEXT clip departs from), then advance to that next clip.
      // This makes a chain visibly step 0 → 1 → 2 instead of appearing to jump
      // straight to the final target.
      const waypointNodeId = videoQueue[nextIndex].startNodeId;
      if (waypointNodeId && project?.nodes?.[waypointNodeId]) {
        setActiveNodeId(waypointNodeId);
      }
      setVideoQueueIndex(nextIndex);
      setTransition((prev) => ({
        ...prev,
        videoUrl: videoQueue[nextIndex].videoUrl,
      }));
    } else {
      // All videos played — arrive at the target while the clip's last frame
      // is still on screen. The transition state is deliberately KEPT: the
      // video sphere stays mounted and dissolves into the (identical) arrival
      // panorama behind it; finishTransition() tears everything down once
      // that fade-out completes. Land on the target only if it still exists;
      // otherwise stay put rather than navigating into a black screen.
      const targetNodeId = transition.targetNodeId;
      if (project?.nodes?.[targetNodeId]) setActiveNodeId(targetNodeId);
    }
  }, [transition, videoQueue, videoQueueIndex, project]);

  /**
   * Called by VideoSphere when the end-of-clip fade-out has fully revealed
   * the arrival panorama — tears down the transition state (which unmounts
   * the video sphere) and brings the hotspots back.
   */
  const finishTransition = useCallback(() => {
    setTransition(null);
    setIsTransitioning(false);
    setHotspotVisible(true);
    setVideoQueue([]);
    setVideoQueueIndex(0);
  }, []);

  // ─── Transition watchdog ───────────────────────────────────────────────────
  // A clip that stalls mid-buffer (network drop, tab backgrounded on mobile)
  // fires neither `ended` nor `error` — without this, isTransitioning stays
  // true forever and the hotspots never come back. Re-armed per queue segment;
  // clips are 5–15 s, so 30 s means genuinely stuck.
  useEffect(() => {
    if (!transition) return;
    const timer = setTimeout(() => {
      console.warn("Transition watchdog: video never finished — forcing completion");
      const targetNodeId = transition.targetNodeId;
      setTransition(null);
      setIsTransitioning(false);
      setHotspotVisible(true);
      setVideoQueue([]);
      setVideoQueueIndex(0);
      if (project?.nodes?.[targetNodeId]) setActiveNodeId(targetNodeId);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [transition, videoQueueIndex, project]);

  // ─── Self-heal a dangling active node ──────────────────────────────────────
  // If activeNodeId ever points at nothing (stale data edge cases), snap to
  // the initial node / first node instead of rendering an empty screen.
  useEffect(() => {
    if (!project?.nodes || !activeNodeId) return;
    if (project.nodes[activeNodeId]) return;
    const configured = project.settings?.initialNodeId;
    const fallback =
      (configured && project.nodes[configured] && configured) ||
      Object.keys(project.nodes)[0] ||
      null;
    console.warn("Active node missing — falling back to:", fallback);
    setActiveNodeId(fallback);
  }, [project, activeNodeId]);

  const activeNode =
    project?.nodes?.[activeNodeId] ||
    // Render fallback for the frame(s) before the self-heal effect runs
    (project?.nodes ? Object.values(project.nodes)[0] : null) ||
    null;

  return {
    project,
    activeNode,
    activeNodeId,
    loading,
    preloading,
    preloadProgress,
    error,
    errorReason,
    transition,
    isTransitioning,
    hotspotVisible,
    audioMuted,
    toggleAudio,
    navigateTo,
    cancelTransition,
    onTransitionComplete,
    finishTransition,
    setActiveNodeId,
    preloadNextAssets, // Expose for hover preloading
    // Multi-video queue state
    videoQueue,
    videoQueueIndex,
  };
}
