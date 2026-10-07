import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = resolve(process.env.OGCTV_DATA_DIR || 'data')
rmSync(dir, { recursive: true, force: true })
console.log(`Removed ${dir}. OGCTV will create and seed a fresh database on next start.`)
