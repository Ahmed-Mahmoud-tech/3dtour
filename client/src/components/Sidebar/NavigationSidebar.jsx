import { useState } from 'react';
import { MenuIcon, CloseIcon, VolumeUpIcon, VolumeMuteIcon, MapMarkerIcon } from '../icons.jsx';

/**
 * NavigationSidebar
 *
 * Toggleable sidebar showing all nodes for quick jumping.
 * Also contains the global background audio toggle.
 *
 * @param {{
 *   nodes: object,
 *   activeNodeId: string,
 *   onNavigate: (nodeId: string) => void,
 *   audioMuted: boolean,
 *   onToggleAudio: function,
 *   audioEnabled: boolean
 * }} props
 */
export default function NavigationSidebar({
  nodes,
  activeNodeId,
  onNavigate,
  audioMuted,
  onToggleAudio,
  audioEnabled,
}) {
  const [open, setOpen] = useState(false);

  const nodeList = nodes ? Object.values(nodes) : [];

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="absolute top-4 left-4 z-40 w-10 h-10 flex items-center justify-center
                   rounded-full bg-black/50 backdrop-blur-sm border border-white/20
                   text-white hover:bg-black/70 transition-colors"
        aria-label="Toggle navigation menu"
      >
        {open ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
      </button>

      {/* Sidebar panel */}
      <div
        className={`absolute top-0 left-0 h-full z-30 w-72 bg-black/80 backdrop-blur-md
                    border-r border-white/10 text-white flex flex-col
                    transition-transform duration-300 ease-in-out
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pt-16 border-b border-white/10">
          <h2 className="font-semibold text-sm uppercase tracking-widest text-gray-300">
            Locations
          </h2>
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto py-2">
          {nodeList.map((node) => (
            <button
              key={node.id}
              onClick={() => {
                onNavigate(node.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left
                          hover:bg-white/10 transition-colors
                          ${node.id === activeNodeId ? 'bg-white/15 text-white' : 'text-gray-300'}`}
            >
              {node.panoramaPreviewUrl ? (
                <img
                  src={node.panoramaPreviewUrl}
                  alt=""
                  loading="lazy"
                  className={`w-14 h-9 rounded object-cover flex-shrink-0 border
                              ${node.id === activeNodeId ? 'border-blue-400' : 'border-white/10'}`}
                />
              ) : (
                <MapMarkerIcon
                  size={14}
                  className={node.id === activeNodeId ? 'text-blue-400' : 'text-gray-500'}
                />
              )}
              <span className="text-sm truncate">{node.displayName}</span>
              {node.id === activeNodeId && (
                <span className="ml-auto text-xs text-blue-400 font-medium">Now</span>
              )}
            </button>
          ))}
        </div>

        {/* Audio toggle footer */}
        {audioEnabled && (
          <div className="p-4 border-t border-white/10">
            <button
              onClick={onToggleAudio}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                         bg-white/10 hover:bg-white/15 transition-colors text-sm"
            >
              {audioMuted ? (
                <VolumeMuteIcon size={16} className="text-red-400" />
              ) : (
                <VolumeUpIcon size={16} className="text-green-400" />
              )}
              <span>{audioMuted ? 'Unmute Background Audio' : 'Mute Background Audio'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Overlay to close sidebar on click outside */}
      {open && (
        <div
          className="absolute inset-0 z-20"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
