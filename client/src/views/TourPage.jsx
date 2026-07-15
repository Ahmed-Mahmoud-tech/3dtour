import { useRef, useState, useMemo, useEffect } from "react";
import { useTour } from "../hooks/useTour.js";
import { useAnalytics } from "../hooks/useAnalytics.js";
import SphereViewer from "../components/Sphere/SphereViewer.jsx";
import NavigationSidebar from "../components/Sidebar/NavigationSidebar.jsx";
import InfoPopup from "../components/Popup/InfoPopup.jsx";
import MessageForm from "../components/Popup/MessageForm.jsx";

const FADE_MS = 250; // ms for fade-to-black transitions
// Static exports have no API — the contact form is compiled out with them.
const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_TOUR === "1";

// projectId comes from the route (app/tour/[projectId]) — or is null in the
// self-hosted static build, where the tour loads from ./tour.json instead.
export default function TourPage({ projectId }) {
  // ─── Info popup state (rendered outside Canvas) ───────────────────────────
  const [activePopup, setActivePopup] = useState(null); // popupContent object
  const activePopupSignIdRef = useRef(null); // sign id for analytics close event

  // ─── Camera yaw and pitch preservation across navigation ──────────────────────────────
  const cameraYawRef = useRef(0); // in radians, updated on every drag
  const cameraPitchRef = useRef(0); // in radians, updated on every drag
  const [preservedCameraYaw, setPreservedCameraYaw] = useState(null); // radians - preserves user's view
  const [preservedCameraPitch, setPreservedCameraPitch] = useState(null); // radians - preserves vertical scroll

  // ─── Active video / yaw are DERIVED from the queue (see below), so the URL
  //     and queue index always change in the same render. Keeping them as
  //     separate lagging state caused an intermediate mismatched render that
  //     remounted VideoSphere and replayed a clip. ──────────────────────────
  const [spotHasVideo, setSpotHasVideo] = useState(false);

  // ─── Render state for pre-rendering assets ───────────────────────────────────
  const [isPreRender, setIsPreRender] = useState(false);

  // ─── Black fade overlay (no-video navigation + video-end transition) ──────
  const [fadeOverlay, setFadeOverlay] = useState(false);

  // ─── Fullscreen + first-visit drag hint ────────────────────────────────────
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDragHint, setShowDragHint] = useState(true);

  // ─── Visitor → owner contact form ──────────────────────────────────────────
  const [showMessageForm, setShowMessageForm] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!showDragHint) return;
    const dismiss = () => setShowDragHint(false);
    window.addEventListener("pointerdown", dismiss, { once: true });
    const timer = setTimeout(dismiss, 8000);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [showDragHint]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };
  const {
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
    preloadNextAssets,
    // Multi-video queue state
    videoQueue,
    videoQueueIndex,
  } = useTour(projectId);

  // ─── Analytics (batched, fire-and-forget) ─────────────────────────────────
  const track = useAnalytics(projectId, Boolean(project));

  // scene_view on every panorama change; targetId carries the PREVIOUS node so
  // the server can count the from→to navigation edge.
  const prevNodeIdRef = useRef(null);
  useEffect(() => {
    if (!activeNodeId) return;
    track("scene_view", {
      nodeId: activeNodeId,
      targetId: prevNodeIdRef.current || "",
    });
    prevNodeIdRef.current = activeNodeId;
  }, [activeNodeId, track]);

  // ─── Current video segment — DERIVED synchronously from the queue ──────────
  // The URL, yaw and queue index therefore always update together in the same
  // render. (Previously activeVideoUrl lagged one render behind videoQueueIndex,
  // producing a mismatched VideoSphere key that remounted and replayed a clip.)
  const activeVideoSegment =
    transition && videoQueue.length > 0
      ? videoQueue[videoQueueIndex] || null
      : null;
  const activeVideoUrl = activeVideoSegment?.videoUrl ?? null;
  const videoTextureYawOffset = activeVideoSegment
    ? activeVideoSegment.yawOffset ?? 0
    : null;

  // ─── Backdrop panoramas rendered behind the currently-playing clip ────────
  // Two spheres per segment, keyed by NODE ID so React reuses them across
  // queue advances:
  //  - START node (outer): the point this clip departs from. When the queue
  //    advances, this is the SAME node that just finished fading in as the
  //    previous clip's end — same key ⇒ the sphere instance is reused and
  //    stays fully opaque, so the gap between clips shows the waypoint
  //    (point 2), never the origin or the final target.
  //  - END node (inner): where this clip arrives — the NEXT clip's start
  //    point, or the hotspot's target for the last clip. It fades in under
  //    the playing video so it's opaque by the time the clip ends.
  const lastArrivalBackdropRef = useRef(null);
  const transitionBackdrops = useMemo(() => {
    if (!project?.nodes) return [];
    if (!transition?.targetNodeId) {
      // Transition finished: keep the arrival panorama mounted while we're
      // still on the node we arrived at, so the active sphere fades in over
      // IDENTICAL imagery instead of over a stale scene background.
      const kept = lastArrivalBackdropRef.current;
      return kept && kept.node.id === activeNodeId ? [kept] : [];
    }
    if (videoQueue.length === 0) {
      const t = project.nodes[transition.targetNodeId];
      if (!t) return [];
      lastArrivalBackdropRef.current = { node: t, radiusOffset: 0.05 };
      return [lastArrivalBackdropRef.current];
    }
    const startId = videoQueue[videoQueueIndex]?.startNodeId;
    const startNode =
      project.nodes[startId] || project.nodes[activeNodeId] || null;
    const endId =
      videoQueue[videoQueueIndex + 1]?.startNodeId || transition.targetNodeId;
    const endNode =
      project.nodes[endId] || project.nodes[transition.targetNodeId] || null;

    const backdrops = [];
    if (startNode) backdrops.push({ node: startNode, radiusOffset: 0.1 });
    if (endNode && endNode.id !== startNode?.id) {
      const end = { node: endNode, radiusOffset: 0.05 };
      lastArrivalBackdropRef.current = end;
      backdrops.push(end);
    }
    return backdrops;
  }, [
    transition?.targetNodeId,
    project?.nodes,
    videoQueue,
    videoQueueIndex,
    activeNodeId,
  ]);

  // ─── Preload next assets when hovering / navigating ──────────────────────
  const handleNavigate = async (
    targetNodeId,
    videoUrl,
    playMode = "forward",
    transitionId,
    videoYawOffset = 0,
    reverseVideoUrl = null,
    transitionVideos = [],
    hotspotId = "",
  ) => {
    if (!project) return;
    if (isPreRender) return; // Prevent multiple simultaneous preloads
    setIsPreRender(true);

    if (hotspotId) {
      track("hotspot_click", { nodeId: activeNodeId, targetId: hotspotId });
    }

    const targetNode = project.nodes?.[targetNodeId];

    // ─── Build the video queue ─────────────────────────────────────────────
    // Every segment prefers the server-baked `_ramped` variant (the speed
    // wave is inside the file — see server/src/config/speedRamp.js); the
    // original clip is the fallback for videos processed before the bake
    // pipeline existed. The viewer plays whichever file at plain 1x.
    const asSegment = (baseUrl, rampedUrl, yawOffset, startNodeId = "") =>
      baseUrl
        ? {
            videoUrl: rampedUrl || baseUrl,
            yawOffset: yawOffset ?? 0,
            startNodeId,
          }
        : null;

    let resolvedQueue = [];

    if (transitionVideos.length > 0) {
      // Multi-video: sort by order, resolve URLs based on play direction
      const sorted = [...transitionVideos].sort((a, b) => a.order - b.order);
      resolvedQueue = sorted
        .map((v) =>
          playMode === "backward"
            ? asSegment(
                v.reverseVideoUrl || v.videoUrl,
                v.reverseVideoUrl ? v.reverseRampedVideoUrl : v.rampedVideoUrl,
                v.yawOffset,
                v.startNodeId || "",
              )
            : asSegment(
                v.videoUrl,
                v.rampedVideoUrl,
                v.yawOffset,
                v.startNodeId || "",
              ),
        )
        .filter(Boolean);
    } else {
      // Legacy single-video path
      const clickedHotspot = activeNode?.navigationHotspots?.find(
        (h) => h.id === hotspotId,
      );
      const sharedTransition = project.transitions?.[transitionId];
      let resolvedUrl = null;
      let resolvedRampedUrl = null;

      if (playMode === "backward") {
        // Try reverse URL from the backward hotspot itself or its shared transition record
        if (reverseVideoUrl) {
          resolvedUrl = reverseVideoUrl;
          resolvedRampedUrl =
            clickedHotspot?.reverseRampedTransitionVideoUrl ||
            sharedTransition?.reverseRampedVideoUrl ||
            null;
        } else if (sharedTransition?.reverseVideoUrl) {
          resolvedUrl = sharedTransition.reverseVideoUrl;
          resolvedRampedUrl = sharedTransition.reverseRampedVideoUrl || null;
        } else {
          // Auto-lookup: find the corresponding forward hotspot on the target node
          const targetNodeData = project.nodes?.[targetNodeId];
          const forwardHotspot = targetNodeData?.navigationHotspots?.find(
            (hs) => hs.targetNodeId === activeNodeId,
          );
          if (forwardHotspot) {
            const forwardTransition =
              project.transitions?.[forwardHotspot.transitionId];
            resolvedUrl =
              forwardHotspot.reverseTransitionVideoUrl ||
              forwardTransition?.reverseVideoUrl ||
              null;
            resolvedRampedUrl =
              forwardHotspot.reverseRampedTransitionVideoUrl ||
              forwardTransition?.reverseRampedVideoUrl ||
              null;
          }
        }
      } else {
        resolvedUrl = videoUrl || sharedTransition?.videoUrl || null;
        resolvedRampedUrl =
          clickedHotspot?.rampedTransitionVideoUrl ||
          sharedTransition?.rampedVideoUrl ||
          null;
      }

      const segment = asSegment(resolvedUrl, resolvedRampedUrl, videoYawOffset);
      if (segment) resolvedQueue = [segment];
    }

    // The destination node of segment i is the NEXT segment's start point,
    // or the hotspot's final target for the last segment.
    const segmentEndNode = (i) => {
      const endNodeId = resolvedQueue[i + 1]?.startNodeId || targetNodeId;
      return project.nodes?.[endNodeId] || targetNode;
    };

    // Pre-render assets. Await the FIRST hop so playback starts promptly, then
    // preload every remaining clip + waypoint panorama in the background so the
    // chain plays through without stalling between hops.
    try {
      if (resolvedQueue.length > 0) {
        await preloadNextAssets(segmentEndNode(0), {
          videoUrl: resolvedQueue[0].videoUrl,
        });
        resolvedQueue.slice(1).forEach((seg, idx) => {
          const i = idx + 1;
          preloadNextAssets(segmentEndNode(i), { videoUrl: seg.videoUrl }).catch(
            () => {},
          );
        });
      } else {
        await preloadNextAssets(targetNode, null);
      }
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

    if (resolvedQueue.length > 0) {
      // Video transition: preserve camera, set up queue.
      // activeVideoUrl / videoTextureYawOffset are derived from the queue, so
      // there's nothing extra to set here — navigateTo populates the queue.
      setPreservedCameraYaw(currentCameraYaw);
      setPreservedCameraPitch(currentCameraPitch);
      setSpotHasVideo(true);
      navigateTo(targetNodeId, resolvedQueue[0].videoUrl, playMode, resolvedQueue);
    } else {
      // No video: cross-fade transition, preserve camera
      setPreservedCameraYaw(currentCameraYaw);
      setPreservedCameraPitch(currentCameraPitch);
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
    // setPreservedCameraYaw(0);
    // setPreservedCameraPitch(0);
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
    setPreservedCameraYaw(cameraYawRef.current);
    setPreservedCameraPitch(cameraPitchRef.current);
    onTransitionComplete();
  };

  // ─── Video fade complete: cleanup transition state ───────────────────────────
  const handleVideoFadeComplete = () => {};

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
    // Server-side access gating: all three reasons share the same screen,
    // only the detail line differs.
    const blockedDetail = {
      subscription_expired:
        "The subscription for this virtual tour has ended. If you are the tour owner, please contact your provider to renew it.",
      project_expired:
        "Access to this virtual tour has ended. If you are the tour owner, please contact your provider to renew it.",
      project_suspended:
        "This virtual tour has been temporarily suspended. If you are the tour owner, please contact your provider.",
    }[errorReason];
    if (blockedDetail) {
      return (
        <div className="flex h-full flex-col items-center justify-center bg-black gap-4 px-6 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-white text-xl font-semibold">This tour is currently unavailable</p>
          <p className="text-white/50 text-sm max-w-md">{blockedDetail}</p>
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  if (!activeNode) return null;

  const audioEnabled = Boolean(project?.settings?.globalBackgroundAudio?.src);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black no-select overflow-hidden"
    >
      {/* ── 3D Sphere Viewer ── */}
      <SphereViewer
        node={activeNode}
        transitionBackdrops={transitionBackdrops} // start/end panoramas shown behind the video
        hotspotVisible={hotspotVisible}
        onNavigate={handleNavigate}
        onSignClick={(content, signId) => {
          setActivePopup(content);
          activePopupSignIdRef.current = signId || null;
          if (signId) track("popup_open", { nodeId: activeNodeId, targetId: signId });
        }}
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
        videoQueueIndex={videoQueueIndex}
        nadirLogoUrl={project?.info?.nadirLogoUrl || ""}
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

      {/* ── Leave a message (hidden in static exports — no API) ── */}
      {!IS_STATIC && (
        <button
          onClick={() => setShowMessageForm(true)}
          title="Leave a message"
          className="absolute bottom-20 right-6 z-10 w-10 h-10 flex items-center
                     justify-center rounded-full bg-black/50 backdrop-blur-sm
                     border border-white/10 text-white/80 hover:text-white
                     hover:bg-black/70 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* ── Fullscreen toggle ── */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        className="absolute bottom-6 right-6 z-10 w-10 h-10 flex items-center
                   justify-center rounded-full bg-black/50 backdrop-blur-sm
                   border border-white/10 text-white/80 hover:text-white
                   hover:bg-black/70 transition-colors cursor-pointer"
      >
        {isFullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        )}
      </button>

      {/* ── First-visit hint ── */}
      {showDragHint && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center
                     pointer-events-none"
        >
          <div
            className="flex flex-col items-center gap-3 px-6 py-4 rounded-2xl
                       bg-black/40 backdrop-blur-sm border border-white/10
                       animate-pulse"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
              <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
            <p className="text-white/90 text-sm font-medium">
              Drag to look around · scroll to zoom
            </p>
          </div>
        </div>
      )}

      {/* ── Visitor → owner message form ── */}
      {showMessageForm && (
        <MessageForm
          tourId={projectId}
          nodeId={activeNodeId}
          onClose={() => setShowMessageForm(false)}
        />
      )}

      {/* ── Info sign popup (rendered outside Canvas for correct layering) ── */}
      {activePopup && (
        <InfoPopup
          content={activePopup}
          onClose={() => {
            if (activePopupSignIdRef.current) {
              track("popup_close", {
                nodeId: activeNodeId,
                targetId: activePopupSignIdRef.current,
              });
              activePopupSignIdRef.current = null;
            }
            setActivePopup(null);
          }}
        />
      )}
    </div>
  );
}
