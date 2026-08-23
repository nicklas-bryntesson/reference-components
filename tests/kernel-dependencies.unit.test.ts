import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every kernel primitive a component imports must be declared in its contract
 * under `## Kernel dependencies`.
 *
 * PORTING.md tells a porter to port the kernel first and points them at that
 * section to know what a component needs. An undeclared import makes the section
 * a lie in the one direction that costs real work: the porter builds the
 * component, the suite fails on behaviour that lives in a primitive they were
 * never told about, and it reads as a bug in their port.
 *
 * ThemeSwitch shipped exactly that. It imports `theme-preference`, mentions it in
 * prose halfway down the file, and had no `## Kernel dependencies` section at all
 * — so it was invisible to any mechanical read, and a port-order table generated
 * from the contracts listed it as needing no kernel.
 *
 * One direction only: an import must be declared. The reverse — a declared
 * dependency with no import — is not checked, because CSS entries like
 * `css/Wheel.css` are real dependencies that no JS import statement expresses.
 */

const DIR = 'src/partials/components'
const PARKED = new Set(['TabAccordion', 'Combobox'])
const read = (p: string): string => (existsSync(p) ? readFileSync(p, 'utf8') : '')

describe('every kernel import is declared in the contract', () => {
  const names = readdirSync(DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !PARKED.has(e.name))
    .map((e) => e.name)

  const withCode = names.filter((n) =>
    ['ts', 'js'].some((e) => existsSync(join(DIR, n, `${n}.${e}`))),
  )

  it('finds components with code to check', () => {
    expect(withCode.length).toBeGreaterThan(3)
  })

  for (const name of withCode) {
    it(`${name}`, () => {
      const code = ['ts', 'js'].map((e) => read(join(DIR, name, `${name}.${e}`))).join('\n')
      const imported = [
        ...new Set(
          [...code.matchAll(/from\s+['"][^'"]*kernel\/(?:js|utils)\/([A-Za-z0-9-]+)['"]/g)].map(
            (m) => m[1],
          ),
        ),
      ]
      if (imported.length === 0) return

      const contract = read(join(DIR, name, `${name}.md`))
      const section = contract.split(/^## Kernel dependencies\s*$/m)[1] ?? ''
      // Stop at the next heading, so a mention elsewhere in the file does not count.
      const declared = section.split(/^## /m)[0]

      const undeclared = imported.filter((mod) => !declared.includes(mod))
      expect(undeclared, [
        `${name}.ts imports ${imported.length} kernel module(s); ${undeclared.length} are not`,
        `declared under "## Kernel dependencies" in ${name}.md:`,
        ...undeclared.map((m) => `  kernel/…/${m}`),
        'A porter reads that section to know what to port first.',
      ].join('\n')).toEqual([])
    })
  }
})
