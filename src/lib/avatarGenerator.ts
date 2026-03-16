/**
 * Deterministic SVG face avatar generator.
 *
 * Creates cute, unique face characters from a display name. Each user gets
 * a consistent avatar with different face colors, eye styles, mouth
 * expressions, and accessories. ~10,000+ unique combinations.
 *
 * Returns a data URI string suitable for use as an <img> src.
 */

// ─── Hash + PRNG ─────────────────────────────────────────────────────────────

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function prng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

// ─── Face parts ──────────────────────────────────────────────────────────────

const FACE_COLORS = [
  '#fbbf24', // amber
  '#f87171', // red
  '#fb923c', // orange
  '#a78bfa', // violet
  '#60a5fa', // blue
  '#34d399', // emerald
  '#f472b6', // pink
  '#38bdf8', // sky
  '#c084fc', // purple
  '#4ade80', // green
  '#fb7185', // rose
  '#fcd34d', // yellow
]

const BG_COLORS = [
  '#fef3c7', '#fce7f3', '#fff7ed', '#f5f3ff', '#eff6ff',
  '#ecfdf5', '#fdf2f8', '#f0f9ff', '#faf5ff', '#f0fdf4',
  '#fff1f2', '#fefce8',
]

// Eye generators: return SVG string for both eyes
const EYES = [
  // Simple dots
  (c: string) =>
    `<circle cx="34" cy="42" r="3.5" fill="${c}"/><circle cx="56" cy="42" r="3.5" fill="${c}"/>`,
  // Ovals
  (c: string) =>
    `<ellipse cx="34" cy="42" rx="4" ry="5" fill="${c}"/><ellipse cx="56" cy="42" rx="4" ry="5" fill="${c}"/>`,
  // Wink (left eye closed)
  (c: string) =>
    `<path d="M30 42 Q34 38 38 42" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="56" cy="42" r="3.5" fill="${c}"/>`,
  // Happy squint
  (c: string) =>
    `<path d="M30 42 Q34 38 38 42" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M52 42 Q56 38 60 42" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  // Big round eyes with pupils
  (c: string) =>
    `<circle cx="34" cy="42" r="5" fill="white" stroke="${c}" stroke-width="1.5"/><circle cx="35.5" cy="41.5" r="2.5" fill="${c}"/><circle cx="56" cy="42" r="5" fill="white" stroke="${c}" stroke-width="1.5"/><circle cx="57.5" cy="41.5" r="2.5" fill="${c}"/>`,
  // Star eyes
  (c: string) =>
    `<text x="34" y="46" text-anchor="middle" font-size="12" fill="${c}">★</text><text x="56" y="46" text-anchor="middle" font-size="12" fill="${c}">★</text>`,
  // Sleepy / relaxed
  (c: string) =>
    `<path d="M30 43 Q34 40 38 43" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M52 43 Q56 40 60 43" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
]

// Mouth generators
const MOUTHS = [
  // Smile
  (c: string) => `<path d="M37 56 Q45 64 53 56" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  // Big grin
  (c: string) => `<path d="M35 55 Q45 67 55 55" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  // Open mouth (surprised)
  (c: string) => `<ellipse cx="45" cy="58" rx="5" ry="6" fill="${c}" opacity="0.8"/>`,
  // Straight / neutral
  (c: string) => `<line x1="38" y1="57" x2="52" y2="57" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
  // Smirk
  (c: string) => `<path d="M38 57 Q46 63 54 55" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  // Cat mouth
  (c: string) => `<path d="M37 56 L45 60 L53 56" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Tongue out
  (c: string) => `<path d="M37 56 Q45 64 53 56" stroke="${c}" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="45" cy="62" rx="3" ry="4" fill="#f87171" opacity="0.7"/>`,
  // Tiny smile
  (c: string) => `<path d="M41 57 Q45 61 49 57" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
]

// Accessory generators (optional — some are "none")
const ACCESSORIES = [
  // None
  () => '',
  () => '',
  () => '',
  // Chef hat
  (_fc: string) =>
    `<ellipse cx="45" cy="18" rx="16" ry="10" fill="white" stroke="#e5e7eb" stroke-width="1"/><rect x="30" y="16" width="30" height="8" rx="2" fill="white" stroke="#e5e7eb" stroke-width="1"/>`,
  // Round glasses
  (fc: string) =>
    `<circle cx="34" cy="42" r="8" fill="none" stroke="${fc}" stroke-width="1.5" opacity="0.5"/><circle cx="56" cy="42" r="8" fill="none" stroke="${fc}" stroke-width="1.5" opacity="0.5"/><line x1="42" y1="42" x2="48" y2="42" stroke="${fc}" stroke-width="1.5" opacity="0.5"/>`,
  // Blush
  (_fc: string) =>
    `<circle cx="28" cy="52" r="5" fill="#fda4af" opacity="0.4"/><circle cx="62" cy="52" r="5" fill="#fda4af" opacity="0.4"/>`,
  // Headband
  (fc: string) =>
    `<path d="M22 32 Q45 22 68 32" stroke="${fc}" stroke-width="3" fill="none" opacity="0.4" stroke-linecap="round"/>`,
  // Freckles
  (_fc: string) =>
    `<circle cx="32" cy="50" r="1.2" fill="#92400e" opacity="0.3"/><circle cx="36" cy="52" r="1.2" fill="#92400e" opacity="0.3"/><circle cx="54" cy="50" r="1.2" fill="#92400e" opacity="0.3"/><circle cx="58" cy="52" r="1.2" fill="#92400e" opacity="0.3"/>`,
  // Rosy nose
  (_fc: string) =>
    `<circle cx="45" cy="49" r="3" fill="#fda4af" opacity="0.5"/>`,
]

// ─── Generator ───────────────────────────────────────────────────────────────

const SIZE = 90

export function generateAvatar(name: string): string {
  const seed = hash(name)
  const rand = prng(seed)

  const faceColor = pick(FACE_COLORS, rand)
  const bgColor = pick(BG_COLORS, rand)
  const eyeFn = pick(EYES, rand)
  const mouthFn = pick(MOUTHS, rand)
  const accessoryFn = pick(ACCESSORIES, rand)

  // Feature color (eyes, mouth) — darker shade
  const featureColor = '#1e293b'

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">`,
    // Background
    `<rect width="${SIZE}" height="${SIZE}" fill="${bgColor}"/>`,
    // Face circle
    `<circle cx="45" cy="45" r="28" fill="${faceColor}"/>`,
    // Eyes
    eyeFn(featureColor),
    // Mouth
    mouthFn(featureColor),
    // Accessory
    accessoryFn(faceColor),
    '</svg>',
  ]

  return `data:image/svg+xml,${encodeURIComponent(parts.join(''))}`
}
