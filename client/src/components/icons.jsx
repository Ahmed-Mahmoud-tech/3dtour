/**
 * Inline SVG icons for the viewer chrome.
 *
 * These few icons used to be static imports from react-icons — but any static
 * import of a react-icons pack forces the ENTIRE pack (~1.3 MB for fa) into
 * the entry bundle, because the pack is also loaded dynamically by
 * iconCompiler for user-configured icons. Keeping the viewer's own icons as
 * plain SVG keeps react-icons fully lazy.
 *
 * All icons accept { size, color, className } like react-icons components.
 */

const Svg = ({ size = 24, color = "currentColor", className = "", children, viewBox = "0 0 24 24" }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const ArrowRightIcon = (props) => (
  <Svg {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const MenuIcon = (props) => (
  <Svg {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
);

export const CloseIcon = (props) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const VolumeUpIcon = (props) => (
  <Svg {...props}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" fill={props.color || "currentColor"} stroke="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);

export const VolumeMuteIcon = (props) => (
  <Svg {...props}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" fill={props.color || "currentColor"} stroke="none" />
    <path d="M16 9l6 6M22 9l-6 6" />
  </Svg>
);

export const MapMarkerIcon = (props) => (
  <Svg {...props}>
    <path d="M12 21s-7-5.75-7-11a7 7 0 1 1 14 0c0 5.25-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
