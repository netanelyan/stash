import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' so the built index.html works when Electron loads it over file://
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5183,
    strictPort: true,
  },
  clearScreen: false,
});
