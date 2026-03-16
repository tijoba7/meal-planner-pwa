export type UnitSystem = 'imperial' | 'metric'

export const UNIT_SYSTEM_KEY = 'unitSystem'

// ─── Conversion tables ────────────────────────────────────────────────────────

/** Imperial volume units → ml */
const IMPERIAL_VOL_TO_ML: Record<string, number> = {
  cup: 240,
  cups: 240,
  c: 240,
  tbsp: 14.787,
  tablespoon: 14.787,
  tablespoons: 14.787,
  tbs: 14.787,
  tsp: 4.929,
  teaspoon: 4.929,
  teaspoons: 4.929,
  ts: 4.929,
  'fl oz': 29.574,
  'fl. oz': 29.574,
  'fl. oz.': 29.574,
  floz: 29.574,
  pint: 473.176,
  pints: 473.176,
  pt: 473.176,
  pts: 473.176,
  quart: 946.353,
  quarts: 946.353,
  qt: 946.353,
  qts: 946.353,
  gallon: 3785.41,
  gallons: 3785.41,
  gal: 3785.41,
}

/** Imperial weight units → grams */
const IMPERIAL_WT_TO_G: Record<string, number> = {
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
}

/** Metric volume units → ml */
const METRIC_VOL_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
}

/** Metric weight units → grams */
const METRIC_WT_TO_G: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  gramme: 1,
  grammes: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  kilogramme: 1000,
  kilogrammes: 1000,
}

// ─── Direction: ml → imperial display unit ───────────────────────────────────

function mlToImperial(ml: number): { amount: number; unit: string } {
  if (ml >= 946) return { amount: ml / 946.353, unit: 'qt' }
  if (ml >= 236) return { amount: ml / 240, unit: 'cup' }
  if (ml >= 14) return { amount: ml / 14.787, unit: 'tbsp' }
  return { amount: ml / 4.929, unit: 'tsp' }
}

// ─── Direction: g → imperial display unit ────────────────────────────────────

function gToImperial(g: number): { amount: number; unit: string } {
  if (g >= 453) return { amount: g / 453.592, unit: 'lb' }
  return { amount: g / 28.3495, unit: 'oz' }
}

// ─── Direction: ml → metric display unit ─────────────────────────────────────

function mlToMetric(ml: number): { amount: number; unit: string } {
  if (ml >= 1000) return { amount: ml / 1000, unit: 'L' }
  return { amount: ml, unit: 'ml' }
}

// ─── Direction: g → metric display unit ──────────────────────────────────────

function gToMetric(g: number): { amount: number; unit: string } {
  if (g >= 1000) return { amount: g / 1000, unit: 'kg' }
  return { amount: g, unit: 'g' }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert an ingredient amount + unit to the target unit system.
 * Returns the original values unchanged when the unit is not recognised
 * (e.g. "pinch", "clove", "sprig").
 */
export function convertUnit(
  amount: number,
  unit: string,
  system: UnitSystem,
): { amount: number; unit: string } {
  if (!unit || amount === 0) return { amount, unit }

  const key = unit.toLowerCase().trim()

  if (system === 'metric') {
    if (key in IMPERIAL_VOL_TO_ML) {
      return mlToMetric(amount * IMPERIAL_VOL_TO_ML[key])
    }
    if (key in IMPERIAL_WT_TO_G) {
      return gToMetric(amount * IMPERIAL_WT_TO_G[key])
    }
    // Handle °F → °C
    if (key === '°f' || key === 'f' || key === 'fahrenheit') {
      return { amount: (amount - 32) * (5 / 9), unit: '°C' }
    }
    // Already metric or not convertible — return as-is
    return { amount, unit }
  }

  // system === 'imperial'
  if (key in METRIC_VOL_TO_ML) {
    return mlToImperial(amount * METRIC_VOL_TO_ML[key])
  }
  if (key in METRIC_WT_TO_G) {
    return gToImperial(amount * METRIC_WT_TO_G[key])
  }
  // Handle °C → °F
  if (key === '°c' || key === 'c' || key === 'celsius') {
    return { amount: amount * (9 / 5) + 32, unit: '°F' }
  }
  // Already imperial or not convertible — return as-is
  return { amount, unit }
}

/** Read the stored unit system (safe to call outside React). */
export function getUnitPreference(): UnitSystem {
  return (localStorage.getItem(UNIT_SYSTEM_KEY) as UnitSystem) ?? 'imperial'
}
