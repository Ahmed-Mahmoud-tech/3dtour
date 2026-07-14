import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { degToPosition } from "../../utils/coordUtils.js";
import { ArrowRightIcon } from "../icons.jsx";

/**
 * NavigationHotspot
 *
 * Renders an interactive navigation arrow/icon pinned to the sphere wall
 * at the position specified by position2D (degrees).
 *
 * @param {{ hotspot: object, onNavigate: function }} props
 */
export default function NavigationHotspot({ hotspot, onNavigate }) {
  const [hovered, setHovered] = useState(false);
  const downPos = useRef(null);
  const position = degToPosition(
    hotspot.position2D.x_deg,
    hotspot.position2D.y_deg,
  );

  const handleClick = (e) => {
    e.stopPropagation();
    // Ignore "clicks" that were actually camera drags starting on the hotspot
    if (
      downPos.current &&
      Math.hypot(
        e.clientX - downPos.current.x,
        e.clientY - downPos.current.y,
      ) > 8
    ) {
      return;
    }
    const videoUrl = hotspot.transitionVideoUrl || null;
    const reverseVideoUrl = hotspot.reverseTransitionVideoUrl || null;

    // Pass all transition data including multi-video array; TourPage handles direction preservation
    onNavigate(
      hotspot.targetNodeId,
      videoUrl,
      hotspot.playMode,
      hotspot.transitionId,
      hotspot.videoInitialYawOffset ?? 0,
      reverseVideoUrl,
      hotspot.transitionVideos || [],
      hotspot.id,
    );
  };

  const scale = hotspot.scale || { width: 1, height: 1 };
  const baseSize = 48 * scale.width;

  return (
    <Html
      position={position}
      center
      zIndexRange={[1, 10]}
      style={{ pointerEvents: "auto" }}
    >
      <div
        onClick={handleClick}
        onPointerDown={(e) => {
          downPos.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="hotspot-pulse relative cursor-pointer flex items-center justify-center rounded-full
                   bg-white/20 backdrop-blur-sm border-2 border-white/70 transition-all duration-200"
        style={{
          width: baseSize,
          height: baseSize * (scale.height / scale.width),
          transform: hovered ? "scale(1.2)" : "scale(1)",
          boxShadow: hovered
            ? "0 0 20px rgba(255,255,255,0.6)"
            : "0 0 10px rgba(0,0,0,0.4)",
        }}
        title={`Go to next area`}
      >
        <ArrowRightIcon
          size={baseSize * 0.45}
          color="white"
          style={{
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
          }}
        />
      </div>
    </Html>
  );
}
