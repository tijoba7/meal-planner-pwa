/**
 * Deterministic SVG avatar generator.
 *
 * Generates unique, fun geometric avatars from a display name — similar to
 * GitHub identicons or Notion's default avatars. Each user gets a consistent
 * pattern with warm, food-inspired colors.
 *
 * Returns a data URI string suitable for use as an <img> src.
 */

// ─── Color palettes ──────────────────────────────────────────────────────────
// Pairs of [foreground, background] — warm, food-inspired tones.

const PALETTES: [string, string][] = [
  ['#f43f5e', '#fff1f2'], // rose
  ['#f97316', '#fff7ed'], // orange
  ['#eab308', '#fefce8'], // yellow
  ['#22c55e', '#f0fdf4'], // green
  ['#14b8a6', '#f0fdfa'], // teal
  ['#3b82f6', '#eff6ff'], // blue
  ['#8b5cf6', '#f5f3ff'], // violet
  ['#ec4899', '#fdf2f8'], // pink
  ['#d946ef', '#fdf4ff'], // fuchsia
  ['#6366f1', '#eef2ff'], // indigo
  ['#0ea5e9', '#f0f9ff'], // sky
  ['#a855f7', '#faf5ff'], // purple
]

// ─── Hash ────────────────────────────────────────────────────────────────────
// Simple but effective string hash — produces enough entropy for our needs.

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Derive multiple pseudo-random values from one seed. */
function prng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
}

// ─── SVG generation ──────────────────────────────────────────────────────────

const SIZE = 80 // viewBox size
const GRID = 5  // 5×5 grid, mirrored horizontally → 3 unique columns

/**
 * Generate a deterministic avatar SVG as a data URI.
 *
 * @param name — the user's display name (or any stable string)
 * @returns a `data:image/svg+xml,...` URI
 */
export function generateAvatar(name: string): string {
  const seed = hash(name)
  const rand = prng(seed)

  // Pick palette
  const [fg, bg] = PALETTES[seed % PALETTES.length]

  // Generate the 5×5 symmetric grid (only need first 3 cols, mirror the rest)
  const cellSize = SIZE / GRID
  const cells: string[] = []

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < Math.ceil(GRID / 2) + 1; col++) {
      if (rand() > 0.5) {
        // Fill this cell and its mirror
        const x = col * cellSize
        const y = row * cellSize
        cells.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fg}"/>`)

        // Mirror (skip center column since it mirrors onto itself)
        const mirrorCol = GRID - 1 - col
        if (mirrorCol !== col) {
          const mx = mirrorCol * cellSize
          cells.push(`<rect x="${mx}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fg}"/>`)
        }
      }
    }
  }

  // Ensure at least some cells are filled (avoid blank avatars)
  if (cells.length === 0) {
    const cx = SIZE / 2
    const cy = SIZE / 2
    cells.push(`<circle cx="${cx}" cy="${cy}" r="${SIZE * 0.3}" fill="${fg}"/>`)
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">`,
    `<rect width="${SIZE}" height="${SIZE}" fill="${bg}"/>`,
    ...cells,
    '</svg>',
  ].join('')

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Get a background color class for when the avatar is used alongside
 * Tailwind containers (e.g. as a ring behind the generated image).
 */
export function getAvatarBgClass(name: string): string {
  const BG_CLASSES = [
    'bg-rose-100 dark:bg-rose-900/40',
    'bg-orange-100 dark:bg-orange-900/40',
    'bg-amber-100 dark:bg-amber-900/40',
    'bg-emerald-100 dark:bg-emerald-900/40',
    'bg-teal-100 dark:bg-teal-900/40',
    'bg-cyan-100 dark:bg-cyan-900/40',
    'bg-blue-100 dark:bg-blue-900/40',
    'bg-violet-100 dark:bg-violet-900/40',
    'bg-purple-100 dark:bg-purple-900/40',
    'bg-pink-100 dark:bg-pink-900/40',
    'bg-fuchsia-100 dark:bg-fuchsia-900/40',
    'bg-indigo-100 dark:bg-indigo-900/40',
  ]
  return BG_CLASSES[hash(name) % BG_CLASSES.length]
}
