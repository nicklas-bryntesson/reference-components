/**
 * RangeGroup — two RangeFields on one shared RangeScale, bounding a span.
 *
 * Native range has no `multiple` — it was never implemented — so a span is two
 * inputs, and something has to own the rules that are about the PAIR rather than
 * about either control. That is this class, and it owns exactly three:
 *
 *  1. CLAMPING. Hard stop: each control stops where the other stands, so nothing
 *     the user did not touch ever moves. The VALUE is clamped and the `max`
 *     attribute is left alone — changing it would shrink that input's own
 *     geometry and the two would stop sharing a coordinate system.
 *
 *  2. THE EXPOSED SPAN. Because the attribute stays put, the narrowed ceiling has
 *     to be exposed through ARIA instead. Measured in Chromium 147 over CDP:
 *     author-set aria-valuemin/valuemax do reach the accessibility tree and
 *     override the native mapping. Not yet measured in Firefox or WebKit, or with
 *     a screenreader — so aria-valuetext carries the same fact in words, which is
 *     author-owned and therefore honoured everywhere.
 *
 *  3. POINTER ARBITRATION. On the same value the thumbs overlap and one becomes
 *     unreachable by pointer, so the nearer one is raised — on move as well as on
 *     press, because a pointerdown listener runs after hit-testing. The keyboard
 *     never has this problem: Tab reaches both regardless.
 *
 * Two consequences worth knowing rather than hiding. Clicking the bare track does
 * NOT move a thumb here: the inputs give up the pointer so both thumbs stay
 * grabbable, and that trade is the only way to keep the lower one reachable. And
 * on touch there is no hover to pre-raise with, so a first tap exactly on two
 * coincident thumbs may take the other end; the second tap is correct.
 *
 * Push and swap were both rejected. Push silently moves a value the user did not
 * touch. Swap changes the control's IDENTITY mid-interaction — focus stays on the
 * same element while it now drives the other end — and no ARIA mechanism can
 * announce that.
 *
 * The lane keeps drawing: it publishes both positions and fills between them.
 * This class never touches geometry.
 */

type MountedElement = HTMLElement & { __rangeGroupInstance?: RangeGroup }

interface ScaleLike {
  sync: () => void
}

export default class RangeGroup {
  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll<HTMLElement>('[data-component="RangeGroup"]').forEach((el) => {
      const mounted = el as MountedElement
      if (!mounted.__rangeGroupInstance) mounted.__rangeGroupInstance = new RangeGroup(el)
    })
  }

  #root: HTMLElement
  #scale: HTMLElement
  #lower: HTMLInputElement
  #upper: HTMLInputElement
  #outputs: { lower: HTMLElement | null; upper: HTMLElement | null }

  constructor(root: HTMLElement) {
    const scale = root.querySelector<HTMLElement>('.RangeScale')
    const lower = root.querySelector<HTMLInputElement>('[data-role="lower"]')
    const upper = root.querySelector<HTMLInputElement>('[data-role="upper"]')
    if (!scale || !lower || !upper) {
      throw new Error('RangeGroup: needs a .RangeScale and two fields with data-role lower/upper')
    }

    this.#root = root
    this.#scale = scale
    this.#lower = lower
    this.#upper = upper
    this.#outputs = {
      lower: root.querySelector<HTMLElement>('[data-readout="lower"]'),
      upper: root.querySelector<HTMLElement>('[data-readout="upper"]'),
    }

    this.#reserveReadoutWidth()

    lower.addEventListener('input', this.#onLower)
    upper.addEventListener('input', this.#onUpper)
    // pointermove, not just pointerdown: by the time a pointerdown listener runs
    // the browser has already hit-tested and chosen a target, so raising a thumb
    // then only affects the NEXT press. Pre-raising on hover means the right thumb
    // is already on top when the press arrives.
    scale.addEventListener('pointermove', this.#onPointerMove)
    scale.addEventListener('pointerdown', this.#onPointerMove)

    this.sync()
    ;(root as MountedElement).__rangeGroupInstance = this
  }

  /**
   * Reserve room for the widest NUMBER the readouts can ever show.
   *
   * Without this the component's width follows its content: "700" is one character
   * narrower than "1000", so crossing into four digits widened the whole group by
   * ~12px in a shrink-to-fit container. That is not cosmetic — the lane widens with
   * it, every position recomputes, and the thumb jumps under the finger mid-drag.
   *
   * Only the digits are reserved, and only in `ch`, which under tabular numerals is
   * exactly a digit's width. Reserving the whole string instead over-reserved by a
   * quarter, because a space and three lowercase letters are much narrower than a
   * zero — and paying 51px of permanent width to remove a 12px jump is the wrong
   * trade. The unit is static markup, so it costs its natural width and no more.
   *
   * Same idea as AffixField's --_af-input-chars: taken from the contract, never
   * measured from the DOM.
   */
  #reserveReadoutWidth(): void {
    const digits = Math.max(
      (this.#lower.min || '0').length,
      (this.#upper.max || '100').length,
    )
    this.#root.style.setProperty('--_rg-readout-digits', String(digits))
  }

  #onLower = (): void => this.#clamp('lower')
  #onUpper = (): void => this.#clamp('upper')

  #clamp(touched: 'lower' | 'upper'): void {
    const lo = this.#lower.valueAsNumber
    const hi = this.#upper.valueAsNumber

    // Hard stop: only the control the user is holding moves.
    if (lo > hi) {
      if (touched === 'lower') this.#lower.value = this.#upper.value
      else this.#upper.value = this.#lower.value
    }
    this.sync()
  }

  /**
   * Recompute the announcement and the exposed span, then let the lane redraw.
   *
   * Public for the same reason RangeScale's is: `input` does not fire when a value
   * is set programmatically, so a host that writes `field.value = …` must call
   * this. It is also what makes the clamp safe without coordinating listener
   * order — the lane may publish an unclamped position first, and this overwrites
   * it in the same tick, before anything paints.
   */
  sync = (): void => {
    const lo = this.#lower
    const hi = this.#upper
    const loText = this.#format(lo)
    const hiText = this.#format(hi)

    // The span, written once with a single unit. The <label> already says which
    // end this is, so the text must not repeat it: a screenreader announces name,
    // role and then this, and "Lowest, slider, 200 tkr, lowest of …" says it twice.
    // What is missing from the announcement is the pair, so that is what is added.
    const unit = this.#suffix()
    const span = unit ? `${lo.value}–${hi.value} ${unit}` : `${lo.value}–${hi.value}`

    // The narrowed span, exposed through ARIA because the attributes stay put.
    lo.setAttribute('aria-valuemax', hi.value)
    hi.setAttribute('aria-valuemin', lo.value)

    // And carried in words as well, which is the half that is honoured everywhere.
    lo.setAttribute('aria-valuetext', `${loText}, within ${span}`)
    hi.setAttribute('aria-valuetext', `${hiText}, within ${span}`)

    // Only the number is written; the unit is markup and stays put.
    this.#digits('lower')?.replaceChildren(lo.value)
    this.#digits('upper')?.replaceChildren(hi.value)

    // The lane owns the drawing; ask it to redraw from the corrected values.
    const scale = this.#scale as HTMLElement & { __rangeScaleInstance?: ScaleLike }
    scale.__rangeScaleInstance?.sync()
  }

  /**
   * On overlap only one thumb can be reached by pointer, so the one nearer the
   * cursor is raised — on move as well as on press, because a pointerdown listener
   * runs after hit-testing and would only ever fix the following press.
   *
   * When both ends hold the SAME value the distances are identical, so distance
   * cannot break the tie. Side does: a cursor below the shared position wants the
   * lower end, above it the upper. Without that, one end is permanently
   * unreachable once they meet.
   *
   * Read along the lane's inline axis so it holds in RTL too.
   */
  #onPointerMove = (event: PointerEvent): void => {
    const box = this.#scale.getBoundingClientRect()
    const rtl = getComputedStyle(this.#scale).direction === 'rtl'
    const fraction = rtl
      ? (box.right - event.clientX) / box.width
      : (event.clientX - box.left) / box.width

    const position = (field: HTMLInputElement) => {
      const min = Number(field.min || 0)
      const max = Number(field.max || 100)
      return (field.valueAsNumber - min) / (max - min || 1)
    }

    const pLower = position(this.#lower)
    const pUpper = position(this.#upper)
    const dLower = Math.abs(fraction - pLower)
    const dUpper = Math.abs(fraction - pUpper)

    const nearerLower =
      Math.abs(dLower - dUpper) < 1e-9 ? fraction < pLower : dLower < dUpper

    // Both states are written explicitly, because both are selectable: exactly
    // one thumb is on top at any moment, so the off state carries style too.
    this.#lower.setAttribute('data-on-top', String(nearerLower))
    this.#upper.setAttribute('data-on-top', String(!nearerLower))
  }

  #digits(side: 'lower' | 'upper'): HTMLElement | null {
    return this.#outputs[side]?.querySelector<HTMLElement>('[data-part="digits"]') ?? null
  }

  /** Both readouts carry the same unit; the lower one is the canonical source. */
  #suffix(): string {
    return this.#outputs.lower?.dataset.suffix ?? this.#outputs.upper?.dataset.suffix ?? ''
  }

  /** `data-suffix` on the readout carries the unit, as it does on the lane. */
  #format(field: HTMLInputElement): string {
    const readout = field.dataset.role === 'lower' ? this.#outputs.lower : this.#outputs.upper
    const suffix = readout?.dataset.suffix ?? ''
    return suffix ? `${field.value} ${suffix}` : field.value
  }

  get values(): [number, number] {
    return [this.#lower.valueAsNumber, this.#upper.valueAsNumber]
  }

  destroy(): void {
    this.#lower.removeEventListener('input', this.#onLower)
    this.#upper.removeEventListener('input', this.#onUpper)
    this.#scale.removeEventListener('pointermove', this.#onPointerMove)
    this.#scale.removeEventListener('pointerdown', this.#onPointerMove)
    delete (this.#root as MountedElement).__rangeGroupInstance
  }
}
