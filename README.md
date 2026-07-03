# Reference Components

This repo is a **living library of accessible UI components** — not a published package, not a framework, not a theme. It is a set of reference implementations that define the minimum HTML structure, JS behaviour, and CSS a component needs to work correctly under real user conditions — keyboard, screen reader, touch, and form submission included.

## What this is for

When building a product UI, the hard problems are rarely visual. They are:

- What keyboard interactions does this component need?
- What ARIA roles, states, and live regions make it work for screen reader users?
- What edge cases exist (disabled, invalid, empty, prefilled, multi-step forms)?
- What should never be in scope?

This repo answers those questions in tested, runnable code. Each component is a **contract** — a baseline your team can inspect, run, and then port into whatever tech stack of your choice.

## How to read a component

Every component lives in `src/partials/components/<Name>/` and ships four things:

1. **`<Name>.md`** — the contract. Authored HTML structure, JS behaviour, ARIA semantics, attributes, accessibility checklist, and explicit non-goals. Read this first.
2. **`<Name>.html`** — the kitchensink. Every state (empty, filled, hover, focus, disabled, invalid) rendered in one page. Use it to verify visual and interaction design.
3. **`<Name>.ts`** — the implementation. Vanilla TypeScript, no framework. The logic you are porting.
4. **`tests/`** — automated proof. Unit tests for pure logic, Playwright e2e tests for keyboard behaviour and ARIA structure, axe-playwright for WCAG 2 AA.

## The kernel — shared primitives

Some components share non-trivial behaviour: a 3D wheel that loops past the year boundary, popover positioning, locale-aware date maths. These live in `src/kernel/` (`js/`, `utils/`, `css/`) with their own contracts and conformance tests. Sharing them is a **correctness mechanism** — re-specifying a looping wheel per component is exactly how subtle bugs (Dec↔Jan wrap, leap years, min/max clamp) creep in.

So the portable unit is **the kernel plus the components that compose it**, not a lone component. Each component's `.md` lists what it needs under `## Kernel dependencies`. Port and verify the kernel once; the components then stay thin and cannot drift in the shared behaviour. See [`src/kernel/README.md`](src/kernel/README.md).

## How to use this repo

```bash
npm run dev        # open the kitchensink in a browser
npm run test:e2e   # run all accessibility and behaviour tests
```

Browse the kitchensink to see what components look and feel like. Read the `.md` contract to understand the API. Port the `.ts` logic to your framework. The tests tell you when your port has drifted from the reference.

## Accessibility approach

Components are built against [atomica11y](https://www.atomica11y.com) acceptance criteria — WCAG broken down into concrete, testable scenarios. Criteria land in one of two places:

- **Automated** — keyboard navigation, ARIA structure, and live regions are covered by Playwright e2e tests. If a test passes, the criterion is met.
- **Manual checklist** — screen reader "I HEAR" scenarios can't be automated. They live as a checklist in each component's `.md`. A component is not done until someone has worked through that list with a real screen reader.

## Components

| Component | Status |
|-----------|--------|
| DateField | Reference implementation + full test suite |
| DateTimeField | Reference implementation + full test suite |
| TimeField | Reference implementation + full test suite |
| MonthField | Reference implementation + full test suite |
| WeekField | Reference implementation + full test suite |
| FileUpload | Reference implementation + full test suite |
| ToggleTip | Reference implementation |
| Combobox | In progress |
| TabAccordion | In progress |
