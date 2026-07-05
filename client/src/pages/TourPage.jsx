import { useEffect, useRef, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTour } from "../hooks/useTour.js";
// import { usePreloader } from "../hooks/usePreloader.js";
import SphereViewer from "../components/Sphere/SphereViewer.jsx";
import NavigationSidebar from "../components/Sidebar/NavigationSidebar.jsx";
import InfoPopup from "../components/Popup/InfoPopup.jsx";

const FADE_MS = 250; // ms for fade-to-black transitions

export default function TourPage() {
  const { projectId } = useParams();
  // const { preloadNextAssets } = usePreloader();

  // ─── Info popup state (rendered outside Canvas) ───────────────────────────
  const [activePopup, setActivePopup] = useState(null); // popupContent object

  // ─── Camera yaw and pitch preservation across navigation ──────────────────────────────
  const cameraYawRef = useRef(0); // in radians, updated on every drag
  const cameraPitchRef = useRef(0); // in radians, updated on every drag
  const [preservedCameraYaw, setPreservedCameraYaw] = useState(null); // radians - preserves user's view
  const [preservedCameraPitch, setPreservedCameraPitch] = useState(null); // radians - preserves vertical scroll

  // ─── Video texture yaw for rotation ─────────────────────────────────────────
  const [videoTextureYawOffset, setVideoTextureYawOffset] = useState(null);

  // ─── Active video URL (managed separately to control video lifecycle) ──────
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [spotHasVideo, setSpotHasVideo] = useState(false);

  // ─── Render state for pre-rendering assets ───────────────────────────────────
  const [isPreRender, setIsPreRender] = useState(false);

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
    preloadNextAssets,
  } = useTour(projectId);

  // ─── Compute target node for video transition (to show behind the video) ──
  const targetNodeForVideo = useMemo(() => {
    if (!transition?.targetNodeId || !project?.nodes) return null;
    return project.nodes[transition.targetNodeId] || null;
  }, [transition?.targetNodeId, project?.nodes]);

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
    if (isPreRender) return; // Prevent multiple simultaneous preloads
    setIsPreRender(true);

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

    // Pre-render assets and show pre-rendering indicator
    try {
      await preloadNextAssets(targetNode, transitionData);
    } catch (error) {
      console.error("Pre-render failed:", error);
    } finally {
      setIsPreRender(false);
    }

    // ─── THREE INDEPENDENT VALUES ───
    // 1. User Camera Drag (pure user input) - preserved across navigation
    // 2. Target Panorama Rotation (from node.initialYawOffset) - rotates the image sphere
    // 3. Video Rotation (from videoInitialYawOffset) - rotates the video sphere
    const currentCameraYaw = cameraYawRef.current; // in radians
    const currentCameraPitch = cameraPitchRef.current; // in radians
    const targetPanoramaRotation = targetNode.initialYawOffset || 0; // in degrees

    console.log("\n═══════════════════════════════════════════════");
    console.log("� NAVIGATION: 3 INDEPENDENT ROTATIONS");
    console.log("───────────────────────────────────────────────");
    console.log(
      "1️⃣  USER CAMERA DRAG (preserved):",
      ((currentCameraYaw * 180) / Math.PI).toFixed(2) +
        "° yaw, " +
        ((currentCameraPitch * 180) / Math.PI).toFixed(2) +
        "° pitch",
    );
    console.log(
      "2️⃣  TARGET PANORAMA IMAGE ROTATION:",
      targetPanoramaRotation + "°",
    );
    console.log("3️⃣  VIDEO ROTATION:", videoYawOffset + "°");
    console.log("═══════════════════════════════════════════════\n");

    if (resolvedUrl) {
      // Video transition: preserve camera, rotate video sphere
      setPreservedCameraYaw(currentCameraYaw);
      setPreservedCameraPitch(currentCameraPitch);
      setVideoTextureYawOffset(videoYawOffset);
      setActiveVideoUrl(resolvedUrl);
      setSpotHasVideo(true);
      navigateTo(targetNodeId, resolvedUrl, playMode);
    } else {
      console.log(
        "🚀 No video transition: cross-fade to target node, preserving camera",
        resolvedUrl,
      );
      // No video: cross-fade transition, preserve camera
      setPreservedCameraYaw(currentCameraYaw);
      setPreservedCameraPitch(currentCameraPitch);
      setVideoTextureYawOffset(null);
      setActiveVideoUrl(null);
      setSpotHasVideo(false);
      cancelTransition();
      setActiveNodeId(targetNodeId);
    }
  };

  // ─── Sidebar quick-jump (no transition video) ─────────────────────────────
  const handleSidebarNavigate = async (targetNodeId) => {
    if (targetNodeId === activeNodeId || !project) return;
    if (isPreRender) return; // Prevent multiple simultaneous preloads

    cancelTransition();
    // Reset camera to 0,0 for sidebar navigation (fresh start)
    setPreservedCameraYaw(0);
    setPreservedCameraPitch(0);
    setVideoTextureYawOffset(null);
    setActiveVideoUrl(null);
    setSpotHasVideo(false);

    const targetNode = project.nodes?.[targetNodeId];

    // Preload assets before navigation
    setIsPreRender(true);
    try {
      await preloadNextAssets(targetNode, null);
    } catch (error) {
      console.error("Preload failed:", error);
    } finally {
      setIsPreRender(false);
    }

    setActiveNodeId(targetNodeId);
  };

  // ─── Transition complete: video ended, clean up ──────────────────────────────
  const handleTransitionComplete = () => {
    // IMPORTANT: Update preserved camera to CURRENT position (includes any dragging during video)
    const currentCameraAfterVideo = cameraYawRef.current;
    const currentPitchAfterVideo = cameraPitchRef.current;
    setPreservedCameraYaw(currentCameraAfterVideo);
    setPreservedCameraPitch(currentPitchAfterVideo);

    console.log(
      "🎬 VIDEO FADE STARTED - Node already changed when video started. Camera position:",
      ((currentCameraAfterVideo * 180) / Math.PI).toFixed(2) +
        "° yaw, " +
        ((currentPitchAfterVideo * 180) / Math.PI).toFixed(2) +
        "° pitch (includes any dragging during video)",
    );

    onTransitionComplete();
  };

  // ─── Video fade complete: cleanup transition state ───────────────────────────
  const handleVideoFadeComplete = () => {
    // setVideoTextureYawOffset(null);
    // setActiveVideoUrl(null);
    console.log("🎬 VIDEO FADE COMPLETE - Cleaning up video");
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
        targetNodeForVideo={targetNodeForVideo} // Pass target node to show behind video
        hotspotVisible={hotspotVisible}
        onNavigate={handleNavigate}
        onSignClick={(content) => setActivePopup(content)}
        preservedCameraYaw={preservedCameraYaw}
        preservedCameraPitch={preservedCameraPitch}
        onYawChange={(yawRad) => {
          cameraYawRef.current = yawRad;
        }}
        onPitchChange={(pitchRad) => {
          cameraPitchRef.current = pitchRad;
        }}
        transitionVideoUrl={activeVideoUrl}
        onTransitionComplete={handleTransitionComplete}
        onVideoFadeComplete={handleVideoFadeComplete}
        videoTextureYawOffset={videoTextureYawOffset}
        spotHasVideo={spotHasVideo}
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

      {/* ── Pre-render indicator ── */}
      {/* {isPreRender && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white/80 text-sm font-medium">Loading...</p>
          </div>
        </div>
      )} */}

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
