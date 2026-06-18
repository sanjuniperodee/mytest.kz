import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // Стабильные vendor-чанки кэшируются между релизами и не тянут весь UI в один файл.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@bilimland/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // ADMIN_DEV_API lets you preview against a remote API (e.g. prod) without
      // CORS: the browser only ever talks to localhost, Vite proxies server-side.
      '/api': {
        target: process.env.ADMIN_DEV_API || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: process.env.ADMIN_DEV_API || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
