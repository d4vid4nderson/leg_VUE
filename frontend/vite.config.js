
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Get Git information for automatic versioning
const getGitInfo = () => {
  try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    const commitDate = execSync('git log -1 --format=%ci').toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    return { commitHash, commitDate, branch };
  } catch (e) {
    console.warn('Unable to get git info:', e.message);
    return { commitHash: 'unknown', commitDate: new Date().toISOString(), branch: 'unknown' };
  }
};

const gitInfo = getGitInfo();
const buildTimestamp = new Date().toISOString();

export default defineConfig({
  assetsInclude: ['**/*.PNG', '**/*.png'],
  plugins: [react()],
  css: {
    postcss: './postcss.config.cjs', // Updated extension here
  },
  define: {
    global: 'globalThis',
    'process.env': {},
    // Inject Git and build info as environment variables
    '__GIT_COMMIT__': JSON.stringify(gitInfo.commitHash),
    '__GIT_COMMIT_DATE__': JSON.stringify(gitInfo.commitDate),
    '__GIT_BRANCH__': JSON.stringify(gitInfo.branch),
    '__BUILD_TIMESTAMP__': JSON.stringify(buildTimestamp)
  },
  server: {
    port: 3000,
    strictPort: false,
    open: true,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    },
    watch: {
      usePolling: true,
    },
  },
  publicDir: 'public',
});
