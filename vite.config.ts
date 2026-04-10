import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/mds-proxy': {
        target: 'https://mywealth.mds.prod.mywealthcare.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mds-proxy/, ''),
      },
      '/broker-proxy': {
        target: 'https://stoplight.io/mocks/mywealth-inc/mywealth-platform/1099845682',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/broker-proxy/, ''),
      },
      '/moneta-proxy': {
        target: 'https://api.moneta.ng',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/moneta-proxy/, ''),
      },
    },
  },
})
