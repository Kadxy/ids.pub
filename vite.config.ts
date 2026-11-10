import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      // `bun dev` uses the remote D1. IDS_LOCAL_DB=1 uses a throwaway local database in
      // .wrangler/test instead, so automated checks never touch real data.
      persistState: {
        path: process.env.IDS_LOCAL_DB === '1' ? '.wrangler/test' : '.wrangler/state',
      },
      remoteBindings: process.env.IDS_LOCAL_DB !== '1',
    }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) },
  },
  server: { port: 3201, strictPort: true },
})
