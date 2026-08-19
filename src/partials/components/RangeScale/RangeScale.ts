/**
 * RangeScale — the lane a RangeField is measured against.
 *
 * This is the only tier in the range family with any JavaScript, and it has it
 * for one reason: CSS cannot read an input's `value`, so anything whose length
 * or position depends on that value has to be told. The component writes the
 * normalised position onto ITSELF, where it inherits down into every layer —
 * custom properties only flow downward, so a field can never publish its own
 * position upward to a sibling.
 *
 * Everything else here is text: an optional `<output>` and the mirroring of the
 * formatted value into the field's `aria-valuetext`, so the sighted and the
 * announced value cannot drift apart.
 *
 * PROGRESSIVE: `--_rs-p` can be server-rendered in the style attribute for a
 * correct first paint. This class then keeps it live. Without JavaScript the
 * lane shows the authored value — frozen, but true.
 *
 * A lane may hold TWO controls (a span). It then publishes both ends as
 * `--_rs-a` and `--_rs-b`, sorted by value rather than by document order,
 * because an owner may have just clamped one of them. The lane still does not
 * interpret the pair — clamping, the combined announcement and pointer
 * arbitration belong to whatever owns the two controls.
 */

type MountedElement = HTMLElement & { __rangeScaleInstance?: RangeScale }

export default class RangeScale {
  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll<HTMLElement>('[data-component="RangeScale"]').forEach((el) => {
      const mounted = el as MountedElement
      if (!mounted.__rangeScaleInstance) mounted.__rangeScaleInstance = new RangeScale(el)
    })
  }

  #root: HTMLElement
  #fields: HTMLInputElement[]
  #output: HTMLOutputElement | null

  constructor(root: HTMLElement) {
    const fields = [...root.querySelectorAll<HTMLInputElement>('input[type="range"]')]
    if (fields.length === 0) throw new Error('RangeScale: no input[type="range"] found')

    this.#root = root
    this.#fields = fields
    this.#output = root.querySelector<HTMLOutputElement>('output.value')

    this.#reserveReadoutWidth()

    for (const field of fields) field.addEventListener('input', this.sync)
    this.sync()
    ;(root as MountedElement).__rangeScaleInstance = this
  }

  /** The single-field case, and the one every layer reads by default. */
  get #field(): HTMLInputElement {
    return this.#fields[0]
  }

  /**
   * Recompute everything from the field's current value.
   *
   * Public because `input` does NOT fire when `value` is set programmatically.
   * A host that writes `field.value = 80` in code must call this afterwards, or
   * the lane keeps drawing the old position — the same drift the family removed
   * from RangeField, and the reason it is documented rather than hidden.
   */
  sync = (): void => {
    const positions = this.#fields.map((f) => RangeScale.#position(f))

    // A lane with two controls publishes both ends. Sorted, because which input
    // is the lower one is a fact about the values, not about document order — and
    // a clamping owner may have just corrected one of them.
    if (positions.length > 1) {
      const [a, b] = [...positions].sort((x, y) => x - y)
      this.#root.style.setProperty('--_rs-a', String(a))
      this.#root.style.setProperty('--_rs-b', String(b))
    }

    // Always published, so anything reading a single position still works.
    this.#root.style.setProperty('--_rs-p', String(positions[positions.length - 1]))

    // The lane owns the formatted value, and mirrors it downward. Only when it
    // actually has one — an authored aria-valuetext on a field with no output is
    // the host's, and overwriting it would be a regression, not a sync.
    //
    // With two controls the lane deliberately does NOT mirror: a span's spoken
    // value is "lowest of a–b" and "highest of a–b", which is a statement about
    // the pair. Whatever owns the pair writes that; the lane would only be able
    // to guess.
    if (this.#output && this.#fields.length === 1) {
      // Only the number is written; the unit is markup and stays put.
      this.#output.querySelector('.digits')?.replaceChildren(this.#field.value)
      this.#field.setAttribute('aria-valuetext', this.#format())
    }
  }

  /**
   * Reserve room for the widest NUMBER the readout can show, so the lane's width
   * does not follow its content. A value crossing into another digit is one
   * character wider, and in a shrink-to-fit container that widens the lane — which
   * recomputes every position and makes the thumb jump mid-drag.
   *
   * Digits only, in `ch`, which under tabular numerals is exactly a digit's width.
   * The unit is static markup and costs its natural width: reserving the whole
   * string over-reserved by a quarter, and permanent width is a worse defect than
   * the jump it removes.
   */
  #reserveReadoutWidth(): void {
    if (!this.#output) return
    const digits = Math.max(
      ...this.#fields.flatMap((f) => [(f.min || '0').length, (f.max || '100').length]),
    )
    this.#root.style.setProperty('--_rs-value-digits', String(digits))
  }

  static #position(field: HTMLInputElement): number {
    const min = Number(field.min || 0)
    const max = Number(field.max || 100)
    const span = max - min
    // A zero span has no position to express; clamp rather than divide by zero.
    return span === 0 ? 0 : (field.valueAsNumber - min) / span
  }

  /** `data-suffix` on the output carries the unit; absent means the bare number. */
  #format(): string {
    const suffix = this.#output?.dataset.suffix ?? ''
    return suffix ? `${this.#field.value} ${suffix}` : this.#field.value
  }

  get value(): number {
    return this.#field.valueAsNumber
  }

  get position(): number {
    return Number(this.#root.style.getPropertyValue('--_rs-p') || 0)
  }

  destroy(): void {
    for (const field of this.#fields) field.removeEventListener('input', this.sync)
    delete (this.#root as MountedElement).__rangeScaleInstance
  }
}
