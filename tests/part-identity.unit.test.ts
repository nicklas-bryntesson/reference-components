import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A part has two names (ADR-0033): a lowercase class the stylesheet reads, and
 * `data-part` when a test, the reference JS or a composing component has to find
 * it. The two never cross:
 *
 *   - a stylesheet never selects on `data-part`          (appearance reads classes)
 *   - a test or JS never finds a part by class            (behaviour reads data-part)
 *   - a `data-part` that nothing finds is dead            (identity is earned, not decorative)
 *
 * That is what lets a reader tell, from the markup alone, which names are
 * load-bearing: a class is free to change, a `data-part` is a contract.
 *
 * "Finds" is judged per component: a finder file counts for component C if it
 * lives under C or mentions C by name (root class, data-component, custom element,
 * attach/constructor call). That is how Picklist's tests may hold on to the Notice
 * parts they render, without Notice's `title` counting as found for ToggleTip.
 *
 * Every active component is covered — the directory is the list. Parked legacy
 * references are excluded as in ADR-0019. The kernel's WheelColumn is checked
 * alongside.
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

const finderFiles: string[] = [
  ...SWEPT.flatMap((c) => {
    const t = join(DIR, c, 'tests')
    return [
      ...(existsSync(t) ? readdirSync(t, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(t, e.name)) : []),
      ...[`${DIR}/${c}/${c}.ts`, `${DIR}/${c}/${c}.js`].filter(existsSync),
    ]
  }),
  'src/kernel/js/WheelColumn.ts',
  ...readdirSync('src/kernel/js/tests').map((f) => 'src/kernel/js/tests/' + f),
  ...readdirSync('tests').map((f) => 'tests/' + f),
].filter((f) => statSync(f).isFile())

const customElement = (c: string) => c.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
const mentions = (file: string, c: string): boolean =>
  file.includes(`/${c}/`) ||
  new RegExp(`\\.${c}\\b|data-component="${c}"|<${customElement(c)}\\b|${c}\\.attach|new ${c}\\(`).test(read(file))
const foundFor = (part: string, c: string): boolean =>
  finderFiles.filter((f) => mentions(f, c)).some((f) => new RegExp(`data-part=\\\\?["']${part}\\\\?["']`).test(read(f)))
/** Components whose markup a kitchensink hosts (a Notice inside a Picklist): their parts are theirs. */
const composedBy = (c: string): string[] =>
  [...new Set([...read(join(DIR, c, `${c}.html`)).matchAll(/class="([A-Z][A-Za-z]+)/g)].map((m) => m[1]))].filter((x) => x !== c && SWEPT.includes(x))
const isFound = (part: string, c: string): boolean => foundFor(part, c) || composedBy(c).some((x) => foundFor(part, x))

/** `[data-part=…]` in a stylesheet — appearance reading identity. */
const cssDataPartSelectors = (css: string): string[] =>
  [...new Set([...stripComments(css).matchAll(/\[data-part=["']([a-z][a-z0-9-]*)["']\]/g)].map((m) => m[1]))].sort()

describe('a part has two names — class for styling, data-part for identity (ADR-0033)', () => {
  it('covers the whole component directory', () => {
    expect(SWEPT.length).toBeGreaterThan(15)
    for (const name of SWEPT) expect(existsSync(join(DIR, name))).toBe(true)
  })

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
      it('stylesheet never selects on data-part', () => {
        expect(cssDataPartSelectors(read(`${base}.css`))).toEqual([])
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
      it('every data-part is found by a test, the JS or a composing component', () => {
        const dead = parts.filter((p) => !isFound(p, name))
        expect(dead, [
          `${name} carries data-part on ${dead.length} part(s) nothing finds:`,
          ...dead.map((p) => `  ${p}`),
          'Identity is earned: drop the attribute and keep the class, or write the test that needs it.',
        ].join('\n')).toEqual([])
      })
    })
  }

  for (const [label, cssPath, logicPath, testsDir] of KERNEL) {
    const testFiles = readdirSync(testsDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(testsDir, e.name))
    const logic = read(logicPath)
    const tests = testFiles.map(read).join('\n')
    const parts = partVocabulary(logic)
    describe(label, () => {
      it('stylesheet never selects on data-part', () => expect(cssDataPartSelectors(read(cssPath))).toEqual([]))
      it('kernel JS finds no part by class', () => expect(queryClassSelectors(logic)).toEqual([]))
      it('kernel tests locate no part by class', () => expect(queryClassSelectors(tests)).toEqual([]))
      it('no string literal in JS or tests names a part by class', () =>
        expect(stringClassSelectors(logic + '\n' + tests, parts)).toEqual([]))
      it('every data-part is found by a test or the JS', () =>
        expect(parts.filter((p) => !isFound(p, 'Wheel'))).toEqual([]))
    })
  }
})
