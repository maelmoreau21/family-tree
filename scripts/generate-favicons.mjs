#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const STATIC_DIR = path.join(ROOT, 'static')
const INPUT_SVG = path.join(STATIC_DIR, 'logo.svg')

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch (e) {
    return false
  }
}

async function generate() {
  if (!(await fileExists(INPUT_SVG))) {
    console.error(`[generate-favicons] Introuvable: ${INPUT_SVG}`)
    process.exit(1)
  }

  const sizes = [48, 32, 16]
  try {
    const svgBuffer = await fs.readFile(INPUT_SVG)
    for (const size of sizes) {
      const outPath = path.join(STATIC_DIR, `logo-${size}.png`)
      await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain' })
        .png({ compressionLevel: 9 })
        .toFile(outPath)
      console.log(`[generate-favicons] Wrote ${path.relative(ROOT, outPath)}`)
    }

    // Apple touch icon (180)
    const appleOut = path.join(STATIC_DIR, `apple-touch-icon.png`)
    await sharp(svgBuffer)
      .resize(180, 180, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toFile(appleOut)
    console.log(`[generate-favicons] Wrote ${path.relative(ROOT, appleOut)}`)

    console.log('[generate-favicons] Terminé')
  } catch (error) {
    console.error('[generate-favicons] Erreur:', error)
    process.exit(2)
  }
}

generate()
