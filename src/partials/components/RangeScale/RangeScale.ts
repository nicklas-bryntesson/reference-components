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
  #field: HTMLInputElement
  #output: HTMLOutputElement | null

  constructor(root: HTMLElement) {
    const field = root.querySelector<HTMLInputElement>('input[type="range"]')
    if (!field) throw new Error('RangeScale: no input[type="range"] found')

    this.#root = root
    this.#field = field
    this.#output = root.querySelector<HTMLOutputElement>('output.value')

    this.#field.addEventListener('input', this.sync)
    this.sync()
    ;(root as MountedElement).__rangeScaleInstance = this
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
    const field = this.#field
    const min = Number(field.min || 0)
    const max = Number(field.max || 100)
    const span = max - min

    // A zero span has no position to express; clamp rather than divide by zero.
    const p = span === 0 ? 0 : (field.valueAsNumber - min) / span

    this.#root.style.setProperty('--_rs-p', String(p))

    // The lane owns the formatted value, and mirrors it downward. Only when it
    // actually has one — an authored aria-valuetext on a field with no output is
    // the host's, and overwriting it would be a regression, not a sync.
    if (this.#output) {
      const text = this.#format()
      this.#output.textContent = text
      field.setAttribute('aria-valuetext', text)
    }
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
    this.#field.removeEventListener('input', this.sync)
    delete (this.#root as MountedElement).__rangeScaleInstance
  }
}
