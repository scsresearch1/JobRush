import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed at https://jbrush.netlify.app/jadm (copied into main site dist/jadm)
const base = '/jadm/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
  },
})
