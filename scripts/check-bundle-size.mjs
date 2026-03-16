#!/usr/bin/env node
/**
 * Bundle size budget check.
 *
 * Budgets (gzipped):
 *   Initial JS total (index-*.js chunks) — 350 KB
 *   Any single JS chunk                  — 200 KB
 *   CSS total                            — 20 KB
 *
 * Warns (but does not fail) when a chunk exceeds 80% of its per-chunk limit.
 * Exit 1 if any hard budget is exceeded so CI fails.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

const DIST_ASSETS = 'dist/assets'

const BUDGETS = {
  initialJs: 350 * 1024,  // 350 KB gzipped — total initial JS
  chunkJs: 200 * 1024,    // 200 KB gzipped — any single JS chunk
  css: 20 * 1024,         // 20 KB gzipped — total CSS
}
const WARN_RATIO = 0.8

function gzippedSize(filePath) {
  const content = readFileSync(filePath)
  return gzipSync(content, { level: 9 }).length
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function pct(value, budget) {
  return Math.round((value / budget) * 100)
}

let files
try {
  files = readdirSync(DIST_ASSETS)
} catch {
  console.error(`Error: ${DIST_ASSETS} not found. Run "pnpm build" first.`)
  process.exit(1)
}

let totalInitialJs = 0
let totalCss = 0
const rows = []

for (const file of files) {
  const ext = file.split('.').pop()
  if (ext !== 'js' && ext !== 'css') continue

  const filePath = join(DIST_ASSETS, file)
  if (!statSync(filePath).isFile()) continue

  const gz = gzippedSize(filePath)
  const isWorkbox = file.includes('workbox')
  // Vite names the main entry chunk "index-*.js"; everything else is a lazy chunk.
  const isEntry = ext === 'js' && /^index-/.test(file) && !isWorkbox

  if (isEntry) totalInitialJs += gz
  if (ext === 'css') totalCss += gz

  rows.push({ file, gz, ext, isWorkbox, isEntry })
}

// ── Print report table ────────────────────────────────────────────────────────
const COL = 52
console.log('\nBundle size report (gzipped)\n')
console.log('File'.padEnd(COL) + 'Gzipped   Budget%  Status')
console.log('─'.repeat(COL + 30))

let failed = false
const warnings = []

for (const row of rows.sort((a, b) => b.gz - a.gz)) {
  let note = ''
  let status = ''

  if (row.isWorkbox) {
    note = ' (workbox)'
    status = 'excluded'
  } else if (row.ext === 'js') {
    const usedPct = pct(row.gz, BUDGETS.chunkJs)
    if (row.gz > BUDGETS.chunkJs) {
      status = `FAIL (${usedPct}% of ${formatKB(BUDGETS.chunkJs)} chunk limit)`
      failed = true
    } else if (row.gz > BUDGETS.chunkJs * WARN_RATIO) {
      status = `WARN (${usedPct}% of ${formatKB(BUDGETS.chunkJs)} chunk limit)`
      warnings.push(row.file)
    } else {
      status = `ok   (${usedPct}%)`
    }
    if (row.isEntry) note = ' ← initial'
  } else {
    status = 'ok'
  }

  console.log(row.file.padEnd(COL) + formatKB(row.gz).padEnd(10) + status + note)
}

console.log('─'.repeat(COL + 30))
console.log(`${'Total initial JS (index-*.js)'.padEnd(COL)}${formatKB(totalInitialJs).padEnd(10)}budget: ${formatKB(BUDGETS.initialJs)}`)
console.log(`${'Total CSS'.padEnd(COL)}${formatKB(totalCss).padEnd(10)}budget: ${formatKB(BUDGETS.css)}`)
console.log()

// ── Budget checks ─────────────────────────────────────────────────────────────
if (totalInitialJs > BUDGETS.initialJs) {
  console.error(`FAIL  Initial JS budget exceeded: ${formatKB(totalInitialJs)} > ${formatKB(BUDGETS.initialJs)} (+${formatKB(totalInitialJs - BUDGETS.initialJs)} over)`)
  console.error('      Tip: lazy-load routes or split large deps with dynamic import().')
  failed = true
} else {
  const p = pct(totalInitialJs, BUDGETS.initialJs)
  const icon = p > 80 ? 'WARN' : 'PASS'
  console.log(`${icon}  Initial JS: ${formatKB(totalInitialJs)} / ${formatKB(BUDGETS.initialJs)} (${p}%)`)
}

if (totalCss > BUDGETS.css) {
  console.error(`FAIL  CSS budget exceeded: ${formatKB(totalCss)} > ${formatKB(BUDGETS.css)} (+${formatKB(totalCss - BUDGETS.css)} over)`)
  failed = true
} else {
  console.log(`PASS  CSS: ${formatKB(totalCss)} / ${formatKB(BUDGETS.css)}`)
}

if (warnings.length > 0) {
  console.log(`\nWARN  Chunks approaching ${formatKB(BUDGETS.chunkJs)} limit (>${Math.round(WARN_RATIO * 100)}%):`)
  for (const f of warnings) console.log(`        ${f}`)
}

console.log()

if (failed) {
  process.exit(1)
}
