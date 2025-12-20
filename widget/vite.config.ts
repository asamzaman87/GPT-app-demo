import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'pending-invites': resolve(__dirname, 'pending-invites.html'),
        'auth-status': resolve(__dirname, 'auth-status.html'),
        'respond-result': resolve(__dirname, 'respond-result.html'),
      },
      output: {
        // Keep assets in a single flat structure
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 5174,
  },
});

