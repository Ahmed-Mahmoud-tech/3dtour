import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useSmartPreloader } from "./useSmartPreloader";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
// Static (self-hosted export) build: the tour ships as ./tour.json next to
// index.html, with media rewritten to relative ./media/... paths.
const IS_STATIC = import.meta.env.VITE_STATIC_TOUR === "1";

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
 *  - Smart preloading (initial 5 nodes, then background loading by proximity)
 */
export function useTour(projectId) {
  const [project, setProject] = useState(null);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorReason, setErrorReason] = useState(null); // e.g. 'subscription_expired'

  // Smart preloader
  const { preloadRemaining, cancelBackgroundLoading, preloadNextAssets } =
    useSmartPreloader();

  // Transition state
  const [transition, setTransition] = useState(null); // { videoUrl, playMode, targetNodeId }
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

  // ─── Fetch project (NO blocking preload - instant start like old usePreloader) ────
  useEffect(() => {
    if (!projectId && !IS_STATIC) return;

    const fetchProject = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(
          IS_STATIC ? "./tour.json" : `${API_BASE}/projects/${projectId}/public`,
        );
        setProject(data);

        const initialId =
          data.settings?.initialNodeId || Object.keys(data.nodes)[0];
        setActiveNodeId(initialId);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load tour");
        setErrorReason(err.response?.data?.reason || null);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  // ─── Background audio management ───────────────────────────────────────────
  useEffect(() => {
    const audioSrc = project?.settings?.globalBackgroundAudio?.src;
    const defaultVolume =
      project?.settings?.globalBackgroundAudio?.defaultVolume ?? 0.4;

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

  // ─── Background preload neighbors (silent, non-blocking) ──────────────────
  useEffect(() => {
    if (!project || !activeNodeId) return;

    // Cancel any previous background loading to re-prioritize from current node
    cancelBackgroundLoading();

    // Start silent background loading of immediate neighbors
    // This runs in the background and never blocks user interaction
    const timer = setTimeout(() => {
      preloadRemaining(project, activeNodeId);
    }, 5000); // 5 seconds - user has settled, start preloading neighbors

    return () => {
      clearTimeout(timer);
      cancelBackgroundLoading();
    };
  }, [project, activeNodeId, preloadRemaining, cancelBackgroundLoading]);

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
   * @param {'forward'|'backward'} [playMode='forward']
   * @param {{ videoUrl: string, yawOffset: number }[]} [queue=[]] - Multi-video queue
   */
  const navigateTo = useCallback(
    (targetNodeId, videoUrl, playMode = "forward", queue = []) => {
      if (!project) return;
      if (targetNodeId === activeNodeId) return;

      if (queue.length > 0) {
        // Multi-video queue: start playing the first video
        setVideoQueue(queue);
        setVideoQueueIndex(0);
        setTransition({
          videoUrl: queue[0].videoUrl,
          playMode,
          targetNodeId,
        });
        setIsTransitioning(true);
        setHotspotVisible(false);
      } else if (videoUrl) {
        // Single video (legacy path)
        setVideoQueue([]);
        setVideoQueueIndex(0);
        setTransition({ videoUrl, playMode, targetNodeId });
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
      // All videos played — complete the transition
      const targetNodeId = transition.targetNodeId;
      setTransition(null);
      setIsTransitioning(false);
      setHotspotVisible(true);
      setActiveNodeId(targetNodeId);
      setVideoQueue([]);
      setVideoQueueIndex(0);
    }
  }, [transition, videoQueue, videoQueueIndex, project]);

  const activeNode = project?.nodes?.[activeNodeId] || null;

  return {
    project,
    activeNode,
    activeNodeId,
    loading,
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
    setActiveNodeId,
    preloadNextAssets, // Expose for hover preloading
    // Multi-video queue state
    videoQueue,
    videoQueueIndex,
  };
}
