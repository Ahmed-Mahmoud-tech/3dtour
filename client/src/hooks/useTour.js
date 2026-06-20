import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/**
 * useTour — Central state machine for the 360 tour viewer.
 *
 * Manages:
 *  - Project data fetching
 *  - Active node (current panorama)
 *  - Transition lifecycle (preload → play → complete)
 *  - Audio state
 *  - UI visibility (hotspots/signs hidden during transitions)
 */
export function useTour(projectId) {
  const [project, setProject] = useState(null);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Transition state
  const [transition, setTransition] = useState(null); // { videoUrl, playMode, targetNodeId }
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hotspotVisible, setHotspotVisible] = useState(true);

  // Audio
  const [audioMuted, setAudioMuted] = useState(false);
  const audioRef = useRef(null);

  // ─── Fetch project ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;

    const fetchProject = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(
          `${API_BASE}/projects/${projectId}/public`,
        );
        setProject(data);
        setActiveNodeId(
          data.settings?.initialNodeId || Object.keys(data.nodes)[0],
        );
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load tour");
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

  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return;
    const next = !audioMuted;
    setAudioMuted(next);
    audioRef.current.muted = next;
  }, [audioMuted]);

  // ─── Navigation ────────────────────────────────────────────────────────────
  /**
   * Navigate to a new node, optionally via a transition video.
   * @param {string} targetNodeId
   * @param {string} [transitionId]
   * @param {'forward'|'backward'} [playMode='forward']
   */
  const navigateTo = useCallback(
    (targetNodeId, videoUrl, playMode = "forward") => {
      if (!project) return;
      if (targetNodeId === activeNodeId) return;
      if (videoUrl) {
        console.log("2222");
        // Change node immediately so new panorama loads underneath video
        // setTimeout(() => {
        // setActiveNodeId(targetNodeId);
        // }, 600);
        // Overwrite any existing transition — VideoSphere will restart with the new URL
        setTransition({ videoUrl, playMode, targetNodeId });
        setIsTransitioning(true);
        setHotspotVisible(false); // hide hotspots/signs while video plays
      } else {
        console.log("5555");
        // No transition video — jump directly (caller handles fade overlay)
        setTransition(null);
        setIsTransitioning(false);
        setActiveNodeId(targetNodeId);
      }
    },
    [project],
  );

  /** Cancel an in-progress video transition without changing the active node */
  const cancelTransition = useCallback(() => {
    setTransition(null);
    setIsTransitioning(false);
    setHotspotVisible(true);
  }, []);

  /** Called by VideoSphere when video finishes */
  const onTransitionComplete = useCallback(() => {
    if (!transition) return;
    // Node was already changed when video started, just cleanup transition state
    setTransition(null);
    setIsTransitioning(false);
    setHotspotVisible(true);
    setActiveNodeId(transition.targetNodeId);
  }, [transition]);

  const activeNode = project?.nodes?.[activeNodeId] || null;

  return {
    project,
    activeNode,
    activeNodeId,
    loading,
    error,
    transition,
    isTransitioning,
    hotspotVisible,
    audioMuted,
    toggleAudio,
    navigateTo,
    cancelTransition,
    onTransitionComplete,
    setActiveNodeId,
  };
}
