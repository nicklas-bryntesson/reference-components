import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every `data-*` a component's stylesheet SELECTS ON must actually be produced
 * somewhere — by the component, by a component that composes it, or by the
 * consumer under a documented contract. A rule keyed on an attribute nobody
 * writes is dead: it looks like the feature exists, the suite stays green, and
 * only the rendering is wrong.
 *
 * This exists because DateTimeField styled `td[data-today="true"]` and
 * `td[data-disabled="true"]` and its `_renderMonth()` set neither, so today was
 * not bold and an out-of-range day looked ordinary — while DateField and
 * WeekField, sharing the same markup shape, set both. The aria half was correct,
 * which is exactly why no accessibility test could see it.
 *
 * Static on purpose. The obvious runtime version — "query every attribute
 * selector against the rendered page" — was tried and rejected: it flagged 81 of
 * 193 selectors, almost all of them mutually exclusive states that cannot be
 * reachable at once (`[data-direction="top"]` and `[data-direction="bottom"]` on
 * one instance) or modes absent on the test platform (`data-input-mode="display"`
 * is touch-only). Asking who *writes* the attribute has no such blind spot: both
 * directions are written, so both pass.
 *
 * KNOWN LIMIT — this checks attribute NAMES, not the elements they sit on. Of the
 * two dead rules that motivated it, this catches `data-today` and would NOT have
 * caught `td[data-disabled="true"]`, because DateTimeField writes `data-disabled`
 * on its own root, so the name was present while the `<td>` rule was dead.
 * Distinguishing those needs dataflow — knowing a given variable holds a `<td>` —
 * which is more fragility than the extra catch is worth. Stated here so the next
 * reader knows the shape of what still gets through, rather than trusting a green
 * run further than it deserves.
 */

const DIR = 'src/partials/components'

// Parked legacy references, excluded as in ADR-0019.
const PARKED = new Set(['TabAccordion', 'Combobox'])

// Written by the harness or the framework, never by a component.
const NOT_A_COMPONENT_CONCERN = /^data-(test-state|component|id|name|template)$/

const read = (p: string): string => (existsSync(p) ? readFileSync(p, 'utf8') : '')

function componentNames(): string[] {
  return readdirSync(DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !PARKED.has(e.name))
    .map((e) => e.name)
}

/** Everything a component authors: logic, state generator, kitchensink, contract. */
function sourcesOf(name: string): string {
  const base = join(DIR, name, name)
  return [`${base}.ts`, `${base}.js`, `${base}.generate.ts`, `${base}.html`, `${base}.md`]
    .map(read)
    .join('\n')
}

/** Attributes a stylesheet selects on. */
function attributesRead(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...new Set([...withoutComments.matchAll(/\[(data-[a-z0-9-]+)/g)].map((m) => m[1]))]
}

/** Attributes some source produces, sets, or documents as the consumer's. */
function attributesWritten(source: string): Set<string> {
  const out = new Set<string>()
  // dataset.outsideMonth → data-outside-month
  for (const m of source.matchAll(/dataset\.([A-Za-z0-9]+)/g)) {
    out.add('data-' + m[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()))
  }
  // setAttribute('data-x'), a generator's { 'data-x': … }, markup's data-x=
  for (const m of source.matchAll(/['"`](data-[a-z0-9-]+)['"`]/g)) out.add(m[1])
  for (const m of source.matchAll(/(data-[a-z0-9-]+)\s*=/g)) out.add(m[1])
  return out
}

describe('no component styles an attribute nobody writes', () => {
  const names = componentNames()

  it('finds components to check', () => {
    expect(names.length).toBeGreaterThan(5)
  })

  for (const name of names) {
    const css = read(join(DIR, name, `${name}.css`))
    if (!css) continue

    it(`${name}`, () => {
      // An owner may write state onto a child component's root — RangeGroup sets
      // `data-fields` and `data-on-top` on the RangeScale it composes — so the
      // writers are this component plus anything whose markup mounts it.
      const composers = names.filter(
        (other) => other !== name && sourcesOf(other).includes(`data-component="${name}"`),
      )
      const written = attributesWritten([name, ...composers].map(sourcesOf).join('\n'))

      const dead = attributesRead(css).filter(
        (a) => !written.has(a) && !NOT_A_COMPONENT_CONCERN.test(a),
      )

      expect(dead, [
        `${name}.css selects on ${dead.length} attribute(s) that nothing writes:`,
        ...dead.map((a) => `  [${a}]`),
        composers.length ? `Searched ${name} and its composers: ${composers.join(', ')}.` : `Searched ${name}.`,
        'Either the component should set it, a composing component should, or the',
        'contract should document it as the consumer\'s to author.',
      ].join('\n')).toEqual([])
    })
  }
})
