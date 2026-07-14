import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This Vite config exists for ONE build only: the self-hosted tour player
// (`npm run build:static` → dist-static/) that the admin export zips together
// with tour.json + media. It needs relative asset paths so the folder runs
// from any static host at any sub-path — which Next.js cannot emit (no
// relative assetPrefix) — so the Vite pipeline stays for this one artifact.
// Everything else (landing, hosted viewer, dashboard) is the Next.js app.
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    // The shared viewer sources read process.env.NEXT_PUBLIC_* (inlined by
    // Next in the hosted app). Define the same keys here so one codebase
    // serves both builds. STATIC_TOUR=1 ⇒ load ./tour.json, no API, no
    // analytics, no message form.
    'process.env.NEXT_PUBLIC_STATIC_TOUR': JSON.stringify('1'),
    'process.env.NEXT_PUBLIC_API_URL': JSON.stringify(''),
  },
  build: {
    outDir: 'dist-static',
    rollupOptions: {
      output: {
        // Split the heavyweight libraries into their own cacheable chunks so
        // the app code chunk stays small and a code change doesn't invalidate
        // the three.js download for returning visitors. Icon packs are NOT
        // grouped here — they're dynamic imports (see iconCompiler.jsx) and
        // must stay as lazily-loaded async chunks.
        // NOTE: the react chunk must be dependency-CLOSED — every package it
        // contains may only import other packages in the same chunk. If a
        // react-chunk package (react-dom → scheduler) lands in vendor
        // instead, the react and vendor chunks become circular and React is
        // undefined when vendor evaluates ("Cannot read properties of
        // undefined (useLayoutEffect)" → blank page in EVERY production
        // build).
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-icons')) return;
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-reconciler|scheduler)[\\/]/.test(id)
          ) {
            return 'react';
          }
          if (id.includes('three') || id.includes('@react-three')) return 'three';
          return 'vendor';
        },
      },
    },
  },
});
