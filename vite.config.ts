import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Cloudflare plugin runs the Worker (worker/index.ts) and local D1 inside `vite dev`,
// and builds the Worker alongside the static site for `wrangler deploy`.
export default defineConfig({
  plugins: [react(), cloudflare()],
})
