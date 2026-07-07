# Component Philosophy

These rules govern how components are written in this repo. They apply to CSS, JavaScript, and markup. Deviating from them requires an explicit reason — not a preference for a familiar pattern.

---

## The core principle

> Don't declare a property only to override it. Bound each declaration to the context where it's valid.

This extends the argument in [Generic CSS, Mobile First](https://www.smashingmagazine.com/2018/12/generic-css-mobile-first/) (Hodgson, 2018) beyond viewport breakpoints to every axis of variation: states, features, sizes, and component variants.

The thread through everything: **explicit over implicit, bounded over cascading, presence over absence.**

---

## Deletability test

Any code block — a media range, a `@supports` branch, a state gate — must be removable without touching anything outside it. If deleting a block requires cleanup elsewhere, the block was not properly bounded.

```css
/* ✅ Each range is self-contained — delete either block, nothing changes elsewhere */
@media (width >= 600px) and (width < 900px) {
  .Component { padding: 1rem; }
}

@media (width >= 900px) {
  .Component { padding: 2rem; }
}

/* ❌ Delete the min-width block and the base style now applies unchecked */
.Component { padding: 0.5rem; }

@media (min-width: 600px) { .Component { padding: 1rem; } }
@media (min-width: 900px) { .Component { padding: 2rem; } }
```

The same applies to `@supports` branches: a fallback for browsers without Popover API support must be fully self-contained. When browser support reaches the threshold, the entire `@supports not (...)` block is deleted — no other code is touched.

```css
/* ✅ Fallback is fully isolated — delete it when threshold is met */
@supports not (anchor-name: --x) {
  .Tooltip { position: absolute; /* manual positioning */ }
}

@supports (anchor-name: --x) {
  .Tooltip { position-anchor: --trigger; /* native */ }
}
```

---

## CSS rules

### Conditional properties live behind a gate

A property that only applies in some states must not appear in the base rule. Group the gate selector to declare the property once; individual selectors set the variable.

```css
/* ✅ box-shadow only enters the cascade when data-elevation is present */
&[data-elevation="sm"],
&[data-elevation="md"],
&[data-elevation="lg"] {
  box-shadow: var(--_shadow);
}

&[data-elevation="sm"] { --_shadow: 0 1px 3px oklch(0 0 0 / 0.08); }
&[data-elevation="md"] { --_shadow: 0 4px 12px oklch(0 0 0 / 0.12); }

/* ❌ Always in the inspector — noise even when elevation is never set */
.Card { box-shadow: var(--_shadow, none); }
```

### Base rule contains only unconditional properties

If a property applies to every instance with no variation — it belongs in the base. If it varies by attribute at all — it belongs behind a gate.

### Private props (`--_*`) carry no value in the base

Use `--_` prefix for internal variables. They have no value until a variant sets them — the gate consumes them.

### Interaction states are paired selectors

Every real pseudo-class has a `data-test-state` counterpart on the component root. This makes all states renderable in the kitchensink without JS.

```css
& .Segments:hover,
&[data-test-state="hover"] .Segments { border-color: #333; }

& .Segments:focus-within,
&[data-test-state="focus"] .Segments { outline: 2px solid; }
```

### No BEM modifiers, no utility classes

Variants and states are expressed through `data-*` attributes. CSS class is always PascalCase matching the component name (`.DateField`, `.ToggleTip`). No `.DateField--disabled`, no `.text-sm`.

---

## Markup rules

### `data-*` attributes are the public API

All component state is expressed as `data-*` attributes on the root element. JavaScript reads and writes these attributes; CSS responds to them. Neither reaches into the other's internals.

Boolean state always carries the explicit literal value `"true"` — never a bare/empty attribute. An empty declaration is harder to read than a stated value, in the HTML and in the CSS alike: `[data-disabled="true"]` reads as a condition, not an existence check. The off state is expressed by removing the attribute.

```html
<div class="DateField" data-component="DateField" data-disabled="true">
```

### No impossible states in markup

The component's source of truth (JS logic + `generate.ts` for state partials) defines which attribute combinations are valid. CSS never needs to guard against states that can't exist — they can't be authored.

### Disabled is a functional state, not an interaction state

`data-disabled="true"` / `disabled` means `pointer-events: none`. Hover, focus, and active are therefore impossible. Disabled never appears as a column in the interaction state table — it gets its own table.

---

## JavaScript rules

### State lives in attributes, not variables

Component state is always reflected in `data-*` attributes on the root element. A variable that tracks state internally without reflecting it to the DOM is a hidden state that CSS and tests can't see.

### Explicit transitions, no implicit defaults

A component starts in a known state defined by its initial markup. Transitions are explicit: a function moves the component from state A to state B by updating the relevant attributes.

---

## Where this differs from conventional approaches

| Convention | This project |
|---|---|
| Mobile-first (`min-width` cascade) | Bounded ranges — each breakpoint is self-contained |
| BEM modifiers (`.Block--modifier`) | `data-*` attributes |
| CSS defaults overridden by variants | Gate selectors — variants never fight the base |
| Feature detection with JS flags | `@supports` branches — each fully isolated |
| State in JS variables | State reflected to `data-*` attributes |
