import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      // Proxy for Google Fonts
      '/fonts.googleapis.com': {
        target: 'https://fonts.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fonts.googleapis.com/, '')
      },
      // Proxy for Amazon images (for recommendations)
      '/m.media-amazon.com': {
        target: 'https://m.media-amazon.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/m.media-amazon.com/, '')
      }
    },
    headers: {
      // Required headers for WebAssembly and SharedArrayBuffer
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  assetsInclude: ['**/*.onnx'],
  build: {
    chunkSizeWarningLimit: 8000,
  }
});