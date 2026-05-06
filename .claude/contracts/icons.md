# Icon System Spec

## Constraints

- Add an icon in **one place**
- Frontend output is always **inline SVG** — no sprite `<use>` references
- No icon picker needed on the frontend — only in the backoffice

---

## Source of Truth

Individual SVG files in `ClientApp/icons/`.
One file = one icon. File name = icon ID.

```
ClientApp/icons/
  arrow-right.svg
  search.svg
  external-link.svg
  ...
```

---

## Frontend

**Vite** copies `ClientApp/icons/*.svg` → `wwwroot/icons/` at build time.

**Tag Helper** `<app-icon>` reads the file from `wwwroot/icons/{name}.svg` and outputs inline `<svg>`. Caches file content in `IMemoryCache`.

```cshtml
<app-icon name="arrow-right" />
```

Output:
```html
<svg viewBox="0 0 24 24" ...><path .../></svg>
```

No manifest. No sets. No picker.

---

## Backoffice Icon Picker

Lives inside `App_Plugins/CtaPropertyEditor/src/icons/manifest.ts` (bundled at build time — no runtime fetch for the list).

```ts
export interface IconEntry {
    id: string;
    label: string;
    sets: IconSet[];
}

export type IconSet = 'full' | 'button';

export const icons: IconEntry[] = [
    { id: 'arrow-right',    label: 'Arrow Right',    sets: ['button', 'full'] },
    { id: 'search',         label: 'Search',         sets: ['full'] },
    { id: 'external-link',  label: 'External Link',  sets: ['button', 'full'] },
];
```

The picker element filters by `set` prop, renders previews by fetching `/icons/{id}.svg`.

---

## Adding an Icon

1. Drop `my-icon.svg` into `ClientApp/icons/`
2. Add one entry to `App_Plugins/CtaPropertyEditor/src/icons/manifest.ts`
3. Rebuild both:
   - `ClientApp/` → `npm run build`
   - `App_Plugins/CtaPropertyEditor/` → `npm run build`

---

## Retiring `_SvgSprite.cshtml`

The sprite partial is replaced entirely by the `<app-icon>` Tag Helper.
Delete `_SvgSprite.cshtml` and its `@await Html.PartialAsync("...")` call once the Tag Helper is in place.

---

## Future Upgrade Path

If the manifest grows large or needs to be shared across multiple property editors:

- Move `manifest.ts` to `ClientApp/icons/manifest.ts`
- Either symlink it into each plugin's `src/`, or configure Vite aliases to point at it
- Or: have Vite output `wwwroot/icons/manifest.json` and switch pickers to fetch it at runtime

Not needed at PoC scale.
