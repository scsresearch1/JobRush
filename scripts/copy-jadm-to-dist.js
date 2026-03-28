/**
 * After `vite build` (main) and `npm run build` in jadm, copy jadm/dist into dist/jadm
 * so Netlify serves the admin portal at /jadm.
 */
import { cpSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = join(root, 'jadm', 'dist')
const dest = join(root, 'dist', 'jadm')

if (!existsSync(src)) {
  console.error('copy-jadm-to-dist: jadm/dist not found. Run: npm run admin:build')
  process.exit(1)
}

mkdirSync(join(root, 'dist'), { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('copy-jadm-to-dist: jadm/dist -> dist/jadm')
