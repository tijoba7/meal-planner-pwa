import { useState, useRef, useEffect } from 'react'
import type { MealType } from '../../types'

export type DragSource = { date: string; meal: MealType; index: number }

export interface PlannerDragDropHandlers {
  dragSource: DragSource | null
  dragOver: { date: string; meal: MealType } | null
  handleDragStart: (e: React.DragEvent, date: string, meal: MealType, index: number) => void
  handleDragEnd: () => void
  handleSlotDragOver: (e: React.DragEvent, date: string, meal: MealType) => void
  handleSlotDragLeave: (e: React.DragEvent) => void
  handleSlotDrop: (
    e: React.DragEvent,
    tgtDate: string,
    tgtMeal: MealType,
    onMove: (srcDate: string, srcMeal: MealType, srcIndex: number, tgtDate: string, tgtMeal: MealType) => void
  ) => void
  handleRecipeTouchStart: (
    _e: React.TouchEvent,
    date: string,
    meal: MealType,
    index: number
  ) => void
  handleRecipeTouchEnd: (
    e: React.TouchEvent,
    onMove: (srcDate: string, srcMeal: MealType, srcIndex: number, tgtDate: string, tgtMeal: MealType) => void
  ) => void
}

export function usePlannerDragDrop(): PlannerDragDropHandlers {
  const [dragSource, setDragSource] = useState<DragSource | null>(null)
  const [dragOver, setDragOver] = useState<{ date: string; meal: MealType } | null>(null)
  const isDraggingRef = useRef(false)
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchSourceRef = useRef<DragSource | null>(null)

  // Non-passive touchmove listener: prevents page scroll while touch-dragging
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault()
        const touch = e.touches[0]
        const el = document.elementFromPoint(touch.clientX, touch.clientY)
        const zone = (el as HTMLElement | null)?.closest('[data-drop-date]') as HTMLElement | null
        if (zone) {
          const date = zone.dataset.dropDate!
          const meal = zone.dataset.dropMeal as MealType
          setDragOver((prev) =>
            prev?.date === date && prev?.meal === meal ? prev : { date, meal }
          )
        } else {
          setDragOver(null)
        }
      } else if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current)
        touchTimerRef.current = null
      }
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => document.removeEventListener('touchmove', onTouchMove)
  }, [])

  function handleDragStart(e: React.DragEvent, date: string, meal: MealType, index: number) {
    setDragSource({ date, meal, index })
    isDraggingRef.current = true
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd() {
    setDragSource(null)
    setDragOver(null)
    isDraggingRef.current = false
  }

  function handleSlotDragOver(e: React.DragEvent, date: string, meal: MealType) {
    if (!isDraggingRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver((prev) => (prev?.date === date && prev?.meal === meal ? prev : { date, meal }))
  }

  function handleSlotDragLeave(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOver(null)
    }
  }

  function handleSlotDrop(
    e: React.DragEvent,
    tgtDate: string,
    tgtMeal: MealType,
    onMove: (srcDate: string, srcMeal: MealType, srcIndex: number, tgtDate: string, tgtMeal: MealType) => void
  ) {
    e.preventDefault()
    if (!dragSource) return
    onMove(dragSource.date, dragSource.meal, dragSource.index, tgtDate, tgtMeal)
    setDragSource(null)
    setDragOver(null)
    isDraggingRef.current = false
  }

  function handleRecipeTouchStart(
    _e: React.TouchEvent,
    date: string,
    meal: MealType,
    index: number
  ) {
    touchSourceRef.current = { date, meal, index }
    touchTimerRef.current = setTimeout(() => {
      isDraggingRef.current = true
      setDragSource({ date, meal, index })
      if (navigator.vibrate) navigator.vibrate(30)
    }, 300)
  }

  function handleRecipeTouchEnd(
    e: React.TouchEvent,
    onMove: (srcDate: string, srcMeal: MealType, srcIndex: number, tgtDate: string, tgtMeal: MealType) => void
  ) {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
    if (isDraggingRef.current && touchSourceRef.current) {
      const touch = e.changedTouches[0]
      const el = document.elementFromPoint(touch.clientX, touch.clientY)
      const zone = (el as HTMLElement | null)?.closest('[data-drop-date]') as HTMLElement | null
      if (zone) {
        const tgtDate = zone.dataset.dropDate!
        const tgtMeal = zone.dataset.dropMeal as MealType
        onMove(
          touchSourceRef.current.date,
          touchSourceRef.current.meal,
          touchSourceRef.current.index,
          tgtDate,
          tgtMeal
        )
      }
    }
    isDraggingRef.current = false
    touchSourceRef.current = null
    setDragSource(null)
    setDragOver(null)
  }

  return {
    dragSource,
    dragOver,
    handleDragStart,
    handleDragEnd,
    handleSlotDragOver,
    handleSlotDragLeave,
    handleSlotDrop,
    handleRecipeTouchStart,
    handleRecipeTouchEnd,
  }
}
