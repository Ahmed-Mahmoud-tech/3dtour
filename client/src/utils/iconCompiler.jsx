/**
 * Dynamic Icon Compiler
 *
 * Takes a string icon name (e.g. "FaInfoCircle", "IoArrowForward") and returns
 * the corresponding React component from react-icons.
 *
 * Supported packs (extend iconPackMap to add more):
 *   fa  — Font Awesome 5  (react-icons/fa)
 *   fa6 — Font Awesome 6  (react-icons/fa6)
 *   io  — Ionicons 4      (react-icons/io)
 *   io5 — Ionicons 5      (react-icons/io5)
 *   md  — Material Design (react-icons/md)
 *   hi  — Hero Icons      (react-icons/hi)
 *   bi  — Bootstrap Icons (react-icons/bi)
 *   fi  — Feather Icons   (react-icons/fi)
 *
 * Usage:
 *   import { DynamicIcon } from '../utils/iconCompiler';
 *   <DynamicIcon name="FaInfoCircle" size={24} color="white" />
 */

import * as FaIcons  from 'react-icons/fa';
import * as Fa6Icons from 'react-icons/fa6';
import * as IoIcons  from 'react-icons/io';
import * as Io5Icons from 'react-icons/io5';
import * as MdIcons  from 'react-icons/md';
import * as HiIcons  from 'react-icons/hi';
import * as BiIcons  from 'react-icons/bi';
import * as FiIcons  from 'react-icons/fi';

/** Map of prefix → icon pack import namespace */
const iconPackMap = {
  Fa:  FaIcons,
  Fa6: Fa6Icons,
  Io5: Io5Icons,
  Io:  IoIcons,
  Md:  MdIcons,
  Hi:  HiIcons,
  Bi:  BiIcons,
  Fi:  FiIcons,
};

/**
 * Resolve an icon string name to the React component.
 * Returns null if the icon is not found.
 *
 * @param {string} name  e.g. "FaInfoCircle" | "MdHome"
 * @returns {React.ComponentType | null}
 */
export function resolveIcon(name) {
  if (!name) return null;

  // Try prefixes from longest to shortest to avoid Io matching Io5 names
  const prefixes = Object.keys(iconPackMap).sort((a, b) => b.length - a.length);

  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      const pack = iconPackMap[prefix];
      return pack[name] || null;
    }
  }
  return null;
}

/**
 * React component wrapper — renders the resolved icon or a fallback.
 *
 * @param {{ name: string, size?: number, color?: string, className?: string }} props
 */
export function DynamicIcon({ name, size = 24, color = 'white', className = '' }) {
  const IconComponent = resolveIcon(name);

  if (!IconComponent) {
    // Fallback: render a small circle placeholder
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          opacity: 0.6,
        }}
      />
    );
  }

  return <IconComponent size={size} color={color} className={className} />;
}
