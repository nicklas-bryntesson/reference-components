# Tag Helper API Reference

Complete property map for every `<app-*>` Tag Helper. All values are case-insensitive. Invalid values are silently ignored in production and render an error `<div>` in development.

---

## `<app-heading>`

Renders a semantic heading/text element decoupled from its visual style.

**CSS class:** `Heading`

### Properties

| Attribute | Type | Default | Valid values |
|-----------|------|---------|-------------|
| `element` | string | `h2` | `h1` `h2` `h3` `h4` `h5` `h6` `span` `div` `p` |
| `variant` | string | `heading` | `heading` `display` `body` |
| `size` | string | auto | See size table below |
| `text` | string | — | Plain text (XSS-encoded) |
| `highlight` | string | — | Comma-separated words to wrap in `<mark>` |
| `href` | string | — | Wraps text in `<a class="heading-link">` |
| `align` | string | `left` | `left` `center` `right` |
| `wrap` | string | `balance` | `balance` `pretty` `stable` `nowrap` |
| `color` | string | — | `primary` `dark` `light` `inherit` |

### Size values per variant

| variant | valid sizes | default when omitted |
|---------|------------|----------------------|
| `heading` | `1` `2` `3` `4` `5` `6` | inferred from element (`h2` → `2`, etc.) |
| `display` | `1` `2` `3` | `2` |
| `body` | `sm` `md` `lg` | `md` |

### Element restrictions per variant

| variant | allowed elements |
|---------|-----------------|
| `heading` | all (`h1`–`h6`, `span`, `div`, `p`) |
| `display` | all (`h1`–`h6`, `span`, `div`, `p`) |
| `body` | heading elements only (`h1`–`h6`) |

### Content rules

- Provide either `text` OR child content — **never both**
- `href` requires `text` — **cannot combine `href` with child content**
- `highlight` only works with `text`
- Renders nothing (suppressed) if both `text` and child content are absent

### Examples

```cshtml
{{!-- semantic h1, styled as display-1 --}}
<app-heading element="h1" variant="display" size="1" text="Page Title" />

{{!-- default heading/2 --}}
<app-heading element="h2" text="Section Title" />

{{!-- body label on an h3 for document outline --}}
<app-heading element="h3" variant="body" size="sm" text="Posted on" />

{{!-- highlighted word --}}
<app-heading element="h2" text="Build better with AiPoc" highlight="AiPoc" />

{{!-- linked heading --}}
<app-heading element="h3" href="/blog" text="Latest posts" />

{{!-- custom child content --}}
<app-heading element="h2">Rich <em>content</em> here</app-heading>
```

---

## `<app-link-button>`

Renders an `<a>` tag styled as a Button. No `intent` — links are always intent-neutral.

**CSS class:** `Button`

### Properties

| Attribute | Type | Default | Valid values |
|-----------|------|---------|-------------|
| `href` | string | — | Any URL |
| `target` | string | — | `_blank` `_self` etc. (`_blank` auto-adds `rel="noopener noreferrer"`) |
| `emphasis` | string | `primary` | `primary` `secondary` `tertiary` |
| `size` | string | `md` | `sm` `md` `lg` |
| `pill` | bool | `false` | `true` `false` |
| `icon` | string | — | SVG sprite symbol ID |
| `icon-position` | string | `right` | `left` `right` |
| `aria-label` | string | — | Required when icon-only |

### Content rules

- Provide child content (button label) and/or `icon`
- Suppress (render nothing) if all three are absent: no child content, no `icon`, no `aria-label`
- Icon-only (no child content + icon present) → sets `data-icon-only="true"`
- **No `intent` attribute** — links do not carry destructive/success intent

### Examples

```cshtml
<app-link-button href="/start">Get started</app-link-button>

<app-link-button href="/docs" emphasis="secondary" size="sm">Docs</app-link-button>

<app-link-button href="https://example.com" target="_blank" icon="arrow-right">
  Open link
</app-link-button>

{{!-- icon-only --}}
<app-link-button href="/share" icon="share" aria-label="Share" />
```

---

## `<app-action-button>`

Renders a `<button>` element. Supports `intent` for destructive/success states.

**CSS class:** `Button`

### Properties

| Attribute | Type | Default | Valid values |
|-----------|------|---------|-------------|
| `button-type` | string | `button` | `button` `submit` `reset` |
| `disabled` | bool | `false` | `true` `false` |
| `emphasis` | string | `primary` | `primary` `secondary` `tertiary` |
| `intent` | string | `neutral` | `neutral` `destructive` `success` |
| `size` | string | `md` | `sm` `md` `lg` |
| `pill` | bool | `false` | `true` `false` |
| `icon` | string | — | SVG sprite symbol ID |
| `icon-position` | string | `right` | `left` `right` |
| `aria-label` | string | — | Required when icon-only |

### Content rules

- Same as `app-link-button` — child content and/or `icon` required
- Suppress if all absent
- Icon-only → sets `data-icon-only="true"`

### Examples

```cshtml
<app-action-button button-type="submit">Save</app-action-button>

<app-action-button intent="destructive" emphasis="secondary">Delete account</app-action-button>

<app-action-button button-type="button" icon="close" aria-label="Close dialog" />

<app-action-button disabled="true" button-type="submit">Processing…</app-action-button>
```

---

## `<app-cta-link-button>`

Special promotional link button with layered visual effects. Distinct from `app-link-button` — not interchangeable.

**CSS class:** `CtaButton`

### Properties

| Attribute | Type | Default | Valid values |
|-----------|------|---------|-------------|
| `href` | string | — | Any URL |
| `target` | string | — | `_blank` etc. |
| `variant` | string | `glow` | `glow` *(only valid value currently)* |
| `icon` | string | — | SVG sprite symbol ID (always rendered on the right) |
| `aria-label` | string | — | — |

### Content rules

- Requires child content OR `aria-label`
- Icon position is always right — no `icon-position` attribute
- No `emphasis`, `size`, `pill`, `intent` — those belong to `app-link-button`

### Examples

```cshtml
<app-cta-link-button href="/signup">Start free trial</app-cta-link-button>

<app-cta-link-button href="/demo" icon="play">Watch demo</app-cta-link-button>
```

---

## `<app-card>`

Renders a container element with optional border and elevation.

**CSS class:** `Card`

### Properties

| Attribute | Type | Default | Valid values |
|-----------|------|---------|-------------|
| `element` | string | `article` | `article` `section` `li` `div` |
| `padding` | string | `md` | `none` `sm` `md` `lg` |
| `border` | bool | `false` | `true` `false` |
| `elevation` | string | — | `none` `sm` `md` `lg` (omit to have no elevation attribute) |

### Content rules

- Suppressed if no child content

### Forbidden combinations

Currently none enforced (see `ForbiddenCombinations` in `CardTagHelper.cs` — empty set). Project constraints are added there when the design system dictates, e.g.:

> bordered cards may not have elevation → add `(true, "sm")`, `(true, "md")`, `(true, "lg")` to the set

### Examples

```cshtml
<app-card>Content</app-card>

<app-card border="true" padding="lg">
  <p>Bordered card</p>
</app-card>

<app-card element="li" elevation="sm" padding="sm">
  List item card
</app-card>
```

---

## `<app-prose>`

Renders a block of rich/body text with variant and size axes.

**CSS class:** `Prose`

### Properties

| Attribute | Type | Default | Valid values |
|-----------|------|---------|-------------|
| `element` | string | `div` | `div` `section` `article` `aside` `footer` |
| `variant` | string | `default` | `basic` `default` `rich` |
| `size` | string | `md` | `sm` `md` `lg` |
| `content` | `IHtmlContent` | — | Pass pre-rendered HTML (e.g. from Umbraco RTE) |

### Content rules

- Provide either `content` (IHtmlContent, for Umbraco RTE output) OR child content — not both
- Suppressed if both are absent

### Examples

```cshtml
{{!-- child content --}}
<app-prose variant="rich" size="lg">
  <p>Some body copy.</p>
</app-prose>

{{!-- Umbraco RTE field (IHtmlContent) --}}
<app-prose content="@Model.BodyText" />

{{!-- basic variant for plain text snippets --}}
<app-prose variant="basic" size="sm">
  <p>@Model.Excerpt</p>
</app-prose>
```

---

## `<app-picture>`

Renders a responsive `<figure>` with `<picture>` / `<source>` / `<img>` elements using predefined presets.

**CSS class:** `Media` (on the `<figure>`)

### Properties

| Attribute | Type | Default | Valid values |
|-----------|------|---------|-------------|
| `image` | `IPublishedContent` | **required** | Umbraco media node |
| `preset` | string | `""` | `teaser` `hero` (see table below) |
| `alt` | string | — | Alt text (empty string = decorative) |
| `loading` | string | — | `lazy` `eager` (overrides preset default) |

### Preset reference

| Preset | Loading default | Use case |
|--------|----------------|----------|
| `teaser` | `lazy` | Card/teaser component images (stacked + horizontal responsive) |
| `hero` | `eager` | Full-bleed hero images (art direction across breakpoints) |

### Content rules

- No child content — self-closing
- Renders nothing (error in dev) if `image` is null or `preset` is unknown

### Examples

```cshtml
<app-picture image="@Model.HeroImage" preset="hero" alt="Mountain landscape" />

<app-picture image="@post.ThumbnailImage" preset="teaser" alt="@post.Name" />

{{!-- decorative image --}}
<app-picture image="@Model.BackgroundImage" preset="hero" alt="" />
```

---

## `<app-teaser>`

Opinionated card+media+heading+excerpt layout. Wraps its own `Card` frame — callers never set Card props directly.

**CSS class:** `Teaser`

### Properties

| Attribute | Type | Default | Valid values |
|-----------|------|---------|-------------|
| `element` | string | `article` | `article` `div` `li` `section` |
| `frame` | string | `bordered` | `bordered` `elevated` `bare` |
| `image` | `IPublishedContent` | — | Umbraco media node |
| `alt` | string | — | Alt text for image |
| `heading` | string | — | Card heading text |
| `href` | string | — | Link URL (wraps heading unless `button` is true) |
| `excerpt` | string | — | Short description text (XSS-encoded) |
| `button` | bool | `false` | `true` `false` |
| `button-label` | string | `Read more` | CTA button label |

### Content rules

- Child content is placed inside the body area, after `excerpt`
- `button="true"` requires `href` — will error without it
- When `button="false"` (default) and `href` is set, the heading becomes a link
- When `button="true"`, `href` is used only for the button — heading is plain text

### Frame → Card mapping (internal, callers do not control this)

| `frame` | Card output |
|---------|------------|
| `bordered` | `data-border="true"` |
| `elevated` | `data-elevation="sm"` |
| `bare` | no Card wrapper |

### Examples

```cshtml
{{!-- linked heading, no button --}}
<app-teaser
  image="@post.ThumbnailImage"
  alt="@post.Name"
  heading="@post.Name"
  href="@post.Url()"
  excerpt="@post.Excerpt" />

{{!-- explicit CTA button --}}
<app-teaser
  heading="@post.Name"
  href="@post.Url()"
  excerpt="@post.Excerpt"
  button="true"
  button-label="Read the post" />

{{!-- no frame --}}
<app-teaser frame="bare" heading="@post.Name" excerpt="@post.Excerpt" />

{{!-- list context --}}
<app-teaser element="li" image="@item.Image" heading="@item.Title" href="@item.Url()" />
```

---

## Quick comparison: Button variants

| | `app-link-button` | `app-action-button` | `app-cta-link-button` |
|---|---|---|---|
| Renders as | `<a>` | `<button>` | `<a>` |
| CSS class | `Button` | `Button` | `CtaButton` |
| Has `intent` | no | yes | no |
| Has `emphasis` | yes | yes | no |
| Has `size` | yes | yes | no |
| Has `pill` | yes | yes | no |
| Has `variant` | no | no | yes (`glow`) |
| Icon position | left / right | left / right | always right |
| Use for | navigation, links | form actions | marketing CTAs |
