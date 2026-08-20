# Component Philosophy

These rules govern how components are written in this repo. They apply to CSS, JavaScript, and markup. Deviating from them requires an explicit reason — not a preference for a familiar pattern.

> These are the standing rules. The dated *decisions* behind them — with considered alternatives and reconsider triggers — live in [`docs/adr/`](../docs/adr/README.md): [ADR-0002](../docs/adr/0002-data-attributes-are-the-public-api.md) (`data-*` as the public API), [ADR-0003](../docs/adr/0003-bounded-css-over-mobile-first-cascade.md) (bounded CSS), [ADR-0005](../docs/adr/0005-feature-detection-is-progressive-enhancement-only.md) (`:has()` PE-only).

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

### Component-local props are private (`--_`)

**Every** component-local custom property is prefixed `--_<component>-*` (`--_dtf-calendar-bg`, `--_nt-accent`) — not just internal/gated ones. A var set on a component is only overridable by selecting that component, so it is inherently component-scoped; the `--_` marks that (a convention marker, not enforced privacy). See ADR-0017.

Within that: a **gate-consumed** prop carries no value in the base — it gets one only when a variant/gate sets it, and the gate consumes it (the `box-shadow`/`--_shadow` example above). A `--_*` used as a plain **internal constant** (a fixed rail width, an arrow size) is the exception: it legitimately holds its value in the base, because it never varies by state — it is a named constant, not a gated variable.

### Design comes from the `--ui-*` seam

Components take design through **one** host-facing namespace: `--ui-*` (in `01-Setup/ui-tokens.css`) — surface, colour, radius, shadow, and state roles, with neutral standalone defaults. A themable component prop reads a `--ui-*` with a literal fallback, so it still renders with nothing wired:

```css
--_nt-accent: var(--ui-destructive, #c0362c);
```

Never read design from `--SITE--*` — that namespace is *site layout scaffolding* (padding / max-width / grid), not the component seam — and never invent a new host token. If a role is missing, add it to `ui-tokens.css`, don't reach past the seam. See ADR-0018.

### Typography is the consumer's; we own the mechanics

**This is not a design project.** The family, the scale, the ratio and the rhythm belong to the
consuming project, which is expected to replace anything here with its own typography components,
utility classes, or nothing at all. Another design system may have reached entirely different
conclusions, and a reference that ships a scale forces its taxonomy onto every consumer.

One test decides whether a typographic declaration belongs here: **does the value follow from a
mechanism or a criterion, or is it taste?** If removing it only makes things look worse, it is taste.
If removing it measurably breaks something, it is mechanics.

**Ours:** `tabular-nums` on a value that changes in place (without it the digits jump);
`unicode-bidi: isolate` on a number-plus-unit run; `1lh` to *read* line height in a calculation,
never to set one; the `text-wrap: balance` / `pretty` trade; `hyphens` depending on a correct `lang`;
and surviving WCAG 1.4.12 Text Spacing.

**Not ours:** `font-family`, the size scale and its ratio, `letter-spacing` as a value, margins
between blocks, and which variant to reach for.

**Express relationships, never a scale.** A hint at `0.875em` is not a type step — it is the
statement *"supporting text is smaller than what it supports"*, and in `em` it survives whatever
scale the consumer installs. Two relationships cover the whole component set; a third is drift.
The failure mode is writing the same relationship as `0.875em` in one component and `0.75em` in
another, which is how the current inconsistency happened.

### Interaction states are paired selectors

Every real pseudo-class has a `data-test-state` counterpart on the component root. This makes all states renderable in the kitchensink without JS.

```css
& .Segments:hover,
&[data-test-state="hover"] .Segments { border-color: #333; }

& .Segments:focus-within,
&[data-test-state="focus"] .Segments { outline: 2px solid; }
```

### Class naming — case marks component vs element

Case carries meaning:

- **A component is `PascalCase`, no dash** (`.DateField`, `.Wheel`, `.ChoiceField`) — the root *and* any nested/composed sub-component. Litmus: *it has its own `.md` contract* (or is a kernel primitive with one).
- **An internal element is `lowercase-kebab`** (`.calendar-header`, `.content`, `.options`, `.arrow`) — a presentational part with no standalone contract. **No `Component-` prefix** — it's redundant once nested under the root, and it bloats the footprint.

**Every rule is fully qualified from the root** — `.Component .element`, never a bare `.element` and never `&`-nested. The `.Component { }` block holds only the tokens and the properties applied to the root itself; every part is its own flat, rooted rule:

```css
.DateField { /* tokens + root-level props only */ }
.DateField .segments {}
.DateField[data-invalid="true"] .segments {}
.DateField .popup [data-panel="picker"][data-active="true"] {}
.DateField .Wheel {}   /* sub-component — still PascalCase */
```

**Why flat, not nested:** a fully-qualified selector is deterministic to read — no `&` to resolve, no nesting depth to track, every rule says exactly what it targets. A bare `.element {}` at column 0 is a scoping bug (generic names like `.popup`/`.grid` would leak across components); the `.Component` prefix is what makes bare element names safe. The one exception: a part rendered *outside* the root (genuinely portaled / top-layer) can't be a descendant, so it takes a root-scoped `.Component-part` name.

Variants and states are `data-*`, never class modifiers: no `.DateField--disabled`, no `.text-sm` utilities.

**Shared lexicon** — same kind of part, same word, everywhere: `.content` · `.options` · `.popup` · `.trigger` · `.rail` · `.arrow` · `.icon` · `.title` · `.hint` · `.notice-region`. `.container` is reserved for a genuinely role-less box (a part *with* a role gets the role's name, so `.container` never becomes the new catch-all "wrapper"). See ADR-0019.

**Why — the swap map.** A consumer decoding this library reads three seams by case + namespace: `PascalCase` = component boundaries (map to your components), `lowercase-kebab` = our internal element styling (swap for your utilities on the same DOM), `--ui-*` = design values (ADR-0018). Case itself tells you where to go in.

---

## Markup rules

### `data-*` attributes are the public API

All component state is expressed as `data-*` attributes on the root element. JavaScript reads and writes these attributes; CSS responds to them. Neither reaches into the other's internals.

Boolean state always carries the explicit literal value `"true"` — never a bare/empty attribute. An empty declaration is harder to read than a stated value, in the HTML and in the CSS alike: `[data-disabled="true"]` reads as a condition, not an existence check. The off state is expressed by removing the attribute.

**Exception — explicit `"false"` when the off-state needs CSS.** When *both* states must be selectable — most often to **transition/animate between them** — write the value explicitly (`data-x="true"` *and* `data-x="false"`) instead of removing the attribute. You cannot animate the *removal* of an attribute or class, so a deterministic two-value switch (exactly one panel `"true"`, its siblings `"false"`) is what lets the inactive state carry its own style and run its transition. Presence/absence stays the default; make `"false"` explicit only when the off-state is itself styled.

```html
<div class="DateField" data-component="DateField" data-disabled="true">
```

### Boolean or enum — decided by the orthogonality test

Before adding a `data-*`, ask whether each axis is meaningful **on its own**:

- **Boolean** when the axis is independent and *stacks* with the others — `data-invalid`,
  `data-icon`, `data-border`, `data-emphasis`, `data-segmented`. Notice is the proof: three
  independent toggles, and all eight combinations are meaningful.
- **Enum** when the values are mutually exclusive positions on **one** axis — `data-legend`
  (`above`/`beside`/`hidden`), `data-orientation`, `data-variant`, `data-direction`. A legend
  cannot be above *and* hidden.

The failure mode runs in both directions. Splitting one axis into N booleans promises 2^N
combinations of which only a couple are coherent — a segmented Picklist was nearly shipped as
`data-joined` + `data-wrap` + `data-equal`, eight combinations with two meaningful, when wrap and
equal-width are simply *derived* from being segmented. Bundling two independent axes into one enum
is the mirror image: `data-shape="chips|segmented"` would have made direction and tightness
inexpressible together.

### Name a `data-*` after what the thing *is*

Name the attribute for the intent or the result, never the mechanism and never "this is about
looks". `data-emphasis` beat `elevated` (a mechanism: shadow) and `styled` (vague).
`data-segmented` beat `data-flush` (context-dependent jargon — flush left, flush a cache — and
silent about the result), `data-joined`/`data-connected` (mechanism: the borders merge),
`data-compact`/`data-dense` (both conventionally mean *less padding*, so an author would expect a
shorter control), and `data-look`/`data-shape` (names the category, not the thing).

A design *value* is not an attribute at all — pill versus rounded rectangle is
`--_pl-chip-radius`, i.e. the `--_`/`--ui-*` seam.

### Choose the element before styling it

A control is picked by what it *is*, never by what it should look like. One test: **does the same
distance along the track mean the same thing everywhere?** If there is no unit to answer in, there
is no scale — only ordered options, and those are radios (`ChoiceGroup` + `ChoiceField`, or
`Picklist`), or a `<select>` when the list is long. Continuous quantity is a range. A measurement
that is read but not set is `<meter>`, never a disabled range. Two values bounding a span are two
inputs; `multiple` on range was never implemented.

The order matters because presentation leaks into semantics on this family. `appearance: none` —
the first line of any styling attempt — removes the browser's `<datalist>` ticks and the focus ring
and hands you a coordinate system, so the meaning of a scale lives only in the visual layer until
someone mirrors it into `aria-valuetext`. Two symptoms that the element is wrong: the control needs
a "no answer yet" state but a range always carries a value, and the word list is written twice —
once in markup, once in CSS or JS.

**Tick marks are decoration.** Nothing in ARIA models them, so they belong in CSS. Marks without
labels need no ARIA at all: `step` already makes the keyboard land on exactly those values, so both
channels agree for free. Labels *are* information, and the visible label is the source of truth —
mirrored into `aria-valuetext`, never derived in a stylesheet. A word that exists only as CSS
`content` cannot be selected, copied, translated, or read back by JS.

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
