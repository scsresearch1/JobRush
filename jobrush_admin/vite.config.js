import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Deployed at https://jbrush.netlify.app/jadm (copied from jobrush_admin/dist into dist/jadm)
const base = '/jadm/'

export default defineConfig({
  base,
  // Use repo-root .env / .env.local so one file configures both apps locally
  envDir: path.resolve(__dirname, '..'),
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
  },
})
