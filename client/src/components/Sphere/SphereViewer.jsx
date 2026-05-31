import { useRef, useEffect, useCallback, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { useTexture, Html } from '@react-three/drei';
import * as THREE from 'three';
import NavigationHotspot from './NavigationHotspot.jsx';
import InfoSign from './InfoSign.jsx';

const SPHERE_RADIUS = 50;

// ─── Panorama Sphere Mesh ─────────────────────────────────────────────────────
// Converts the equirectangular texture to a cubemap and uses it as scene.background.
// This gives true rectilinear projection — straight lines stay straight.
function PanoramaSphere({ panoramaUrl }) {
  const texture = useTexture(panoramaUrl);
  const { gl, scene } = useThree();

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(gl);
    const envMap = pmrem.fromEquirectangular(texture).texture;
    pmrem.dispose();
    scene.background = envMap;

    return () => {
      scene.background = null;
      envMap.dispose();
    };
  }, [texture, gl, scene]);

  return null;
}

// ─── Drag-to-pan Camera Controls ─────────────────────────────────────────────
function PanoramaControls({ initialYawOffset = 0, onYawChange, videoYawOverride }) {
  const { camera, gl } = useThree();
  const isDragging   = useRef(false);
  const prevMouse    = useRef({ x: 0, y: 0 });
  const euler        = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  // Use a ref so callbacks don't force useCallback recreation on every render
  const onYawChangeRef = useRef(onYawChange);
  useEffect(() => { onYawChangeRef.current = onYawChange; });

  // Apply initial yaw on mount only; key={node.id} on parent remounts this on node change
  useEffect(() => {
    euler.current.y = THREE.MathUtils.degToRad(initialYawOffset);
    euler.current.x = 0;
    camera.quaternion.setFromEuler(euler.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snap camera to videoYawOverride when a video transition starts
  useEffect(() => {
    if (videoYawOverride == null) return;
    euler.current.y = THREE.MathUtils.degToRad(videoYawOverride);
    camera.quaternion.setFromEuler(euler.current);
    onYawChangeRef.current?.(euler.current.y);
  }, [videoYawOverride, camera]);

  const onPointerDown = useCallback((e) => {
    e.preventDefault(); // stop browser image-drag / text-selection
    isDragging.current = true;
    prevMouse.current = { x: e.clientX, y: e.clientY };
    // Lock pointer to canvas so fast moves don't escape
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
      // Report yaw on every move so callers always have the latest value
      onYawChangeRef.current?.(euler.current.y);
    },
    [camera]
  );

  const onPointerUp = useCallback((e) => {
    isDragging.current = false;
    onYawChangeRef.current?.(euler.current.y);
    if (e?.target?.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
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
    [onPointerMove]
  );

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    onYawChangeRef.current?.(euler.current.y);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [gl.domElement, onPointerDown, onPointerMove, onPointerUp, onTouchStart, onTouchMove, onTouchEnd]);

  // Nothing to render — this is a pure-logic component
  return null;
}

// ─── Video Sphere (transition video mapped onto the sphere) ──────────────────
function VideoSphere({ videoUrl, onEnded }) {
  const [texture, setTexture] = useState(null);
  const opacityRef     = useRef(0);
  const fadingOutRef   = useRef(false);
  const onEndedCalledRef = useRef(false);
  const matRef         = useRef();
  // Keep latest onEnded in a ref to avoid re-creating the video on callback change
  const onEndedRef = useRef(onEnded);
  useEffect(() => { onEndedRef.current = onEnded; });

  // Update video texture + fade-in / fade-out opacity every frame
  useFrame(() => {
    if (texture) texture.needsUpdate = true;
    if (matRef.current) {
      if (fadingOutRef.current) {
        // Fade out: ~13 frames to fully transparent at 60 fps
        if (!onEndedCalledRef.current) {
          opacityRef.current = Math.max(0, opacityRef.current - 0.08);
          matRef.current.opacity = opacityRef.current;
          if (opacityRef.current === 0) {
            onEndedCalledRef.current = true;
            onEndedRef.current?.();
          }
        }
      } else if (opacityRef.current < 1) {
        // Fade in: ~16 frames to fully opaque at 60 fps
        opacityRef.current = Math.min(1, opacityRef.current + 0.06);
        matRef.current.opacity = opacityRef.current;
      }
    }
  });

  useEffect(() => {
    let mounted = true;
    opacityRef.current = 0;

    const video = document.createElement('video');
    // Set attributes BEFORE src to avoid CORS / load-order issues
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    // No crossOrigin — video is same-origin via Vite proxy; adding it causes CORS failures

    const tex = new THREE.VideoTexture(video);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1;           // fixes seam/cutting caused by negative repeat
    tex.colorSpace = THREE.SRGBColorSpace;

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
      console.error('Transition video failed:', videoUrl);
      onEndedRef.current?.();
    };

    video.addEventListener('playing', handlePlaying, { once: true });
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    video.src = videoUrl;
    video.play().catch((err) => {
      if (!mounted) return;
      if (err.name !== 'AbortError') {
        console.error('Transition video play rejected:', err);
        onEndedRef.current?.();
      }
    });

    return () => {
      mounted = false;
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      setTexture(null);
      video.pause();
      video.src = '';
      tex.dispose();
    };
  }, [videoUrl]);

  if (!texture) return null;

  return (
    <mesh>
      {/* Slightly smaller radius so video renders in front of PanoramaSphere */}
      <sphereGeometry args={[SPHERE_RADIUS - 0.1, 128, 64]} />
      <meshBasicMaterial ref={matRef} map={texture} side={THREE.BackSide}
                         transparent opacity={0} />
    </mesh>
  );
}

// ─── Scene Root ───────────────────────────────────────────────────────────────
function Scene({ node, hotspotVisible, onNavigate, onSignClick, initialYaw, onYawChange,
                 transitionVideoUrl, onTransitionComplete, videoYawOverride }) {
  return (
    <>
      <PanoramaControls key={node.id} initialYawOffset={initialYaw} onYawChange={onYawChange} videoYawOverride={videoYawOverride} />
      {/* Panorama always visible — acts as background during transition */}
      <PanoramaSphere panoramaUrl={node.panoramaUrl} />
      {/* Video sphere sits in front; only appears once first frame is decoded */}
      {transitionVideoUrl && (
        <VideoSphere videoUrl={transitionVideoUrl} onEnded={onTransitionComplete} />
      )}

      {hotspotVisible &&
        node.navigationHotspots?.map((hotspot) => (
          <NavigationHotspot key={hotspot.id} hotspot={hotspot} onNavigate={onNavigate} />
        ))}

      {hotspotVisible &&
        node.infoSigns?.map((sign) => (
          <InfoSign key={sign.id} sign={sign} onOpenPopup={onSignClick} />
        ))}
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
export default function SphereViewer({ node, hotspotVisible, onNavigate, onSignClick, initialYaw, onYawChange,
                                       transitionVideoUrl, onTransitionComplete, videoYawOverride }) {
  if (!node) return null;

  // entryYaw (initialYaw prop) is already in internal euler.y-degrees space.
  // node.initialYawOffset is a panorama angle (right = positive) which must be
  // negated because Three.js camera rotates counter-clockwise for positive euler.y.
  const effectiveYaw = initialYaw !== null && initialYaw !== undefined
    ? initialYaw
    : -(node.initialYawOffset || 0);

  return (
    <Canvas
      camera={{ fov: 65, near: 0.1, far: 200, position: [0, 0, 0.01] }}
      style={{ width: '100%', height: '100%', background: '#000',
               userSelect: 'none', WebkitUserSelect: 'none',
               WebkitUserDrag: 'none' }}
      onDragStart={(e) => e.preventDefault()}
      gl={{ antialias: true }}
    >
      <Scene
        node={node}
        hotspotVisible={hotspotVisible}
        onNavigate={onNavigate}
        onSignClick={onSignClick}
        initialYaw={effectiveYaw}
        onYawChange={onYawChange}
        transitionVideoUrl={transitionVideoUrl}
        onTransitionComplete={onTransitionComplete}
        videoYawOverride={videoYawOverride}
      />
    </Canvas>
  );
}
