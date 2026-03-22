import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = '/';
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3000';

  return {
  plugins: [
    react(),
    {
      name: 'redirect-admin-to-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/admin' || req.url?.startsWith('/admin?')) {
            res.statusCode = 302;
            res.setHeader('Location', '/admin/');
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  base,
  server: {
    port: 5174,
    proxy: {
      '/admin': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  };
});
