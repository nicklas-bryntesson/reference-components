# ADR 0021: Appearance is a `color-scheme` switch, not a token system — and contrast stays out of the state machine

**Status:** Accepted 2026-08-14 — ThemeSwitch built; the seam shipped first and separately (PR #39)
**Date:** 2026-08-13
**Decider:** Nicklas Bryntesson
**Supersedes in part:** ADR-0020 (its ThemeSwitch deferral — the blocker it named is resolved here)

## Context

ADR-0020 deferred ThemeSwitch on the grounds that the repo owns no theme: `--ui-*` is deliberately
neutral (ADR-0018), built on the system colours `Canvas`/`CanvasText` plus a handful of hardcoded
accents, with no `prefers-color-scheme` anywhere. A theme switch with nothing to switch is not a
reference.

Two things then came into view.

**The components are already theme-reactive, and nothing was wired to prove it.** Measured on the
kitchensink: forcing `color-scheme: dark` flips `Canvas` to `rgb(18,18,18)` and `CanvasText` to
white, and the *inverting* logic in Picklist and ChoiceField follows for free — a selected chip
becomes light-on-dark without a line of new CSS. But `color-scheme` is declared **nowhere** in the
repo, so today the library renders light even for a dark-OS user. The system-colour strategy was
sound and simply never switched on.

**A working implementation showed exactly which parts must not be copied.** A production Astro
ThemeSwitch (cookie-persisted, SSR-resolved) carries a per-component JS token registry aggregated by
a collector, four named appearances (`light`, `dark`, `light-contrast`, `dark-contrast`), and
`document.documentElement.style.cssText = tokenMap` to apply them. It also triplicates its
`calculateAppearance` decision function — one copy in the collector, one in the layout's inline
script, one in the manager with the comment *"duplicated from Layout for runtime use"*.

That surfaced the real question, asked as devil's advocate: **is it a reference library's business to
have opinions about the consumer's tokens?** It is not. So the design question is how to make the
colour-mode state machine extractable without prescribing a token methodology.

## Decision

Three layers, and only two of them are ours:

| Layer | Ours? |
|---|---|
| **The resolver** — stored preference + OS signal → an appearance | ✅ pure kernel logic |
| **The projection** — where the resolved appearance lands in the DOM | ✅ an *interface*, one attribute |
| **The values** — what `dark` actually looks like | ❌ never; defaults only |

### 1. `data-appearance` on the root, and its only job is switching `color-scheme`

```css
:root { color-scheme: light dark; }                       /* follow the OS */
:root[data-appearance="light"] { color-scheme: light; }
:root[data-appearance="dark"]  { color-scheme: dark; }
```

Setting `color-scheme` is a **platform** declaration, not a design decision: it is what makes system
colours, form controls, scrollbars and UA-rendered chrome correct. Because every component in the
library already reads `Canvas`/`CanvasText`, this single switch makes the whole set reactive with no
component changes. Verified in the browser: `Canvas` resolves to `rgb(18,18,18)` under
`[data-appearance="dark"]` and `rgb(255,255,255)` under `light`.

**When the preference is `system`, no attribute is projected at all.** The absent attribute *is* the
system state, and `color-scheme: light dark` already delegates to the OS. That removes the flash, the
inline correction script and the token re-application for the most common case — by doing less.

### 2. Values are `light-dark()` pairs in the existing seam — same names, no new concepts

The seven hardcoded accents in `ui-tokens.css` gain a dark half:

```css
--ui-primary: light-dark(#0066cc, #66b3ff);
```

This does **not** reverse ADR-0018; it completes it. That file already ships *light* values and calls
them "neutral standalone DEFAULTS — the reference looks right with nothing wired". A default in both
modes is symmetrical with a default in one: the same token names, the same seam, the same one-pass
find-replace for a consumer. **Zero new API surface.**

What is rejected is the *mechanism* the Astro version used: no JS token registry, no collector, no
appearance-keyed token maps, no `style.cssText` injection (which silently destroys every other inline
style on the root). Values stay plain custom properties in the file that already holds them.

**The lock-in test:** a Tailwind consumer maps `[data-appearance="dark"]` to its `dark` variant in
one line, or points Tailwind's `darkMode` selector at it. If it takes more than one line, we leaked.

### 3. Contrast is not in the state machine

`prefers-contrast: more` has **no user override** — it is a pure OS signal — so it needs no JS and no
place in the resolver. It is expressed as a media query, orthogonal to appearance, and remains fully
addressable in both modes:

```css
@media (prefers-contrast: more) {
  :root { --ui-primary: light-dark(#003d7a, #a8d4ff); }   /* hits light and dark alike */
}
```

Verified: `light-dark()` resolves per the active `color-scheme`, so one contrast block covers all
four cells without naming any of them. This is what keeps `light-contrast` and `dark-contrast` — the
consumer's taxonomy — out of our contract, and keeps the resolver at two states instead of four.

### 4. The kernel is two functions that never see a colour

```ts
type Preference = 'system' | 'light' | 'dark'
type Appearance = 'light' | 'dark'

resolvePreference(stored: string | null): Preference        // unknown input → 'system'
resolveAppearance(pref: Preference, prefersDark: boolean): Appearance
```

No DOM, no globals, no colours — the same discipline as `motion-policy`, and extracted for the same
reason: the Astro source had three copies of this decision and a comment admitting it. The one rule
worth testing exhaustively is the one `resolveMotion` step 3 also encodes: **`system` delegates to
the signal; an explicit choice ignores it.** An OS change must never revoke an active user choice.

### 5. The contract is the DOM end-state, not where it is computed

Per ADR-0009: what is contractual is that the root carries the resolved appearance. Our reference
computes it client-side from `localStorage` plus an inline snippet; an Astro or Razor consumer reads
a cookie and renders `<html data-appearance="dark">` server-side with **zero** client JS. Both satisfy
the same contract and pass the same e2e assertions — the persistence medium is explicitly the host's
choice, and the `.md` documents both.

### 6. ThemeSwitch is a component (`Status: Proposed` here)

The control itself composes Picklist's chip mechanism — an sr-clipped radio whose adjacent label is
the surface — as a three-segment group with icons. It is not a Picklist skin: it owns the resolver,
the persistence, the projection, the `matchMedia` subscription, and a **sliding indicator**, which
Picklist explicitly refuses. The refusal still stands there and does not here: the indicator needs one
CSS rule per segment index, which caps segment count — irrelevant for a control whose arity is fixed
at three by its own contract, fatal for a general-purpose chip list.

## Considered alternatives

1. **Keep ThemeSwitch deferred until the repo "owns a theme"** (ADR-0020's position) — Rejected: it
   assumed owning a theme was the precondition. It is not; declaring `color-scheme` is, and the
   components were already built for it.
2. **Port the Astro token architecture** (JS registry + collector + `cssText`) — Rejected: it imposes
   a token methodology on every consumer, adds a mechanism they must unpick, and `cssText` assignment
   destroys unrelated inline styles on the root.
3. **Four appearances including contrast** (`light-contrast`, `dark-contrast`) — Rejected: doubles the
   contract for a signal with no user override, and imports the consumer's naming into ours. Contrast
   composes as a media query for free.
4. **Project a class (`.dark`) instead of an attribute** — Rejected: classes are for styling hooks and
   this repo puts state in `data-*` (ADR-0002). A consumer who wants a class maps one selector.
5. **Emit the resolved appearance for `system` too** (always project an attribute) — Rejected: it
   needs an inline script before first paint to avoid a flash, and re-introduces the correction pass.
   An absent attribute expresses "follow the OS" precisely.
6. **`color-scheme` switch + `light-dark()` defaults + media-query contrast (chosen)** — one
   declaration per token, one platform switch, one orthogonal contrast block, and no component churn.

## Consequences

### Positive
- The existing 14 components become theme-reactive with **no component changes** — the system-colour
  investment finally pays out.
- The state machine is two pure functions, portable to any stack, and the triplication that motivated
  extraction cannot recur.
- Consumers keep full ownership of values; our footprint is one attribute name and one platform
  declaration.
- The `system` path needs no JavaScript and cannot flash.

### Costs
- `ui-tokens.css` grows a dark half for seven accents plus the shadow — real design decisions, but
  defaults rather than prescriptions.
- `light-dark()` is relatively new. Where it is unsupported the declaration is invalid at
  computed-value time, the custom property goes unset, and components fall back to the literal in
  `var(--ui-x, #hex)` — i.e. light values. Degradation is graceful and must be documented, not
  guarded.
- One more attribute in the repo's vocabulary (`data-appearance`), which is the one opinion no
  contract can avoid.

### Risks to manage
- **Site scaffolding is not reactive.** `site.css` and `kitchensink.css` hold ten hardcoded
  backgrounds. Measured: components flip while the page does not, which renders unselected chips dark
  on a light page (they read as *selected*) and selected chips white on white (invisible). Half-done
  is worse than not started — the scaffolding must land in the same pass as the switch.
- **FileUpload holds five genuinely hardcoded colours** (not token fallbacks). It is the only
  component with real debt here.
- **A consumer may mistake defaults for prescriptions.** The `.md` and `ui-tokens.css` must keep
  saying these are neutral defaults meant to be replaced.

### Non-goals
- No token registry, collector, appearance-keyed maps, or `cssText` application.
- No opinion on persistence medium — cookie, `localStorage` or server session are all conformant.
- No contrast axis in the resolver, and no `*-contrast` appearance names in the contract.
- Not a general theming system: this switches **one** axis (colour scheme). Brand or density themes
  are the consumer's business.

### Kernel dependencies
- New: `theme-preference` (pure resolver, no DOM) — sibling to `motion-policy`.
- Reuses Picklist's chip mechanism as a *recipe*, copied not imported (ADR-0004).

## Reconsider when

- **`light-dark()` support becomes universal or regresses** — the graceful-degradation note is the
  only thing that would change.
- **A second axis earns a user override** (density, brand) — then `data-appearance` may need to become
  a compound value or gain a sibling attribute, and the resolver a second dimension. Contrast is *not*
  that case; it has no override by definition.
- **A consumer reports the one-line mapping is not enough** — that is the signal we leaked a
  methodology after all.
- **`forced-colors` interacts badly** with an explicit appearance choice — the two are independent
  today, but the combination has never been exercised on a real high-contrast machine.

## References

- ADR-0018 (the `--ui-*` seam this completes), ADR-0020 (the ThemeSwitch deferral this resolves),
  ADR-0009 (end-state contract — persistence is the host's choice), ADR-0002 (`data-*` is the public
  API), ADR-0004 (clarity over DRY — the chip recipe is copied), ADR-0005 (`:has()` is progressive
  enhancement only — the Astro source used it load-bearing for its focus ring)
- `src/kernel/js/motion-policy.md` — the precedent for extracting a pure decision function, including
  the "an OS signal must not revoke an active choice" rule
- `src/partials/components/Picklist/Picklist.md` — the chip mechanism, and the sliding-indicator
  non-goal that stands there and is lifted here
- The reference Astro implementation (`ThemeManager.astro`, `ThemeSwitch.astro`,
  `lib/tokens/collector.js`) — the source of both the good parts and the rejected mechanism
