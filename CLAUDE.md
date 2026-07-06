# CLAUDE.md

## Project

Static component boilerplate — Vite + Handlebars + Tailwind. Components are reference implementations meant to be ported to frameworks or Web Components. Types serve as machine-readable contracts, not build-time enforcement.

## Tech Stack

- **Bundler:** Vite (handles TS transpilation; `tsc` is type-check only)
- **Templates:** Handlebars via `vite-plugin-handlebars`
- **Styling:** Tailwind v4 + PostCSS nesting
- **Unit tests:** Vitest + jsdom
- **E2E tests:** Playwright + axe-playwright
- **TypeScript:** TS is the norm (`strict: true`, `noEmit: true`). The mature component set — DateField, DateTimeField, TimeField, MonthField, WeekField, AffixField, FileUpload, ToggleTip — and the whole `src/kernel/` are all TS. Only TabAccordion and Combobox remain `.js`, and they are **parked legacy references**, not migration targets.

## Commands

```bash
npm run dev          # generate:states + vite dev server
npm run test:unit    # Vitest unit tests
npm run test:e2e     # generate:states + Playwright e2e tests
npm run typecheck    # tsc --noEmit (TypeScript files only)
npm run generate:states  # regenerate .hbs state partials (via vite-node)
```

## Structure

```
src/partials/components/<Name>/
  <Name>.js (or .ts)              # component logic
  <Name>.css                      # component styles
  <Name>.html                     # kitchensink / dev preview
  <Name>.md                       # API reference, a11y notes, non-goals
  <Name>.generate.ts              # state partial generator (if component has states)
  states/                         # generated .hbs partials (~16–21 files) — gitignored, never edit by hand
  tests/
    <Name>.unit.test.*            # unit tests
    <Name>.e2e.test.*             # e2e tests
src/kernel/                       # shared primitives — ported once, composed by components
  js/    WheelColumn.ts, popup-position.ts, popup-interaction.ts   # 3D wheel + popover maths + focus trap / scroll containment
  utils/ dates.ts, locale.ts                 # pure date / locale helpers
  css/   Wheel.css                           # wheel visuals (pairs with WheelColumn)
  <module>.md  + README.md                   # one contract per primitive
  js/tests/, utils/tests/                    # kernel conformance tests
src/js/script.js                  # entry point, imports all active components
src/css/site/01-Setup/tokens.css  # host --SITE--* token contract (components read these)
tasks/                            # current specs & implementation plans (gitignored, local)
docs/superpowers/                 # historical specs/plans archive — no longer the active workflow
```

> **Note:** Shared primitives live in `src/kernel/` with their own contracts and conformance tests. Each component's `.md` lists the primitives it composes under `## Kernel dependencies` — port the kernel once, then the component stays thin.

## Kitchensink Pattern

Each component's `.html` file is a kitchensink with 5–6 sections:

1. **Interaction states** — columns: default / hover / focus / active; rows: empty / filled
2. **Disabled** — single-column (no interaction columns — `pointer-events:none` makes hover impossible)
3. **Invalid** — single-column
4. **Variants** — component-specific configurations (most components; DateTimeField uses named variant sections instead)
5. **Live demo** — a real interactive instance
6. **Native reference** — browser's built-in control for comparison

Hover/focus/active states are simulated via `data-test-state="hover|focus|active"` on the component root element. CSS uses descendant selectors: `&[data-test-state="hover"] .Segments`. This mirrors the real pseudo-class selectors written in pairs.

## State Generator Pattern

Components with many HTML variants use a `<Name>.generate.ts` file as the single source of truth for markup. Generated `.hbs` files live in `states/` and are gitignored — they are build artifacts.

- The `canonical()` function defines the complete HTML structure
- A `StateDefinition[]` array declares only the diffs per state (attribute overrides)
- Run via `vite-node`; wired into `dev`, `build`, and `test:e2e`
- When changing component markup: update `canonical()`, re-run `generate:states`

## Philosophy

Read [`.claude/philosophy.md`](.claude/philosophy.md) before writing any CSS or JS. It defines bounded CSS, deletability, `data-*` state, and why this project deviates from conventional mobile-first and BEM patterns.

## Workflow Preferences

- **New features / design decisions:** subagent-driven development + full spec + quality review
- **Mechanical tasks (migrations, renames, type annotations):** inline execution, skip brainstorming
- **TypeScript migrations:** one component per session; no logic changes

## Accessibility

When creating or reviewing a component, read the relevant `docs/atomica11y/<html-element>/<component>.md`
file(s) for WCAG acceptance criteria. Folders mirror HTML context: `html/`, `header/`, `nav/`,
`main/`, `form/`, `footer/`.

Apply criteria in two layers:

- **Section 1 – Keyboard** → write automated Playwright e2e tests. Tab order, focus visibility,
  keyboard activation (space/enter/escape), no focus traps. Also assert the ARIA structure that
  enables correct screenreader behaviour (roles, states, live regions).
- **Sections 2–3 – Desktop/Mobile screenreader ("I HEAR")** → add a `## Manual accessibility testing`
  section to the component's `<Name>.md` with the screenreader scenarios as a checklist. These are
  the definition-of-done criteria before a component ships.

## Constraints

- No framework code — vanilla JS/TS only
- No build-time type checking — Vite transpiles, `tsc --noEmit` validates
- No logic changes during TypeScript migrations
- E2E tests stay `.js` (Playwright has its own type setup)
