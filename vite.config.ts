import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Workaround: some environments mis-serve HTML as application/javascript.
// This middleware forces proper Content-Type for HTML paths during dev.
function fixHtmlContentType(): Plugin {
  return {
    name: 'fix-html-content-type',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url === '/' || url.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [fixHtmlContentType(), react()],
      server: {
        port: 5173,
        host: true,
        proxy: {
          '/api': {
            target: 'http://localhost',
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api/, '/CRM_ERP_V4/api'),
          },
          '/onecall': {
            target: 'https://onecallvoicerecord.dtac.co.th',
            changeOrigin: true,
            secure: true,
            rewrite: (p) => p.replace(/^\/onecall/, ''),
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
