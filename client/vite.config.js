import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heavyweight libraries into their own cacheable chunks so
        // the app code chunk stays small and a code change doesn't invalidate
        // the three.js download for returning visitors. Icon packs are NOT
        // grouped here — they're dynamic imports (see iconCompiler.jsx) and
        // must stay as lazily-loaded async chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-icons')) return;
          if (id.includes('three') || id.includes('@react-three')) return 'three';
          if (id.includes('react')) return 'react';
          return 'vendor';
        },
      },
    },
  },
});
