import { useState } from 'react';
import { Html } from '@react-three/drei';
import { degToPosition } from '../../utils/coordUtils.js';
import { hexToRgba, darkenHex } from '../../utils/colorUtils.js';
import { DynamicIcon } from '../../utils/iconCompiler.jsx';

export default function InfoSign({ sign, onOpenPopup }) {
  const [hovered, setHovered] = useState(false);
  const position = degToPosition(sign.position2D.x_deg, sign.position2D.y_deg);
  const scale = sign.scale || { width: 1, height: 1 };
  const baseSize = 42 * scale.width;
  const appearance = sign.appearance || {};
  const title = sign.popupContent?.title;
  const badgeColor = appearance.color || '#10c9b7';

  return (
    <Html position={position} center zIndexRange={[1, 10]} style={{ pointerEvents: 'auto' }}>
      <div className="relative flex items-center justify-center">
        {/* Title pill floats above the badge on hover; absolute so it never
            shifts the badge off its anchor point */}
        {title && (
          <div
            className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap
                        rounded-full bg-black/75 backdrop-blur-sm px-3 py-1 text-xs font-medium
                        text-white shadow-lg transition-all duration-200 pointer-events-none
                        ${hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
          >
            {title}
          </div>
        )}
        <div
          onClick={(e) => { e.stopPropagation(); onOpenPopup(sign.popupContent, sign.id); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="cursor-pointer flex items-center justify-center rounded-full
                     backdrop-blur-sm border-2 transition-all duration-200"
          style={{
            width: baseSize,
            height: baseSize * ((scale.height || 1) / (scale.width || 1)),
            borderColor: hovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
            background: `radial-gradient(120% 120% at 30% 25%, ${hexToRgba(badgeColor, hovered ? 0.95 : 0.88)}, ${hexToRgba(darkenHex(badgeColor, 0.45), hovered ? 0.92 : 0.88)})`,
            transform: hovered ? 'scale(1.12)' : 'scale(1)',
            boxShadow: hovered
              ? `0 4px 16px rgba(0,0,0,0.4), 0 0 18px ${hexToRgba(badgeColor, 0.6)}`
              : `0 3px 10px rgba(0,0,0,0.4), 0 0 10px ${hexToRgba(badgeColor, 0.35)}`,
          }}
          title={title || 'Info'}
        >
          <DynamicIcon
            name={appearance.assetUrl || 'FaInfoCircle'}
            size={baseSize * 0.52}
            color={appearance.iconColor || 'white'}
          />
        </div>
      </div>
    </Html>
  );
}
