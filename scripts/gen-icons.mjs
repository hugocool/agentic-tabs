import { mkdirSync, readFileSync, existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

const svgPath = join(process.cwd(), 'src', 'assets', 'icon.svg')
const outDir = join(process.cwd(), 'assets')
try { mkdirSync(outDir) } catch { }

const sizes = [16, 19, 32, 38, 48, 128, 256, 512]
const svg = readFileSync(svgPath)

async function run() {
    for (const size of sizes) {
        const file = join(outDir, `icon${size}.png`)
        if (existsSync(file)) continue
        await sharp(svg).resize(size, size, { fit: 'contain' }).png({ compressionLevel: 9 }).toFile(file)
        console.log('Generated', file)
        // Also copy into src root (for bundler resolution with flat filenames) and project root
        const rootCopy = join(process.cwd(), `icon${size}.png`)
        try { copyFileSync(file, rootCopy) } catch { }
        const srcCopyDir = join(process.cwd(), 'src')
        try { mkdirSync(srcCopyDir) } catch { }
        const srcCopy = join(srcCopyDir, `icon${size}.png`)
        try { copyFileSync(file, srcCopy) } catch { }
    }
}

run().catch(e => { console.error('gen-icons failed', e); process.exit(1) })
