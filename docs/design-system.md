# Mise Design System

> "Everything in its place." — clean, warm, approachable. Not corporate. Not playful.

Tailwind CSS 4 · React · Lucide React icons · Mobile-first · Local-first PWA

---

## 1. Color Palette

All colors are Tailwind utility classes. Design tokens are declared in `src/index.css` via `@theme`.

### Brand / Primary

| Role | Class | Hex | Usage |
|---|---|---|---|
| Primary action | `green-600` | #16a34a | CTA buttons, active nav links, focus rings, step badges |
| Primary hover | `green-700` | #15803d | Hover state for green-600 elements |
| Primary light bg | `green-50` | #f0fdf4 | Tag backgrounds, active sidebar item bg, success banners |
| Primary light text | `green-700` | #15803d | Tag text, active sidebar item text, brand title |
| Primary muted | `green-100` | #dcfce7 | Step number badge background in form/edit context |
| Progress fill | `green-500` | #22c55e | Progress bars only (slightly lighter than primary) |

### Neutral / Surface

| Role | Class | Hex | Usage |
|---|---|---|---|
| Page background | `gray-50` | #f9fafb | App background |
| Card / surface | `white` | #ffffff | Cards, modals, sidebar, header, tab bar |
| Border | `gray-200` | #e5e7eb | Card borders, input borders, dividers between sections |
| Divider (internal) | `gray-100` | #f3f4f6 | Row dividers inside cards |
| Input hover bg | `gray-100` | #f3f4f6 | Hover bg for nav items, subtle interactive areas |

### Text

| Role | Class | Hex | Usage |
|---|---|---|---|
| Heading | `gray-800` | #1f2937 | Page headings, card titles, primary labels |
| Label | `gray-700` | #374151 | Form labels, section sub-headings |
| Body | `gray-600` | #4b5563 | Descriptive body text, ingredient names, instructions |
| Secondary | `gray-500` | #6b7280 | Supporting metadata, subtitles |
| Muted | `gray-400` | #9ca3af | Placeholders, captions, disabled-state text, nav inactive |
| Subtle | `gray-300` | #d1d5db | Checked/completed item metadata |

### Semantic

| Role | Class | Usage |
|---|---|---|
| Danger fill | `red-500` | Filled delete/destructive buttons |
| Danger fill hover | `red-600` | Hover on filled danger buttons |
| Danger border | `red-300` | Outlined danger button border |
| Danger muted | `red-400` | Ghost danger icon buttons (remove) |
| Danger light | `red-50` | Hover background for danger icon buttons |
| Warning bg | `amber-50` | Warning/info banners |
| Warning border | `amber-200` | Warning/info banner border |
| Warning text | `amber-800` | Warning banner heading |
| Warning body | `amber-700` | Warning banner body text |
| Warning action | `amber-600` | Warning CTA button fill |
| Warning action hover | `amber-700` | Warning CTA button hover |
| Error inline | `red-500` | Inline validation error text |
| Error banner bg | `red-50` | Inline error box background |
| Error banner border | `red-200` | Inline error box border |
| Success banner bg | `green-50` | Success notice background |
| Success banner border | `green-200` | Success notice border |
| Success banner text | `green-700` | Success notice text |

---

## 2. Typography

System font stack. No custom fonts.

### Scale

| Role | Classes | Where used |
|---|---|---|
| Page heading | `text-2xl font-bold text-gray-800` | `<h2>` top of each page |
| Section heading | `text-lg font-semibold text-gray-800` | `<h3>` within a page section |
| Card title | `font-semibold text-gray-800` | Recipe card name, list item name |
| Subsection heading | `text-sm font-semibold text-gray-700` | Form section labels, card sub-headers |
| Label | `text-sm font-medium text-gray-700` | `<label>` elements |
| Body | `text-sm text-gray-600` | General body text, descriptions |
| Secondary | `text-sm text-gray-500` | Metadata, supporting text |
| Caption | `text-xs text-gray-400` | Timestamps, hints, nav labels |
| Section overline | `text-xs font-medium text-gray-400 uppercase tracking-wider` | "Checked off" section headers |

---

## 3. Icons

Icon library: **Lucide React** (`lucide-react`). No emojis in UI chrome.

### Usage

```tsx
import { BookOpen, X, ShoppingCart } from 'lucide-react'

// Navigation icon (sidebar)
<BookOpen size={16} strokeWidth={1.75} aria-hidden="true" />

// Navigation icon (mobile tab bar)
<BookOpen size={20} strokeWidth={1.75} aria-hidden="true" />

// Inline / action icon
<X size={14} strokeWidth={2} aria-hidden="true" />

// Empty state icon
<ShoppingCart size={36} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" aria-hidden="true" />
```

### Sizing conventions

| Context | `size` | `strokeWidth` |
|---|---|---|
| Desktop sidebar nav | 16 | 1.75 |
| Mobile tab bar nav | 20 | 1.75 |
| Close / remove (small) | 14 | 2 |
| Modal close | 20 | 2 |
| Empty state illustration | 36 | 1.5 |

### Navigation icons

| Tab | Icon |
|---|---|
| Recipes | `BookOpen` |
| Meal Plan | `CalendarDays` |
| Shopping | `ShoppingCart` |
| Settings | `Settings` |

Always add `aria-hidden="true"` on icons — visible labels provide the accessible name.

---

## 4. Spacing

### Page Container

All pages use the same container:
```
p-4 max-w-2xl mx-auto
```

Add `pb-8` or `pb-10` on detail/form pages to avoid content hiding behind the mobile tab bar.

### Section Gaps

| Purpose | Class |
|---|---|
| Between page heading and first content | `mb-4` |
| Between major sections | `mb-6` |
| Between cards in a list | `space-y-3` |
| Between form fields | `space-y-6` |
| Between form sub-items (ingredients, steps) | `space-y-2` |

### Card Padding

| Context | Classes |
|---|---|
| Standard card content | `p-4` |
| Compact card row | `px-4 py-3` |
| Modal content area | `p-4` |
| Confirmation dialog | `p-6` |

---

## 5. Component Patterns

### Cards

**Standard card:**
```
bg-white rounded-xl border border-gray-200
```
Add `hover:shadow-sm transition-shadow` for clickable cards.

**Card with pinned header:**
```html
<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
  <div class="px-4 py-2 bg-gray-50 border-b border-gray-200">
    <!-- header -->
  </div>
  <div class="divide-y divide-gray-100">
    <!-- rows -->
  </div>
</div>
```

**Settings / info card (divided sections):**
```
bg-white rounded-xl border border-gray-200 divide-y divide-gray-100
```

### Buttons

**Primary (compact):**
```
bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg
hover:bg-green-700 transition-colors
```
Use for page-level CTAs inline with a heading row (e.g., "+ Add Recipe").

**Primary (full-width / prominent):**
```
w-full bg-green-600 text-white font-semibold py-3 rounded-xl
hover:bg-green-700 transition-colors disabled:opacity-50
```
Use for form submit buttons and primary modal actions.

**Secondary (outlined, gray):**
```
border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg
hover:bg-gray-50 transition-colors
```
Use for Cancel / secondary actions next to a primary.

**Secondary (outlined, full-width):**
```
border border-gray-200 text-sm text-gray-600 px-5 py-3 rounded-xl
hover:bg-gray-50 transition-colors disabled:opacity-50
```
Use as a sibling to full-width primary in a `flex gap-3` container.

**Green outlined:**
```
text-sm font-medium text-green-600 border border-green-600 px-3 py-1.5 rounded-lg
hover:bg-green-50 transition-colors
```
Use for secondary actions on a detail page (e.g., Edit button).

**Danger outlined:**
```
text-sm font-medium text-red-500 border border-red-300 px-3 py-1.5 rounded-lg
hover:bg-red-50 transition-colors
```
Use for destructive secondary actions on a detail page (e.g., Delete button).

**Danger filled:**
```
bg-red-500 text-white text-sm font-medium py-2 rounded-lg
hover:bg-red-600 transition-colors disabled:opacity-50
```
Use inside confirmation dialogs.

**Ghost / text link:**
```
text-sm text-green-600 hover:text-green-700 font-medium
```
Use for "Back" navigation and inline additive actions ("+ Add ingredient").

**Icon close button (modal header):**
```tsx
<button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
  <X size={20} strokeWidth={2} aria-hidden="true" />
</button>
```

**Ghost remove button (row items):**
```tsx
<button
  onClick={onRemove}
  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
  aria-label="Remove item"
>
  <X size={14} strokeWidth={2} aria-hidden="true" />
</button>
```

**Navigation arrow (prev/next):**
```
p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xl font-bold leading-none
```

### Inputs

**Standard text/search/date input:**
```
border border-gray-200 rounded-lg px-3 py-2 text-sm
focus:outline-none focus:ring-2 focus:ring-green-500
```

**Textarea:**
```
border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none
focus:outline-none focus:ring-2 focus:ring-green-500
```

**Checkbox (unchecked):**
```
w-5 h-5 rounded border-2 border-gray-300 hover:border-green-500 transition-colors
```

**Checkbox (checked):**
```
w-5 h-5 rounded border-2 border-green-500 bg-green-500
flex items-center justify-center text-white text-xs
```

**Form label:**
```
block text-sm font-medium text-gray-700 mb-1
```

**Hint text:**
```
text-xs text-gray-400 mt-1
```

**Validation error:**
```
text-red-500 text-xs mt-1
```

### Tags / Badges

**Keyword tag:**
```
bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full
```

**Numbered step badge (detail view, filled):**
```
shrink-0 w-6 h-6 bg-green-600 text-white rounded-full
flex items-center justify-center text-xs font-bold
```

**Numbered step badge (form/edit, light):**
```
shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full
flex items-center justify-center text-xs font-bold
```

### Modals

**Bottom sheet (mobile) / centered (sm+):**
```html
<!-- Backdrop -->
<div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
  <!-- Sheet -->
  <div class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh]">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-gray-800">Title</h3>
        <!-- Use Lucide X via React: <X size={20} strokeWidth={2} /> -->
      </div>
    </div>
    <!-- Scrollable body -->
    <div class="overflow-y-auto flex-1 p-4">…</div>
  </div>
</div>
```

**Confirmation dialog (centered, small):**
```html
<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
  <div class="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full shadow-xl">
    <h4 class="text-lg font-semibold text-gray-800 mb-2">Confirm title?</h4>
    <p class="text-sm text-gray-500 mb-6">Destructive action description.</p>
    <div class="flex gap-3">
      <button class="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancel</button>
      <button class="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600">Delete</button>
    </div>
  </div>
</div>
```

### Navigation

**Mobile bottom tab bar:**
```
fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around z-10
```

Active tab: `text-green-600`
Inactive tab: `text-gray-500 hover:text-gray-700`

**Desktop sidebar:**
```
hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-200 min-h-screen
```

Active sidebar link: `bg-green-50 text-green-700`
Inactive sidebar link: `text-gray-600 hover:bg-gray-100 hover:text-gray-800`

### Empty States

Use the `EmptyState` component (`src/components/EmptyState.tsx`) for all empty states. It accepts a Lucide icon, title, optional description, and optional CTA action.

```tsx
import EmptyState from '../components/EmptyState'
import { BookOpen, Search, ShoppingCart } from 'lucide-react'

// With CTA link
<EmptyState
  icon={BookOpen}
  title="No recipes yet"
  description="Add your first recipe to get started planning meals."
  action={{ label: 'Add your first recipe', href: '/recipes/new' }}
/>

// With CTA button (onClick)
<EmptyState
  icon={ShoppingCart}
  title="No shopping lists yet"
  description="Create one from your meal plan to auto-generate your grocery list."
  action={{ label: 'Create a list', onClick: () => setShowCreate(true) }}
/>

// No CTA (informational only)
<EmptyState
  icon={Search}
  title="No results found"
  description="Try a different search term."
/>
```

**Visual spec:** icon is rendered at `size={36} strokeWidth={1.5}` in `text-green-400` inside a `w-20 h-20 rounded-full bg-green-50` circle. CTA button uses the standard primary button style (`bg-green-600 px-5 py-2.5 rounded-lg`).

**Empty state icons by context:**

| Context | Icon |
|---|---|
| No recipes | `BookOpen` |
| No search results | `Search` |
| No shopping lists | `ShoppingCart` |
| Empty shopping list | `ClipboardList` |
| No meal plan slots | `CalendarDays` |

### Progress Bar

```html
<div class="w-full bg-gray-200 rounded-full h-2">
  <div class="bg-green-500 h-2 rounded-full transition-all" style="width: 60%"></div>
</div>
```

Use `h-2` (8px) for detail view, `h-1.5` (6px) for list card preview.

### Loading Spinner

```html
<div class="inline-block w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
```

### Banner / Alert

**Success:**
```
bg-green-50 border border-green-200 rounded-xl p-4
```
Text: `text-sm text-green-700 font-medium`

**Warning:**
```
bg-amber-50 border border-amber-200 rounded-xl p-5 text-center
```
Heading: `text-amber-800 font-medium mb-1`
Body: `text-sm text-amber-700 mb-4`

**Error (inline form):**
```
text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2
```

---

## 6. Responsive Breakpoints

Mobile-first. Single breakpoint: `md:` (768px).

| Context | Mobile | Desktop (`md:`) |
|---|---|---|
| Layout | Single column, bottom tab bar | Sidebar + content area |
| Modal | Bottom sheet (`items-end`, `rounded-t-2xl`) | Centered (`items-center`, `rounded-2xl`, `sm:p-4`) |
| Sidebar | Hidden (`hidden`) | Visible (`md:flex`) |
| Mobile header | Visible | Hidden (`md:hidden`) |
| Main content padding | `pb-20` (clears tab bar) | `pb-0` |

**Note:** the modal breakpoint uses `sm:` (640px) rather than `md:` for earlier centering on tablet-size screens.

---

## 7. Accessibility

- **Focus rings:** all interactive elements use `focus:outline-none focus:ring-2 focus:ring-green-500`
- **Aria labels:** icon-only buttons must have `aria-label`; decorative icons must have `aria-hidden="true"`
- **Disabled state:** `disabled:opacity-50 disabled:cursor-not-allowed`
- **Contrast:** `green-600` on white meets WCAG AA (4.5:1 for normal text). `gray-400` (#9ca3af) on white is 2.85:1 — use only for non-essential decorative text and captions.
- **Loading text:** always provide a text alternative adjacent to spinners
- **Form errors:** render `<p class="text-red-500 text-xs mt-1">` immediately after the relevant input

---

## 8. Audit Changes (MEA-21)

Changes applied during the initial design system establishment pass:

| # | File | Change |
|---|---|---|
| 1 | `src/index.css` | Added `@theme` block with `--color-brand-*` tokens |
| 2 | `src/components/Layout.tsx` | Replaced emoji nav icons (📖 📅 🛒 ⚙️) with Lucide React (`BookOpen`, `CalendarDays`, `ShoppingCart`, `Settings`) |
| 3 | `src/pages/ShoppingListPage.tsx` | Replaced 🛒 empty-state emoji with `<ShoppingCart>` Lucide icon |
| 4 | `src/pages/ShoppingListPage.tsx` | Replaced `&times;` remove/close chars with `<X size={14}>` and `<X size={20}>` Lucide icons |
| 5 | `src/pages/PlannerPage.tsx` | Replaced `×` remove/close chars with Lucide `<X>` icons |
| 6 | `src/pages/RecipeFormPage.tsx` | Replaced ✕ remove chars (ingredients, steps) with Lucide `<X size={14}>` |
| 7 | `src/pages/RecipeDetailPage.tsx` | Fixed delete confirm modal card: `rounded-2xl` → `rounded-xl border border-gray-200` to match card pattern |
