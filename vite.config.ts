import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 150
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4812',
        changeOrigin: true
      }
    },
    fs: {
      strict: false,
      allow: ['..']
    }
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  base: './'
});
