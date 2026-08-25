// MotionRegion — a decorative region whose motion is governed for accessibility
// and performance (ADR-0010). The component is thin: it gathers the live browser
// signals, tracks user intent, asks the pure `motion-policy` kernel what the state
// should be, and projects it onto the root as `data-motion` (ADR-0002). Every
// backend obeys that attribute in its own idiom — a CSS animation gates
// `animation-play-state` on it (zero JS), the video adapter maps it to
// play()/pause() (added separately). This file owns the media-agnostic core:
// signal gathering, the data-motion projection, the WCAG 2.2.2 pause control, and
// user intent.

import {
  evaluateMotionPolicy,
  resolveMotion,
  type MotionSignals,
  type MotionState,
} from '../../../kernel/js/motion-policy'

type MountedElement = HTMLElement & { __motionRegionInstance?: MotionRegion }

// navigator.connection (Network Information API) is not in the standard DOM lib.
interface NetworkInformationLike {
  effectiveType?: string
  saveData?: boolean
  addEventListener?: (type: 'change', listener: () => void) => void
  removeEventListener?: (type: 'change', listener: () => void) => void
}

// Visibility threshold: motion is "in view" once 40% of the region intersects —
// the same fraction the source used.
const VISIBILITY_THRESHOLD = 0.4

const ICON_PATHS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 4h4v16H6zm8 0h4v16h-4z',
} as const

export default class MotionRegion {
  static instanceCount = 0

  root: HTMLElement
  autoplay: 'off' | 'policy'
  playLabel: string
  pauseLabel: string
  playingStatus: string
  pausedStatus: string

  userPaused = false
  userStarted = false
  visible = true
  state: MotionState = 'paused'

  video: HTMLVideoElement | null = null
  appliedVideoState: MotionState | null = null
  control: HTMLButtonElement | null = null
  statusRegion: HTMLElement | null = null
  iconPath: SVGPathElement | null = null
  reducedMotionQuery: MediaQueryList | null = null
  connection: NetworkInformationLike | null = null
  intersectionObserver: IntersectionObserver | null = null

  constructor(root: HTMLElement) {
    this.root = root
    this.autoplay = root.dataset.autoplay === 'off' ? 'off' : 'policy'
    this.playLabel = root.dataset.playText || 'Play video'
    this.pauseLabel = root.dataset.pauseText || 'Pause video'
    this.playingStatus = root.dataset.playingText || 'Motion playing'
    this.pausedStatus = root.dataset.pausedText || 'Motion paused'

    this.onSignalChange = this.onSignalChange.bind(this)
    this.onToggle = this.onToggle.bind(this)
    this.onVisibilityChange = this.onVisibilityChange.bind(this)

    this.init()
  }

  static attach(parent: Document | Element = document): void {
    parent.querySelectorAll<HTMLElement>('[data-component="MotionRegion"]').forEach((el) => {
      const mounted = el as MountedElement
      if (mounted.__motionRegionInstance) return
      mounted.__motionRegionInstance = new MotionRegion(el)
    })
  }

  init(): void {
    this.setupVideo()
    this.setupControl()
    this.setupSignals()
    this.resolve()
    this.root.setAttribute('data-initialized', 'true')
  }

  // Prepare a video backend, if present, for governed autoplay. muted + playsinline
  // are autoplay-eligibility requirements (browsers only autostart muted video);
  // preload="none" is the performance gate — no media bytes load until the adapter
  // actually calls play() (which only happens when motion resolves to running).
  setupVideo(): void {
    this.video = this.root.querySelector('video')
    if (!this.video) return
    this.video.muted = true
    this.video.setAttribute('playsinline', '')
    this.video.controls = false
    this.video.preload = 'none'
    this.ensureVideoId()
  }

  ensureVideoId(): void {
    if (!this.video || this.video.id) return
    MotionRegion.instanceCount += 1
    this.video.id = `motion-region-video-${MotionRegion.instanceCount}`
  }

  setupControl(): void {
    const control = document.createElement('button')
    control.type = 'button'
    control.className = 'control'
    if (this.video?.id) control.setAttribute('aria-controls', this.video.id)

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'currentColor')

    this.iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    svg.appendChild(this.iconPath)
    control.appendChild(svg)

    control.addEventListener('click', this.onToggle)
    this.root.prepend(control)
    this.control = control

    // A screenreader does not re-announce a name change on the focused element,
    // so the aria-label swap alone leaves the toggle silent. This region speaks
    // the resolved state instead. Starts empty (nothing to announce on load) and
    // is written only from onToggle — policy changes must stay quiet.
    const status = document.createElement('span')
    status.className = 'status'
    status.setAttribute('role', 'status')
    this.root.prepend(status)
    this.statusRegion = status
  }

  // Read the live browser signals. Every source is feature-detected, so the
  // component degrades cleanly where an API is absent (and stays testable in
  // jsdom, which has neither matchMedia nor IntersectionObserver).
  setupSignals(): void {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.reducedMotionQuery.addEventListener('change', this.onSignalChange)
    }

    const nav = navigator as Navigator & { connection?: NetworkInformationLike; mozConnection?: NetworkInformationLike }
    this.connection = nav.connection || nav.mozConnection || null
    this.connection?.addEventListener?.('change', this.onSignalChange)

    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(this.onVisibilityChange, {
        threshold: VISIBILITY_THRESHOLD,
      })
      this.intersectionObserver.observe(this.root)
    } else {
      this.visible = true
    }
  }

  gatherSignals(): MotionSignals {
    return {
      autoplay: this.autoplay,
      reducedMotion: this.reducedMotionQuery?.matches ?? false,
      visible: this.visible,
      saveData: Boolean(this.connection?.saveData),
      effectiveType: this.connection?.effectiveType ?? '',
    }
  }

  // The single application point: resolve policy + intent to a state and project it.
  resolve(): void {
    const policy = evaluateMotionPolicy(this.gatherSignals())
    this.state = resolveMotion(policy, { userPaused: this.userPaused, userStarted: this.userStarted })
    this.root.setAttribute('data-motion', this.state)
    this.updateControl()
    this.driveVideo()
  }

  // The video adapter: map the resolved state onto the element's play/pause API.
  // Guarded on the last-applied state so a redundant resolve() never fires
  // overlapping play()/pause() calls (the "play() interrupted by pause()" warning).
  driveVideo(): void {
    if (!this.video || this.state === this.appliedVideoState) return
    this.appliedVideoState = this.state
    if (this.state === 'running') {
      // play() rejects if the platform blocks autoplay; motion simply stays paused.
      void Promise.resolve(this.video.play()).catch(() => {})
    } else {
      this.video.pause()
    }
  }

  updateControl(): void {
    if (!this.control || !this.iconPath) return
    const running = this.state === 'running'
    // The label describes the action the button performs next.
    this.control.setAttribute('aria-label', running ? this.pauseLabel : this.playLabel)
    this.control.setAttribute('data-icon', running ? 'pause' : 'play')
    this.iconPath.setAttribute('d', running ? ICON_PATHS.pause : ICON_PATHS.play)
  }

  onToggle(event: Event): void {
    event.preventDefault()
    if (this.state === 'running') {
      this.userPaused = true
      this.userStarted = false
    } else {
      this.userStarted = true
      this.userPaused = false
    }
    this.resolve()
    // Announce the RESOLVED state, not the intent — if policy keeps motion
    // paused despite a play press, "paused" is the truth the user needs.
    if (this.statusRegion) {
      this.statusRegion.textContent =
        this.state === 'running' ? this.playingStatus : this.pausedStatus
    }
  }

  onVisibilityChange(entries: IntersectionObserverEntry[]): void {
    const entry = entries[0]
    if (!entry) return
    this.visible = entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD
    this.resolve()
  }

  onSignalChange(): void {
    this.resolve()
  }

  destroy(): void {
    this.reducedMotionQuery?.removeEventListener('change', this.onSignalChange)
    this.connection?.removeEventListener?.('change', this.onSignalChange)
    this.intersectionObserver?.disconnect()
    this.control?.removeEventListener('click', this.onToggle)
    this.control?.remove()
    this.control = null
    this.statusRegion?.remove()
    this.statusRegion = null
    this.iconPath = null
    this.video = null
    this.appliedVideoState = null
    delete (this.root as MountedElement).__motionRegionInstance
  }
}
