# CSS Pattern

CSS is **purely reactive**. It responds to attributes the Tag Helper sets — it never assumes, defaults, or guards against states that can't exist.

---

## Philosophy

This approach is the logical extension of [Generic CSS, Mobile First](https://www.smashingmagazine.com/2018/12/generic-css-mobile-first/) (Hodgson, 2018).

That article argues against the conventional mobile-first cascade: declaring a property at the base level and overriding it at each breakpoint creates noise — DevTools fills with strikethrough rules, and understanding what's actually active requires tracing the full cascade. The proposed fix: **bound each declaration to the exact context where it's valid**. Styles live inside the breakpoint range they belong to, not in a base that gets progressively unwound.

The same principle applies here, extended from viewport to every axis:

> Don't declare a property only to override it. Bound each declaration to the context where it's valid.

Viewport breakpoints are one axis. `data-elevation`, `data-padding`, `data-border` are the same idea on different axes. The gate selector is attribute compartmentalization — a property only enters the cascade when the component is in a state where it actually applies.

The Tag Helper adds a layer the original article couldn't have: **source validation**. The article still required developers to know which classes to apply. Here, invalid values and forbidden combinations are rejected at render time. CSS never needs to defend against impossible states — they can't be authored.

The thread through all of it: **explicit over implicit, bounded over cascading, presence over absence**.

---

## Rules

### 1. Conditional properties live behind a gate

A property that only applies in some states must not appear in the base rule. Use a grouped selector as the gate — it declares the property once. Individual selectors below it set the variable.

```css
/* ✅ Property only enters the cascade when data-elevation is present */
&[data-elevation="none"],
&[data-elevation="sm"],
&[data-elevation="md"],
&[data-elevation="lg"] {
    box-shadow: var(--_shadow);
}

&[data-elevation="none"] { --_shadow: none; }
&[data-elevation="sm"]   { --_shadow: 0 1px 3px oklch(0 0 0 / 0.08); }

/* ❌ Always in the inspector — noise even when elevation is never set */
.Card {
    box-shadow: var(--_shadow, none);
}
```

### 2. Defaults belong in the Tag Helper

The Tag Helper owns default values via C# property defaults. Because it always outputs the attribute, CSS never needs a fallback.

```csharp
// Tag Helper — owns the default, always outputs data-padding="md"
public string Padding { get; set; } = "md";
```

```css
/* CSS — just responds, no base default needed */
&[data-padding="sm"] { --_padding: var(--size-sm); }
&[data-padding="md"] { --_padding: var(--size-md); }
&[data-padding="lg"] { --_padding: var(--size-lg); }
```

### 3. Base rule contains only unconditional properties

If a property applies to every instance of the component with no variation — it belongs in the base. If it varies by attribute at all — it belongs behind a gate.

```css
/* ✅ Always true for every card */
:where(.Card) {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--_borderRadius);
}

/* ❌ Not always true — move behind a gate */
:where(.Card) {
    box-shadow: none;
    padding: 1rem;
}
```

### 4. Private props (`--_*`) for internal state

Use `--_` prefix for component-internal variables. They carry no value in the base — they only exist once a variant sets them. The gate consumes them.

```css
:where(.Card) {
    /* --_shadow is not declared here — it has no value until a variant sets it */

    &[data-elevation="sm"],
    &[data-elevation="md"] {
        box-shadow: var(--_shadow); /* gate */
    }

    &[data-elevation="sm"] { --_shadow: 0 1px 3px oklch(0 0 0 / 0.08); }
    &[data-elevation="md"] { --_shadow: 0 4px 12px oklch(0 0 0 / 0.08); }
}
```

---

## Why

**Inspector clarity** — every rule you see is intentional. No `box-shadow: none` cluttering every card in DevTools.

**Testability** — any attribute combination has exactly one predictable output. Nothing hides in base defaults.

**Portability** — CSS makes no assumptions about which attributes exist. Swap the Tag Helper for a Vue component or a plain class, the CSS still works correctly.

**Separation of concerns** — the Tag Helper validates and defaults; CSS only renders. Neither needs to know about the other's internals.
