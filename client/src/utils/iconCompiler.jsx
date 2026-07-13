/**
 * Dynamic Icon Compiler
 *
 * Takes a string icon name (e.g. "FaInfoCircle", "IoArrowForward") and renders
 * the corresponding React component from react-icons.
 *
 * Icon packs are loaded LAZILY via dynamic import: statically importing all
 * eight packs (`import * as FaIcons ...`) forced ~7 MB of icon code into the
 * main bundle. Each pack is now a separate chunk fetched the first time an
 * icon from it is actually rendered, then cached for the session.
 *
 * Supported packs (extend iconPackLoaders to add more):
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

import { useEffect, useState } from 'react';

/** Map of prefix → lazy pack loader (each becomes its own async chunk) */
const iconPackLoaders = {
  Fa:  () => import('react-icons/fa'),
  Fa6: () => import('react-icons/fa6'),
  Io5: () => import('react-icons/io5'),
  Io:  () => import('react-icons/io'),
  Md:  () => import('react-icons/md'),
  Hi:  () => import('react-icons/hi'),
  Bi:  () => import('react-icons/bi'),
  Fi:  () => import('react-icons/fi'),
};

// Try prefixes from longest to shortest to avoid Io matching Io5 names
const prefixes = Object.keys(iconPackLoaders).sort((a, b) => b.length - a.length);

/** Already-loaded pack namespaces, keyed by prefix */
const loadedPacks = {};
/** In-flight pack loads, keyed by prefix (dedupes concurrent requests) */
const pendingLoads = {};

function packPrefixOf(name) {
  if (!name) return null;
  return prefixes.find((p) => name.startsWith(p)) || null;
}

/**
 * Resolve an icon string name to its React component, loading the icon pack
 * chunk on first use. Resolves to null if the icon is not found.
 *
 * @param {string} name  e.g. "FaInfoCircle" | "MdHome"
 * @returns {Promise<React.ComponentType | null>}
 */
export async function resolveIcon(name) {
  const prefix = packPrefixOf(name);
  if (!prefix) return null;

  if (!loadedPacks[prefix]) {
    if (!pendingLoads[prefix]) {
      pendingLoads[prefix] = iconPackLoaders[prefix]()
        .then((mod) => {
          loadedPacks[prefix] = mod;
          return mod;
        })
        .catch(() => null)
        .finally(() => {
          delete pendingLoads[prefix];
        });
    }
    await pendingLoads[prefix];
  }

  return loadedPacks[prefix]?.[name] || null;
}

/**
 * React component wrapper — renders the resolved icon, or a small circle
 * placeholder while the pack chunk loads / when the icon is unknown.
 *
 * @param {{ name: string, size?: number, color?: string, className?: string }} props
 */
export function DynamicIcon({ name, size = 24, color = 'white', className = '' }) {
  const [IconComponent, setIconComponent] = useState(() => {
    // Synchronous hit when the pack is already loaded — no placeholder flash
    const prefix = packPrefixOf(name);
    return (prefix && loadedPacks[prefix]?.[name]) || null;
  });

  useEffect(() => {
    let alive = true;
    resolveIcon(name).then((Comp) => {
      if (alive) setIconComponent(() => Comp);
    });
    return () => {
      alive = false;
    };
  }, [name]);

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
