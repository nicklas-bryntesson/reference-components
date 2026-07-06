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
2. **The component** — its `.md` contract markup, `.ts` behaviour, and `.css`. Copy the `.css` **verbatim** — it is a portable deliverable, keyed off the same `data-*`/ARIA attributes your markup already emits, so it drops in with zero markup changes. Don't re-derive your own thin stylesheet to "satisfy the tests": the suite checks behaviour, not appearance (see below), so a hand-written stylesheet can pass while looking wrong. Only two things change: map the `## Required site tokens` onto your design system, and **drop the runtime-only rules**.

   > **Runtime-only CSS — skip when your framework renders formed markup.** The reference uses a vanilla-JS "hide unstyled content until init" gate: `.DateField { overflow: hidden }` flipped to `overflow: visible` by `.DateField[data-initialized="true"]`. A framework that renders fully-formed markup never needs the gate, and leaving it in **clips your popup**. Drop these init-gated rules; they are reference *runtime*, not the contract.

Do **not** port:

- **`*.generate.ts` and `states/`** — repo-internal tooling that regenerates the kitchensink's `.hbs` state partials. You author your demo states directly in your own stack.
- **`*.unit.test.*`** — these are white-box tests of the *reference implementation* (they call private methods and import the TS class directly). They are **not** the portable contract and carry a TS-adaptation tax for no benefit. The portable contract is the **conformance suite** — the e2e + axe tests, which assert observable behaviour and ARIA structure against your own DOM.

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
- [ ] The manual accessibility checklist in each component's `<Name>.md` has been worked through with a real screen reader
- [ ] The submodule is still clean (`git -C reference-components status`) — operate from your project root, never with your shell `cwd` inside the submodule

Once all boxes are checked, remove the submodule:

```bash
git submodule deinit reference-components
git rm reference-components
rm -rf .git/modules/reference-components
```
