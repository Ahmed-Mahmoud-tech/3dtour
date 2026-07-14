import { Html } from '@react-three/drei';
import { degToPosition } from '../../utils/coordUtils.js';
import { DynamicIcon } from '../../utils/iconCompiler.jsx';

export default function InfoSign({ sign, onOpenPopup }) {
  const position = degToPosition(sign.position2D.x_deg, sign.position2D.y_deg);
  const scale = sign.scale || { width: 1, height: 1 };
  const baseSize = 40 * scale.width;
  const appearance = sign.appearance || {};

  return (
    <Html position={position} center zIndexRange={[1, 10]} style={{ pointerEvents: 'auto' }}>
      <div
        onClick={(e) => { e.stopPropagation(); onOpenPopup(sign.popupContent, sign.id); }}
        className="relative cursor-pointer flex items-center justify-center rounded-full
                   bg-blue-500/70 backdrop-blur-sm border-2 border-white/70
                   hover:bg-blue-400/80 hover:scale-110 transition-all duration-200"
        style={{
          width: baseSize,
          height: baseSize * (scale.height / scale.width),
          boxShadow: '0 0 12px rgba(59,130,246,0.6)',
        }}
        title={sign.popupContent?.title || 'Info'}
      >
        <DynamicIcon
          name={appearance.assetUrl || 'FaInfoCircle'}
          size={baseSize * 0.6}
          color="white"
        />
      </div>
    </Html>
  );
}
