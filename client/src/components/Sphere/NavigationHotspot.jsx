import { useCallback } from "react";
import FloorMarker3D from "./FloorMarker3D.jsx";

/**
 * NavigationHotspot
 *
 * A Matterport-style 3D floor marker — ring + chevrons lying on the ground —
 * telling the visitor they can move forward here. All visuals (orientation,
 * pulse, hover, drag-vs-click detection) live in FloorMarker3D; this
 * component wires tour navigation into its click.
 *
 * @param {{ hotspot: object, onNavigate: function }} props
 */
export default function NavigationHotspot({ hotspot, onNavigate }) {
  const handleClick = useCallback(() => {
    const videoUrl = hotspot.transitionVideoUrl || null;

    // Pass all transition data including the multi-video array
    onNavigate(
      hotspot.targetNodeId,
      videoUrl,
      hotspot.transitionId,
      hotspot.videoInitialYawOffset ?? 0,
      hotspot.transitionVideos || [],
      hotspot.id,
    );
  }, [hotspot, onNavigate]);

  return (
    <FloorMarker3D
      x_deg={hotspot.position2D.x_deg}
      y_deg={hotspot.position2D.y_deg}
      color={hotspot.color || "#ffffff"}
      scale={hotspot.scale}
      onClick={handleClick}
    />
  );
}
