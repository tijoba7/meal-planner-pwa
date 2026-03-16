#!/usr/bin/env node
/**
 * Bundle size budget check.
 *
 * Budgets (gzipped):
 *   JS  — 150 KB total across all entry chunks
 *   CSS — 20 KB total
 *
 * Exit 1 if any budget is exceeded so CI fails.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

const DIST_ASSETS = 'dist/assets'

const BUDGETS = {
  js: 150 * 1024,  // 150 KB
  css: 20 * 1024,  // 20 KB
}

function gzippedSize(filePath) {
  const content = readFileSync(filePath)
  return gzipSync(content, { level: 9 }).length
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

let files
try {
  files = readdirSync(DIST_ASSETS)
} catch {
  console.error(`Error: ${DIST_ASSETS} not found. Run "pnpm build" first.`)
  process.exit(1)
}

let totalJs = 0
let totalCss = 0
const rows = []

for (const file of files) {
  const ext = file.split('.').pop()
  if (ext !== 'js' && ext !== 'css') continue

  const filePath = join(DIST_ASSETS, file)
  if (!statSync(filePath).isFile()) continue

  const gz = gzippedSize(filePath)
  const isWorkbox = file.includes('workbox')

  // Workbox service worker files are tracked but excluded from the JS budget
  if (ext === 'js' && !isWorkbox) totalJs += gz
  if (ext === 'css') totalCss += gz

  rows.push({ file, gz, ext, isWorkbox })
}

// Print report table
const colWidth = 48
console.log('\nBundle size report (gzipped)\n')
console.log('File'.padEnd(colWidth) + 'Gzipped')
console.log('─'.repeat(colWidth + 12))
for (const row of rows.sort((a, b) => b.gz - a.gz)) {
  const note = row.isWorkbox ? ' (workbox — excluded from budget)' : ''
  console.log(row.file.padEnd(colWidth) + formatKB(row.gz) + note)
}
console.log('─'.repeat(colWidth + 12))
console.log(`${'Total JS (excl. workbox)'.padEnd(colWidth)}${formatKB(totalJs)}  (budget: ${formatKB(BUDGETS.js)})`)
console.log(`${'Total CSS'.padEnd(colWidth)}${formatKB(totalCss)}  (budget: ${formatKB(BUDGETS.css)})`)
console.log()

let failed = false

if (totalJs > BUDGETS.js) {
  console.error(`FAIL  JS budget exceeded: ${formatKB(totalJs)} > ${formatKB(BUDGETS.js)} (+${formatKB(totalJs - BUDGETS.js)} over)`)
  console.error('      Tip: check for large deps (lucide-react, @supabase/supabase-js, react-router-dom).')
  console.error('           Consider lazy-loading routes or importing icons individually.')
  failed = true
} else {
  console.log(`PASS  JS: ${formatKB(totalJs)} / ${formatKB(BUDGETS.js)}`)
}

if (totalCss > BUDGETS.css) {
  console.error(`FAIL  CSS budget exceeded: ${formatKB(totalCss)} > ${formatKB(BUDGETS.css)} (+${formatKB(totalCss - BUDGETS.css)} over)`)
  failed = true
} else {
  console.log(`PASS  CSS: ${formatKB(totalCss)} / ${formatKB(BUDGETS.css)}`)
}

console.log()

if (failed) {
  process.exit(1)
}
