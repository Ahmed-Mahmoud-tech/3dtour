import { useRef, useEffect, useCallback, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { useTexture, Html } from "@react-three/drei";
import * as THREE from "three";
import NavigationHotspot from "./NavigationHotspot.jsx";
import InfoSign from "./InfoSign.jsx";

const SPHERE_RADIUS = 50;

// ─── Panorama Sphere Mesh ─────────────────────────────────────────────────────
// Converts the equirectangular texture to a cubemap and uses it as scene.background.
// This gives true rectilinear projection — straight lines stay straight.
// The sphere is rotated by initialYawOffset so all panoramas align to the same world direction.
function PanoramaSphere({
  panoramaUrl,
  opacity = 1,
  onFadeComplete,
  yawOffset = 0,
  useBackground = true,
}) {
  const texture = useTexture(panoramaUrl);
  const { gl, scene } = useThree();
  const opacityRef = useRef(opacity);
  const matRef = useRef();
  const meshRef = useRef();
  const onFadeCompleteRef = useRef(onFadeComplete);

  useEffect(() => {
    onFadeCompleteRef.current = onFadeComplete;
  });

  // Smooth fade animation - 1 second transition
  useFrame(() => {
    if (matRef.current) {
      const target = opacity;
      const current = opacityRef.current;
      if (Math.abs(current - target) > 0.001) {
        // Smooth fade: ~1 second at 60fps using lerp factor 0.04
        opacityRef.current += (target - current) * 0.04;
        matRef.current.opacity = opacityRef.current;
      } else if (current !== target) {
        opacityRef.current = target;
        matRef.current.opacity = target;
        if (target === 0 && onFadeCompleteRef.current) {
          onFadeCompleteRef.current();
        }
      }
    }
  });

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1; // fixes seam/cutting caused by negative repeat
    texture.needsUpdate = true;

    // Only set as background if not in transition (no video playing)
    if (useBackground) {
      const pmrem = new THREE.PMREMGenerator(gl);
      const envMap = pmrem.fromEquirectangular(texture).texture;
      pmrem.dispose();
      scene.background = envMap;

      return () => {
        scene.background = null;
        envMap.dispose();
      };
    }
  }, [texture, gl, scene, useBackground]);

  // Rotate sphere mesh by yawOffset to align all panoramas to the same world direction
  const rotationY = THREE.MathUtils.degToRad(yawOffset);

  console.log(
    "📷 PANORAMA IMAGE ROTATION:",
    yawOffset + "°",
    "(mesh rotation, independent of camera) -",
    panoramaUrl.split("/").pop(),
  );

  // Render a transparent sphere for cross-fade effect
  return (
    <mesh ref={meshRef} rotation={[0, rotationY, 0]}>
      <sphereGeometry args={[SPHERE_RADIUS, 128, 64]} />
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
function PanoramaControls({ preservedCameraYaw = null, onYawChange }) {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const onYawChangeRef = useRef(onYawChange);

  useEffect(() => {
    onYawChangeRef.current = onYawChange;
  });

  // Set camera to preserved position on mount, or 0,0 if first visit
  useEffect(() => {
    if (preservedCameraYaw !== null) {
      euler.current.y = preservedCameraYaw; // already in radians
      console.log(
        "🎥 USER CAMERA DRAG (preserved):",
        ((preservedCameraYaw * 180) / Math.PI).toFixed(2) + "°",
        "(pure user input, independent of mesh rotation)",
      );
    } else {
      euler.current.y = 0;
      console.log(
        "🎥 USER CAMERA DRAG (initial): 0° (pure user input, independent of mesh rotation)",
      );
    }
    euler.current.x = 0;
    camera.quaternion.setFromEuler(euler.current);
    onYawChangeRef.current?.(euler.current.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    prevMouse.current = { x: e.clientX, y: e.clientY };
    e.target.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      prevMouse.current = { x: e.clientX, y: e.clientY };

      const sensitivity = 0.003;
      euler.current.y -= dx * sensitivity;
      euler.current.x -= dy * sensitivity;

      // Clamp vertical look: -85° to +85°
      const limit = THREE.MathUtils.degToRad(85);
      euler.current.x = Math.max(-limit, Math.min(limit, euler.current.x));

      camera.quaternion.setFromEuler(euler.current);

      // Report camera yaw changes from user drag
      onYawChangeRef.current?.(euler.current.y);
    },
    [camera],
  );

  const onPointerUp = useCallback((e) => {
    isDragging.current = false;
    onYawChangeRef.current?.(euler.current.y);
    if (e?.target?.releasePointerCapture)
      e.target.releasePointerCapture(e.pointerId);
  }, []);

  // Touch support
  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    isDragging.current = true;
    prevMouse.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchMove = useCallback(
    (e) => {
      const t = e.touches[0];
      onPointerMove({ clientX: t.clientX, clientY: t.clientY });
    },
    [onPointerMove],
  );

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    onYawChangeRef.current?.(euler.current.y);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [
    gl.domElement,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  ]);

  // Nothing to render — this is a pure-logic component
  return null;
}

// ─── Video Sphere (transition video mapped onto the sphere) ──────────────────
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

  // Update video texture + fade-in / fade-out opacity every frame
  useFrame(() => {
    if (texture) texture.needsUpdate = true;
    if (matRef.current) {
      if (fadingOutRef.current) {
        // Fade out smoothly: ~1 second at 60 fps
        // Call onEnded when fade STARTS to switch nodes
        if (!onEndedCalledRef.current) {
          onEndedCalledRef.current = true;
          onEndedRef.current?.();
        }
        // Continue fading out
        if (!fadeCompleteCalledRef.current) {
          opacityRef.current = Math.max(0, opacityRef.current - 0.0167);
          matRef.current.opacity = opacityRef.current;
          if (opacityRef.current <= 0) {
            fadeCompleteCalledRef.current = true;
            // Call onFadeComplete when fade is DONE to cleanup
            onFadeCompleteRef.current?.();
          }
        }
      } else if (opacityRef.current < 1) {
        // Fade in smoothly: ~1 second to fully opaque at 60 fps
        opacityRef.current = Math.min(1, opacityRef.current + 0.0167);
        matRef.current.opacity = opacityRef.current;
      }
    }
  });

  useEffect(() => {
    let mounted = true;
    opacityRef.current = 0;
    fadingOutRef.current = false;
    onEndedCalledRef.current = false;
    fadeCompleteCalledRef.current = false;

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

    console.log("Video Texture Yaw Offset:", textureYawOffset + "°");

    const handlePlaying = () => {
      // Only show sphere once the first frame is actually decoded — no black flash
      if (mounted) setTexture(tex);
    };
    const handleEnded = () => {
      // Trigger smooth fade-out before notifying parent
      if (mounted) fadingOutRef.current = true;
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
    video.play().catch((err) => {
      if (!mounted) return;
      if (err.name !== "AbortError") {
        console.error("Transition video play rejected:", err);
        onEndedRef.current?.();
      }
    });

    return () => {
      mounted = false;
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      setTexture(null);
      video.pause();
      video.src = "";
      tex.dispose();
    };
  }, [videoUrl, textureYawOffset]);

  if (!texture) return null;

  // Rotate the entire mesh to apply the video's yaw offset
  // Convert degrees to radians; positive rotation = clockwise from above
  const rotationY = THREE.MathUtils.degToRad(textureYawOffset);

  console.log(
    "🎬 VIDEO ROTATION:",
    textureYawOffset + "°",
    "(mesh rotation, independent of camera)",
  );

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

// ─── Scene Root ───────────────────────────────────────────────────────────────
function Scene({
  node,
  previousNode,
  hotspotVisible,
  onNavigate,
  onSignClick,
  preservedCameraYaw,
  onYawChange,
  transitionVideoUrl,
  onTransitionComplete,
  onVideoFadeComplete,
  videoTextureYawOffset,
  panoramaOpacity,
  previousPanoramaOpacity,
  onPreviousFadeComplete,
}) {
  return (
    <>
      <PanoramaControls
        key={node.id}
        preservedCameraYaw={preservedCameraYaw}
        onYawChange={onYawChange}
      />

      {/* Previous panorama fading out - rotated by its yawOffset */}
      {previousNode && previousPanoramaOpacity > 0 && (
        <PanoramaSphere
          panoramaUrl={previousNode.panoramaUrl}
          opacity={previousPanoramaOpacity}
          onFadeComplete={onPreviousFadeComplete}
          yawOffset={previousNode.initialYawOffset || 0}
          useBackground={!transitionVideoUrl}
        />
      )}

      {/* Current panorama - rotated by its yawOffset to align with world direction */}
      <PanoramaSphere
        panoramaUrl={node.panoramaUrl}
        opacity={panoramaOpacity}
        yawOffset={node.initialYawOffset || 0}
        useBackground={!transitionVideoUrl}
      />

      {/* Video sphere - rotated by video's yawOffset */}
      {transitionVideoUrl && (
        <VideoSphere
          videoUrl={transitionVideoUrl}
          onEnded={onTransitionComplete}
          onFadeComplete={onVideoFadeComplete}
          textureYawOffset={videoTextureYawOffset || 0}
        />
      )}

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
 * @param {function} props.onNavigate     (targetNodeId, transitionId, playMode) => void
 */
export default function SphereViewer({
  node,
  hotspotVisible,
  onNavigate,
  onSignClick,
  preservedCameraYaw,
  onYawChange,
  transitionVideoUrl,
  onTransitionComplete,
  onVideoFadeComplete,
  videoTextureYawOffset,
}) {
  const [previousNode, setPreviousNode] = useState(null);
  const [panoramaOpacity, setPanoramaOpacity] = useState(1);
  const [previousPanoramaOpacity, setPreviousPanoramaOpacity] = useState(0);
  const nodeIdRef = useRef(node?.id);
  const nodeDataRef = useRef({
    panoramaUrl: node?.panoramaUrl,
    initialYawOffset: node?.initialYawOffset,
  });

  // Fade out current panorama when video transition starts
  useEffect(() => {
    if (transitionVideoUrl) {
      // Video is starting, fade out ALL panoramas (current and previous)
      setPanoramaOpacity(0);
      setPreviousPanoramaOpacity(0);
      // Clean up previous node since we're transitioning
      if (previousNode) {
        setPreviousNode(null);
      }
    }
  }, [transitionVideoUrl]);

  // Detect node change and trigger cross-fade
  useEffect(() => {
    if (node && nodeIdRef.current !== node.id) {
      // Store previous node data including yawOffset for proper rotation during fade
      setPreviousNode({
        id: nodeIdRef.current,
        panoramaUrl: nodeDataRef.current.panoramaUrl,
        initialYawOffset: nodeDataRef.current.initialYawOffset,
      });
      setPreviousPanoramaOpacity(1);
      setPanoramaOpacity(0);
      nodeIdRef.current = node.id;
      nodeDataRef.current = {
        panoramaUrl: node.panoramaUrl,
        initialYawOffset: node.initialYawOffset,
      };

      // Start cross-fade
      requestAnimationFrame(() => {
        setPreviousPanoramaOpacity(0);
        setPanoramaOpacity(1);
      });
    } else if (node && !previousNode) {
      // First load
      nodeIdRef.current = node?.id;
      nodeDataRef.current = {
        panoramaUrl: node?.panoramaUrl,
        initialYawOffset: node?.initialYawOffset,
      };
      setPanoramaOpacity(1);
    }
  }, [node?.id]);

  const handlePreviousFadeComplete = useCallback(() => {
    setPreviousNode(null);
  }, []);

  if (!node) return null;

  return (
    <Canvas
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
        hotspotVisible={hotspotVisible}
        onNavigate={onNavigate}
        onSignClick={onSignClick}
        preservedCameraYaw={preservedCameraYaw}
        onYawChange={onYawChange}
        transitionVideoUrl={transitionVideoUrl}
        onTransitionComplete={onTransitionComplete}
        onVideoFadeComplete={onVideoFadeComplete}
        videoTextureYawOffset={videoTextureYawOffset}
        panoramaOpacity={panoramaOpacity}
        previousPanoramaOpacity={previousPanoramaOpacity}
        onPreviousFadeComplete={handlePreviousFadeComplete}
      />
    </Canvas>
  );
}
