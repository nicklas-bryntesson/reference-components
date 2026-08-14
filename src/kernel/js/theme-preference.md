# theme-preference (kernel / pure logic)

Which colour appearance applies **right now**, given what the user chose and what the OS reports.
The pure heart of the `ThemeSwitch` component, extracted so the decision is specified once and
unit-tested exhaustively — never re-derived (and drifted) per call site.

No DOM, no browser globals, and deliberately **no colours**. The component reads the live signal
from the platform and projects the result onto the document root; what that appearance *looks like*
is the consuming project's business.

## Why this is extracted

The production implementation this is modelled on carried **three copies** of the same decision —
one in its token collector, one in the layout's inline script, and one in its runtime manager, the
last with the comment *"duplicated from Layout for runtime use"*. Three copies of a branch is three
chances to drift. Same motivation as `motion-policy`.

## Public API

```ts
resolvePreference(stored: string | null | undefined): Preference
resolveAppearance(preference: Preference, prefersDark: boolean): Appearance
shouldProject(preference: Preference): boolean

type Preference = 'system' | 'light' | 'dark'
type Appearance = 'light' | 'dark'
```

## Semantics

- **`resolvePreference`** — the three known values pass through; **everything else** resolves to
  `'system'`: `null` (never chosen), `''`, a value written by a future version, a value written by
  another app sharing the storage key, or plain corruption. It never throws, because an unnamed
  preference would render a radio group with nothing checked. Case-sensitive on purpose — `'Dark'`
  is not a value this library writes, so mapping it to `'dark'` would be guessing at another
  writer's intent.

- **`resolveAppearance` precedence** — the whole state machine:
  1. `'light'` → `'light'` (explicit; the signal is not consulted)
  2. `'dark'` → `'dark'` (explicit; the signal is not consulted)
  3. `'system'` → `prefersDark ? 'dark' : 'light'`

  Steps 1 and 2 are the contract, not an optimisation: **an OS change moves nothing for a user who
  has chosen.** This is the same rule `resolveMotion` step 3 encodes for motion — a platform signal
  never revokes an active user decision.

- **`shouldProject`** — `'system'` projects nothing. An absent attribute *is* "follow the OS", which
  `color-scheme: light dark` already does. Writing a resolved appearance for it would mean
  recomputing on every OS change and, before first paint, an inline script to avoid a flash. Doing
  less is the correctness argument here, not only the simplicity one.

## Conformance

Black-box unit tests: [`tests/theme-preference.unit.test.ts`](tests/theme-preference.unit.test.ts)
cover every unknown-input case, all six `(preference × prefersDark)` combinations, the headline rule
stated on its own in both directions, the invariant that only the `system` branch reads the signal
at all, and the two compositions the component actually performs. Pure functions → no jsdom needed.

## Consumed by

`ThemeSwitch`. The component's e2e suite proves the live browser signal reaches these functions and
that the DOM reflects the result (`data-appearance` on the root, absent for `system`).
