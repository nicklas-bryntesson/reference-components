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
  for (const m of source.matchAll(/(?<!\[)(data-[a-z0-9-]+)\s*=/g)) out.add(m[1])
  return out
}

/** Literal values a source assigns to each attribute, plus which ones it writes dynamically. */
function valuesWritten(source: string): { literal: Map<string, Set<string>>; dynamic: Set<string> } {
  const literal = new Map<string, Set<string>>()
  const dynamic = new Set<string>()
  const add = (attr: string, value: string): void => {
    if (!literal.has(attr)) literal.set(attr, new Set())
    literal.get(attr)!.add(value)
  }
  // markup: data-x="v" — skip anything with a template hole, that is dynamic.
  //
  // The lookbehind is load-bearing. A querySelector string `'[data-picker="month"]'`
  // is indistinguishable from markup to a flat regex, so without it a typo in a JS
  // selector registers itself as a written value and the check can never fail on
  // it — which is exactly how the first version of this test passed against a
  // planted typo. Markup is preceded by whitespace; a selector by `[`.
  for (const m of source.matchAll(/(?<!\[)(data-[a-z0-9-]+)\s*=\s*["']([^"'{}$]*)["']/g)) {
    add(m[1], m[2])
  }
  // a generator's attribute map: 'data-x': 'v'
  for (const m of source.matchAll(/['"](data-[a-z0-9-]+)['"]\s*:\s*['"]([^'"]*)['"]/g)) add(m[1], m[2])
  for (const m of source.matchAll(/setAttribute\(\s*['"](data-[a-z0-9-]+)['"]\s*,\s*([^)]*)\)/g)) {
    const v = m[2].trim()
    if (/^['"][^'"]*['"]$/.test(v)) add(m[1], v.slice(1, -1))
    else dynamic.add(m[1])
  }
  // `=(?!=)` matters: `dataset.panel === active` is a comparison, and reading it
  // as an assignment marked the attribute dynamic, which silently switched this
  // whole check off for it. That is how the first version of this test passed
  // against a deliberately planted typo.
  for (const m of source.matchAll(/dataset\.([A-Za-z0-9]+)\s*=(?!=)\s*([^\n;]*)/g)) {
    const attr = 'data-' + m[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
    const v = m[2].trim()
    if (/^['"][^'"]*['"]$/.test(v)) add(attr, v.slice(1, -1))
    else dynamic.add(attr)
  }
  // any template or binding form makes the value unknowable from here
  for (const m of source.matchAll(/(data-[a-z0-9-]+)\s*=\s*["']?\{?\$?\{/g)) dynamic.add(m[1])

  // A contract table row documents the permitted set:
  //   | `data-reference-layer` | `under` · `over` · `outside` | … |
  for (const line of source.split('\n')) {
    const decl = line.match(/`(data-[a-z0-9-]+)`/)
    if (!decl || !line.trimStart().startsWith('|')) continue
    for (const v of line.matchAll(/`([a-z0-9-]+)`/g)) {
      if (v[1] !== decl[1].slice(5) && !v[1].startsWith('data-')) add(decl[1], v[1])
    }
  }
  return { literal, dynamic }
}

/** Attribute values a stylesheet or a querySelector literal selects on. */
function valuesRead(sources: string[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const src of sources) {
    for (const m of src.matchAll(/\[(data-[a-z0-9-]+)\s*=\s*["']([^"']+)["']\]/g)) {
      if (!out.has(m[1])) out.set(m[1], new Set())
      out.get(m[1])!.add(m[2])
    }
  }
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

/**
 * The same question one level down: not just "does anything write this
 * attribute", but "does anything write THIS VALUE". A selector keyed on a value
 * nothing produces is dead in exactly the same way, and it is the failure mode a
 * move to `data-part` would introduce at scale — `[data-part="poppup"]` is a
 * silent no-op that a grep for `popup` will never find, where a misspelt `.popup`
 * at least stands out as a class that exists nowhere else.
 *
 * An attribute written dynamically (`setAttribute('data-x', String(flag))`) has no
 * knowable value set, so it is skipped rather than guessed at. A contract table
 * row counts as a declaration: the permitted values of a consumer-authored
 * attribute live in the `.md`, not in our markup, and `data-reference-layer="over"`
 * is deliberately documented without appearing in any demo.
 */
describe('no component selects on an attribute value nobody produces', () => {
  for (const name of componentNames()) {
    const css = read(join(DIR, name, `${name}.css`))
    if (!css) continue

    it(`${name}`, () => {
      const js = ['ts', 'js'].map((e) => read(join(DIR, name, `${name}.${e}`))).join('\n')
      const reads = valuesRead([css.replace(/\/\*[\s\S]*?\*\//g, ''), js])

      const composers = componentNames().filter(
        (other) => other !== name && sourcesOf(other).includes(`data-component="${name}"`),
      )
      const { literal, dynamic } = valuesWritten([name, ...composers].map(sourcesOf).join('\n'))

      const dead: string[] = []
      for (const [attr, values] of reads) {
        if (dynamic.has(attr) || NOT_A_COMPONENT_CONCERN.test(attr)) continue
        for (const value of values) {
          if (!literal.get(attr)?.has(value)) dead.push(`[${attr}="${value}"]`)
        }
      }

      expect(dead, [
        `${name} selects on ${dead.length} attribute value(s) that nothing produces:`,
        ...dead.map((d) => `  ${d}`),
        'Either write the value, or document it in the contract as the consumer\'s.',
      ].join('\n')).toEqual([])
    })
  }
})
