// Which colour appearance applies *right now*, given what the user chose and what
// the OS reports — the pure heart of the ThemeSwitch component (ADR-0021), shared
// so it is specified once and unit-tested exhaustively rather than re-derived.
//
// That re-derivation is not hypothetical. The production implementation this is
// modelled on carried THREE copies of this decision — one in its token collector,
// one in the layout's inline script, and one in its runtime manager, the last
// carrying the comment "duplicated from Layout for runtime use". Three copies of a
// branch is three chances to drift.
//
// The rule that matters, and the only one worth testing from every angle, is the
// same one `resolveMotion` step 3 encodes for motion: an explicit user choice
// outranks the platform signal. Changing the OS theme must never silently revoke
// a choice the user made.
//
// Two pure functions, no DOM, no browser globals, and — deliberately — no colours:
//
//   resolvePreference(stored)          → what the user has chosen (or 'system')
//   resolveAppearance(pref, prefersDark) → which appearance that means today

/**
 * What the user has chosen. `'system'` is not a third colour — it is the explicit
 * absence of a choice, delegating to the platform signal.
 */
export type Preference = 'system' | 'light' | 'dark'

/** What that resolves to. Only two appearances exist; `'system'` is never one of them. */
export type Appearance = 'light' | 'dark'

/** The values a stored preference may legitimately take. */
const PREFERENCES: readonly Preference[] = ['system', 'light', 'dark']

/**
 * Normalise a stored preference into one this library understands.
 *
 * Everything unrecognised resolves to `'system'`: `null` (never chosen), `''`,
 * a value written by a future version, a value written by a different app sharing
 * the key, or plain corruption. This must never throw and must never leave the
 * control in a state that has no radio to match it — an unnamed preference would
 * render a group with nothing checked.
 *
 * Case-sensitive on purpose: `'Dark'` is not a value this library ever writes, so
 * treating it as `'dark'` would be guessing at another writer's intent.
 */
export function resolvePreference(stored: string | null | undefined): Preference {
  return PREFERENCES.includes(stored as Preference) ? (stored as Preference) : 'system'
}

/**
 * Resolve a preference against the platform signal.
 *
 * Precedence — the whole state machine:
 *   1. `'light'`  → `'light'`   (explicit; the signal is not consulted)
 *   2. `'dark'`   → `'dark'`    (explicit; the signal is not consulted)
 *   3. `'system'` → the signal
 *
 * Steps 1 and 2 are the contract: an OS change moves nothing for a user who has
 * chosen. Only step 3 reads `prefersDark` at all.
 *
 * @param preference  the user's normalised choice
 * @param prefersDark whether `(prefers-color-scheme: dark)` currently matches
 */
export function resolveAppearance(preference: Preference, prefersDark: boolean): Appearance {
  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return prefersDark ? 'dark' : 'light'
}

/**
 * Whether a preference should be *projected* onto the document at all.
 *
 * `'system'` projects nothing: an absent attribute is precisely "follow the OS",
 * which `color-scheme: light dark` already does. Writing a resolved appearance for
 * it would mean recomputing on every OS change, and — before first paint — an
 * inline script to avoid a flash. Doing less is the correctness argument here, not
 * only the simplicity one.
 */
export function shouldProject(preference: Preference): boolean {
  return preference !== 'system'
}
