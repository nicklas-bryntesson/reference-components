# Component Contracts

Shared naming and API rules. All rendering patterns (Tag Helpers, HTMX, Vue, etc.) must conform to these.

## Rules

- Component name: `PascalCase` (e.g. `Heading`, `Card`, `Button`)
- Tag Helper tag: `app-{kebab-name}` (e.g. `<app-heading>`, `<app-card>`)
- CSS class: matches component name exactly (e.g. `.Heading`, `.Card`)
- Variants, sizes, states: `data-*` attributes — never BEM modifiers or extra classes
- No utility-first — semantic HTML elements only
- **Defaults belong in the Tag Helper** — C# property defaults guarantee which attributes are always present. CSS never assumes or guards against absent attributes. See `patterns/css.md`.

## Inventory

| Component | Tag Helper | CSS file | Status |
|-----------|-----------|----------|--------|
| Heading | `<app-heading>` | `04_ui/Heading.css` | done |
| LinkButton | `<app-link-button>` | `04_ui/Button.css` | done |
| ActionButton | `<app-action-button>` | `04_ui/Button.css` | done |
| Prose | — | `04_ui/Prose.css` | done |
| Card | `<app-card>` | `04_ui/Card.css` | done |
| Media | `<app-picture>` | `04_ui/Media.css` | done |
| Prose | `<app-prose>` | `04_ui/Prose.css` | done |
| Teaser | `<app-teaser>` | `04_ui/Teaser.css` | done |
