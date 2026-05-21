# AGENTS.md

This repo answers one question: **what does a browser need to render this component correctly, accessibly, and testably under real user constraints?**

How you build it in your stack — Razor, Vue, Astro, Web Components, or anything else — is out of scope. The contract is what is in scope.

Each component in this repo is a specification written in HTML, CSS, and JavaScript. The HTML is the contract. The JavaScript documents behaviour as observable state changes on `data-*` attributes. The CSS is reference styling — adapt it to your design system's tokens. Use these contracts to implement the same behaviour in your tech stack.

## How to use this repo as an agent

Follow these steps to implement a component:

1. **Find the component** in the registry below.
2. **Read its `.md` file** — the `## Contract` section defines the exact HTML structure the browser requires.
3. **Read the `## Behaviour` section** — this is what the JavaScript must do, expressed as observable state changes on `data-*` attributes.
4. **Read the `## Accessibility` section** — these are non-negotiable ARIA requirements.
5. **Check the test files** — they are the proof. If your implementation passes the same behavioural assertions, it is correct.
6. **Port the behaviour** to whatever your stack provides. Do not copy the TypeScript class — port the logic.

## Component registry

| Component | Contract | Tests | Maturity |
|-----------|----------|-------|----------|
| DateField | `src/partials/components/DateField/DateField.md` | `src/partials/components/DateField/tests/` | ✅ complete |
| FileUpload | `src/partials/components/FileUpload/FileUpload.md` | `src/partials/components/FileUpload/tests/` | ✅ complete |
| ToggleTip | `src/partials/components/ToggleTip/ToggleTip.md` | `src/partials/components/ToggleTip/tests/` | ✅ complete |
| Button | — | — | 🚧 stub |
| Combobox | — | — | 🚧 stub |
| TabAccordion | — | — | 🚧 stub |

## How to read a contract

Every component `.md` file follows a standard structure:

- **`## Contract`** — the minimum HTML structure a browser requires. This is what your server, template, or component must render. Nothing more is required; nothing less will work.
- **`## Behaviour`** — what JS does, expressed as: event → observable outcome on `data-*` attributes or DOM changes. No implementation details, no code snippets.
- **`## Accessibility`** — ARIA roles, properties, live regions, and focus management. These are requirements, not suggestions.
- **`## Attributes`** — the full public API: input attributes (configure the component), state attributes (set by JS, read by CSS and tests).
- **`## Non-goals`** — explicit scope boundaries. What this component deliberately does not do.
