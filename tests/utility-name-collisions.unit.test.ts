import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * No element class may be a bare utility-framework class name.
 *
 * ADR-0019 chose generic single words for element classes so a consumer could
 * discard them. Generic single words are also exactly what a utility framework
 * generates, and the collision is worse than a name clash because **the cascade
 * resolves per declaration**: the utility does not have to beat our rule, it only
 * has to set a property our rule does not mention.
 *
 * Measured in a Tailwind port, and neither was a specificity fight:
 *
 *   .DateField .popup .grid { width; border-collapse }   ← no `display`
 *   Tailwind   .grid        { display: grid }            ← unopposed, applied
 *   → the calendar <table> became a one-column grid, 7×32px inside a 262px box
 *
 *   .Wheel .cylinder { position; inset; transform-style; will-change }  ← no shadow
 *   Tailwind .ring   { box-shadow: var(--tw-ring-shadow) }             ← unopposed
 *   → a grey ring around every wheel column
 *
 * Our higher specificity protected nothing, because it never named the hijacked
 * property. `.grid` was also the odd one out: DateTimeField and WeekField already
 * called the same element `.calendar-grid`, so the fix converged a name rather
 * than inventing one.
 *
 * Tailwind is the instance, not the rule. Any utility framework mints the same
 * vocabulary, so the constraint is on our side: a part name has to be a *part*,
 * not a CSS behaviour.
 */

// Tailwind core utilities that are a single bare token — the only shape that can
// collide with a one-word element class. Compound utilities (`flex-col`, `w-full`)
// cannot, because no part is named that way.
const BARE_UTILITIES = new Set(
  `block inline flex grid contents hidden table flow-root list-item
   static fixed absolute relative sticky container visible invisible collapse
   shadow ring border divide outline rounded
   italic antialiased subpixel-antialiased underline overline truncate
   uppercase lowercase capitalize ordinal
   filter blur grayscale invert sepia transform transition resize isolate
   grow shrink sr-only not-sr-only`.split(/\s+/),
)

const DIR = 'src/partials/components'
const PARKED = new Set(['TabAccordion', 'Combobox'])
const read = (p: string): string => (existsSync(p) ? readFileSync(p, 'utf8') : '')

function partClasses(css: string): Set<string> {
  const out = new Set<string>()
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const chunk of withoutComments.split('{')) {
    const selector = chunk.split('}').pop() ?? ''
    if (!selector.trim() || selector.trim().startsWith('@')) continue
    for (const m of selector.matchAll(/\.([a-z][a-z0-9-]*)/g)) out.add(m[1])
    // Parts are `data-part` values now (ADR-0026); the collision rule outlives the
    // mechanism, because a port may well project the value back onto a class.
    for (const m of selector.matchAll(/\[data-part=["']([a-z][a-z0-9-]*)["']\]/g)) out.add(m[1])
  }
  return out
}

describe('no element class collides with a utility-framework class', () => {
  const files = readdirSync(DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !PARKED.has(e.name))
    .map((e) => join(DIR, e.name, `${e.name}.css`))
    .concat('src/kernel/css/Wheel.css')
    .filter(existsSync)

  it('finds stylesheets to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const file of files) {
    it(file.split('/').pop()!, () => {
      const collisions = [...partClasses(read(file))].filter((c) => BARE_UTILITIES.has(c)).sort()
      expect(collisions, [
        `${file} names ${collisions.length} part(s) after a utility class:`,
        ...collisions.map((c) => `  ${c}`),
        'A utility only has to set a property this stylesheet does not mention —',
        'specificity does not protect against that. Rename the part.',
      ].join('\n')).toEqual([])
    })
  }
})
