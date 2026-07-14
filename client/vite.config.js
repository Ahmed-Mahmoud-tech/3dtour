import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite build --mode static` produces the self-hosted tour player used by the
// admin export: relative asset paths (runs from any folder on any static
// host), tour data read from ./tour.json instead of the API, analytics off.
export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static';

  return {
    plugins: [react()],
    base: isStatic ? './' : '/',
    define: isStatic
      ? { 'import.meta.env.VITE_STATIC_TOUR': JSON.stringify('1') }
      : {},
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:5000',
        '/uploads': 'http://localhost:5000',
      },
    },
    build: {
      outDir: isStatic ? 'dist-static' : 'dist',
      rollupOptions: {
        output: {
          // Split the heavyweight libraries into their own cacheable chunks so
          // the app code chunk stays small and a code change doesn't invalidate
          // the three.js download for returning visitors. Icon packs are NOT
          // grouped here — they're dynamic imports (see iconCompiler.jsx) and
          // must stay as lazily-loaded async chunks.
          // NOTE: the react chunk must be dependency-CLOSED — every package it
          // contains may only import other packages in the same chunk. If a
          // react-chunk package (react-dom → scheduler, react-router-dom →
          // @remix-run/router) lands in vendor instead, the react and vendor
          // chunks become circular and React is undefined when vendor
          // evaluates ("Cannot read properties of undefined (useLayoutEffect)"
          // → blank page in EVERY production build).
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('react-icons')) return;
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-reconciler|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)
            ) {
              return 'react';
            }
            if (id.includes('three') || id.includes('@react-three')) return 'three';
            return 'vendor';
          },
        },
      },
    },
  };
});
