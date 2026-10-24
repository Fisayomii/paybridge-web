import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, requests to /api go through Vite to your local Spring Boot app,
// so the browser sees one origin and CORS never comes into it.
// In production, VITE_API_URL points the app straight at the Render backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
