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
 * The sweep runs one component per PR. Add a component here in the PR that
 * sweeps it; the list is the migration's progress bar. When every component is
 * listed, replace the allowlist with the full directory.
 */

const SWEPT = ['ToggleTip', 'TimeField', 'MonthField']

const DIR = 'src/partials/components'
const read = (p: string): string => (existsSync(p) ? readFileSync(p, 'utf8') : '')
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

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
    for (const c of m[2].matchAll(/\.([a-z][a-z0-9-]*)/g)) out.add(c[1])
  }
  return [...out].sort()
}

/** Lowercase classes minted in authored markup — TS template strings, generator, kitchensink. */
function authoredClasses(src: string): string[] {
  const out = new Set<string>()
  for (const m of stripComments(src).matchAll(/class=["']([^"']*)["']/g)) {
    for (const c of m[1].split(/\s+/)) {
      // Harness classes on the kitchensink page are not component parts.
      if (/^[a-z]/.test(c) && !c.startsWith('kitchensink-') && c !== 'state-table') out.add(c)
    }
  }
  return [...out].sort()
}

describe('part identity is data-part, not a class (swept components)', () => {
  it('lists swept components', () => {
    expect(SWEPT.length).toBeGreaterThan(0)
    for (const name of SWEPT) expect(existsSync(join(DIR, name))).toBe(true)
  })

  for (const name of SWEPT) {
    const base = join(DIR, name, name)
    const testsDir = join(DIR, name, 'tests')
    const testFiles = existsSync(testsDir) ? readdirSync(testsDir).map((f) => join(testsDir, f)) : []
    const logic = [`${base}.ts`, `${base}.js`, `${base}.generate.ts`].map(read).join('\n')
    const markup = [`${base}.ts`, `${base}.js`, `${base}.generate.ts`, `${base}.html`].map(read).join('\n')

    describe(name, () => {
      it('stylesheet selects no lowercase class', () => {
        expect(cssClassSelectors(read(`${base}.css`))).toEqual([])
      })
      it('reference JS finds no part by class', () => {
        expect(queryClassSelectors(logic)).toEqual([])
      })
      it('tests locate no part by class', () => {
        expect(queryClassSelectors(testFiles.map(read).join('\n'))).toEqual([])
      })
      it('authored markup mints no lowercase class', () => {
        expect(authoredClasses(markup)).toEqual([])
      })
    })
  }
})
