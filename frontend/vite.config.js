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
    port: 5173,
    strictPort: false,
    open: true,
  },
  publicDir: 'public',
});