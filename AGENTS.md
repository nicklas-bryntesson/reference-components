# AGENTS.md

This repo answers one question: **what does a browser need to render this component correctly, accessibly, and testably under real user constraints?**

How you build it in your stack — Razor, Vue, Astro, Web Components, or anything else — is out of scope. The contract is what is in scope.

Each component in this repo is a specification written in HTML, CSS, and JavaScript. The HTML is the contract. The JavaScript documents behaviour as observable state changes on `data-*` attributes. The CSS is reference styling — adapt it to your design system's tokens. Use these contracts to implement the same behaviour in your tech stack.

## How to use this repo as an agent

Follow these steps to implement a component:

1. **Find the component** in the registry below.
2. **Read its `.md` file** — the `## Contract` section defines the exact HTML structure the browser requires.
3. **Port the kernel first** — if the `.md` has a `## Kernel dependencies` section, read each linked `src/kernel/<module>.md`, port that shared primitive, and run its conformance test before touching the component. The kernel is ported once and composed by every component that declares it; this is what stops a looping wheel or date-maths edge case from being re-interpreted (and drifting) per component.
4. **Read the behaviour section** — look for `## Behaviour` (DateField) or equivalent narrative sections in older docs. This is what the JavaScript must do, expressed as observable state changes on `data-*` attributes.
5. **Read the `## Accessibility` section** — these are non-negotiable ARIA requirements.
6. **Check the test files** — they are the proof. If your implementation passes the same behavioural assertions, it is correct.
7. **Port the behaviour** to whatever your stack provides. Do not copy the TypeScript class — port the logic.

## Component registry

| Component | Contract | Tests | Maturity |
|-----------|----------|-------|----------|
| DateField | `src/partials/components/DateField/DateField.md` | `src/partials/components/DateField/tests/` | ✅ complete |
| DateTimeField | `src/partials/components/DateTimeField/DateTimeField.md` | `src/partials/components/DateTimeField/tests/` | ✅ complete |
| TimeField | `src/partials/components/TimeField/TimeField.md` | `src/partials/components/TimeField/tests/` | ✅ complete |
| MonthField | `src/partials/components/MonthField/MonthField.md` | `src/partials/components/MonthField/tests/` | ✅ complete |
| WeekField | `src/partials/components/WeekField/WeekField.md` | `src/partials/components/WeekField/tests/` | ✅ complete |
| FileUpload | `src/partials/components/FileUpload/FileUpload.md` | `src/partials/components/FileUpload/tests/` | ✅ complete |
| ToggleTip | `src/partials/components/ToggleTip/ToggleTip.md` | `src/partials/components/ToggleTip/tests/` | ✅ complete |
| Combobox | — | — | 🚧 stub |
| TabAccordion | — | — | 🚧 stub |

## How to read a contract

Every component `.md` file follows a standard structure:

- **`## Contract`** — the minimum HTML structure a browser requires. This is what your server, template, or component must render. Nothing more is required; nothing less will work.
- **`## Behaviour`** — what JS does, expressed as: event → observable outcome on `data-*` attributes or DOM changes. No implementation details, no code snippets. Present in DateField; older components describe behaviour inline under their usage sections.
- **`## Accessibility`** — ARIA roles, properties, live regions, and focus management. These are requirements, not suggestions.
- **`## Attributes`** — the full public API: input attributes (configure the component), state attributes (set by JS, read by CSS and tests). Section name may vary in older docs (`## HTML Authoring API` in ToggleTip).
- **`## Kernel dependencies`** — the shared `src/kernel/` primitives (JS + CSS) this component composes. Port these once, before the component. "None" means the component folder is self-contained.
- **`## Required site tokens`** — the `--SITE--*` / `--MAX--WIDTH--SITE` CSS custom properties the host page must provide (reference values in `src/css/site/01-Setup/tokens.css`). A component with no such section reads no site tokens.
- **`## Non-goals`** — explicit scope boundaries. What this component deliberately does not do.
