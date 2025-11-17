import { promises as fs } from 'fs'
import path from 'path'

const ROOT = process.cwd()
const IGNORE_DIRS = ['node_modules', 'dist', '.git']
const WARNINGS = []

function shouldIgnore(filePath) {
  return IGNORE_DIRS.some(dir => filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`))
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (shouldIgnore(full)) continue
    if (ent.isDirectory()) await walk(full)
    else if (ent.isFile()) await checkFile(full)
  }
}

async function checkFile(file) {
  const ext = path.extname(file).toLowerCase()
  if (!['.js', '.ts', '.jsx', '.tsx', '.html'].includes(ext)) return
  let content
  try {
    content = await fs.readFile(file, 'utf8')
  } catch (e) {
    console.error('Could not read', file, e)
    return
  }

  
  if (file.endsWith('src\\utils\\safe-html.ts') || file.endsWith('src/utils/safe-html.ts')) return

  
  const innerHtmlMatches = content.match(/\.innerHTML\b/g)
  const insertAdjacent = content.match(/insertAdjacentHTML\b/g)
  const jqueryHtml = content.match(/\.html\(/g)
  const documentWrite = content.match(/document\.write\b/g)

  if (innerHtmlMatches || insertAdjacent || jqueryHtml || documentWrite) {
    WARNINGS.push({ file, reason: 'Use of raw HTML insertion (innerHTML / insertAdjacentHTML / .html() / document.write)' })
  }

  
  if (ext === '.html') {
    const re = /<[^>]*target\s*=\s*['"]_blank['"][^>]*>/gi
    let m
    while ((m = re.exec(content)) !== null) {
      const tag = m[0]
      if (!/rel\s*=/.test(tag)) {
        WARNINGS.push({ file, reason: 'HTML anchor with target="_blank" missing rel attribute' })
      }
    }
  } else {
    
    const setAttrMatches = content.match(/setAttribute\(\s*['\"]target['\"]\s*,\s*['\"]_blank['\"]\s*\)/g)
    if (setAttrMatches) {
      WARNINGS.push({ file, reason: "Setting target='_blank' via setAttribute - ensure rel='noopener' is set" })
    }
  }
}

async function main() {
  await walk(ROOT)
  if (WARNINGS.length === 0) {
    console.log('security-check: no obvious issues found')
    process.exit(0)
  }
  console.log('security-check: warnings found (please review)')
  WARNINGS.forEach(w => console.log(` - ${w.file}: ${w.reason}`))
  process.exit(1)
}

main().catch(err => { console.error(err); process.exit(2) })
