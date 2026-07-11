import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2018',
  },
  resolve: {
    alias: {
      '@wealthos': path.resolve(__dirname, '../wealthos/frontend'),
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, '../wealthos'),
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
