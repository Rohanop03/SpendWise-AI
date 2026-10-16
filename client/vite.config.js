import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same-origin API in development: no CORS preflights, and the refresh cookie is first-party.
    proxy: {
      '/api': {
        changeOrigin: true,
        target: 'http://localhost:5000',
      },
    },
  },
  test: {
    environment: 'jsdom',
    fileParallelism: false,
    setupFiles: './src/tests/setup.js',
    testTimeout: 10000,
  },
});
