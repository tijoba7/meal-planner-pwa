import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShoppingItemRow from './ShoppingItem'
import type { ShoppingItem } from '../../types'

type TouchPoint = { clientX: number; clientY: number }

function dispatchTouch(
  target: Element,
  type: 'touchstart' | 'touchmove' | 'touchend',
  {
    touches = [],
    changedTouches = [],
  }: {
    touches?: TouchPoint[]
    changedTouches?: TouchPoint[]
  }
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: touches,
    configurable: true,
  })
  Object.defineProperty(event, 'changedTouches', {
    value: changedTouches,
    configurable: true,
  })
  target.dispatchEvent(event)
}

function renderItem(overrides: Partial<ShoppingItem> = {}) {
  const onToggle = vi.fn()
  const onRemove = vi.fn()
  const onCategoryChange = vi.fn()
  const onAmountChange = vi.fn()

  const item: ShoppingItem = {
    id: 'item-1',
    name: 'Apples',
    amount: 2,
    unit: 'cup',
    checked: false,
    category: 'Produce',
    ...overrides,
  }

  render(
    <ShoppingItemRow
      item={item}
      onToggle={onToggle}
      onRemove={onRemove}
      onCategoryChange={onCategoryChange}
      onAmountChange={onAmountChange}
      unitSystem="imperial"
    />
  )

  const checkButton = screen.getByRole('button', { name: `Check ${item.name}` })
  const swipeRow = checkButton.parentElement as HTMLElement
  const deleteButton = screen.getByRole('button', {
    name: `Delete ${item.name}`,
    hidden: true,
  })

  return {
    onToggle,
    onRemove,
    onCategoryChange,
    onAmountChange,
    checkButton,
    swipeRow,
    deleteButton,
  }
}

describe('ShoppingItemRow', () => {
  it('marks item checked on a right-swipe gesture', () => {
    const { onToggle, swipeRow } = renderItem()

    act(() => {
      dispatchTouch(swipeRow, 'touchstart', {
        touches: [{ clientX: 100, clientY: 100 }],
      })
      dispatchTouch(swipeRow, 'touchmove', {
        touches: [{ clientX: 170, clientY: 102 }],
      })
      dispatchTouch(swipeRow, 'touchend', {
        changedTouches: [{ clientX: 170, clientY: 102 }],
      })
    })

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('disables transition during horizontal swipe and restores it on release', async () => {
    const { swipeRow } = renderItem()

    act(() => {
      dispatchTouch(swipeRow, 'touchstart', {
        touches: [{ clientX: 220, clientY: 100 }],
      })
      dispatchTouch(swipeRow, 'touchmove', {
        touches: [{ clientX: 140, clientY: 103 }],
      })
    })

    await waitFor(() => {
      expect(swipeRow.style.transition).toBe('none')
    })

    act(() => {
      dispatchTouch(swipeRow, 'touchend', {
        changedTouches: [{ clientX: 140, clientY: 103 }],
      })
    })

    await waitFor(() => {
      expect(swipeRow.style.transition).toBe('transform 0.22s ease')
    })
  })

  it('reveals delete action after left swipe and closes on check tap without toggling', async () => {
    const user = userEvent.setup()
    const { onToggle, checkButton, swipeRow, deleteButton } = renderItem()

    act(() => {
      dispatchTouch(swipeRow, 'touchstart', {
        touches: [{ clientX: 220, clientY: 100 }],
      })
      dispatchTouch(swipeRow, 'touchmove', {
        touches: [{ clientX: 130, clientY: 101 }],
      })
    })

    await waitFor(() => {
      expect(swipeRow.style.transform).toBe('translateX(-80px)')
    })

    act(() => {
      dispatchTouch(swipeRow, 'touchend', {
        changedTouches: [{ clientX: 130, clientY: 101 }],
      })
    })

    await waitFor(() => {
      expect(deleteButton).toHaveAttribute('tabindex', '0')
      expect(swipeRow.style.transform).toBe('translateX(-80px)')
    })

    await user.click(checkButton)

    expect(onToggle).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(deleteButton).toHaveAttribute('tabindex', '-1')
      expect(swipeRow.style.transform).toBe('translateX(0px)')
    })
  })
})
