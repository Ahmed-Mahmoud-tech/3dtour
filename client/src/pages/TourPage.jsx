import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTour } from "../hooks/useTour.js";
import { usePreloader } from "../hooks/usePreloader.js";
import SphereViewer from "../components/Sphere/SphereViewer.jsx";
import NavigationSidebar from "../components/Sidebar/NavigationSidebar.jsx";
import InfoPopup from "../components/Popup/InfoPopup.jsx";

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
  const handleNavigate = async (
    targetNodeId,
    videoUrl,
    playMode = "forward",
    transitionId,
    videoYawOffset = 0,
    reverseVideoUrl = null,
  ) => {
    if (!project) return;
    const targetNode = project.nodes?.[targetNodeId];

    let resolvedUrl;
    // effectiveYawOffset may be overridden by auto-lookup below
    let effectiveYawOffset = videoYawOffset;

    if (playMode === "backward") {
      // 1. Try reverse URL from the backward hotspot itself or its shared transition record
      let resolvedReverse =
        reverseVideoUrl ||
        project.transitions?.[transitionId]?.reverseVideoUrl ||
        null;

      // 2. Auto-lookup: if still nothing, find the corresponding forward hotspot on the
      //    target node (the one pointing back to activeNodeId) and borrow its reverse URL.
      //    This lets a backward hotspot work without re-uploading the video.
      if (!resolvedReverse) {
        const targetNodeData = project.nodes?.[targetNodeId];
        const forwardHotspot = targetNodeData?.navigationHotspots?.find(
          (hs) => hs.targetNodeId === activeNodeId,
        );
        if (forwardHotspot) {
          resolvedReverse =
            forwardHotspot.reverseTransitionVideoUrl ||
            project.transitions?.[forwardHotspot.transitionId]
              ?.reverseVideoUrl ||
            null;
        }
      }

      // Never fall back to the forward video — playing it "backward" looks wrong.
      // If no reverse is available yet, the transition falls through to a simple fade.
      resolvedUrl = resolvedReverse || null;
    } else {
      resolvedUrl =
        videoUrl || project.transitions?.[transitionId]?.videoUrl || null;
    }

    const transitionData = resolvedUrl ? { videoUrl: resolvedUrl } : null;

    // Background preload — fires and resolves before the transition starts
    await preloadNextAssets(targetNode, transitionData);

    if (resolvedUrl) {
      // Separate user drag from the video's configured angle, then combine:
      //   nodeBaseEulerYDeg = the euler.y angle the camera mounted at for this node
      //   userDragDeltaDeg  = how much the user has dragged FROM that base (0 if no drag)
      //   combinedEulerYDeg = -(videoInitialYawOffset) + userDragDeltaDeg
      //
      // Example: videoInitialYawOffset=270, no drag → combined = -270° (euler.y) = 270° right
      const nodeBaseEulerYDeg =
        entryYaw !== null ? entryYaw : -(activeNode.initialYawOffset || 0);
      const userDragDeltaDeg =
        lastYawRef.current * (180 / Math.PI) - nodeBaseEulerYDeg;
      const combinedEulerYDeg = -effectiveYawOffset + userDragDeltaDeg;
      setVideoYawOverride(combinedEulerYDeg);
      setEntryYaw(combinedEulerYDeg);
      navigateTo(targetNodeId, resolvedUrl, playMode);
    } else {
      // No video — use cross-fade transition via SphereViewer
      setEntryYaw(lastYawRef.current * (180 / Math.PI));
      setVideoYawOverride(null); // clear any stale video-yaw so it doesn't override entryYaw on remount
      cancelTransition();
      // SphereViewer will handle the cross-fade automatically
      setActiveNodeId(targetNodeId);
    }
  };

  // ─── Sidebar quick-jump (no transition video) ─────────────────────────────
  const handleSidebarNavigate = async (targetNodeId) => {
    if (targetNodeId === activeNodeId || !project) return;
    cancelTransition(); // stop any playing transition video
    setVideoYawOverride(null); // clear stale video-yaw so new node starts at its own initialYawOffset
    setEntryYaw(null); // reset to let the target node use its own initialYawOffset
    const targetNode = project.nodes?.[targetNodeId];
    await preloadNextAssets(targetNode, null);
    setActiveNodeId(targetNodeId);
  };

  // ─── Transition complete: fade overlay → switch node → fade out ──────────────────
  const handleTransitionComplete = () => {
    // Video ended - panorama will cross-fade automatically in SphereViewer
    setVideoYawOverride(null);
    onTransitionComplete();
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
        onYawChange={(yawRad) => {
          lastYawRef.current = yawRad;
        }}
        transitionVideoUrl={
          isTransitioning && transition ? transition.videoUrl : null
        }
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

      {/* ── Black fade overlay (only for sidebar navigation) ── */}
      {fadeOverlay && (
        <div
          className="absolute inset-0 z-50 bg-black pointer-events-none"
          style={{
            opacity: 1,
            transition: `opacity ${FADE_MS}ms ease`,
          }}
        />
      )}

      {/* ── Node title badge ── */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10
                      px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm
                      text-white/80 text-sm font-medium border border-white/10
                      pointer-events-none"
      >
        {activeNode.displayName}
      </div>

      {/* ── Info sign popup (rendered outside Canvas for correct layering) ── */}
      {activePopup && (
        <InfoPopup content={activePopup} onClose={() => setActivePopup(null)} />
      )}
    </div>
  );
}
