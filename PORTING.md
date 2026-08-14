# Porting guide

This repo is designed to be used as a temporary reference during porting. Add it as a git submodule, run its test suite against your project's dev server, iterate until everything is green, then remove the submodule.

## Add as a submodule

```bash
git submodule add <repo-url> reference-components
git submodule update --init
```

## What you port (and what you don't)

Port in this order:

1. **The kernel** (`src/kernel/`) — the shared primitives (the 3D wheel, popover maths, date/locale helpers, `Wheel.css`). Each component's `.md` lists what it needs under `## Kernel dependencies`. Port these **once** and run their conformance tests; every component that declares them then composes the same verified behaviour, so a looping wheel or a leap-year edge case is never re-interpreted per component. **Popup focus-trap + wheel-scroll containment is one of these ported-once primitives** ([`js/popup-interaction`](src/kernel/js/popup-interaction.md)): all five popup fields (DateField, DateTimeField, TimeField, MonthField, WeekField) share the same cyclic Tab trap over their tab stops and the same background-scroll containment — port it once and no field can drift into leaking focus out of an `aria-modal` dialog or jittering the page behind a wheel.
2. **The component** — its `.md` contract markup, `.ts` behaviour, and `.css`. Copy the `.css` **verbatim** — it is a portable deliverable, keyed off the same `data-*`/ARIA attributes your markup already emits, so it drops in with zero markup changes. Don't re-derive your own thin stylesheet to "satisfy the tests": the suite checks behaviour, not appearance (see below), so a hand-written stylesheet can pass while looking wrong. Only two things change: map the component's `## Required tokens` onto your design system — the design seam is the flat `--ui-*` namespace in [`01-Setup/ui-tokens.css`](src/css/site/01-Setup/ui-tokens.css), so one find-replace of `--ui-*` against your own tokens wires the whole theme (`--SITE--*` remains site *layout* scaffolding) — and **drop the runtime-only rules**.

   > **Runtime-only CSS — skip when your framework renders formed markup.** The reference uses a vanilla-JS "hide unstyled content until init" gate: `.DateField { overflow: hidden }` flipped to `overflow: visible` by `.DateField[data-initialized="true"]`. A framework that renders fully-formed markup never needs the gate, and leaving it in **clips your popup**. Drop these init-gated rules; they are reference *runtime*, not the contract.

Do **not** port:

- **`*.generate.ts` and `states/`** — repo-internal tooling that regenerates the kitchensink's `.hbs` state partials. You author your demo states directly in your own stack.
- **`*.unit.test.*`** — these are white-box tests of the *reference implementation* (they call private methods and import the TS class directly). They are **not** the portable contract and carry a TS-adaptation tax for no benefit. The portable contract is the **conformance suite** — the e2e + axe tests, which assert observable behaviour and ARIA structure against your own DOM.

## Appearance (light/dark)

### How far you need to read

Most of what follows may not apply to you. The sections escalate, and **stopping early is the
correct outcome** — this is a map of limitations and options, not a prescription. Your project may
run Tailwind, or a token pipeline, or have opinions of its own; the contract this library asserts is
the same in every case.

| If your project… | You need | Read |
|---|---|---|
| has **one** colour scheme | nothing. Map `--ui-*` to your colours and move on | — |
| follows the **OS** light/dark | **one line**: `color-scheme: light dark`. No JS, no flash, no attribute | *One platform line* |
| also lets the **user override** | that line + `data-appearance` on the root + a head script | *Preventing FOUC* |
| must also honour **contrast** (a legal requirement in public-sector work) | a four-mode value table, and a real decision about where it lives | *Four modes* |

The one part that is **not** optional if you ship this library's CSS at all is the first line —
without it, components that read system colours never follow the OS.

### One platform line

The library follows light and dark through **system colours**, not through a theme system. Every
component reads `Canvas`/`CanvasText`, so the whole set follows the appearance with no per-component
work — but only because one line switches it on:

```css
:root { color-scheme: light dark; }
```

> **Port this line or the library is light-only, silently.** It lives in
> [`01-Setup/ui-tokens.css`](src/css/site/01-Setup/ui-tokens.css) and is the one declaration in that
> file that is *not* a token. A consumer who replaces the file with their own token mapping and drops
> it gets a library that renders light for a dark-OS user, with nothing visibly broken and no test
> failing. It is the single most expensive line to lose in the whole port.

### What you owe, and what you don't

| | Reactive by itself | Needs a decision from you |
|---|---|---|
| Surfaces, text, borders, hover tints | ✅ system colours and `color-mix` against them | — |
| `--ui-muted-foreground`, `--ui-primary-foreground` | ✅ derived | — |
| The five semantic hues + the shadow ink | — | a value that works on both grounds |

Pairs are **not** a requirement. If your brand blue reads well on light and dark, one value is fine;
supply a pair only where one value cannot serve both. Our defaults use `light-dark()`, but that is a
convenience, not part of the contract.

**Contrast is deliberately not shipped.** `prefers-contrast: more` has no user override, so it never
belonged in the state machine and picking high-contrast hues is your design work, not ours. It
composes in one block, because `light-dark()` resolves against the active `color-scheme`:

```css
@media (prefers-contrast: more) {
  :root { --ui-primary: light-dark(<darker>, <lighter>); }
}
```

### The projection contract

```html
<html>                          <!-- "system" — NO attribute -->
<html data-appearance="light">
<html data-appearance="dark">
```

Absence is the system state. The attribute's only job is pinning `color-scheme`; nothing in this
library applies tokens at runtime. Map it to your own system in one line — a Tailwind `darkMode`
selector, a single CSS rule, whatever you already use.

### Preventing FOUC — structure, not a workaround

**How the attribute gets onto `<html>` is yours to choose; *when* is not.** If a stored override is
applied after the document parses, the page paints in the OS appearance and then snaps — a flash on
every reload. Two conformant structures:

**Server-rendered (preferred — no client JS, no flash by construction).** Read your cookie during
render and emit the attribute in the markup:

```html
<html data-appearance="dark">
```

The preference has to live somewhere the *server* can read, so use a **cookie, not `localStorage`**.
That is the whole reason the reference Astro implementation this pattern came from used one.

**Static or client-only.** A render-blocking inline script in `<head>`, before your stylesheet.
There is no alternative: a module runs after parsing, so by the time your component mounts the wrong
paint has already happened.

```html
<script>
  try {
    var a = localStorage.getItem('appearance-preference')
    if (a === 'light' || a === 'dark') document.documentElement.setAttribute('data-appearance', a)
  } catch (e) { /* storage blocked — fall back to following the OS */ }
</script>
```

Three things about that snippet are deliberate:

- **It does not handle `system`.** That is the payoff for projecting nothing for it: `color-scheme:
  light dark` already follows the OS, so the most common case needs no script and **cannot** flash.
  Only an explicit override is restored this early.
- **It is inline and synchronous.** An external or `defer`red script defeats the purpose.
- **It swallows storage errors.** Private-mode Safari and blocked third-party contexts throw on
  access; a theme preference must never take the page down.

Whatever you choose, the component is unaware of it. What is contractual is the **DOM end-state** —
the root carries the resolved appearance — never where it was computed. The same e2e suite passes
against a client-restored page and a server-rendered one.

### When you need four modes, not two — CSS map vs JS lookup

This library ships **two** appearances and no contrast values, so it stays in CSS. Your project may
not have that luxury: EU/Swedish public-sector accessibility rules require honouring the user's
colour *and* contrast preferences, which is **four modes** — and most teams also want an in-app
override, because a user whose OS is dark may still want this one site light.

That is where it stops being a styling question and becomes a data-structure question. The signals
are independent:

| Signal | Source | Values |
|---|---|---|
| `prefers-color-scheme` | OS | light · dark |
| `prefers-contrast` | OS | normal · more |
| your override | UI | may pin either axis |

And the values are genuinely four, not two inverted pairs. Foreground and background just flip, but a
**mid-tone does not**: a border that reads against white is not the one that reads against black, and
in high contrast there is no mid-tone at all — it collapses into the text colour. Four distinct
values per mid-tone token.

**Route A — CSS, with `light-dark()` and a style query.** Two declarations per token:

```css
:root { color-scheme: light dark; --contrast: normal; }
:root[data-appearance="light"] { color-scheme: light; }
:root[data-appearance="dark"]  { color-scheme: dark; }
@media (prefers-contrast: more) { :root { --contrast: more; } }
:root[data-contrast="more"]    { --contrast: more; }   /* the UI override */

.thing { --border: light-dark(darkgrey, lightgrey); }
@container style(--contrast: more) { .thing { --border: light-dark(black, white); } }
```

The colour axis needs no `:not()` and no duplicate override blocks, because `light-dark()` reads the
*used* `color-scheme` and the attribute already pins it. The contrast axis is a **named condition**
set in one place from either source. Verified: this produces all four cells with the axes
independent.

#### Support, and the very different ways these two degrade

Both sit around 89–90% global support — Baseline *newly* available, not *widely* available:

| Feature | Global | First supported |
|---|---|---|
| `light-dark()` | ~88.8% | Chrome/Edge 123 · Firefox 120 · Safari 17.5 |
| `@container style()` | ~90.2% | Chrome/Edge 111 · Safari 18 · Firefox 151 |

(Support tables mark Chrome and Safari "partial" for style queries; the partial part is that only
*custom properties* can be queried, not regular CSS properties — which is exactly this use.)

The percentages matter less than the failure shapes, which are not comparable:

- **`light-dark()` unsupported** → the declaration is invalid at computed-value time, the custom
  property becomes guaranteed-invalid, and `var(--ui-x, #literal)` falls back to the literal. The
  page renders light. Cosmetic, and every token in this library carries a literal fallback for
  exactly this reason.
- **Style queries unsupported** → the whole `@container` block is dropped and tokens keep their
  normal-contrast values, so **the user's high-contrast preference is silently ignored**. That is the
  obligation you were implementing, failing invisibly.

So do not let the style query carry the OS signal. **Layer it:** a plain media query — support is
effectively universal — honours the preference, and the style query only adds the in-app override on
top.

```css
/* 1. The OS signal, everywhere. */
@media (prefers-contrast: more) { .thing { --border: light-dark(black, white); } }

/* 2. The in-app override, where style queries exist. */
@container style(--contrast: more) { .thing { --border: light-dark(black, white); } }
@container style(--contrast: normal) { .thing { --border: light-dark(darkgrey, lightgrey); } }
```

A browser without style queries then still respects the OS preference and merely cannot offer the
in-app toggle — a feature gap rather than an accessibility regression. The duplication is one extra
block per contrast-sensitive token, and it buys a failure mode you can live with.

If that trade reads badly to you, it is a fair argument for Route B: a JS lookup has no partial
support and no silent-drop failure mode, at the cost of everything listed under its own heading.

> Worth knowing if you have an older codebase: before `light-dark()` and style queries, this needed
> roughly **eight** blocks — four for the OS combinations and four more whose only job was repairing
> the crossing between the UI override and the OS contrast query, containing no new values at all.
> If your existing theme CSS looks like that, the language has moved since it was written.

**Route B — a JS lookup table.** The table lives in one object keyed by token, and a function
resolves it per mode:

```js
'--border': { light: 'darkgrey', dark: 'lightgrey',
              'light-contrast': 'black', 'dark-contrast': 'white' }
```

**Choose Route A when** the token count is modest and you want values to stay in the cascade — a
consumer can then override one token on one component with a normal CSS rule, and `light-dark()`
does the colour axis for free.

**Choose Route B when** any of these bite:

- **Coverage needs verifying.** Nothing in CSS checks that every token has a value in every mode. A
  forgotten `dark-contrast` inherits silently from the wrong block and surfaces in production as a
  contrast bug. An object can be linted, tested and iterated.
- **You want to read the table by token, not by selector.** The cascade sorts by selector; the
  question you actually ask is "what is `--border` in dark-contrast?" In CSS that answer *emerges*
  from simulating the cascade. In an object it is one line.
- **You are generating tokens anyway** — from a design-token pipeline, a CMS, or per-component token
  files that need aggregating.
- **You already render server-side.** You are computing the appearance there regardless, so emitting
  the resolved values costs nothing extra.
- **You want the current values legible in DevTools.** This one is underrated. With the CSS route the
  Styles pane fragments your custom properties across every matched rule and query block, and you
  read the cascade to work out which won. With a JS map the whole resolved set lands in **one inline
  block on `<html>`** — every semantic variable and what it means *right now*, in a single list. The
  Computed pane does flatten values, but it flattens them among everything else; the inline block is
  the set you actually care about, on its own.

  > Sass does not solve this. It can dedupe the *authoring*, but it compiles to the same scattered
  > blocks, so the inspector view is unchanged and you have added a build step between you and the
  > CSS you are debugging. Reported from having tried it.

**Route B's costs, which are real:**

- **It does not avoid the flash** — the same render-blocking head script is still required, and now
  it must apply *values*, not just an attribute.
- **Never assign `documentElement.style.cssText`.** It replaces the whole inline declaration block
  and silently destroys anything else living there: scroll locks, viewport fixes, view-transition
  names. Use `setProperty` per token.
- **Values leave the cascade.** Inline styles on `:root` beat every stylesheet rule, so a consumer
  overriding one token for one component now has to fight specificity or re-enter the map.
- **You give up `light-dark()`** doing the colour axis for you, and re-implement that branch in JS.

A reasonable hybrid, if you want the table auditable without leaving CSS: keep the lookup in JS as
the **source of truth**, and generate a stylesheet from it at build time. You get the validation and
the by-token reading, and the browser still gets plain cascading CSS.

**If you are on Tailwind**, most of this is already answered by whatever you use for `dark:` — point
its `darkMode` selector at `[data-appearance="dark"]` and your existing variants keep working. The
contrast axis has no `dark:`-equivalent, so it is still the same decision as above; a custom variant
over the same named condition is the usual answer.

Whichever route: **the contract this library asserts is unchanged.** The root carries the resolved
appearance; how the values respond is entirely yours. We are pointing at the limitations and the
options, not at an answer — a consuming project owns its colour, and may reasonably conclude that
none of this applies to it.

### A second flash, unrelated to theme

An `<svg>` carrying only a `viewBox` falls back to **300×150** until CSS sizes it, which reads as a
large shape snapping down whenever styles arrive late (routinely in dev, where CSS is injected by
JS). Every icon in this library carries explicit `width`/`height` attributes for that reason — keep
them when you port the markup, even though your CSS overrides them.

> **Auditing tip, learned the hard way:** grepping `<svg` tags for `width=` reports false negatives,
> because `stroke-width=` contains the substring. Exclude a preceding hyphen.

## Restyle to your own convention — after the suite is green, never during

Copying the `.css` verbatim is the point of the step above, so if your project writes nested CSS, CSS Modules, scoped styles or utility classes, that translation is a **separate step on a verified baseline**. Doing both at once leaves you two variables and nothing to bisect: when the field misbehaves you cannot tell which half broke it.

Translate in **your own tree**, not inside the submodule — the submodule is meant to stay pristine and disposable, and rewriting it costs you both upstream updates and the unmodified reference to compare against when something looks wrong.

Two things worth knowing before you start:

- **The suite will not catch a botched translation.** It asserts behaviour and ARIA, not appearance — green afterwards means "I did not break the interaction", not "it looks right". Cheap net: snapshot `getComputedStyle` for a handful of parts (the popup, its footer, the segments, the trigger) with the popup **open**, translate, snapshot again, diff. That catches exactly what the suite cannot.
- **Keep every rule qualified from the root.** The element class names are deliberately generic words — `.popup`, `.footer`, `.rail`, `.content`, `.trigger`, the same word in every component — so a bare `.popup {}` at column 0 leaks across components and the last stylesheet imported wins. Nesting is fine; a nested rule is qualified too. The one trap: `&` takes the specificity of the **most specific** selector in its parent list, so `#id, .cls { & .x {} }` silently gives `.x` id-level weight, which a later class-level rule can no longer override. Flat descendant selectors cannot express that ambiguity.

## Run the test suite against your dev server

The test suite is driven by `BASE_URL`. When set, Playwright skips the built-in dev server and points all tests at your server instead.

```bash
# From inside the submodule directory
BASE_URL=http://localhost:YOUR_PORT npx playwright test
```

Or run a specific component only:

```bash
BASE_URL=http://localhost:5000 npx playwright test --grep "DateField"
```

### Point the suite at your own page

`BASE_URL` chooses *which server*. Two more env vars choose *where on that server* the suite looks (see `src/e2e-helpers/target.js`):

- `TARGET_PATH` — the page the tests navigate to (default `/`). Set it when your demo lives elsewhere, e.g. `TARGET_PATH=/kitchen-sink`.
- `TARGET_ID` — overrides the component root selector for the suites that target a single instance (DateTimeField, TimeField, MonthField, WeekField). DateField and FileUpload assume their canonical demo ids (see below) — render those on your page.

```bash
BASE_URL=http://localhost:5000 TARGET_PATH=/kitchen-sink npx playwright test
```

Axe checks are scoped to the component under test, so unrelated markup elsewhere on a shared demo page never fails a component's accessibility audit.

### Browser matrix — decide it up front

This repo's Playwright config (`playwright.config.js`) runs **headless Chromium only** — a single `Desktop Chrome` device profile, no `projects` matrix. CSS system colors and animation timing can differ headed vs headless and across engines, so an `axe` result is not guaranteed identical between them. Running a fuller browser matrix is your responsibility as the porter: decide which browsers you support, add them to your own config, and run that full matrix before declaring a port done — don't validate Chromium alone and assume the rest.

### Entrance animations and `axe` (the subtle one)

The reference appends its popups at **full opacity** — no fade — so `axe` always samples fully-contrasted text. If your port adds an opacity **entrance** animation (the idiomatic `<Transition>` / `<AnimatePresence>` / `@starting-style` move), there is a ~150–180 ms window where popup text is below WCAG AA contrast. Playwright's auto-wait checks bounding-box stability, **not opacity**, so a click can return mid-fade and a scoped axe check samples that frame → **false "color-contrast" violations**. This is transient, not a real defect — a settled popup is compliant. Three honest options:

- Set `AXE_SETTLE=1` — `scopedCheckA11y` then waits for the scope to reach `opacity: 1` before auditing (see `src/e2e-helpers/target.js → waitForStable`).
- Animate a property that doesn't affect contrast (`transform`/slide), or pop in instantly and only fade *out* (the suite never samples during close).
- Keep the reference's no-animation behaviour.

## What the tests expect

Tests navigate to `TARGET_PATH` (default `/`) and locate components by their `data-component` attribute and `data-id` / `data-initialized="true"` state attributes. Your page needs to render the component with the correct HTML contract — see each component's `<Name>.md` for the required markup.

For **DateField**, the test target is `[data-id="birthdate"]`. Your page must include a DateField instance with that id.

For **FileUpload**, the test target is `[data-component="FileUpload"][data-initialized="true"]`. Multiple instances are fine — tests use `.last()` to target the live demo instance.

For **MonthField**, the test target is `[data-component="MonthField"][data-id="meeting-month"]`. Your page must include a MonthField instance with that id (or override `TARGET_ID`).

For **WeekField**, the test target is `[data-component="WeekField"][data-id="meeting-week"]`. Your page must include a WeekField instance with that id (or override `TARGET_ID`).

## Fixtures

FileUpload tests need a small PDF fixture. Copy it into your project:

```bash
cp reference-components/src/partials/components/FileUpload/tests/fixtures/test.pdf \
   <your-test-fixtures-path>/test.pdf
```

Then update the fixture path in the relevant test file.

## Exit criteria

**The suite proves behaviour and a11y, not appearance.** It asserts structure, ARIA, and interaction — it can be fully green while day cells render as raw `<button>` chrome or a chevron is missing. Visual fidelity is a separate axis whose source of truth is the component `.css`; verify it with a deliberate side-by-side against the reference's live demo. "Tests green" is necessary, not sufficient.

A port is complete when:

- [ ] All component e2e tests pass against your dev server, **on your chosen browser matrix** (not chromium alone)
- [ ] `axe` tests pass (zero WCAG 2 AA violations) — with open/animated states settled (see *Entrance animations and `axe`* above)
- [ ] **Visual parity** checked side-by-side against the reference demo (the suite will not catch appearance regressions)
- [ ] **`color-scheme: light dark` survived the token mapping**, and the app was viewed once with the OS in dark — losing that line fails nothing and breaks everything
- [ ] **No flash on reload** with an explicit appearance stored, checked on a *cold* load rather than a warm one
- [ ] The manual accessibility checklist in each component's `<Name>.md` has been worked through with a real screen reader
- [ ] The submodule is still clean (`git -C reference-components status`) — operate from your project root, never with your shell `cwd` inside the submodule

Once all boxes are checked, remove the submodule:

```bash
git submodule deinit reference-components
git rm reference-components
rm -rf .git/modules/reference-components
```
