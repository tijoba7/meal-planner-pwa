/**
 * SVG illustrations for empty states.
 * All fills/strokes use brand palette hex values from the design system:
 *   #f0fdf4 = green-50   (light fill background)
 *   #dcfce7 = green-100  (soft fill)
 *   #86efac = green-300  (mid stroke)
 *   #22c55e = green-500  (accent fill)
 *   #16a34a = green-600  (primary stroke / brand color)
 * Hard-coded hex is intentional here — SVG fill/stroke props do not accept CSS classes.
 */

export function RecipeBookIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full" aria-hidden="true">
      {/* Left page */}
      <rect
        x="10"
        y="18"
        width="27"
        height="44"
        rx="3"
        fill="#dcfce7"
        stroke="#16a34a"
        strokeWidth="1.5"
      />
      {/* Right page */}
      <rect
        x="43"
        y="18"
        width="27"
        height="44"
        rx="3"
        fill="#dcfce7"
        stroke="#16a34a"
        strokeWidth="1.5"
      />
      {/* Spine */}
      <rect x="37" y="16" width="6" height="48" rx="2" fill="#16a34a" />
      {/* Left page lines */}
      <line
        x1="16"
        y1="28"
        x2="31"
        y2="28"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="33"
        x2="31"
        y2="33"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="38"
        x2="26"
        y2="38"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="43"
        x2="31"
        y2="43"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="48"
        x2="28"
        y2="48"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Right page lines */}
      <line
        x1="49"
        y1="28"
        x2="64"
        y2="28"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="49"
        y1="33"
        x2="64"
        y2="33"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="49"
        y1="38"
        x2="59"
        y2="38"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="49"
        y1="43"
        x2="64"
        y2="43"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="49"
        y1="48"
        x2="61"
        y2="48"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SearchNoResultsIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full" aria-hidden="true">
      {/* Magnifying glass circle */}
      <circle cx="34" cy="34" r="18" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
      {/* Handle */}
      <line
        x1="47"
        y1="47"
        x2="64"
        y2="64"
        stroke="#16a34a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* X inside */}
      <line
        x1="27"
        y1="27"
        x2="41"
        y2="41"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="41"
        y1="27"
        x2="27"
        y2="41"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ShoppingCartIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full" aria-hidden="true">
      {/* Cart bar */}
      <path
        d="M8 16 L16 16 L22 46"
        stroke="#16a34a"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Cart body */}
      <path
        d="M20 22 L60 22 L56 46 H24 Z"
        fill="#dcfce7"
        stroke="#16a34a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Wheels */}
      <circle cx="30" cy="56" r="5" fill="#16a34a" />
      <circle cx="52" cy="56" r="5" fill="#16a34a" />
      {/* Items in cart */}
      <rect
        x="26"
        y="26"
        width="10"
        height="14"
        rx="2"
        fill="#86efac"
        stroke="#16a34a"
        strokeWidth="1"
      />
      <rect
        x="39"
        y="26"
        width="10"
        height="14"
        rx="2"
        fill="#86efac"
        stroke="#16a34a"
        strokeWidth="1"
      />
    </svg>
  )
}

export function ClipboardIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full" aria-hidden="true">
      {/* Clipboard body */}
      <rect
        x="14"
        y="20"
        width="52"
        height="52"
        rx="4"
        fill="#dcfce7"
        stroke="#16a34a"
        strokeWidth="1.5"
      />
      {/* Clip */}
      <rect x="28" y="14" width="24" height="12" rx="4" fill="#16a34a" />
      <rect x="32" y="16" width="16" height="8" rx="2" fill="#dcfce7" />
      {/* Lines */}
      <line
        x1="22"
        y1="38"
        x2="58"
        y2="38"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="46"
        x2="58"
        y2="46"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="54"
        x2="44"
        y2="54"
        stroke="#86efac"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CalendarIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full" aria-hidden="true">
      {/* Calendar body */}
      <rect
        x="10"
        y="20"
        width="60"
        height="50"
        rx="6"
        fill="#dcfce7"
        stroke="#16a34a"
        strokeWidth="1.5"
      />
      {/* Header band */}
      <path d="M10 26 Q10 20 16 20 H64 Q70 20 70 26 V36 H10 Z" fill="#16a34a" />
      {/* Ring pins */}
      <circle cx="26" cy="18" r="3.5" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
      <circle cx="54" cy="18" r="3.5" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
      {/* Day cells row 1 */}
      <rect x="15" y="42" width="10" height="8" rx="2" fill="#86efac" />
      <rect x="29" y="42" width="10" height="8" rx="2" fill="#86efac" />
      <rect x="43" y="42" width="10" height="8" rx="2" fill="#86efac" />
      <rect x="57" y="42" width="8" height="8" rx="2" fill="#86efac" />
      {/* Day cells row 2 */}
      <rect x="15" y="55" width="10" height="8" rx="2" fill="#bbf7d0" />
      <rect x="29" y="55" width="10" height="8" rx="2" fill="#bbf7d0" />
      <rect x="43" y="55" width="10" height="8" rx="2" fill="#bbf7d0" />
    </svg>
  )
}

export function HeartIllustration() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="w-full h-full" aria-hidden="true">
      {/* Heart */}
      <path
        d="M40 66 C40 66 12 48 12 28 C12 19 18.5 13 27 13 C32 13 36.5 16 40 20 C43.5 16 48 13 53 13 C61.5 13 68 19 68 28 C68 48 40 66 40 66 Z"
        fill="#dcfce7"
        stroke="#16a34a"
        strokeWidth="1.5"
      />
      {/* Inner highlight */}
      <path
        d="M23 26 C23 21 29 19 32 22"
        stroke="#86efac"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Sparkle top-right */}
      <line
        x1="63"
        y1="15"
        x2="63"
        y2="22"
        stroke="#16a34a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="59.5"
        y1="18.5"
        x2="66.5"
        y2="18.5"
        stroke="#16a34a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Sparkle bottom-left */}
      <line
        x1="17"
        y1="53"
        x2="17"
        y2="60"
        stroke="#16a34a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="13.5"
        y1="56.5"
        x2="20.5"
        y2="56.5"
        stroke="#16a34a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
