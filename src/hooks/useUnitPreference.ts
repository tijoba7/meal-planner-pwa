import { useState } from 'react'
import { UNIT_SYSTEM_KEY, type UnitSystem } from '../lib/units'

/**
 * Read and write the user's preferred unit system (imperial/metric).
 * The preference is persisted in localStorage under `unitSystem`.
 */
export function useUnitPreference(): [UnitSystem, (system: UnitSystem) => void] {
  const [system, setSystemState] = useState<UnitSystem>(
    () => (localStorage.getItem(UNIT_SYSTEM_KEY) as UnitSystem) ?? 'imperial'
  )

  function setSystem(s: UnitSystem) {
    setSystemState(s)
    localStorage.setItem(UNIT_SYSTEM_KEY, s)
  }

  return [system, setSystem]
}
