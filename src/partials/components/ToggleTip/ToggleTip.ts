// src/partials/components/ToggleTip/ToggleTip.ts

import { calculatePopupOffset, calculateArrowOffset, detectDirection } from '../../../js/popup-position'

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
    this.popup = this.element.querySelector('.ToggleTip-popup') as HTMLElement
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
        <div class="ToggleTip-popup" id="${id}" role="tooltip" aria-hidden="true">
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
