import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTour } from '../hooks/useTour.js';
import { usePreloader } from '../hooks/usePreloader.js';
import SphereViewer from '../components/Sphere/SphereViewer.jsx';
import NavigationSidebar from '../components/Sidebar/NavigationSidebar.jsx';
import InfoPopup from '../components/Popup/InfoPopup.jsx';

const FADE_MS = 250; // ms for fade-to-black transitions

export default function TourPage() {
  const { projectId } = useParams();
  const { preloadNextAssets } = usePreloader();

  // ─── Info popup state (rendered outside Canvas) ───────────────────────────
  const [activePopup, setActivePopup] = useState(null); // popupContent object

  // ─── Camera yaw tracking for smooth hotspot navigation ──────────────────
  const lastYawRef = useRef(0); // in radians, updated on every drag-end
  const [entryYaw, setEntryYaw] = useState(null); // degrees — overrides initialYawOffset on navigate
  // ─── Video initial yaw override ────────────────────────────────────────
  const [videoYawOverride, setVideoYawOverride] = useState(null);

  // ─── Black fade overlay (no-video navigation + video-end transition) ──────
  const [fadeOverlay, setFadeOverlay] = useState(false);
  const {
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
  } = useTour(projectId);

  // ─── Preload next assets when hovering / navigating ──────────────────────
  const handleNavigate = async (targetNodeId, videoUrl, playMode = 'forward', transitionId, videoYawOffset = 0) => {
    if (!project) return;
    const targetNode = project.nodes?.[targetNodeId];
    // Resolve URL: embedded field (new) OR transitions Map (legacy)
    const resolvedUrl = videoUrl || project.transitions?.[transitionId]?.videoUrl || null;
    const transitionData = resolvedUrl ? { videoUrl: resolvedUrl } : null;

    // Background preload — fires and resolves before the transition starts
    await preloadNextAssets(targetNode, transitionData);

    if (resolvedUrl) {
      // Snap camera to configured video angle (hidden behind black since panorama is unmounted).
      // Negate because panorama angles are right-positive but euler.y is left-positive.
      if (videoYawOffset) setVideoYawOverride(-videoYawOffset);
      // Destination node entry angle: configured offset, or preserve user's current rotation.
      setEntryYaw(videoYawOffset ? -videoYawOffset : lastYawRef.current * (180 / Math.PI));
      navigateTo(targetNodeId, resolvedUrl, playMode);
    } else {
      // No video — cancel any ongoing transition, then fade to black, switch, fade back
      setEntryYaw(lastYawRef.current * (180 / Math.PI));
      setVideoYawOverride(null); // clear any stale video-yaw so it doesn't override entryYaw on remount
      cancelTransition();
      setFadeOverlay(true);
      setTimeout(() => {
        setActiveNodeId(targetNodeId);
        setTimeout(() => setFadeOverlay(false), 50);
      }, FADE_MS);
    }
  };

  // ─── Sidebar quick-jump (no transition video) ─────────────────────────────
  const handleSidebarNavigate = async (targetNodeId) => {
    if (targetNodeId === activeNodeId || !project) return;
    cancelTransition(); // stop any playing transition video
    setVideoYawOverride(null); // clear stale video-yaw so new node starts at its own initialYawOffset
    setEntryYaw(null);         // reset to let the target node use its own initialYawOffset
    const targetNode = project.nodes?.[targetNodeId];
    await preloadNextAssets(targetNode, null);
    setActiveNodeId(targetNodeId);
  };

  // ─── Transition complete: fade overlay → switch node → fade out ──────────────────
  const handleTransitionComplete = () => {
    // VideoSphere already faded to black; show overlay during panorama swap.
    // entryYaw was set from videoInitialYawOffset when navigation started — do not overwrite.
    setFadeOverlay(true);
    setVideoYawOverride(null);
    setTimeout(() => {
      onTransitionComplete();
      setTimeout(() => setFadeOverlay(false), 50);
    }, 80);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading tour…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  if (!activeNode) return null;

  const audioEnabled = Boolean(project?.settings?.globalBackgroundAudio?.src);

  return (
    <div className="relative w-full h-full bg-black no-select overflow-hidden">
      {/* ── 3D Sphere Viewer ── */}
      <SphereViewer
        node={activeNode}
        hotspotVisible={hotspotVisible}
        onNavigate={handleNavigate}
        onSignClick={(content) => setActivePopup(content)}
        initialYaw={entryYaw}
        onYawChange={(yawRad) => { lastYawRef.current = yawRad; }}
        transitionVideoUrl={isTransitioning && transition ? transition.videoUrl : null}
        onTransitionComplete={handleTransitionComplete}
        videoYawOverride={videoYawOverride}
      />

      {/* ── Navigation Sidebar ── */}
      <NavigationSidebar
        nodes={project?.nodes}
        activeNodeId={activeNodeId}
        onNavigate={handleSidebarNavigate}
        audioMuted={audioMuted}
        onToggleAudio={toggleAudio}
        audioEnabled={audioEnabled}
      />

      {/* ── Black fade overlay for smooth transitions ── */}
      <div
        className="absolute inset-0 z-50 bg-black pointer-events-none"
        style={{
          opacity: fadeOverlay ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      />

      {/* ── Node title badge ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10
                      px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm
                      text-white/80 text-sm font-medium border border-white/10
                      pointer-events-none">
        {activeNode.displayName}
      </div>

      {/* ── Info sign popup (rendered outside Canvas for correct layering) ── */}
      {activePopup && (
        <InfoPopup content={activePopup} onClose={() => setActivePopup(null)} />
      )}
    </div>
  );
}
