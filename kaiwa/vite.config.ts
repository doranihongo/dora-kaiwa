import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Đường dẫn gốc của cả web (mặc định "/"; GitHub Pages dạng project page là
// "/<tên-repo>/") - do scripts/build-site.js truyền vào qua biến môi trường.
const siteBase = (() => {
  const trimmed = (process.env.SITE_BASE || '/').replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
})();

export default defineConfig(() => {
  return {
    base: `${siteBase}kaiwa/`,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
