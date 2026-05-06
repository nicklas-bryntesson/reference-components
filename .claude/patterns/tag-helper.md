# Component Pattern

Components are **ASP.NET Core Tag Helpers** paired with a single CSS file. The Tag Helper owns the markup contract; the CSS file owns the visual contract.

## Rules

- Tag name: `app-{name}` → renders a semantic HTML element
- CSS class: `{Name}` (PascalCase, matches component name exactly)
- Variants, sizes, states: `data-*` attributes — never BEM modifiers or utility classes
- One Tag Helper `.cs` file per component in `TagHelpers/`
- One CSS file per component in `ClientApp/css/04_ui/`
- Tag Helpers validate all attribute values in dev; silently suppress in production

---

## Example: Heading

### What it does

`<app-heading>` decouples **semantic element** (h1–h6, p, span, div) from **visual style** (variant + size). A marketing hero can use an `h1` element with `display` styling; a sidebar label can use an `h3` element with `body/sm` styling.

### Tag Helper attributes

| Attribute | Type | Default | Notes |
|-----------|------|---------|-------|
| `element` | string | `h2` | The rendered HTML element |
| `variant` | string | `heading` | `heading` \| `display` \| `body` |
| `size` | string | auto | heading: 1–6 · display: 1–3 · body: sm/md/lg |
| `text` | string | — | Plain text content (use OR child content, not both) |
| `highlight` | string | — | Comma-separated words to wrap in `<mark>` |
| `href` | string | — | Wraps text in `<a class="heading-link">` (requires `text`) |
| `align` | string | `left` | `left` \| `center` \| `right` |
| `wrap` | string | `balance` | `balance` \| `pretty` \| `stable` \| `nowrap` |
| `color` | string | — | `primary` \| `dark` \| `light` \| `inherit` |

**Size defaults when omitted:**
- `heading` → inferred from element (`h1` → 1, `h2` → 2, etc.)
- `display` → `2`
- `body` → `md`

### Usage

```cshtml
{{!-- semantic h1, styled as display-1 --}}
<app-heading element="h1" variant="display" size="1" text="Page Title" />

{{!-- h2 with default heading/2 styling --}}
<app-heading element="h2" text="Section Title" />

{{!-- body copy label, h3 for document outline --}}
<app-heading element="h3" variant="body" size="sm" text="Posted on" />

{{!-- highlighted words --}}
<app-heading element="h2" text="Build better with AiPoc" highlight="AiPoc" />

{{!-- linked heading --}}
<app-heading element="h3" href="/blog" text="Latest posts" />

{{!-- child content (custom markup inside) --}}
<app-heading element="h2">Rich <em>content</em> here</app-heading>
```

### Rendered HTML

```html
<!-- app-heading element="h2" variant="heading" size="3" text="Hello" -->
<h2 class="Heading" data-variant="heading" data-size="3" data-align="left" data-wrap="balance">
  <span class="heading-text">Hello</span>
</h2>

<!-- with href -->
<h2 class="Heading" data-variant="heading" data-size="3" ...>
  <a href="/blog" class="heading-link">Hello</a>
</h2>
```

### CSS structure

```css
/* Heading.css */

.Heading { /* reset: margin-block, overflow-wrap */ }

.Heading .heading-text,
.Heading .heading-link {
  /* typography engine: resolves --_fontSize, --_lineHeight */
}

.Heading[data-variant="heading"] { /* font stack, weight, tracking */ }
.Heading[data-variant="heading"][data-size="1"] { --_fontSize: var(--fontSize-h1); }
/* … sizes 2–6 … */

.Heading[data-variant="display"] { /* display font stack */ }
/* … sizes 1–3 … */

.Heading[data-variant="body"] { /* body font stack */ }
/* … sizes sm/md/lg … */

.Heading[data-align="center"] { text-align: center; }
.Heading[data-wrap="pretty"]  { text-wrap: pretty; }
```

The CSS never references element type — all styling is driven by `data-variant` and `data-size`. This means the same visual output regardless of which element is rendered.

---

## Adding a new component

1. Create `TagHelpers/{Name}TagHelper.cs` — target `app-{name}`
2. Validate all attribute values; call `output.SuppressOutput()` (prod) or render an error div (dev) on invalid input
3. Set `class="{Name}"` — preserve any extra classes passed by the caller
4. Set `data-*` attributes for all variant axes
5. Create `ClientApp/css/04_ui/{Name}.css` — `.{Name}` as root selector, `data-*` for all variants
6. Import the new CSS file in `ClientApp/css/style.css`
