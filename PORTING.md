# Porting guide

This repo is designed to be used as a temporary reference during porting. Add it as a git submodule, run its test suite against your project's dev server, iterate until everything is green, then remove the submodule.

## Add as a submodule

```bash
git submodule add <repo-url> reference-components
git submodule update --init
```

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

## What the tests expect

Tests navigate to `/` and locate components by their `data-component` attribute and `data-id` / `data-initialized` state attributes. Your page needs to render the component with the correct HTML contract — see each component's `<Name>.md` for the required markup.

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
