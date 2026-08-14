import {
  resolvePreference,
  resolveAppearance,
  shouldProject,
  type Preference,
} from '../../../kernel/js/theme-preference'

/**
 * ThemeSwitch — System · Light · Dark (ADR-0021).
 *
 * The component owns only the *plumbing*: read the stored preference, read the
 * live OS signal, hand both to the kernel, and reflect the answer on the document
 * root. Every decision lives in `theme-preference`, so it can be unit-tested
 * without a DOM and re-used by a port that renders the attribute server-side.
 *
 * What it deliberately does NOT do:
 *   - apply tokens. It sets one attribute; `color-scheme` and the token layer do
 *     the rest. Writing `documentElement.style.cssText`, as the implementation
 *     this is modelled on did, silently destroys every other inline style on the
 *     root (scroll locks, viewport fixes, view-transition names).
 *   - project anything for `system`. An absent attribute IS "follow the OS", so
 *     there is nothing to compute before first paint and nothing to flash.
 *   - own persistence as a contract. This reference uses localStorage; a server
 *     stack may use a cookie and render the attribute directly. Both satisfy the
 *     same end-state contract (ADR-0009).
 */
export default class ThemeSwitch {
  static readonly STORAGE_KEY = 'appearance-preference'

  private readonly root: HTMLElement
  private readonly inputs: HTMLInputElement[]
  private readonly darkQuery: MediaQueryList | null = null
  private preference: Preference

  constructor(root: HTMLElement) {
    this.root = root
    this.inputs = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"][name]')]

    this.preference = resolvePreference(this.readStored())
    this.reflectPreference()
    this.project()

    this.root.addEventListener('change', this.onChange)

    // jsdom has no matchMedia; the component must still attach there so the unit
    // suite can exercise the markup contract.
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
      this.darkQuery.addEventListener('change', this.onSystemChange)
    }

    this.root.dataset.initialized = 'true'
  }

  static attach(parent: Document | Element = document): void {
    parent.querySelectorAll<HTMLElement>('[data-component="ThemeSwitch"]').forEach((el) => {
      if (el.dataset.initialized === 'true') return
      new ThemeSwitch(el)
    })
  }

  /** Whether the OS currently asks for dark. `false` when the API is unavailable. */
  private get prefersDark(): boolean {
    return this.darkQuery?.matches ?? false
  }

  private readStored(): string | null {
    // Storage can throw outright: Safari in private mode, a blocked third-party
    // context, a disabled-storage policy. A theme switch must not take the page
    // down with it, so failure degrades to "no preference".
    try {
      return window.localStorage.getItem(ThemeSwitch.STORAGE_KEY)
    } catch {
      return null
    }
  }

  private writeStored(preference: Preference): void {
    try {
      window.localStorage.setItem(ThemeSwitch.STORAGE_KEY, preference)
    } catch {
      /* preference is still applied for this page — it just will not survive a reload */
    }
  }

  /** Check the radio matching the current preference, without firing `change`. */
  private reflectPreference(): void {
    for (const input of this.inputs) input.checked = input.value === this.preference
  }

  /**
   * Reflect the resolved appearance on the document root — the whole contract.
   * `system` removes the attribute rather than writing a value: absence is the
   * state, so the OS stays in charge with no listener needed on the CSS side.
   */
  private project(): void {
    const root = document.documentElement
    if (!shouldProject(this.preference)) {
      root.removeAttribute('data-appearance')
    } else {
      root.setAttribute('data-appearance', resolveAppearance(this.preference, this.prefersDark))
    }
    this.root.dispatchEvent(new CustomEvent('theme-change', {
      bubbles: true,
      detail: {
        preference: this.preference,
        appearance: resolveAppearance(this.preference, this.prefersDark),
      },
    }))
  }

  private readonly onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement
    if (!this.inputs.includes(input)) return
    this.preference = resolvePreference(input.value)
    this.writeStored(this.preference)
    this.project()
  }

  /**
   * The OS changed. Re-project only under `system` — an explicit choice is not
   * revoked by the platform. (`project()` is a no-op for an explicit preference
   * anyway; the guard states the rule rather than relying on that.)
   */
  private readonly onSystemChange = (): void => {
    if (this.preference !== 'system') return
    this.project()
  }

  destroy(): void {
    this.root.removeEventListener('change', this.onChange)
    this.darkQuery?.removeEventListener('change', this.onSystemChange)
    delete this.root.dataset.initialized
  }
}
