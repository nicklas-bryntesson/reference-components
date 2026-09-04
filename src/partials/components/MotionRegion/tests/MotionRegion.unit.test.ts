// src/partials/components/MotionRegion/tests/MotionRegion.unit.test.ts
//
// jsdom — proves the media-agnostic controller contract: attach/init, the
// data-motion projection driven by the motion-policy kernel, the injected
// WCAG 2.2.2 control, and the user-intent toggle. jsdom has no matchMedia or
// IntersectionObserver, so the environment resolves to a clean policy
// (reducedMotion=false, visible=true, no connection) — deterministic here.
// Real browser signals (reduced-motion, visibility, connection, preload) are
// proven in the Playwright e2e suite, per ADR-0010's testability split.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import MotionRegion from '../MotionRegion'

type MountedElement = HTMLElement & { __motionRegionInstance?: MotionRegion }

function createRegion(attrs: Record<string, string> = {}, withVideo = false): HTMLElement {
  const el = document.createElement('div')
  el.className = 'MotionRegion'
  el.setAttribute('data-component', 'MotionRegion')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  const media = document.createElement('div')
  media.className = 'demo-media'
  if (withVideo) media.appendChild(document.createElement('video'))
  el.appendChild(media)
  document.body.appendChild(el)
  return el
}

function video(el: HTMLElement): HTMLVideoElement {
  return el.querySelector('video')!
}

function control(el: HTMLElement): HTMLButtonElement | null {
  return el.querySelector<HTMLButtonElement>('button[data-part="control"]')
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
    expect(document.querySelectorAll('button[data-part="control"]').length).toBe(1)
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

/**
 * A screenreader does not re-announce a name change on the focused element, so
 * the aria-label swap alone leaves the toggle SILENT — measured with VoiceOver
 * 2026-08-25: nothing is spoken until focus leaves and returns. A role="status"
 * region carries the resolved state instead. It is written ONLY on user toggles;
 * policy changes (scrolling out of view, reduced-motion flips) must stay quiet,
 * or every viewport exit becomes an announcement.
 */
describe('MotionRegion — the toggle is heard, not just relabelled', () => {
  function status(el: HTMLElement): HTMLElement | null {
    return el.querySelector<HTMLElement>('[role="status"]')
  }

  it('injects a status region, empty until the user acts', () => {
    const el = createRegion({ 'data-autoplay': 'policy' })
    MotionRegion.attach(document.body)
    expect(status(el)).not.toBeNull()
    expect(status(el)!.textContent).toBe('')
  })

  it('announces the resolved state on toggle, both ways', () => {
    const el = createRegion({ 'data-autoplay': 'policy' })
    MotionRegion.attach(document.body)
    const btn = control(el)!
    btn.click() // running → paused
    expect(status(el)!.textContent).toBe('Motion paused')
    btn.click() // paused → running
    expect(status(el)!.textContent).toBe('Motion playing')
  })

  it('takes its wording from data-paused-text / data-playing-text', () => {
    const el = createRegion({
      'data-autoplay': 'policy',
      'data-paused-text': 'Animation pausad',
      'data-playing-text': 'Animation spelas',
    })
    MotionRegion.attach(document.body)
    control(el)!.click()
    expect(status(el)!.textContent).toBe('Animation pausad')
  })
})

describe('MotionRegion — video adapter', () => {
  let playSpy: ReturnType<typeof vi.spyOn>
  let pauseSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom does not implement media playback; spy on the API to assert the
    // adapter drives it, and give play() a resolved promise to await.
    playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('plays the video when motion resolves to running', () => {
    createRegion({ 'data-autoplay': 'policy' }, true)
    MotionRegion.attach(document.body)
    expect(playSpy).toHaveBeenCalled()
  })

  it('does not play (no bytes load) when paused, and keeps preload="none"', () => {
    const el = createRegion({ 'data-autoplay': 'off' }, true)
    MotionRegion.attach(document.body)
    expect(playSpy).not.toHaveBeenCalled()
    expect(video(el).preload).toBe('none')
  })

  it('pauses the video when the user pauses', () => {
    const el = createRegion({ 'data-autoplay': 'policy' }, true)
    MotionRegion.attach(document.body)
    el.querySelector<HTMLButtonElement>('button[data-part="control"]')!.click()
    expect(pauseSpy).toHaveBeenCalled()
  })

  it('enforces muted + playsinline for autoplay eligibility', () => {
    const el = createRegion({ 'data-autoplay': 'policy' }, true)
    MotionRegion.attach(document.body)
    expect(video(el).muted).toBe(true)
    expect(video(el).hasAttribute('playsinline')).toBe(true)
  })

  it('wires aria-controls from the control to the video id', () => {
    const el = createRegion({ 'data-autoplay': 'policy' }, true)
    MotionRegion.attach(document.body)
    const v = video(el)
    expect(v.id).toBeTruthy()
    expect(el.querySelector('button[data-part="control"]')!.getAttribute('aria-controls')).toBe(v.id)
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
