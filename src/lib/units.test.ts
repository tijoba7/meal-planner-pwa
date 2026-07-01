import { describe, it, expect, beforeEach } from 'vitest'
import {
  volumeToMl,
  weightToG,
  mlToDisplayUnit,
  gToDisplayUnit,
  convertUnit,
  getUnitPreference,
  UNIT_SYSTEM_KEY,
} from './units'

describe('volumeToMl', () => {
  it('converts imperial volume units to ml', () => {
    expect(volumeToMl(1, 'cup')).toBeCloseTo(240)
    expect(volumeToMl(2, 'tbsp')).toBeCloseTo(29.574)
    expect(volumeToMl(1, 'gallon')).toBeCloseTo(3785.41)
  })

  it('converts metric volume units to ml', () => {
    expect(volumeToMl(1, 'l')).toBe(1000)
    expect(volumeToMl(250, 'ml')).toBe(250)
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(volumeToMl(1, ' CUP ')).toBeCloseTo(240)
    expect(volumeToMl(1, 'Tablespoon')).toBeCloseTo(14.787)
  })

  it('returns null for non-volume units', () => {
    expect(volumeToMl(1, 'oz')).toBeNull()
    expect(volumeToMl(1, 'pinch')).toBeNull()
    expect(volumeToMl(1, '')).toBeNull()
  })
})

describe('weightToG', () => {
  it('converts imperial weight units to grams', () => {
    expect(weightToG(1, 'oz')).toBeCloseTo(28.3495)
    expect(weightToG(1, 'lb')).toBeCloseTo(453.592)
  })

  it('converts metric weight units to grams', () => {
    expect(weightToG(1, 'kg')).toBe(1000)
    expect(weightToG(500, 'g')).toBe(500)
  })

  it('returns null for non-weight units', () => {
    expect(weightToG(1, 'cup')).toBeNull()
    expect(weightToG(1, 'clove')).toBeNull()
  })
})

describe('mlToDisplayUnit / gToDisplayUnit', () => {
  it('round-trips a volume conversion', () => {
    const ml = volumeToMl(2, 'cups')!
    expect(mlToDisplayUnit(ml, 'cup')).toBeCloseTo(2)
  })

  it('round-trips a weight conversion', () => {
    const g = weightToG(3, 'oz')!
    expect(gToDisplayUnit(g, 'oz')).toBeCloseTo(3)
  })

  it('returns the base value unchanged for unrecognized units', () => {
    expect(mlToDisplayUnit(500, 'pinch')).toBe(500)
    expect(gToDisplayUnit(500, 'sprig')).toBe(500)
  })
})

describe('convertUnit', () => {
  it('converts imperial volume to metric', () => {
    const { amount, unit } = convertUnit(1, 'cup', 'metric')
    expect(unit).toBe('ml')
    expect(amount).toBeCloseTo(240)
  })

  it('promotes large metric volumes to liters', () => {
    const { amount, unit } = convertUnit(5, 'cups', 'metric')
    expect(unit).toBe('L')
    expect(amount).toBeCloseTo((5 * 240) / 1000)
  })

  it('keeps small imperial weights in grams when converting to metric', () => {
    const { amount, unit } = convertUnit(2, 'lb', 'metric')
    expect(unit).toBe('g')
    expect(amount).toBeCloseTo(2 * 453.592)
  })

  it('promotes large imperial weights to kilograms', () => {
    const { amount, unit } = convertUnit(3, 'lb', 'metric')
    expect(unit).toBe('kg')
    expect(amount).toBeCloseTo((3 * 453.592) / 1000)
  })

  it('converts metric volume to imperial', () => {
    const { unit } = convertUnit(1, 'l', 'imperial')
    expect(unit).toBe('qt')
  })

  it('converts metric weight to imperial', () => {
    const { unit } = convertUnit(1, 'kg', 'imperial')
    expect(unit).toBe('lb')
  })

  it('converts Fahrenheit to Celsius', () => {
    const { amount, unit } = convertUnit(212, '°F', 'metric')
    expect(unit).toBe('°C')
    expect(amount).toBeCloseTo(100)
  })

  it('converts Celsius to Fahrenheit', () => {
    const { amount, unit } = convertUnit(100, '°C', 'imperial')
    expect(unit).toBe('°F')
    expect(amount).toBeCloseTo(212)
  })

  it('leaves unrecognized units unchanged', () => {
    expect(convertUnit(3, 'cloves', 'metric')).toEqual({ amount: 3, unit: 'cloves' })
  })

  it('returns input unchanged when amount is zero or unit is empty', () => {
    expect(convertUnit(0, 'cup', 'metric')).toEqual({ amount: 0, unit: 'cup' })
    expect(convertUnit(5, '', 'metric')).toEqual({ amount: 5, unit: '' })
  })

  it('leaves already-metric units unchanged in metric system', () => {
    expect(convertUnit(200, 'ml', 'metric')).toEqual({ amount: 200, unit: 'ml' })
  })
})

describe('getUnitPreference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to imperial when nothing is stored', () => {
    expect(getUnitPreference()).toBe('imperial')
  })

  it('reads the stored preference', () => {
    localStorage.setItem(UNIT_SYSTEM_KEY, 'metric')
    expect(getUnitPreference()).toBe('metric')
  })
})
