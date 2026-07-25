// src/partials/components/AffixField/AffixField.ts
//
// AffixField renders plain, non-interactive text affixes (a prefix, a suffix,
// or both) visually inside a native text-like <input>.
//
// This component has NO interactivity: no popup, no keyboard model, no value
// logic. Everything the JS below does is compute ATTRIBUTES — affix ids,
// aria-describedby wiring, presence attributes, character counts. All of it is
// equally computable server-side, so the contract is the finished DOM
// end-state, not where it is computed. Consequently this JS is gap-filling,
// never overwriting: if everything is already authored (as a server would
// render it), it finds nothing to do and touches nothing. Authored values
// always win.
//
// Widths are never measured. The layout model is character counts × one
// calibrated character unit (--_af-ch-unit, CSS): the counts below are content
// facts (string lengths), the unit is typography, and the CSS formulas own the
// math. Counts don't change with fonts, so there is no re-measure machinery of
// any kind.
//
// It never reads or writes the input's value, dispatches no events, and
// handles no keys — the input stays a fully native form control.

// ─── Pure utilities (exported for testing) ───────────────────────────────────

// Merge id tokens into an existing space-separated token list (aria-describedby).
// Additions are appended AFTER existing entries so authored hint/error ids keep
// their announcement order; ids already present are never duplicated.
export function mergeTokenList(existing: string | null, additions: string[]): string {
  const tokens = (existing ?? '').split(/\s+/).filter(Boolean)
  for (const id of additions) {
    if (!tokens.includes(id)) tokens.push(id)
  }
  return tokens.join(' ')
}

// ─── Constants ───────────────────────────────────────────────────────────────

function generateId(): string {
  return 'af-' + Math.random().toString(36).slice(2, 9)
}

const AFFIXES = [
  ['prefix', '--_af-prefix-chars'],
  ['suffix', '--_af-suffix-chars'],
] as const

// ─── Global augmentation ─────────────────────────────────────────────────────

declare global {
  interface HTMLElement {
    __affixFieldInstance?: AffixField
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

class AffixField {
  private root: HTMLElement
  private input: HTMLInputElement | null
  private prefix: HTMLElement | null
  private suffix: HTMLElement | null

  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll<HTMLElement>('[data-component="AffixField"]').forEach(el => {
      if (el.__affixFieldInstance) return
      el.__affixFieldInstance = new AffixField(el)
    })
  }

  constructor(el: HTMLElement) {
    this.root = el
    this.input = el.querySelector<HTMLInputElement>('.AffixField-input')
    this.prefix = el.querySelector<HTMLElement>('.AffixField-prefix')
    this.suffix = el.querySelector<HTMLElement>('.AffixField-suffix')
    this._init()
  }

  private _init(): void {
    this._setAffixPresence()
    this._setAffixCounts()
    this._setInputChars()
    this._wireAria()
    this.root.setAttribute('data-initialized', 'true')
  }

  // A count property counts as authored when it is set inline on the root
  // itself. Counts are per-instance content facts, so an inherited value from
  // an ancestor is deliberately NOT treated as authored — it would describe
  // some other instance's content.
  private _authoredInline(prop: string): boolean {
    return this.root.style.getPropertyValue(prop) !== ''
  }

  // data-has-prefix / data-has-suffix are part of the end-state contract — the
  // CSS padding gates key on them (attribute selectors; affix presence is
  // load-bearing layout data and must not depend on :has() support). A server
  // renders them (it knows the affixes); this gap-fill sets them when the
  // affix element exists. Authored attributes are never removed — gap-filling,
  // not overwriting.
  private _setAffixPresence(): void {
    if (this.prefix && !this.root.hasAttribute('data-has-prefix')) {
      this.root.setAttribute('data-has-prefix', 'true')
    }
    if (this.suffix && !this.root.hasAttribute('data-has-suffix')) {
      this.root.setAttribute('data-has-suffix', 'true')
    }
  }

  // --_af-prefix-chars / --_af-suffix-chars: the affix string length as a plain
  // number. The reference JS and a server compute the SAME thing (the length
  // of the affix string), just at different times — the end-state is fully
  // symmetric. Authored counts always win, including fractional ones (the
  // tuning ventil for atypical strings: "WWW" may want 3.5).
  private _setAffixCounts(): void {
    for (const [kind, prop] of AFFIXES) {
      const affix = kind === 'prefix' ? this.prefix : this.suffix
      if (!affix) continue
      if (this._authoredInline(prop)) continue
      this.root.style.setProperty(prop, String((affix.textContent ?? '').trim().length))
    }
  }

  // data-input-characters (width of the value area in character units) →
  // --_af-input-chars. A plain attribute → custom property mapping; the CSS
  // width calc is gated on the attribute so nothing happens when it is absent.
  private _setInputChars(): void {
    const raw = this.root.dataset.inputCharacters
    if (raw === undefined) return
    if (this._authoredInline('--_af-input-chars')) return
    const chars = Number(raw)
    if (!Number.isFinite(chars) || chars <= 0) return
    this.root.style.setProperty('--_af-input-chars', String(chars))
  }

  // Default wiring: affixes get ids (<input-id>-prefix / <input-id>-suffix,
  // falling back to a generated instance id when the input has none) and the
  // ids are appended to the input's aria-describedby after any existing
  // entries. Overrides where JS keeps its hands off:
  // - an affix authored aria-hidden="true" is skipped entirely (the case: the
  //   visible label already carries the unit — announcing it twice is noise)
  // - the input's authored aria-describedby/aria-labelledby already references
  //   the affix ids → everything is left alone
  private _wireAria(): void {
    const input = this.input
    if (!input) return

    const base = input.id || generateId()
    const affixIds: string[] = []
    for (const [kind] of AFFIXES) {
      const affix = kind === 'prefix' ? this.prefix : this.suffix
      if (!affix) continue
      if (affix.getAttribute('aria-hidden') === 'true') continue
      if (!affix.id) affix.id = `${base}-${kind}`
      affixIds.push(affix.id)
    }
    if (affixIds.length === 0) return

    const describedby = input.getAttribute('aria-describedby')
    const labelledby = input.getAttribute('aria-labelledby')
    const referenced = new Set(
      `${describedby ?? ''} ${labelledby ?? ''}`.split(/\s+/).filter(Boolean),
    )
    const missing = affixIds.filter(id => !referenced.has(id))
    if (missing.length === 0) return // fully authored — leave everything alone

    input.setAttribute('aria-describedby', mergeTokenList(describedby, missing))
  }

  destroy(): void {
    delete this.root.__affixFieldInstance
  }
}

export default AffixField
