import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const frontendEnv = loadEnv(mode, __dirname, 'VITE_');
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), 'VITE_');
  const getClientEnv = (key: string) => process.env[key] ?? frontendEnv[key] ?? rootEnv[key] ?? '';
  const backendUrl = 'http://localhost:3000';
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(getClientEnv('VITE_API_URL')),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(getClientEnv('VITE_GEMINI_API_KEY')),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(getClientEnv('VITE_GOOGLE_CLIENT_ID')),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      hmr: process.env.DISABLE_HMR !== 'true',
      fs: {
        allow: [path.resolve(__dirname, '..')],
      },
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
