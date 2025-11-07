#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

async function compactTree(targetPath) {
  const resolvedPath = path.resolve(ROOT_DIR, targetPath || 'data/tree.json')
  const source = await fs.readFile(resolvedPath, 'utf8')
  const parsed = JSON.parse(source)
  const minified = JSON.stringify(parsed)
  await fs.writeFile(resolvedPath, `${minified}\n`, 'utf8')

  const gzPath = `${resolvedPath}.gz`
  await fs.writeFile(gzPath, gzipSync(minified))

  const relativeTarget = path.relative(ROOT_DIR, resolvedPath) || resolvedPath
  const relativeGz = path.relative(ROOT_DIR, gzPath) || gzPath

  console.log(`[compact-tree] Minified ${relativeTarget} (${source.length} -> ${minified.length} bytes)`) // eslint-disable-line no-console
  console.log(`[compact-tree] Wrote gzip archive to ${relativeGz}`) // eslint-disable-line no-console
}

const cliArg = process.argv[2]
compactTree(cliArg).catch(error => {
  console.error('[compact-tree] Failed to compact tree data:', error)
  process.exitCode = 1
})
