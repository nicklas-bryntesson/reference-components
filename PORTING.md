# Porting guide

This repo is designed to be used as a temporary reference during porting. Add it as a git submodule, run its test suite against your project's dev server, iterate until everything is green, then remove the submodule.

## Add as a submodule

```bash
git submodule add <repo-url> reference-components
git submodule update --init
```

## What you port (and what you don't)

Port in this order:

1. **The kernel** (`src/kernel/`) — the shared primitives (the 3D wheel, popover maths, date/locale helpers, `Wheel.css`). Each component's `.md` lists what it needs under `## Kernel dependencies`. Port these **once** and run their conformance tests; every component that declares them then composes the same verified behaviour, so a looping wheel or a leap-year edge case is never re-interpreted per component.
2. **The component** — its `.md` contract markup, `.ts` behaviour, and `.css` (map the `## Required site tokens` onto your design system).

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
- `TARGET_ID` — overrides the component root selector for the suites that target a single instance (DateTimeField, TimeField). DateField and FileUpload assume their canonical demo ids (see below) — render those on your page.

```bash
BASE_URL=http://localhost:5000 TARGET_PATH=/kitchen-sink npx playwright test
```

Axe checks are scoped to the component under test, so unrelated markup elsewhere on a shared demo page never fails a component's accessibility audit.

## What the tests expect

Tests navigate to `TARGET_PATH` (default `/`) and locate components by their `data-component` attribute and `data-id` / `data-initialized` state attributes. Your page needs to render the component with the correct HTML contract — see each component's `<Name>.md` for the required markup.

For **DateField**, the test target is `[data-id="birthdate"]`. Your page must include a DateField instance with that id.

For **FileUpload**, the test target is `[data-component="FileUpload"][data-initialized]`. Multiple instances are fine — tests use `.last()` to target the live demo instance.

## Fixtures

FileUpload tests need a small PDF fixture. Copy it into your project:

```bash
cp reference-components/src/partials/components/FileUpload/tests/fixtures/test.pdf \
   <your-test-fixtures-path>/test.pdf
```

Then update the fixture path in the relevant test file.

## Exit criteria

A port is complete when:

- [ ] All component e2e tests pass against your dev server
- [ ] `axe` tests pass (zero WCAG 2 AA violations)
- [ ] The manual accessibility checklist in each component's `<Name>.md` has been worked through with a real screen reader

Once all boxes are checked, remove the submodule:

```bash
git submodule deinit reference-components
git rm reference-components
rm -rf .git/modules/reference-components
```
