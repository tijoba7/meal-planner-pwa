#!/usr/bin/env node
/**
 * Bundle size budget check.
 *
 * After route-level code splitting (MEA-144) the meaningful budget is the
 * INITIAL bundle — the JS the browser must parse before the app renders.
 * Lazy chunks load on-demand and don't affect first-load performance.
 *
 * Budgets (gzipped):
 *   JS initial chunk (index-*.js)  — 200 KB
 *   CSS total                      — 20 KB
 *
 * Exit 1 if any budget is exceeded so CI fails.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

const DIST_ASSETS = 'dist/assets'

const BUDGETS = {
  jsInitial: 200 * 1024, // 200 KB — initial bundle only
  css: 20 * 1024,        // 20 KB
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

let initialJs = 0
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
  // The initial entry chunk has no route-name prefix — matches index-[hash].js
  const isInitial = ext === 'js' && /^index-/.test(file) && !isWorkbox

  if (ext === 'js' && !isWorkbox) totalJs += gz
  if (ext === 'js' && isInitial) initialJs += gz
  if (ext === 'css') totalCss += gz

  rows.push({ file, gz, ext, isWorkbox, isInitial })
}

// Print report table
const colWidth = 52
console.log('\nBundle size report (gzipped)\n')
console.log('File'.padEnd(colWidth) + 'Gzipped')
console.log('─'.repeat(colWidth + 12))
for (const row of rows.sort((a, b) => b.gz - a.gz)) {
  const note = row.isWorkbox
    ? ' (workbox — excluded)'
    : row.isInitial
    ? ' ← initial bundle'
    : ''
  console.log(row.file.padEnd(colWidth) + formatKB(row.gz) + note)
}
console.log('─'.repeat(colWidth + 12))
console.log(`${'Initial JS (index-*.js)'.padEnd(colWidth)}${formatKB(initialJs)}  (budget: ${formatKB(BUDGETS.jsInitial)})`)
console.log(`${'Total JS (all chunks, excl. workbox)'.padEnd(colWidth)}${formatKB(totalJs)}  (informational)`)
console.log(`${'Total CSS'.padEnd(colWidth)}${formatKB(totalCss)}  (budget: ${formatKB(BUDGETS.css)})`)
console.log()

let failed = false

if (initialJs > BUDGETS.jsInitial) {
  console.error(`FAIL  Initial JS budget exceeded: ${formatKB(initialJs)} > ${formatKB(BUDGETS.jsInitial)} (+${formatKB(initialJs - BUDGETS.jsInitial)} over)`)
  console.error('      Tip: check for large deps in the main bundle (React, Dexie, Layout).')
  console.error('           Move more code to lazy routes or dynamic imports.')
  failed = true
} else {
  console.log(`PASS  Initial JS: ${formatKB(initialJs)} / ${formatKB(BUDGETS.jsInitial)}`)
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
