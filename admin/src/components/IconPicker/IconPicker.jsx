import { useState, useMemo, useCallback } from 'react';
import * as FaIcons  from 'react-icons/fa';
import * as Fa6Icons from 'react-icons/fa6';
import * as IoIcons  from 'react-icons/io';
import * as Io5Icons from 'react-icons/io5';
import * as MdIcons  from 'react-icons/md';
import * as HiIcons  from 'react-icons/hi';
import * as BiIcons  from 'react-icons/bi';
import * as FiIcons  from 'react-icons/fi';

// Build a flat icon name → component map once (lazily)
const buildIconIndex = () => {
  const packs = { ...FaIcons, ...Fa6Icons, ...Io5Icons, ...IoIcons,
                  ...MdIcons, ...HiIcons, ...BiIcons, ...FiIcons };
  return Object.entries(packs).filter(([, v]) => typeof v === 'function');
};

let _iconIndex = null;
const getIconIndex = () => {
  if (!_iconIndex) _iconIndex = buildIconIndex();
  return _iconIndex;
};

/**
 * IconPicker
 *
 * A searchable icon selector from the react-icons library.
 * Clicking an icon calls onSelect(iconName: string).
 *
 * @param {{ value: string, onSelect: (name: string) => void, onClose: () => void }} props
 */
export default function IconPicker({ value, onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const index = getIconIndex();
    const q = query.toLowerCase();
    return q
      ? index.filter(([name]) => name.toLowerCase().includes(q)).slice(0, 120)
      : index.slice(0, 120);
  }, [query]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-700">
        <input
          autoFocus
          type="text"
          className="admin-input"
          placeholder="Search icons… (e.g. arrow, home, star)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="text-gray-600 text-xs mt-1.5">{filtered.length} results</p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-6 gap-1">
          {filtered.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => { onSelect(name); onClose(); }}
              title={name}
              className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg
                          text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors
                          ${value === name ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : ''}`}
            >
              <Icon size={20} />
              <span className="truncate w-full text-center text-[9px] leading-tight">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Small inline preview of the currently selected icon.
 */
export function IconPreview({ name, size = 20 }) {
  const index = getIconIndex();
  const entry = index.find(([n]) => n === name);
  if (!entry) return <span className="text-gray-600 text-xs">—</span>;
  const Icon = entry[1];
  return <Icon size={size} />;
}
