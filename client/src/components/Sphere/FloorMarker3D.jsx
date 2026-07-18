import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, invalidate } from "@react-three/fiber";
import * as THREE from "three";
import { degToPosition } from "../../utils/coordUtils.js";

/**
 * FloorMarker3D — Street-View-style navigation arrow as a 3D object.
 *
 * One bold rounded arrow (triangle with a notched base) lying on the floor,
 * pointing in the walk direction: "you can move forward here". Its opacity
 * breathes continuously; hovering stops the pulse (fully solid), grows the
 * marker and fades in a soft round glow behind it. Pressing tints it the
 * active blue. Matcap shading gives the extruded arrow a glossy 3D look
 * without adding lights to the scene (every other material is unlit).
 *
 * Markers near eye level are tilted back toward the camera so they never
 * degenerate into an edge-on line.
 *
 * Duplicated between client and admin (like coordUtils) — keep
 * client/src/components/Sphere/FloorMarker3D.jsx and
 * admin/src/components/Studio/FloorMarker3D.jsx in sync.
 */

// World-unit scale of the marker (panorama sphere radius is 50)
const BASE_RADIUS = 3.1;
// Sit slightly inside the panorama sphere so depth-testing keeps the marker
// in front of the pano/video spheres without z-fighting
const DIST_FACTOR = 0.92;
// Minimum |cos| between view ray and disc normal — same constant the old 2D
// footprint used as MIN_SQUASH; acos(0.34) ≈ 70° of allowed tilt.
const MIN_FACING = 0.34;
// Height the arrow floats above the floor (unit-marker space) + bob depth
const ARROW_FLOAT = 0.22;
const ARROW_BOB = 0.05;
// Google-blue active/clicked tint (matches the reference asset)
const ACTIVE_COLOR = "#fff";

const HIT_GEO = new THREE.CircleGeometry(1.3, 32);
const GLOW_GEO = new THREE.PlaneGeometry(2.6, 2.6);
const DASH_COUNT = 12;
const DASH_STEP = (Math.PI * 2) / DASH_COUNT;
const DASH_GEO = new THREE.RingGeometry(1.16, 1.28, 8, 1, 0, DASH_STEP * 0.6);
const DASH_ANGLES = Array.from({ length: DASH_COUNT }, (_, i) => i * DASH_STEP);

// Rounded polygon → THREE.Shape (quadratic corner rounding)
function roundedShape(pts, radius) {
  const shape = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const v1 = curr.clone().sub(prev);
    const v2 = next.clone().sub(curr);
    const r = Math.min(radius, v1.length() / 2, v2.length() / 2);
    const p1 = curr.clone().sub(v1.normalize().multiplyScalar(r));
    const p2 = curr.clone().add(v2.normalize().multiplyScalar(r));
    if (i === 0) shape.moveTo(p1.x, p1.y);
    else shape.lineTo(p1.x, p1.y);
    shape.quadraticCurveTo(curr.x, curr.y, p2.x, p2.y);
  }
  shape.closePath();
  return shape;
}

// Street-View chevron silhouette: tip, right base, bottom notch, left base —
// pointing +Y (the walk direction in disc-local space), extruded + bevelled.
const ARROW_GEO = (() => {
  const pts = [
    new THREE.Vector2(0, 0.9), // tip
    new THREE.Vector2(0.72, -0.55), // right base corner
    new THREE.Vector2(0, -0.18), // concave notch
    new THREE.Vector2(-0.72, -0.55), // left base corner
  ];
  const geo = new THREE.ExtrudeGeometry(roundedShape(pts, 0.16), {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  geo.center();
  return geo;
})();

// Fake studio-light matcap (radial gradient, highlight upper-left) generated
// once at module load; tinted per-marker via material.color.
const MATCAP_TEX = (() => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(
    size * 0.38,
    size * 0.34,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.62,
  );
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, "#e2e2e2");
  grad.addColorStop(0.75, "#9a9a9a");
  grad.addColorStop(1, "#585858");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

// Soft round glow sprite texture (alpha radial falloff), used for the hover
// halo and (tinted black) the contact shadow that grounds the arrow.
const GLOW_TEX = (() => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
})();

export default function FloorMarker3D({
  x_deg,
  y_deg,
  color = "#ffffff",
  scale,
  dashed = false,
  pulse = true,
  interactive = true,
  onClick,
}) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const innerRef = useRef();
  const arrowRef = useRef();
  const arrowMatRef = useRef();
  const glowMatRef = useRef();
  const dashedRef = useRef();
  const hoverT = useRef(0); // eased 0→1 hover factor

  const { position, quaternion } = useMemo(() => {
    const p = new THREE.Vector3(...degToPosition(x_deg, y_deg)).multiplyScalar(
      DIST_FACTOR,
    );
    const away = p.clone().normalize().negate(); // marker → camera

    // Disc normal starts pointing straight up (lying on the floor); tilt it
    // toward the camera only as far as needed to stay MIN_FACING visible.
    const n = new THREE.Vector3(0, 1, 0);
    const angle = Math.acos(THREE.MathUtils.clamp(n.dot(away), -1, 1));
    const maxAngle = Math.acos(MIN_FACING);
    if (angle > maxAngle) {
      const axis = new THREE.Vector3().crossVectors(n, away);
      if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0);
      axis.normalize();
      n.applyQuaternion(
        new THREE.Quaternion().setFromAxisAngle(axis, angle - maxAngle),
      );
    }

    // Arrow points along the horizontal walk direction (away from viewer),
    // projected onto the disc plane.
    const f = new THREE.Vector3(-away.x, 0, -away.z);
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.addScaledVector(n, -f.dot(n)).normalize();

    const right = new THREE.Vector3().crossVectors(f, n);
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, f, n),
    );
    return { position: p, quaternion: q };
  }, [x_deg, y_deg]);

  // Reset the cursor if the marker unmounts mid-hover (e.g. navigation)
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  const sw = scale?.width || 1;
  const sh = scale?.height || 1;

  useFrame((state, delta) => {
    const g = innerRef.current;
    if (!g) return;

    // Eased hover factor drives grow, glow and the solid opacity
    const target = hovered ? 1 : 0;
    hoverT.current += (target - hoverT.current) * Math.min(1, delta * 10);
    const grow = 1 + 0.12 * hoverT.current;
    g.scale.set(
      BASE_RADIUS * sw * grow,
      BASE_RADIUS * sh * grow,
      BASE_RADIUS * grow,
    );

    const t = state.clock.elapsedTime;
    if (arrowRef.current) {
      arrowRef.current.position.z = ARROW_FLOAT + Math.sin(t * 2) * ARROW_BOB;
    }
    // Opacity breathes continuously; hover locks it fully solid
    if (arrowMatRef.current) {
      const breath = pulse ? 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.6)) : 0.8;
      arrowMatRef.current.opacity =
        breath * (1 - hoverT.current) + 1 * hoverT.current;
    }
    // Soft halo fades in behind the arrow on hover
    if (glowMatRef.current) {
      glowMatRef.current.opacity = 0.85 * hoverT.current;
    }
    // Placement preview: slowly rotating dashes ("marching ants")
    if (dashedRef.current) {
      dashedRef.current.rotation.z = t * 0.4;
    }

    // The canvas runs frameloop="demand": useFrame only ticks while someone
    // requests frames. The breath/bob/hover animations above are continuous,
    // so keep asking for the next frame while the marker is mounted —
    // otherwise markers freeze mid-breath the moment fades/drags go idle.
    // (Markers unmount during video transitions, so this never competes with
    // clip playback for frame budget.)
    invalidate();
  });

  const handleClick = (e) => {
    e.stopPropagation();
    // Ignore "clicks" that were actually camera drags starting on the marker
    if (e.delta > 8) return;
    onClick?.(e);
  };

  const handleOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };

  const handleOut = () => {
    setHovered(false);
    setActive(false);
    document.body.style.cursor = "";
  };

  return (
    <group position={position} quaternion={quaternion}>
      <group ref={innerRef}>
        {/* Contact shadow grounding the arrow on bright floors */}
        <mesh
          geometry={GLOW_GEO}
          renderOrder={4}
          position-z={0.005}
          scale={0.85}
        >
          <meshBasicMaterial
            map={GLOW_TEX}
            color="#000000"
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
        {/* Hover halo (the round glow of the reference's hover state) */}
        <mesh geometry={GLOW_GEO} renderOrder={5} position-z={0.01}>
          <meshBasicMaterial
            ref={glowMatRef}
            map={GLOW_TEX}
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
        {/* The arrow: extruded, floating, leaning slightly toward the viewer */}
        <mesh
          ref={arrowRef}
          geometry={ARROW_GEO}
          rotation-x={0.35}
          renderOrder={6}
        >
          <meshMatcapMaterial
            ref={arrowMatRef}
            matcap={MATCAP_TEX}
            color={active ? ACTIVE_COLOR : color}
            transparent
          />
        </mesh>
        {dashed && (
          <group ref={dashedRef}>
            {DASH_ANGLES.map((a) => (
              <mesh key={a} geometry={DASH_GEO} rotation-z={a} renderOrder={6}>
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={0.9}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </group>
        )}
        {interactive && (
          <mesh
            geometry={HIT_GEO}
            renderOrder={8}
            onClick={handleClick}
            onPointerOver={handleOver}
            onPointerOut={handleOut}
            onPointerDown={() => setActive(true)}
            onPointerUp={() => setActive(false)}
          >
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}
