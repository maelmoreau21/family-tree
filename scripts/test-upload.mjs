#!/usr/bin/env node
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SCRIPTS_DIR = path.join(ROOT, 'scripts')

const BUILDER_URL = process.env.BUILDER_URL || 'http://localhost:7921'
const ADMIN_TOKEN = process.env.TREE_ADMIN_TOKEN || process.env.ADMIN_TOKEN || ''
const LARGE_MB = Number(process.env.TEST_LARGE_MB || '6')
const SMALL_BYTES = 1024 // 1 KB small
const LARGE_BYTES = LARGE_MB * 1024 * 1024

async function ensureFile(filePath, size) {
  try {
    await fs.access(filePath)
    const stats = await fs.stat(filePath)
    if (stats.size === size) return
  } catch (e) {
    // create
  }
  const fd = await fs.open(filePath, 'w')
  await fd.truncate(size)
  await fd.close()
}

async function doUpload(filePath) {
  const buffer = await fs.readFile(filePath)
  const form = new FormData()
  // Create a Blob from the buffer so Node's FormData accepts it
  const blob = new Blob([buffer], { type: 'image/png' })
  form.append('file', blob, path.basename(filePath))

  const headers = {}
  if (ADMIN_TOKEN) headers['x-admin-token'] = ADMIN_TOKEN

  const url = `${BUILDER_URL}/api/uploads`
  console.log(`Uploading ${path.basename(filePath)} (${(await fs.stat(filePath)).size} bytes) to ${url}`)
  try {
    const res = await fetch(url, { method: 'POST', body: form, headers, signal: undefined })
    const text = await res.text()
    console.log(`Response ${res.status} ${res.statusText}:`)
    try { console.log(JSON.parse(text)) } catch(e) { console.log(text) }
    return res.status
  } catch (error) {
    console.error('Upload failed:', error.message || error)
    return null
  }
}

async function main() {
  const smallPath = path.join(SCRIPTS_DIR, '_test-small.png')
  const largePath = path.join(SCRIPTS_DIR, '_test-large.png')

  console.log('Ensuring test files...')
  await ensureFile(smallPath, SMALL_BYTES)
  await ensureFile(largePath, LARGE_BYTES)

  console.log('\nPerforming small upload (expected success if under limit)')
  await doUpload(smallPath)

  console.log('\nPerforming large upload (expected 413 if server limit smaller than file)')
  await doUpload(largePath)
}

main().catch(err => {
  console.error('Test upload script failed', err)
  process.exit(1)
})
