import { useEffect, useRef, useCallback } from "react";
import { Canvas, useThree, useLoader } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import * as FaIcons from "react-icons/fa";
import * as Fa6Icons from "react-icons/fa6";
import * as IoIcons from "react-icons/io";
import * as Io5Icons from "react-icons/io5";
import * as MdIcons from "react-icons/md";
import * as HiIcons from "react-icons/hi";
import * as BiIcons from "react-icons/bi";
import * as FiIcons from "react-icons/fi";
import { FaArrowRight } from "react-icons/fa";
import { cartesianToDeg, degToPosition } from "../../utils/coordUtils.js";

const SPHERE_RADIUS = 50;

const PACKS = {
  ...FaIcons,
  ...Fa6Icons,
  ...Io5Icons,
  ...IoIcons,
  ...MdIcons,
  ...HiIcons,
  ...BiIcons,
  ...FiIcons,
};
const resolveIcon = (name) => (name && PACKS[name]) || null;

function AdminDynamicIcon({ name, size = 22, color = "white" }) {
  const Icon = resolveIcon(name);
  return Icon ? (
    <Icon size={size} color={color} />
  ) : (
    <span style={{ fontSize: size * 0.6, color }}>?</span>
  );
}

// ─── Panorama Sphere ──────────────────────────────────────────────────────────
// Converts the equirectangular texture to a cubemap and uses it as scene.background.
// This gives true rectilinear projection — straight lines stay straight.
// An invisible sphere is kept solely so raycasting works for hotspot placement.
function PanoramaSphere({ url, onClick }) {
  const texture = useLoader(THREE.TextureLoader, url);
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

  // Invisible mesh — raycasting target for hotspot/sign placement clicks only
  return (
    <mesh onClick={onClick}>
      <sphereGeometry args={[SPHERE_RADIUS, 64, 32]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

// ─── Live placement preview pin ───────────────────────────────────────────────
function PreviewPin({ x_deg, y_deg, type, iconName, scale }) {
  const position = degToPosition(x_deg, y_deg);
  const baseSize = 44 * (scale?.width || 1);

  return (
    <Html position={position} center zIndexRange={[50, 100]}>
      <div
        className="flex items-center justify-center rounded-full border-2 border-dashed
                   pointer-events-none"
        style={{
          width: baseSize,
          height: baseSize * ((scale?.height || 1) / (scale?.width || 1)),
          background:
            type === "hotspot"
              ? "rgba(255,255,255,0.25)"
              : "rgba(59,130,246,0.35)",
          borderColor: type === "hotspot" ? "white" : "#3b82f6",
          boxShadow: "0 0 20px rgba(255,255,255,0.3)",
        }}
      >
        {type === "hotspot" ? (
          <FaArrowRight size={baseSize * 0.4} color="white" />
        ) : (
          <AdminDynamicIcon
            name={iconName || "FaInfoCircle"}
            size={baseSize * 0.7}
          />
        )}
      </div>
    </Html>
  );
}

// ─── Existing hotspot pins (read-only overlay) ────────────────────────────────
function ExistingPins({ node, onEditItem, placementMode }) {
  return (
    <>
      {node?.navigationHotspots?.map((h) => {
        const pos = degToPosition(h.position2D.x_deg, h.position2D.y_deg);
        const size = 36 * (h.scale?.width || 1);
        return (
          <Html key={h.id} position={pos} center zIndexRange={[10, 20]}>
            <div
              onClick={() => !placementMode && onEditItem?.("hotspot", h)}
              className={`flex items-center justify-center rounded-full border border-white/60 bg-white/20 transition-all
                ${!placementMode ? "cursor-pointer hover:bg-white/35 hover:scale-110" : "pointer-events-none"}`}
              style={{
                width: size,
                height: size,
                boxShadow: "0 0 8px rgba(255,255,255,0.4)",
              }}
            >
              <FaArrowRight size={size * 0.4} color="white" />
            </div>
          </Html>
        );
      })}
      {node?.infoSigns?.map((s) => {
        const pos = degToPosition(s.position2D.x_deg, s.position2D.y_deg);
        const sW = 32 * (s.scale?.width || 1);
        const sH = 32 * (s.scale?.height || 1);
        return (
          <Html key={s.id} position={pos} center zIndexRange={[10, 20]}>
            <div
              onClick={() => !placementMode && onEditItem?.("sign", s)}
              className={`flex items-center justify-center rounded-full border border-blue-400/60 bg-blue-500/20 transition-all
                ${!placementMode ? "cursor-pointer hover:bg-blue-400/35 hover:scale-110" : "pointer-events-none"}`}
              style={{ width: sW, height: sH }}
            >
              <AdminDynamicIcon
                name={s.appearance?.assetUrl || "FaInfoCircle"}
                size={sW * 0.7}
              />
            </div>
          </Html>
        );
      })}
    </>
  );
}

// ─── Drag camera controls ─────────────────────────────────────────────────────
function DragControls({ placementMode, initialYawOffset = 0 }) {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  // Apply node's initial yaw so the studio starts at the same view as the tour viewer.
  // Negate because panorama angles are right-positive but euler.y is left-positive.
  useEffect(() => {
    euler.current.y = -THREE.MathUtils.degToRad(initialYawOffset);
    camera.quaternion.setFromEuler(euler.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // In placement mode, cursor is crosshair — disable drag on click
    const canvas = gl.domElement;

    const onDown = (e) => {
      isDragging.current = true;
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;

      // Suppress drag in placement mode if it's just a click (< 3px movement)
      if (placementMode && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

      prevMouse.current = { x: e.clientX, y: e.clientY };
      const s = 0.003;
      euler.current.y -= dx * s;
      euler.current.x = Math.max(
        -1.48,
        Math.min(1.48, euler.current.x - dy * s),
      );
      camera.quaternion.setFromEuler(euler.current);
    };

    const onUp = () => {
      isDragging.current = false;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl.domElement, placementMode]);

  return null;
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function StudioScene({
  panoramaUrl,
  placementMode,
  onSphereClick,
  node,
  previewPin,
  onEditItem,
}) {
  const handleClick = useCallback(
    (e) => {
      if (!placementMode) return;
      e.stopPropagation();
      const point = e.point;
      const coords = cartesianToDeg(point.x, point.y, point.z);
      onSphereClick(coords, point);
    },
    [placementMode, onSphereClick],
  );

  return (
    <>
      <DragControls placementMode={placementMode} initialYawOffset={node?.initialYawOffset || 0} />
      <PanoramaSphere url={panoramaUrl} onClick={handleClick} />
      <ExistingPins
        node={node}
        onEditItem={onEditItem}
        placementMode={placementMode}
      />
      {previewPin && (
        <PreviewPin
          x_deg={previewPin.x_deg}
          y_deg={previewPin.y_deg}
          type={previewPin.type}
          iconName={previewPin.iconName}
          scale={previewPin.scale}
        />
      )}
    </>
  );
}

// ─── SphereStudio (exported) ──────────────────────────────────────────────────
/**
 * @param {object}   props
 * @param {string}   props.panoramaUrl     URL of the 360 image to display
 * @param {string}   props.placementMode   'hotspot' | 'sign' | null
 * @param {function} props.onSphereClick   ({ x_deg, y_deg }, point) => void
 * @param {object}   props.node            Current node data (for overlay pins)
 * @param {object}   [props.previewPin]    { x_deg, y_deg, type, iconName, scale }
 */
export default function SphereStudio({
  panoramaUrl,
  placementMode,
  onSphereClick,
  node,
  previewPin,
  onEditItem,
}) {
  return (
    <div className={`w-full h-full ${placementMode ? "placement-mode" : ""}`}>
      <Canvas
        camera={{ fov: 65, near: 0.1, far: 200, position: [0, 0, 0.01] }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true }}
      >
        <StudioScene
          panoramaUrl={panoramaUrl}
          placementMode={placementMode}
          onSphereClick={onSphereClick}
          node={node}
          previewPin={previewPin}
          onEditItem={onEditItem}
        />
      </Canvas>
    </div>
  );
}
