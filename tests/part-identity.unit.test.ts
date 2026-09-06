import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Part identity is `data-part`; class names carry styling only.
 *
 * In a swept component nothing may find a part by a lowercase class: not the
 * stylesheet, not a querySelector in the reference JS, not a locator in the
 * suite, and the authored markup must not mint one. Otherwise the promise that a
 * consumer may discard every class name is only nearly true — the suite passes
 * upstream and fails on the first CSS-Modules or shadow-DOM port, where class
 * names are hashed or invisible.
 *
 * Every active component is covered — the directory is the list, so a new
 * component is guarded the day its folder appears. Parked legacy references are
 * excluded as in ADR-0019. The kernel's WheelColumn injects parts too, and is
 * checked alongside.
 */

const DIR = 'src/partials/components'
const PARKED = new Set(['TabAccordion', 'Combobox'])
const SWEPT = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !PARKED.has(e.name))
  .map((e) => e.name)
  .sort()

/** Kernel modules that mint parts: [label, stylesheet, logic, tests dir]. */
const KERNEL: [string, string, string, string][] = [
  ['kernel/Wheel', 'src/kernel/css/Wheel.css', 'src/kernel/js/WheelColumn.ts', 'src/kernel/js/tests'],
]
const read = (p: string): string => (existsSync(p) ? readFileSync(p, 'utf8') : '')
// Block comments, line comments, and trailing ` // …` comments — the last because a
// quote inside one (`// "$"`) mis-pairs the string scan below.
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/\s.*$/gm, '')

/** Lowercase class selectors in a stylesheet, outside comments. */
function cssClassSelectors(css: string): string[] {
  const out = new Set<string>()
  for (const chunk of stripComments(css).split('{')) {
    const selector = chunk.split('}').pop() ?? ''
    if (!selector.trim() || selector.trim().startsWith('@')) continue
    for (const m of selector.matchAll(/\.([a-z][a-z0-9-]*)/g)) out.add(m[1])
  }
  return [...out].sort()
}

/** `.lowercase` inside a querySelector / closest / matches / locator string literal. */
function queryClassSelectors(src: string): string[] {
  const out = new Set<string>()
  const calls = /(?:querySelector(?:All)?|closest|matches|locator|\$\$?)\(\s*(['"`])([^'"`]*)\1/g
  for (const m of stripComments(src).matchAll(calls)) {
    // `demo-*` is demo CONTENT a region wraps, not a part — see authoredClasses.
    for (const c of m[2].matchAll(/\.([a-z][a-z0-9-]*)/g)) if (!c[1].startsWith('demo-')) out.add(c[1])
  }
  return [...out].sort()
}

/** The part vocabulary a component actually mints: every data-part value in its sources. */
function partVocabulary(src: string): string[] {
  return [...new Set([...src.matchAll(/data-part[=:]\s*["']([a-z][a-z0-9-]*)["']|['"]data-part['"],\s*['"]([a-z][a-z0-9-]*)['"]/g)].map((m) => m[1] ?? m[2]))]
}

/**
 * `.part` for a KNOWN part inside ANY string literal — not just the ones handed to a
 * query call. An array of selectors mapped over later, or a CDP `selector:` option,
 * is a class-era selector all the same; the call-site scan above cannot see it, and
 * both shapes shipped green once before this check existed.
 */
function stringClassSelectors(src: string, parts: string[]): string[] {
  if (parts.length === 0) return []
  const out = new Set<string>()
  const re = new RegExp(`\\.(${parts.join('|')})(?![\\w-])`, 'g')
  for (const lit of stripComments(src).matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    // No tokenizer here, so two guards keep this honest: a `${…}` expression is
    // property access (`${this.native.id}`), not a selector, and is dropped; and a
    // "literal" spanning lines is a mis-paired quote swallowing code, and is skipped.
    // A real selector string is one line, and every miss this caught was.
    const body = lit[2].replace(/\$\{[^}]*\}/g, '')
    if (body.includes('\n')) continue
    for (const m of body.matchAll(re)) out.add(m[1])
  }
  return [...out].sort()
}

/** Lowercase classes minted in authored markup — TS template strings, generator, kitchensink. */
function authoredClasses(src: string): string[] {
  const out = new Set<string>()
  for (const m of stripComments(src).matchAll(/class=["']([^"']*)["']/g)) {
    for (const c of m[1].split(/\s+/)) {
      // Harness classes on the kitchensink page are not component parts, and neither is
      // demo CONTENT a region wraps (`demo-*`) — a consumer's own markup stands in there.
      if (/^[a-z]/.test(c) && !c.startsWith('kitchensink-') && !c.startsWith('demo-') && c !== 'state-table' && c !== 'prose') out.add(c)
    }
  }
  return [...out].sort()
}

describe('part identity is data-part, not a class (swept components)', () => {
  it('covers the whole component directory', () => {
    expect(SWEPT.length).toBeGreaterThan(15)
    for (const name of SWEPT) expect(existsSync(join(DIR, name))).toBe(true)
  })

  for (const [label, cssPath, logicPath, testsDir] of KERNEL) {
    const testFiles = readdirSync(testsDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(testsDir, e.name))
    const logic = read(logicPath)
    const tests = testFiles.map(read).join('\n')
    const parts = partVocabulary(logic)
    describe(label, () => {
      it('stylesheet selects no lowercase class', () => expect(cssClassSelectors(read(cssPath))).toEqual([]))
      it('kernel JS finds no part by class', () => expect(queryClassSelectors(logic)).toEqual([]))
      it('kernel tests locate no part by class', () => expect(queryClassSelectors(tests)).toEqual([]))
      it('no string literal in JS or tests names a part by class', () =>
        expect(stringClassSelectors(logic + '\n' + tests, parts)).toEqual([]))
    })
  }

  for (const name of SWEPT) {
    const base = join(DIR, name, name)
    const testsDir = join(DIR, name, 'tests')
    const testFiles = existsSync(testsDir)
      ? readdirSync(testsDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(testsDir, e.name))
      : []
    const logic = [`${base}.ts`, `${base}.js`, `${base}.generate.ts`].map(read).join('\n')
    const markup = [`${base}.ts`, `${base}.js`, `${base}.generate.ts`, `${base}.html`].map(read).join('\n')
    const tests = testFiles.map(read).join('\n')
    const parts = partVocabulary(markup)

    describe(name, () => {
      it('stylesheet selects no lowercase class', () => {
        expect(cssClassSelectors(read(`${base}.css`))).toEqual([])
      })
      it('reference JS finds no part by class', () => {
        expect(queryClassSelectors(logic)).toEqual([])
      })
      it('tests locate no part by class', () => {
        expect(queryClassSelectors(tests)).toEqual([])
      })
      it('no string literal in JS or tests names a part by class', () => {
        expect(stringClassSelectors(logic + '\n' + tests, parts)).toEqual([])
      })
      it('authored markup mints no lowercase class', () => {
        expect(authoredClasses(markup)).toEqual([])
      })
    })
  }
})
