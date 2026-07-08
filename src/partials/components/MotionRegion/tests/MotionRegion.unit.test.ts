// src/partials/components/MotionRegion/tests/MotionRegion.unit.test.ts
//
// jsdom — proves the media-agnostic controller contract: attach/init, the
// data-motion projection driven by the motion-policy kernel, the injected
// WCAG 2.2.2 control, and the user-intent toggle. jsdom has no matchMedia or
// IntersectionObserver, so the environment resolves to a clean policy
// (reducedMotion=false, visible=true, no connection) — deterministic here.
// Real browser signals (reduced-motion, visibility, connection, preload) are
// proven in the Playwright e2e suite, per ADR-0010's testability split.
import { describe, it, expect, afterEach } from 'vitest'
import MotionRegion from '../MotionRegion'

type MountedElement = HTMLElement & { __motionRegionInstance?: MotionRegion }

function createRegion(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('div')
  el.className = 'MotionRegion'
  el.setAttribute('data-component', 'MotionRegion')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  const media = document.createElement('div')
  media.className = 'media-container'
  el.appendChild(media)
  document.body.appendChild(el)
  return el
}

function control(el: HTMLElement): HTMLButtonElement | null {
  return el.querySelector<HTMLButtonElement>('button.MotionRegion-control')
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('MotionRegion.attach — init', () => {
  it('autostarts under a clean policy (data-autoplay="policy")', () => {
    const el = createRegion({ 'data-autoplay': 'policy' })
    MotionRegion.attach(document.body)
    expect(el.getAttribute('data-motion')).toBe('running')
  })

  it('does not autostart when data-autoplay is "off"', () => {
    const el = createRegion({ 'data-autoplay': 'off' })
    MotionRegion.attach(document.body)
    expect(el.getAttribute('data-motion')).toBe('paused')
  })

  it('defaults to policy (autostart) when data-autoplay is absent', () => {
    const el = createRegion()
    MotionRegion.attach(document.body)
    expect(el.getAttribute('data-motion')).toBe('running')
  })

  it('marks the region initialized', () => {
    const el = createRegion()
    MotionRegion.attach(document.body)
    expect(el.getAttribute('data-initialized')).toBe('true')
  })

  it('injects an accessible toggle control (a labelled button)', () => {
    const el = createRegion()
    MotionRegion.attach(document.body)
    const btn = control(el)
    expect(btn).not.toBeNull()
    expect(btn!.type).toBe('button')
    expect(btn!.getAttribute('aria-label')).toBeTruthy()
  })

  it('is idempotent — a second attach does not double-inject the control', () => {
    createRegion()
    MotionRegion.attach(document.body)
    MotionRegion.attach(document.body)
    expect(document.querySelectorAll('button.MotionRegion-control').length).toBe(1)
  })
})

describe('MotionRegion — control label reflects the next action', () => {
  it('offers "pause" while running', () => {
    const el = createRegion({ 'data-autoplay': 'policy', 'data-pause-text': 'Pausa', 'data-play-text': 'Spela' })
    MotionRegion.attach(document.body)
    expect(control(el)!.getAttribute('aria-label')).toBe('Pausa')
  })

  it('offers "play" while paused', () => {
    const el = createRegion({ 'data-autoplay': 'off', 'data-pause-text': 'Pausa', 'data-play-text': 'Spela' })
    MotionRegion.attach(document.body)
    expect(control(el)!.getAttribute('aria-label')).toBe('Spela')
  })
})

describe('MotionRegion — user intent via the control', () => {
  it('lets the user start motion when autoplay is off (overrides the autostart gate)', () => {
    const el = createRegion({ 'data-autoplay': 'off' })
    MotionRegion.attach(document.body)
    control(el)!.click()
    expect(el.getAttribute('data-motion')).toBe('running')
  })

  it('lets the user pause motion that is running', () => {
    const el = createRegion({ 'data-autoplay': 'policy' })
    MotionRegion.attach(document.body)
    control(el)!.click()
    expect(el.getAttribute('data-motion')).toBe('paused')
  })

  it('round-trips pause → play through the control', () => {
    const el = createRegion({ 'data-autoplay': 'policy' })
    MotionRegion.attach(document.body)
    const btn = control(el)!
    btn.click() // pause
    btn.click() // play again
    expect(el.getAttribute('data-motion')).toBe('running')
  })
})

describe('MotionRegion — destroy', () => {
  it('removes the injected control and clears the instance guard', () => {
    const el = createRegion() as MountedElement
    MotionRegion.attach(document.body)
    el.__motionRegionInstance!.destroy()
    expect(control(el)).toBeNull()
    expect(el.__motionRegionInstance).toBeUndefined()
  })
})
