/**
 * After client build and `npm run build` in jobrush_admin, copy jobrush_admin/dist into dist/jadm
 * so Netlify serves the admin portal at /jadm (URL unchanged).
 */
import { cpSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const src = join(root, 'jobrush_admin', 'dist')
const dest = join(root, 'dist', 'jadm')

if (!existsSync(src)) {
  console.error('copy-jadm-to-dist: jobrush_admin/dist not found. Run: npm run admin:build')
  process.exit(1)
}

mkdirSync(join(root, 'dist'), { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('copy-jadm-to-dist: jobrush_admin/dist -> dist/jadm')
