import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vite virtual modules (preload helper etc.): pin to the react chunk
          // (always loaded) or rollup may drop them into a lazy chunk, making
          // the entry statically depend on it — which preloads everything.
          if (id.startsWith('\0') || id.includes('vite/')) return 'react';
          if (!id.includes('node_modules')) return undefined;
          // Icon bundles: 'fa' is used (fully, via the picker's star import)
          // across pages; the other 7 bundles are picker-only, so they load
          // only when the icon picker chunk loads.
          if (id.includes('react-icons')) {
            return /react-icons[\\/]fa[\\/]/.test(id) ? 'icons-fa' : 'icons-picker';
          }
          // 3D stack: only the studio route imports it — loads on demand.
          if (/[\\/](three|three-stdlib|@react-three)[\\/]/.test(id)) return 'three';
          // Stable framework chunk: rebuilds don't invalidate it in caches.
          if (/[\\/](react|react-dom|react-router-dom|react-router|scheduler)[\\/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
});
