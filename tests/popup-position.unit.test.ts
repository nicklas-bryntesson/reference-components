import { describe, it, expect } from 'vitest'
import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../src/js/popup-position'

describe('calculatePopupOffset', () => {
  it('centers bubble when trigger is in the middle of the container', () => {
    expect(calculatePopupOffset(500, 0, 1000, 200, 1200)).toBeCloseTo(50)
  })

  it('clamps to minimum when trigger is near left edge', () => {
    expect(calculatePopupOffset(50, 0, 1000, 200, 1200)).toBeCloseTo(10)
  })

  it('clamps at viewport right edge', () => {
    expect(calculatePopupOffset(1150, 0, 1000, 200, 1200)).toBeCloseTo(110)
  })

  it('respects viewportInset on left edge — bubble stays inset px from viewport left', () => {
    expect(calculatePopupOffset(10, -590, 1200, 200, 1200, 12)).toBeCloseTo(58.5)
  })

  it('respects viewportInset on right edge — bubble stays inset px from viewport right', () => {
    expect(calculatePopupOffset(1190, 590, 1200, 200, 1200, 12)).toBeCloseTo(41.5)
  })
})

describe('calculateArrowOffset', () => {
  it('returns 0 when popup is perfectly centered on trigger', () => {
    expect(calculateArrowOffset(500, 400, 200, 16, 12)).toBe(0)
  })

  it('clamps to positive limit when trigger is far right of popup center', () => {
    expect(calculateArrowOffset(600, 400, 200, 16, 12)).toBeCloseTo(78)
  })

  it('clamps to negative limit when trigger is far left of popup center', () => {
    expect(calculateArrowOffset(400, 400, 200, 16, 12)).toBeCloseTo(-78)
  })
})

describe('detectDirection', () => {
  it('returns "top" when more space above', () => {
    expect(detectDirection({ top: 600, bottom: 620 }, 800)).toBe('top')
  })

  it('returns "bottom" when more space below', () => {
    expect(detectDirection({ top: 50, bottom: 70 }, 800)).toBe('bottom')
  })

  it('returns "top" when space above equals space below', () => {
    expect(detectDirection({ top: 400, bottom: 420 }, 820)).toBe('top')
  })
})
