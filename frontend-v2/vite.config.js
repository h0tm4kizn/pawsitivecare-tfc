/* global process */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const resolveFromRoot = (...parts) => path.resolve(projectRoot, ...parts);

const getProxyTargets = (mode) => {
  const env = loadEnv(mode, projectRoot, '');
  return {
    BACKEND_URL: env.VITE_API_TARGET || process.env.VITE_API_TARGET || 'http://127.0.0.1:8002',
    DOG_API_TARGET: env.VITE_PET_ID_DOG_TARGET || process.env.VITE_PET_ID_DOG_TARGET || 'http://127.0.0.1:8000',
    CAT_API_TARGET: env.VITE_PET_ID_CAT_TARGET || process.env.VITE_PET_ID_CAT_TARGET || 'http://127.0.0.1:8001',
  };
};

// Load HTTPS certificates if available
const httpsOptions = (() => {
  try {
    const keyPath = resolveFromRoot('cert', 'dev-key.pem');
    const certPath = resolveFromRoot('cert', 'dev-cert.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    }
  } catch (e) {
    console.warn('HTTPS certificates not found, skipping HTTPS setup');
  }
  return false;
})();

export default defineConfig(({ mode }) => {
  const { BACKEND_URL, DOG_API_TARGET, CAT_API_TARGET } = getProxyTargets(mode);

  return {
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    host: true,
    https: httpsOptions,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/storage': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/dog-api': {
        target: DOG_API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dog-api/, ''),
      },
      '/cat-api': {
        target: CAT_API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cat-api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      react: resolveFromRoot('node_modules/react'),
      'react-dom': resolveFromRoot('node_modules/react-dom'),
      'react/jsx-runtime': resolveFromRoot('node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolveFromRoot('node_modules/react/jsx-dev-runtime.js'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  optimizeDeps: {
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'zustand',
    ],
  },
  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
  build: {
    modulePreload: {
      resolveDependencies: (filename, deps) => deps.filter((dep) => !dep.includes('vendor-pdf') && !dep.includes('vendor-powersync')),
    },
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable') || id.includes('node_modules/html2canvas')) {
            return 'vendor-pdf';
          }
          if (id.includes('node_modules/react-easy-crop')) {
            return 'vendor-crop';
          }
          if (id.includes('node_modules/@powersync') || id.includes('node_modules/@journeyapps/wa-sqlite')) {
            return 'vendor-powersync';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
    // Warn when any individual chunk exceeds 500 kB
    chunkSizeWarningLimit: 500,
  },
  };
});
