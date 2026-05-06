// src/partials/components/ToggleTip/ToggleTip.ts

// ─── Pure calculation functions (exported for unit testing) ─────────────────

/**
 * Calculate the percentage offset of the bubble along the slide rail,
 * clamped so the bubble never overflows the rail edges.
 *
 * @param triggerCenterX  - trigger button center, viewport-relative px
 * @param containerLeft   - rail left edge, viewport-relative px
 * @param containerWidth  - rail total width in px
 * @param popupWidth      - bubble width in px
 * @param viewportWidth   - defaults to window.innerWidth
 * @param viewportInset   - minimum gap between bubble and viewport edges in px (default 0)
 * @returns percentage (0–100) for left position of bubble center
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

  // Clamp so the bubble stays within viewport inset bounds.
  // Expressed in container-relative coordinates — the slide container has no
  // overflow:hidden so the bubble can extend beyond it without issue.
  //   bubbleLeft  = containerLeft + clampedLeft - popupWidth/2 >= viewportInset
  //   bubbleRight = containerLeft + clampedLeft + popupWidth/2 <= viewportWidth - viewportInset
  const minLeft = -containerLeft + popupWidth / 2 + viewportInset
  const maxLeft = viewportWidth - containerLeft - popupWidth / 2 - viewportInset

  // If the bubble is too wide to fit between the insets, center it in the viewport
  const clampedLeft = minLeft <= maxLeft
    ? Math.max(minLeft, Math.min(idealLeft, maxLeft))
    : viewportWidth / 2 - containerLeft

  return (clampedLeft / containerWidth) * 100
}

/**
 * Calculate px correction so the arrow always points at the trigger center,
 * clamped so the arrow stays within the bubble's rounded corners.
 *
 * @param triggerCenterX  - trigger button center, viewport-relative px
 * @param popupLeft       - bubble left edge, viewport-relative px
 * @param popupWidth      - bubble width in px
 * @param borderRadius    - bubble border-radius in px
 * @param arrowSize       - arrow square side length in px
 * @returns pixel offset applied to arrow translateX
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
 *
 * @param triggerRect   - trigger bounding rect
 * @param viewportHeight - defaults to window.innerHeight
 * @returns 'top' | 'bottom'
 */
export function detectDirection(
  triggerRect: Pick<DOMRect, 'top' | 'bottom'>,
  viewportHeight: number = window.innerHeight,
): 'top' | 'bottom' {
  const spaceAbove = triggerRect.top
  const spaceBelow = viewportHeight - triggerRect.bottom
  return spaceAbove >= spaceBelow ? 'top' : 'bottom'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function generateIconSVG(iconType: string): string {
  if (iconType === 'question') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toggleTipIcon">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <path d="M12 17h.01"/>
    </svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toggleTipIcon">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
  </svg>`
}

// ─── Component ───────────────────────────────────────────────────────────────

class ToggleTip {
  private readonly element: HTMLElement
  private readonly icon: string
  private readonly title: string
  private readonly headingLevel: string
  private _rafHandle: number | null
  private button!: HTMLButtonElement
  private popup!: HTMLElement

  constructor(element: HTMLElement) {
    this.element = element
    this.icon = element.getAttribute('icon') ?? 'info'
    this.title = element.getAttribute('title') ?? ''
    // Note: 'title' is a global HTML attribute — browsers show a native tooltip on hover.
    // Rename this attribute (e.g. 'heading') in a future spec update to avoid the conflict.
    this.headingLevel = element.getAttribute('heading-level') ?? '3'
    this._rafHandle = null
    this._init()
  }

  private _init(): void {
    this._buildDOM()
    this.button = this.element.querySelector('button') as HTMLButtonElement
    this.popup = this.element.querySelector('.toggleTipContent') as HTMLElement
    this._updateDirection()
    this.element.setAttribute('initialized', '')
    this.button.addEventListener('click', this._toggle)
    window.addEventListener('resize', this._handleResize)
    document.addEventListener('mousedown', this._handleClickOutside)
    this.element.addEventListener('focusout', this._handleFocusOut)
  }

  private _buildDOM(): void {
    const id = `tt-${randomId()}`
    const titleHTML = this.title
      ? `<span class="title" role="heading" aria-level="${this.headingLevel}">${this.title}</span>`
      : ''
    const content = Array.from(this.element.childNodes)
      .map(n => (n as Element).outerHTML ?? n.textContent ?? '')
      .join('')

    this.element.innerHTML = `
      <button aria-label="${this.icon === 'question' ? 'Learn more' : 'More information'}" aria-expanded="false" aria-controls="${id}">
        ${generateIconSVG(this.icon)}
      </button>
      <div class="slideContainer">
        <div class="toggleTipContent" id="${id}" role="tooltip" aria-hidden="true">
          ${titleHTML}
          ${content}
          <div class="arrow"></div>
        </div>
      </div>
    `
  }

  private _updateDirection(): void {
    const triggerRect = this.element.getBoundingClientRect()
    const direction = detectDirection(triggerRect)
    if (this.element.getAttribute('direction') !== direction) {
      this.element.setAttribute('direction', direction)
    }
  }

  private _updateLayout(): void {
    const container = this.element.querySelector('.slideContainer') as HTMLElement
    const containerRect = container.getBoundingClientRect()
    const popupRect = this.popup.getBoundingClientRect()
    if (!containerRect.width || !popupRect.width) return

    const triggerRect = this.element.getBoundingClientRect()
    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    const arrowSize = this._getCSSPx('--_tt-arrow-size')
    const borderRadius = this._getCSSPx('--_tt-border-radius')
    const viewportInset = this._getCSSPx('--_tt-site-padding') / 2

    const offset = calculatePopupOffset(
      triggerCenterX,
      containerRect.left,
      containerRect.width,
      popupRect.width,
      window.innerWidth,
      viewportInset,
    )
    this.element.style.setProperty('--tt-popup-offset', `${offset}%`)

    // Calculate popup left mathematically (CSS var change not yet in layout)
    const popupLeft = containerRect.left + (offset / 100 * containerRect.width) - popupRect.width / 2
    const arrowOffset = calculateArrowOffset(triggerCenterX, popupLeft, popupRect.width, borderRadius, arrowSize)
    this.element.style.setProperty('--tt-arrow-offset', `${arrowOffset}px`)
  }

  private _getCSSPx(property: string): number {
    // Resolve any CSS variable (rem, clamp, calc, etc.) to px by measuring a probe element.
    // getBoundingClientRect forces synchronous layout, so the value is always current.
    const probe = document.createElement('div')
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:var(${property},0px)`
    this.element.appendChild(probe)
    const px = probe.getBoundingClientRect().width
    this.element.removeChild(probe)
    return px
  }

  private _open = (): void => {
    this._updateDirection()
    this.popup.setAttribute('aria-hidden', 'false') // display:block — getBoundingClientRect will now return real dimensions
    this.button.setAttribute('aria-expanded', 'true')
    this._updateLayout()
  }

  private _close = (): void => {
    this.popup.setAttribute('aria-hidden', 'true')
    this.button.setAttribute('aria-expanded', 'false')
  }

  private _toggle = (): void => {
    const isOpen = this.popup.getAttribute('aria-hidden') === 'false'
    if (isOpen) this._close()
    else this._open()
  }

  private _handleResize = (): void => {
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
    this._rafHandle = requestAnimationFrame(() => {
      this._updateDirection()
      if (this.popup.getAttribute('aria-hidden') === 'false') {
        this._updateLayout()
      }
    })
  }

  private _handleClickOutside = (event: Event): void => {
    if (!this.element.contains(event.target as Node)) this._close()
  }

  private _handleFocusOut = (event: FocusEvent): void => {
    if (!this.element.contains(event.relatedTarget as Node)) this._close()
  }

  destroy(): void {
    window.removeEventListener('resize', this._handleResize)
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle)
    document.removeEventListener('mousedown', this._handleClickOutside)
    this.element.removeEventListener('focusout', this._handleFocusOut)
    this.button?.removeEventListener('click', this._toggle)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('toggle-tip').forEach(el => new ToggleTip(el as HTMLElement))
})
