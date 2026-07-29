// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const publicSchoolDevFallback = {
  name: 'public-school-dev-fallback',
  enforce: 'pre',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (/^\/colegio\/[^/?#]+(?:\?.*)?$/.test(req.url ?? '')) req.url = '/colegio/';
      next();
    });
  },
};

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  server: {
    host: true,
    port: 4321,
  },
  vite: {
    plugins: [publicSchoolDevFallback, tailwindcss()],
    server: {
      watch: {
        usePolling: true,
      },
    },
  },
});
