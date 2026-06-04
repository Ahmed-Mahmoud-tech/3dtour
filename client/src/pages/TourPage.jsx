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

  // ─── Camera yaw preservation across navigation ──────────────────────────────
  const cameraYawRef = useRef(0); // in radians, updated on every drag
  const [preservedCameraYaw, setPreservedCameraYaw] = useState(null); // radians - preserves user's view

  // ─── Video texture yaw for rotation ─────────────────────────────────────────
  const [videoTextureYawOffset, setVideoTextureYawOffset] = useState(null);

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

    if (playMode === "backward") {
      // Try reverse URL from the backward hotspot itself or its shared transition record
      let resolvedReverse =
        reverseVideoUrl ||
        project.transitions?.[transitionId]?.reverseVideoUrl ||
        null;

      // Auto-lookup: find the corresponding forward hotspot on the target node
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

      resolvedUrl = resolvedReverse || null;
    } else {
      resolvedUrl =
        videoUrl || project.transitions?.[transitionId]?.videoUrl || null;
    }

    const transitionData = resolvedUrl ? { videoUrl: resolvedUrl } : null;

    // Background preload
    await preloadNextAssets(targetNode, transitionData);

    // ─── Simple camera preservation: keep user's current view angle ───
    // Camera angle is independent of panorama/video rotations
    const currentCameraYaw = cameraYawRef.current; // in radians

    console.log("=== NAVIGATION ===");
    console.log(
      "Camera Yaw (preserved):",
      ((currentCameraYaw * 180) / Math.PI).toFixed(2) + "°",
    );
    console.log("Video Yaw Offset:", videoYawOffset + "°");
    console.log("==================");

    if (resolvedUrl) {
      // Video transition: preserve camera, rotate video sphere
      setPreservedCameraYaw(currentCameraYaw);
      setVideoTextureYawOffset(videoYawOffset);
      navigateTo(targetNodeId, resolvedUrl, playMode);
    } else {
      // No video: cross-fade transition, preserve camera
      setPreservedCameraYaw(currentCameraYaw);
      setVideoTextureYawOffset(null);
      cancelTransition();
      setActiveNodeId(targetNodeId);
    }
  };

  // ─── Sidebar quick-jump (no transition video) ─────────────────────────────
  const handleSidebarNavigate = async (targetNodeId) => {
    if (targetNodeId === activeNodeId || !project) return;
    cancelTransition();
    // Reset camera to 0,0 for sidebar navigation (fresh start)
    setPreservedCameraYaw(0);
    setVideoTextureYawOffset(null);
    const targetNode = project.nodes?.[targetNodeId];
    await preloadNextAssets(targetNode, null);
    setActiveNodeId(targetNodeId);
  };

  // ─── Transition complete: video ended, clean up ──────────────────────────────
  const handleTransitionComplete = () => {
    setVideoTextureYawOffset(null);
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
        preservedCameraYaw={preservedCameraYaw}
        onYawChange={(yawRad) => {
          cameraYawRef.current = yawRad;
        }}
        transitionVideoUrl={
          isTransitioning && transition ? transition.videoUrl : null
        }
        onTransitionComplete={handleTransitionComplete}
        videoTextureYawOffset={videoTextureYawOffset}
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
