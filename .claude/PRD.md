# AiPoc — Project Brief

## 1. Summary

AiPoc is a proof of concept exploring what Umbraco 17 is capable of as a content platform, how far MCP tooling can take a CMS workflow, and what component-based development looks like in a non-headless .NET landscape.

This is not a product. There are no users, no shipping deadline, no success metrics. The output is knowledge.

---

## 2. Mission

**Explore the middle ground between fully headless and fully traditional server-rendered CMS development.**

### Guiding questions

1. Can MCP replace or significantly reduce manual backoffice work for content modelling?
2. Can a Tag Helper + CSS token system deliver component-level design consistency without a JS framework?
3. Where does the non-headless model break down, and what does the escape hatch look like?

### Principles

- **Explore over deliver** — follow the interesting problems, not a roadmap
- **Real constraints** — build as if it were production: proper design system, clean architecture, semantic HTML
- **Document the findings** — decisions and dead ends are part of the output

---

## 3. Scope

### In scope

- Umbraco content modelling via MCP
- Server-rendered Razor views with Tag Helper components
- Token-based design system (SCSS → CSS custom properties)
- RTE blocks, Block Lists, navigation, shared content
- Selective interactive islands (HTMX, Alpine, or Vue — TBD)

### Out of scope

- Production hardening (auth, perf, security)
- Multi-editor workflows
- Headless / decoupled delivery
- Automated testing

---

## 4. Architecture

```
Umbraco 17 (SQLite)
    │
    ├── Content model (doc types, properties, blocks)
    │       managed via MCP + backoffice
    │
    ├── Razor views + Tag Helpers
    │       server-rendered HTML
    │       component API: <app-heading>, <app-button>, ...
    │
    └── Vite + SCSS
            design tokens → CSS custom properties
            component CSS paired to each Tag Helper
```

See `.claude/contracts/` for shared naming rules and token architecture.
See `.claude/patterns/` for implementation guides per rendering technology.

---

## 5. Exploration areas

| Area | Status | Notes |
|------|--------|-------|
| Content modelling via MCP | active | doc types, properties, templates |
| RTE blocks | done | CTA, Quote, Testimonial |
| Block List navigation | done | nested element types on site root |
| Tag Helper component system | active | Heading, Button done |
| Design token system | active | WIP — structure evolving |
| Interactive islands | not started | HTMX or Vue TBD |
| Page builder (block-driven layout) | not started | next focus |
