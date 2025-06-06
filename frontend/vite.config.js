// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  assetsInclude: ['**/*.PNG', '**/*.png'],
  plugins: [react()],
  css: {
    postcss: './postcss.config.cjs', // Updated extension here
  },
  server: {
    port: 80,
    strictPort: false,
    open: false, // Explicitly disable auto-opening browser
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      }
    },
    watch: {
      usePolling: true,
    },
  },
  publicDir: 'public',
});
