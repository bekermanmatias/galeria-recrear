// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const publicRouteDevFallback = {
  name: 'public-route-dev-fallback',
  enforce: 'pre',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url ?? '';
      if (/^\/colegio\/[^/?#]+(?:\?.*)?$/.test(url)) {
        req.url = '/colegio/';
        return next();
      }

      const publicCode = /^\/([A-Za-z0-9_-]+)(?:\?.*)?$/.exec(url)?.[1];
      const reserved = new Set(['admin', 'login', 'coordinator', 'parent', 'colegio', 'api', 'viajes', 'colegios-pasajeros']);
      if (publicCode && !publicCode.includes('.') && !reserved.has(publicCode.toLowerCase())) req.url = '/';
      next();
    });
  },
};

export default defineConfig({
  integrations: [react()],
  server: {
    host: true,
    port: 4321,
  },
  vite: {
    plugins: [publicRouteDevFallback, tailwindcss()],
    server: {
      watch: {
        usePolling: true,
      },
    },
  },
});
