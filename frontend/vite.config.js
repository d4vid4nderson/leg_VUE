
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  assetsInclude: ['**/*.PNG', '**/*.png'],
  plugins: [react()],
  css: {
    postcss: './postcss.config.cjs', // Updated extension here
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  },
  server: {
    port: 3000,
    strictPort: false,
    open: true,
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
