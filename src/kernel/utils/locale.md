# locale (kernel / pure functions)

Shared locale resolution so DateField, DateTimeField, and TimeField all follow one pattern: read the
requested locale from the element, then resolve it to a key that has a registered translation.

## Public API

```ts
// Requested locale: data-locale → <html lang> → fallback.
readLocale(el: HTMLElement, fallback = 'en'): string

// Resolve `requested` against `available`: exact match → base language → fallback.
//   resolveLocale('sv-SE', { en, sv }) → 'sv'
//   resolveLocale('fr',    { en, sv }) → 'en'
resolveLocale(requested: string, available: Record<string, unknown>, fallback = 'en'): string
```

## Semantics

- `readLocale` lets a component opt into the page language (`<html lang>`) without authoring
  `data-locale` on every instance.
- `resolveLocale` degrades a region tag to its base language before falling back, so `sv-SE` finds a
  `sv` translation even when no exact `sv-SE` entry exists.

## Conformance

Covered indirectly through the component locale-resolution tests (e.g. DateField's locale fallback /
`<html lang>` cases). Consumed by: DateField, DateTimeField, TimeField.
