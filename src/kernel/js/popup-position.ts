/**
 * Calculate the percentage offset of the bubble along the slide rail,
 * clamped so the bubble never overflows the viewport (viewportWidth/viewportInset).
 */
export function calculatePopupOffset(
  triggerCenterX: number,
  containerLeft: number,
  containerWidth: number,
  popupWidth: number,
  viewportWidth: number = window.innerWidth,
  viewportInset: number = 0,
): number {
  const idealLeft = triggerCenterX - containerLeft
  const minLeft = -containerLeft + popupWidth / 2 + viewportInset
  const maxLeft = viewportWidth - containerLeft - popupWidth / 2 - viewportInset
  const clampedLeft = minLeft <= maxLeft
    ? Math.max(minLeft, Math.min(idealLeft, maxLeft))
    : viewportWidth / 2 - containerLeft
  return (clampedLeft / containerWidth) * 100
}

/**
 * Calculate px correction so the arrow always points at the trigger center,
 * clamped so the arrow stays within the bubble's rounded corners.
 */
export function calculateArrowOffset(
  triggerCenterX: number,
  popupLeft: number,
  popupWidth: number,
  borderRadius: number,
  arrowSize: number,
): number {
  const rawOffset = triggerCenterX - (popupLeft + popupWidth / 2)
  const limit = popupWidth / 2 - borderRadius - arrowSize / 2
  return Math.max(-limit, Math.min(rawOffset, limit))
}

/**
 * Detect whether the bubble should appear above or below the trigger.
 * Compares available space; ties go to "top".
 */
export function detectDirection(
  triggerRect: Pick<DOMRect, 'top' | 'bottom'>,
  viewportHeight: number = window.innerHeight,
): 'top' | 'bottom' {
  const spaceAbove = triggerRect.top
  const spaceBelow = viewportHeight - triggerRect.bottom
  return spaceAbove >= spaceBelow ? 'top' : 'bottom'
}
