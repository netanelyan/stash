import { defineConfig } from 'vite';

// The preload runs in a sandboxed context, where require() only resolves
// Electron and a handful of Node builtins - not relative files. So we bundle
// electron/preload.cjs (and the channel list it imports) into one CommonJS file.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    lib: {
      entry: 'electron/preload.cjs',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
});
