import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // When the real backend runs, requests to /api are forwarded to it,
      // so the browser never hits CORS problems during development.
      proxy:
        env.VITE_USE_MOCKS === 'false'
          ? { '/api': { target: env.API_PROXY_TARGET ?? 'http://localhost:8000', changeOrigin: true } }
          : undefined,
    },
  };
});
