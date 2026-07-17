import { useRef, useEffect, useCallback, useState, Suspense } from "react";
import { Canvas, useThree, useFrame, invalidate } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import NavigationHotspot from "./NavigationHotspot.jsx";
import InfoSign from "./InfoSign.jsx";

const SPHERE_RADIUS = 50;

// ─── Nadir logo patch settings ───────────────────────────────────────────────
// A flat disc pinned at the bottom of the scene to hide the robot/tripod that
// carries the camera. Shows the project's client logo when set; falls back to
// the Gateverse logo (served from client/public/, Vite maps it to "/").
const DEFAULT_NADIR_LOGO_URL = "/gateverse-logo.png";
// Half-angle (degrees, measured from straight down) the disc must cover.
// Bigger = wider patch. ~25–30° hides a typical tripod/robot footprint.
const NADIR_COVER_DEG = 28;
// How far below the camera the disc sits. Must be well inside the sphere
// radius so it always renders in front of panorama/video spheres.
const NADIR_Y = -20;

// ─── Progressive equirectangular texture loader ──────────────────────────────
// Loads the tiny preview first (decodes in ~ms, shows instantly), then swaps
// in the full-resolution texture once it's downloaded and decoded. Returns
// null until at least the preview is ready.
function useProgressiveTexture(fullUrl, previewUrl) {
  const { gl } = useThree();
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    let alive = true;
    let previewTex = null;
    let fullTex = null;
    let fullReady = false;
    const loader = new THREE.TextureLoader();

    const configure = (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = -1;
      tex.offset.x = 1; // fixes seam/cutting caused by negative repeat
      tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      return tex;
    };

    if (previewUrl) {
      loader.load(previewUrl, (tex) => {
        if (!alive || fullReady) return tex.dispose();
        previewTex = configure(tex);
        setTexture(previewTex);
        invalidate();
      });
    }

    loader.load(
      fullUrl,
      (tex) => {
        if (!alive) return tex.dispose();
        fullReady = true;
        fullTex = configure(tex);
        setTexture(fullTex);
        if (previewTex) {
          previewTex.dispose();
          previewTex = null;
        }
        invalidate();
      },
      undefined,
      () => console.error("Panorama failed to load:", fullUrl),
    );

    return () => {
      alive = false;
      setTexture(null);
      if (previewTex) previewTex.dispose();
      if (fullTex) fullTex.dispose();
    };
  }, [fullUrl, previewUrl, gl]);

  return texture;
}

// ─── Panorama Sphere Mesh ─────────────────────────────────────────────────────
// An inside-out textured sphere. The sphere is rotated by initialYawOffset so
// all panoramas align to the same world direction. (The old scene.background
// PMREM path was removed: it blurred the image into a fixed-res cubemap and
// burned CPU/VRAM on every node change — the sphere mesh already fills the view.)
function PanoramaSphere({
  panoramaUrl,
  previewUrl,
  opacity = 1,
  // Starting opacity on mount. 0 = fade in from transparent (default);
  // 1 = appear fully opaque immediately (used for the "previous" panorama
  // that must sit behind the incoming one from the very first frame).
  initialOpacity = 0,
  onFadeComplete,
  onFadeInComplete,
  yawOffset = 0,
  customSphere = SPHERE_RADIUS,
}) {
  const texture = useProgressiveTexture(panoramaUrl, previewUrl);
  const opacityRef = useRef(initialOpacity);
  const matRef = useRef();
  const meshRef = useRef();
  const onFadeCompleteRef = useRef(onFadeComplete);
  const onFadeInCompleteRef = useRef(onFadeInComplete);
  const textureReady = Boolean(texture);

  // Tracks whether the fade to the current target has already finished,
  // so useFrame can stop doing any work once there's nothing left to animate.
  const doneRef = useRef(false);
  const lastTargetRef = useRef(opacity);

  useEffect(() => {
    onFadeCompleteRef.current = onFadeComplete;
    onFadeInCompleteRef.current = onFadeInComplete;
  });

  // Whenever the target opacity changes, there's new work to do — reset the
  // guard and explicitly kick the render loop (Canvas runs frameloop="demand",
  // so nothing renders/ticks unless we ask for it).
  useEffect(() => {
    if (lastTargetRef.current !== opacity) {
      lastTargetRef.current = opacity;
      doneRef.current = false;
      invalidate();
    }
  }, [opacity]);

  // Also kick the loop once the texture becomes ready, so the first fade frame runs.
  useEffect(() => {
    if (textureReady) invalidate();
  }, [textureReady]);

  // Smooth fade animation - ~1 second transition
  useFrame(() => {
    // Nothing left to animate for the current target — do no work and,
    // crucially, do NOT call invalidate(), so the render loop actually stops.
    if (doneRef.current) return;

    const target = opacity;
    const current = opacityRef.current;
    if (matRef.current && textureReady) {
      if (Math.abs(current - target) > 0.001) {
        // Smooth fade: ~1 second at 60fps using lerp factor 0.05 for slower, smoother transition
        opacityRef.current += (target - current) * 0.05;
        matRef.current.opacity = opacityRef.current;
        // Still animating — ask for exactly one more frame.
        invalidate();
      } else if (current !== target) {
        opacityRef.current = target;
        matRef.current.opacity = target;
        if (target === 0 && onFadeCompleteRef.current) {
          onFadeCompleteRef.current();
        } else if (target === 1 && onFadeInCompleteRef.current) {
          onFadeInCompleteRef.current();
        }
        // Fade to this target is finished — no more work until opacity changes again.
        doneRef.current = true;
      } else {
        // Already sitting exactly at target with nothing to do.
        doneRef.current = true;
      }
    }
  });

  // Rotate sphere mesh by yawOffset to align all panoramas to the same world direction
  const rotationY = THREE.MathUtils.degToRad(yawOffset);

  // Don't render until texture is ready
  if (!textureReady) return null;

  // Render a transparent sphere for cross-fade effect
  // During fade-in, use smaller radius to render in front of the previous panorama
  const isFadingIn = opacity > opacityRef.current && opacityRef.current < 0.95;
  const radius = isFadingIn ? customSphere - 0.02 : customSphere;

  return (
    <mesh ref={meshRef} rotation={[0, rotationY, 0]}>
      <sphereGeometry args={[radius, 128, 64]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        side={THREE.BackSide}
        transparent
        opacity={opacityRef.current}
      />
    </mesh>
  );
}

// ─── Drag-to-pan Camera Controls ─────────────────────────────────────────────
// Camera only responds to user drag. Initial position is 0,0 unless preserved from previous navigation.
function PanoramaControls({
  preservedCameraYaw = null,
  preservedCameraPitch = null,
  onYawChange,
  onPitchChange,
}) {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const onYawChangeRef = useRef(onYawChange);
  const onPitchChangeRef = useRef(onPitchChange);
  // Inertia: velocity (radians/frame) sampled from the last drag movement,
  // decayed after release so the camera glides to a stop.
  const velocity = useRef({ x: 0, y: 0 });
  const inertiaRaf = useRef(0);
  // Pinch-to-zoom state (distance between two touches on the previous event)
  const pinchDist = useRef(0);

  const MIN_FOV = 35;
  const MAX_FOV = 90;
  const PITCH_LIMIT = THREE.MathUtils.degToRad(85);

  useEffect(() => {
    onYawChangeRef.current = onYawChange;
    onPitchChangeRef.current = onPitchChange;
  });

  const applyCamera = useCallback(() => {
    camera.quaternion.setFromEuler(euler.current);
    invalidate();
    onYawChangeRef.current?.(euler.current.y);
    onPitchChangeRef.current?.(euler.current.x);
  }, [camera]);

  const stopInertia = useCallback(() => {
    cancelAnimationFrame(inertiaRaf.current);
    velocity.current = { x: 0, y: 0 };
  }, []);

  const startInertia = useCallback(() => {
    cancelAnimationFrame(inertiaRaf.current);
    const step = () => {
      velocity.current.x *= 0.94;
      velocity.current.y *= 0.94;
      if (
        Math.abs(velocity.current.x) < 0.0002 &&
        Math.abs(velocity.current.y) < 0.0002
      ) {
        return; // glided to a stop — loop ends, demand-mode renderer goes idle
      }
      euler.current.y += velocity.current.y;
      euler.current.x = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, euler.current.x + velocity.current.x),
      );
      applyCamera();
      inertiaRaf.current = requestAnimationFrame(step);
    };
    inertiaRaf.current = requestAnimationFrame(step);
  }, [applyCamera, PITCH_LIMIT]);

  // Scroll-to-zoom: wheel adjusts field of view (clamped), like every major
  // tour viewer. Pinch on touch devices does the same (see onTouchMove).
  const zoomBy = useCallback(
    (deltaFov) => {
      camera.fov = THREE.MathUtils.clamp(
        camera.fov + deltaFov,
        MIN_FOV,
        MAX_FOV,
      );
      camera.updateProjectionMatrix();
      invalidate();
    },
    [camera],
  );

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      zoomBy(e.deltaY * 0.03);
    },
    [zoomBy],
  );

  // Set camera to preserved position on mount AND when preserved values update
  // This fixes race conditions where state updates after component mounts
  useEffect(() => {
    let updated = false;

    if (preservedCameraYaw !== null && euler.current.y !== preservedCameraYaw) {
      euler.current.y = preservedCameraYaw; // already in radians
      updated = true;
    } else if (preservedCameraYaw === null && euler.current.y !== 0) {
      euler.current.y = 0;
      updated = true;
    }

    if (
      preservedCameraPitch !== null &&
      euler.current.x !== preservedCameraPitch
    ) {
      euler.current.x = preservedCameraPitch; // already in radians
      updated = true;
    } else if (preservedCameraPitch === null && euler.current.x !== 0) {
      euler.current.x = 0;
      updated = true;
    }

    // Only update camera if values actually changed
    if (updated) {
      camera.quaternion.setFromEuler(euler.current);
      invalidate();
      onYawChangeRef.current?.(euler.current.y);
      onPitchChangeRef.current?.(euler.current.x);
    }
  }, [camera, preservedCameraYaw, preservedCameraPitch]);

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      stopInertia();
      isDragging.current = true;
      prevMouse.current = { x: e.clientX, y: e.clientY };
      e.target.setPointerCapture(e.pointerId);
    },
    [stopInertia],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      prevMouse.current = { x: e.clientX, y: e.clientY };

      // Zooming in narrows the FOV — scale sensitivity so panning feels
      // consistent at any zoom level.
      const sensitivity = 0.003 * (camera.fov / 65);
      euler.current.y -= dx * sensitivity;
      euler.current.x -= dy * sensitivity;
      euler.current.x = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, euler.current.x),
      );

      // Remember the last movement as velocity for release inertia
      velocity.current = { y: -dx * sensitivity, x: -dy * sensitivity };

      // Canvas uses frameloop="demand" — a ref-only camera mutation like this
      // won't trigger a render on its own, so applyCamera invalidates explicitly.
      applyCamera();
    },
    [camera, applyCamera, PITCH_LIMIT],
  );

  const onPointerUp = useCallback(
    (e) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      onYawChangeRef.current?.(euler.current.y);
      onPitchChangeRef.current?.(euler.current.x);
      startInertia();
      if (e?.target?.releasePointerCapture)
        e.target.releasePointerCapture(e.pointerId);
    },
    [startInertia],
  );

  // Touch support (single finger = pan, two fingers = pinch zoom)
  const onTouchStart = useCallback(
    (e) => {
      stopInertia();
      if (e.touches.length === 2) {
        isDragging.current = false;
        pinchDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        return;
      }
      const t = e.touches[0];
      isDragging.current = true;
      prevMouse.current = { x: t.clientX, y: t.clientY };
    },
    [stopInertia],
  );

  const onTouchMove = useCallback(
    (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (pinchDist.current > 0) zoomBy((pinchDist.current - dist) * 0.2);
        pinchDist.current = dist;
        return;
      }
      const t = e.touches[0];
      onPointerMove({ clientX: t.clientX, clientY: t.clientY });
    },
    [onPointerMove, zoomBy],
  );

  const onTouchEnd = useCallback(
    (e) => {
      pinchDist.current = 0;
      if (!isDragging.current) return;
      if (e?.touches?.length > 0) return; // a finger is still down
      isDragging.current = false;
      onYawChangeRef.current?.(euler.current.y);
      onPitchChangeRef.current?.(euler.current.x);
      startInertia();
    },
    [startInertia],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      cancelAnimationFrame(inertiaRaf.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [
    gl.domElement,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  ]);

  // Nothing to render — this is a pure-logic component
  return null;
}

// ─── Video Sphere (transition video mapped onto the sphere) ──────────────────
// The viewer has NO speed logic: every clip plays at plain 1x, so playback
// is identical in every browser.
function VideoSphere({
  videoUrl,
  onEnded,
  onFadeComplete,
  textureYawOffset = 0,
}) {
  const [texture, setTexture] = useState(null);
  const opacityRef = useRef(0);
  const fadingOutRef = useRef(false);
  const onEndedCalledRef = useRef(false);
  const fadeCompleteCalledRef = useRef(false);
  const matRef = useRef();
  const meshRef = useRef();
  // Keep latest callbacks in refs to avoid re-creating the video
  const onEndedRef = useRef(onEnded);
  const onFadeCompleteRef = useRef(onFadeComplete);
  useEffect(() => {
    onEndedRef.current = onEnded;
    onFadeCompleteRef.current = onFadeComplete;
  });

  // Once the fade-in has reached 1 (and we're not fading out yet) or the
  // fade-out has fully completed, there's nothing left for useFrame to do.
  const doneRef = useRef(false);
  // True when the browser supports requestVideoFrameCallback: texture uploads
  // are then driven by actual decoded video frames (~24–30/s) instead of
  // re-invalidating at display refresh (up to 120/s) — this was the main cause
  // of the FPS collapse during transitions.
  const rvfcActiveRef = useRef(false);

  useFrame(() => {
    if (doneRef.current) return;

    // Fallback path only: without rVFC we must refresh the texture every frame
    if (!rvfcActiveRef.current && texture) texture.needsUpdate = true;

    if (matRef.current) {
      if (fadingOutRef.current) {
        // Call onEnded when fade STARTS to switch nodes
        if (!onEndedCalledRef.current) {
          onEndedCalledRef.current = true;
          onEndedRef.current?.();
        }
        if (!fadeCompleteCalledRef.current) {
          matRef.current.opacity = opacityRef.current;
          fadeCompleteCalledRef.current = true;
          // Call onFadeComplete when fade is DONE to cleanup
          onFadeCompleteRef.current?.();
        }
        // Fade-out work (and the ended/fade-complete callbacks) is done — stop.
        // Deliberately no invalidate() call here, so the loop halts.
        doneRef.current = true;
      } else if (opacityRef.current < 1) {
        // Fade in smoothly: ~0.5 second to fully opaque at 60 fps
        opacityRef.current = Math.min(1, opacityRef.current + 0.05);
        matRef.current.opacity = opacityRef.current;
        // Still fading in — ask for another frame.
        invalidate();
      } else if (!rvfcActiveRef.current) {
        // Fully faded in, still playing, no rVFC: keep the loop alive so the
        // texture keeps updating. (With rVFC the video frames drive rendering.)
        invalidate();
      }
    }
  });

  // Whenever fade-out is triggered, wake the frame loop back up so it can
  // run the fade-out branch (and then stop itself again above).
  const wakeForFadeOut = useCallback(() => {
    doneRef.current = false;
    invalidate();
  }, []);

  useEffect(() => {
    let mounted = true;
    opacityRef.current = 0;
    fadingOutRef.current = false;
    onEndedCalledRef.current = false;
    fadeCompleteCalledRef.current = false;
    doneRef.current = false;

    const video = document.createElement("video");
    // Set attributes BEFORE src to avoid CORS / load-order issues
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    // No crossOrigin — video is same-origin via Vite proxy; adding it causes CORS failures

    const tex = new THREE.VideoTexture(video);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1; // fixes seam/cutting caused by negative repeat
    tex.colorSpace = THREE.SRGBColorSpace;

    // Drive texture uploads from decoded video frames when supported: the
    // callback fires once per NEW frame (~24–30/s), so we render exactly as
    // often as the video produces pixels instead of at display refresh.
    let rvfcHandle = null;
    const pumpVideoFrames = () => {
      tex.needsUpdate = true;
      invalidate();
      rvfcHandle = video.requestVideoFrameCallback(pumpVideoFrames);
    };

    const handlePlaying = () => {
      // Only show sphere once the first frame is actually decoded — no black flash
      if (mounted) {
        setTexture(tex);
        if (typeof video.requestVideoFrameCallback === "function") {
          rvfcActiveRef.current = true;
          rvfcHandle = video.requestVideoFrameCallback(pumpVideoFrames);
        }
        // Kick the demand-mode render loop so the fade-in/texture-update
        // useFrame actually starts running.
        invalidate();
      }
    };

    const handleEnded = () => {
      // Trigger smooth fade-out before notifying parent
      if (mounted) {
        fadingOutRef.current = true;
        wakeForFadeOut();
      }
    };

    const handleError = () => {
      if (!mounted) return;
      console.error("Transition video failed:", videoUrl);
      onEndedRef.current?.();
    };

    video.addEventListener("playing", handlePlaying, { once: true });
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    video.src = videoUrl;

    // Try to play with better error handling
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch((err) => {
        if (!mounted) return;
        if (err.name !== "AbortError") {
          console.error("Transition video play rejected:", err);
          onEndedRef.current?.();
        }
      });
    }

    return () => {
      mounted = false;
      if (rvfcHandle && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(rvfcHandle);
      }
      rvfcActiveRef.current = false;
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      setTexture(null);
      video.pause();
      video.src = "";
      tex.dispose();
    };
  }, [videoUrl, textureYawOffset, wakeForFadeOut]);

  if (!texture) return null;

  // Rotate the entire mesh to apply the video's yaw offset
  // Convert degrees to radians; positive rotation = clockwise from above
  const rotationY = THREE.MathUtils.degToRad(textureYawOffset);

  return (
    <mesh ref={meshRef} rotation={[0, rotationY, 0]}>
      {/* Slightly smaller radius so video renders in front of PanoramaSphere */}
      <sphereGeometry args={[SPHERE_RADIUS - 0.1, 128, 64]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        side={THREE.BackSide}
        transparent
        opacity={0}
      />
    </mesh>
  );
}

// ─── Nadir Logo Patch ─────────────────────────────────────────────────────────
// A world-fixed disc at the bottom of the sphere that hides the camera robot.
// It sits much closer to the camera than any panorama/video sphere, so the
// depth test keeps it on top of all of them, including during transitions.
// It does NOT rotate with node yawOffset: panoramas are all aligned to the
// same world direction, and the robot is always at the nadir anyway.
// Shows the project's client logo (`url`); if that is unset OR fails to load
// (e.g. the file was deleted), it falls back to the default Gateverse logo.
function NadirLogo({ url }) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    let alive = true;
    let tex = null;
    const loader = new THREE.TextureLoader();

    const apply = (loaded) => {
      if (!alive) return loaded.dispose();
      loaded.colorSpace = THREE.SRGBColorSpace;
      tex = loaded;
      setTexture(loaded);
      invalidate(); // demand-mode loop: render the newly loaded patch
    };

    const loadDefault = () =>
      loader.load(DEFAULT_NADIR_LOGO_URL, apply, undefined, () =>
        console.error("Nadir logo failed to load:", DEFAULT_NADIR_LOGO_URL),
      );

    if (url) {
      // Client logo missing/broken → fall back to the default logo
      loader.load(url, apply, undefined, loadDefault);
    } else {
      loadDefault();
    }

    return () => {
      alive = false;
      setTexture(null);
      if (tex) tex.dispose();
    };
  }, [url]);

  if (!texture) return null;

  // Disc radius that covers NADIR_COVER_DEG from straight down at height NADIR_Y
  const radius =
    Math.abs(NADIR_Y) * Math.tan(THREE.MathUtils.degToRad(NADIR_COVER_DEG));

  return (
    <mesh position={[0, NADIR_Y - 25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius - 5, 64]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

// ─── Scene Root ───────────────────────────────────────────────────────────────
function Scene({
  node,
  previousNode,
  transitionBackdrops,
  hotspotVisible,
  onNavigate,
  onSignClick,
  preservedCameraYaw,
  preservedCameraPitch,
  onYawChange,
  onPitchChange,
  transitionVideoUrl,
  onTransitionComplete,
  onVideoFadeComplete,
  videoTextureYawOffset,
  panoramaOpacity,
  onPanoramaFadeInComplete,
  videoQueueIndex,
  nadirLogoUrl,
}) {
  return (
    <>
      <PanoramaControls
        preservedCameraYaw={preservedCameraYaw}
        preservedCameraPitch={preservedCameraPitch}
        onYawChange={onYawChange}
        onPitchChange={onPitchChange}
      />
      {/* Previous panorama during a NO-VIDEO cross-fade: stays fully opaque
          behind the incoming sphere, rotated by its OWN initialYawOffset, so
          the fade goes old-image(correct rotation) → new-image(correct
          rotation) instead of exposing the un-rotated scene background.
          Slightly larger radius so the incoming sphere renders in front. */}
      {previousNode && (
        <Suspense fallback={null} key={`prev-${previousNode.id}`}>
          <PanoramaSphere
            panoramaUrl={previousNode.panoramaUrl}
            previewUrl={previousNode.panoramaPreviewUrl}
            opacity={1}
            initialOpacity={1}
            yawOffset={previousNode.initialYawOffset || 0}
            customSphere={SPHERE_RADIUS + 0.05}
          />
        </Suspense>
      )}
      {/* Backdrop panoramas rendered behind the video during transition.
          Keyed by NODE ID: when the queue advances, the waypoint node that was
          the previous clip's END becomes the next clip's START — the same key
          means React reuses the sphere instance, so it stays fully opaque and
          the gap between clips shows the waypoint, not a stale panorama. */}
      {transitionBackdrops?.map(({ node: backdropNode, radiusOffset }) => (
        <Suspense fallback={null} key={`backdrop-${backdropNode.id}`}>
          <PanoramaSphere
            panoramaUrl={backdropNode.panoramaUrl}
            previewUrl={backdropNode.panoramaPreviewUrl}
            opacity={1}
            yawOffset={backdropNode.initialYawOffset || 0}
            customSphere={SPHERE_RADIUS + radiusOffset}
          />
        </Suspense>
      ))}
      {/* Current panorama - fades in on top as mesh during transition */}
      <PanoramaSphere
        key={node.id}
        panoramaUrl={node.panoramaUrl}
        previewUrl={node.panoramaPreviewUrl}
        opacity={panoramaOpacity}
        onFadeInComplete={onPanoramaFadeInComplete}
        yawOffset={node.initialYawOffset || 0}
      />
      {/* Video sphere - rotated by video's yawOffset */}
      {/* Video sphere - keyed by queueIndex to force re-mount between sequential videos */}
      {transitionVideoUrl && (
        <VideoSphere
          key={`video-${videoQueueIndex ?? 0}-${transitionVideoUrl}`}
          videoUrl={transitionVideoUrl}
          onEnded={onTransitionComplete}
          onFadeComplete={onVideoFadeComplete}
          textureYawOffset={videoTextureYawOffset || 0}
        />
      )}
      {/* Nadir patch: logo disc hiding the camera robot at the bottom */}
      <NadirLogo url={nadirLogoUrl} />
      {/* Hotspots and signs - rotated by same yawOffset as panorama to stay in correct position */}
      <group
        rotation={[0, THREE.MathUtils.degToRad(node.initialYawOffset || 0), 0]}
      >
        {hotspotVisible &&
          node.navigationHotspots?.map((hotspot) => (
            <NavigationHotspot
              key={hotspot.id}
              hotspot={hotspot}
              onNavigate={onNavigate}
            />
          ))}

        {hotspotVisible &&
          node.infoSigns?.map((sign) => (
            <InfoSign key={sign.id} sign={sign} onOpenPopup={onSignClick} />
          ))}
      </group>
    </>
  );
}

// ─── SphereViewer (exported) ──────────────────────────────────────────────────
/**
 * @param {object}   props
 * @param {object}   props.node           Active node data from MongoDB
 * @param {boolean}  props.hotspotVisible Whether hotspots/signs are rendered
 * @param {function} props.onNavigate     (targetNodeId, videoUrl, transitionId, ...) => void
 */
export default function SphereViewer({
  node,
  transitionBackdrops,
  hotspotVisible,
  onNavigate,
  onSignClick,
  preservedCameraYaw,
  preservedCameraPitch,
  onYawChange,
  onPitchChange,
  transitionVideoUrl,
  onTransitionComplete,
  onVideoFadeComplete,
  videoTextureYawOffset,
  spotHasVideo,
  videoQueueIndex,
  nadirLogoUrl,
}) {
  const [displayedNode, setDisplayedNode] = useState(node);
  const [previousNode, setPreviousNode] = useState(null);
  const [panoramaOpacity, setPanoramaOpacity] = useState(1);
  const prevVideoUrlRef = useRef(transitionVideoUrl);

  // ─── Node-change detection DURING RENDER (React "derived state" pattern) ───
  // Setting state here makes React re-render immediately BEFORE committing, so
  // there is never a painted frame where the new node is mounted but the
  // previous panorama isn't — the frame that used to flash the un-rotated
  // scene background. Applies only to NO-VIDEO navigation (hotspot without a
  // transition video, or sidebar jump): the old panorama is kept fully opaque
  // behind while the new sphere (fresh mount, key=node.id, opacity 0 → 1)
  // fades in on top. Video transitions are unchanged — the backdrop system
  // handles those.
  if (node && node !== displayedNode) {
    if (displayedNode && node.id !== displayedNode.id) {
      if (!spotHasVideo && !transitionVideoUrl) {
        setPreviousNode({
          id: displayedNode.id,
          panoramaUrl: displayedNode.panoramaUrl,
          panoramaPreviewUrl: displayedNode.panoramaPreviewUrl,
          initialYawOffset: displayedNode.initialYawOffset,
        });
        setPanoramaOpacity(1);
      } else {
        setPreviousNode(null);
      }
    }
    setDisplayedNode(node);
  }

  // Handle video transitions. The current panorama is deliberately NOT faded
  // out when the video starts: the video sphere renders at a smaller radius in
  // front of it and covers it once its first frame is decoded, and the sphere
  // unmounts in the same commit the node switches. Fading it out early exposed
  // the black scene background during the click→first-frame gap (on the FIRST
  // transition the backdrop spheres behind it are depth-culled because the
  // long-lived active sphere draws before them), which showed as a dark
  // translucent dip at tour start.
  useEffect(() => {
    const hadVideo = prevVideoUrlRef.current;
    const hasVideo = transitionVideoUrl;

    if (hasVideo) {
      // Clean up previous node since we're transitioning
      setPreviousNode(null);
    } else if (hadVideo && !hasVideo) {
      // Video just finished - target node is now the active node, show it
      setPanoramaOpacity(1);
    }

    prevVideoUrlRef.current = transitionVideoUrl;
  }, [transitionVideoUrl]);

  // The incoming panorama has fully faded in — the old one underneath can go.
  const handleFadeInComplete = useCallback(() => {
    setPreviousNode(null);
  }, []);

  if (!node) return null;

  return (
    <Canvas
      // Render only when invalidate() is explicitly called (by an active
      // fade, an in-progress video, or a camera drag) instead of ticking
      // every browser frame forever. This is what actually stops useFrame
      // from being called once its work is done — early-returning inside
      // a useFrame callback alone does NOT stop the render loop.
      frameloop="demand"
      // Cap device-pixel-ratio at 2: on high-DPI screens rendering at dpr 3
      // quadruples fragment work for no visible gain on a photo sphere.
      dpr={[1, 2]}
      camera={{ fov: 65, near: 0.1, far: 200, position: [0, 0, 0.01] }}
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitUserDrag: "none",
      }}
      onDragStart={(e) => e.preventDefault()}
      gl={{ antialias: true }}
    >
      <Scene
        node={node}
        previousNode={previousNode}
        transitionBackdrops={transitionBackdrops}
        hotspotVisible={hotspotVisible}
        onNavigate={onNavigate}
        onSignClick={onSignClick}
        preservedCameraYaw={preservedCameraYaw}
        preservedCameraPitch={preservedCameraPitch}
        onYawChange={onYawChange}
        onPitchChange={onPitchChange}
        transitionVideoUrl={transitionVideoUrl}
        onTransitionComplete={onTransitionComplete}
        onVideoFadeComplete={onVideoFadeComplete}
        videoTextureYawOffset={videoTextureYawOffset}
        panoramaOpacity={panoramaOpacity}
        onPanoramaFadeInComplete={handleFadeInComplete}
        videoQueueIndex={videoQueueIndex}
        nadirLogoUrl={nadirLogoUrl}
      />
    </Canvas>
  );
}
