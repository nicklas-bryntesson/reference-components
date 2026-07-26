# AffixField

An **affix** is the linguistics umbrella term for prefix and suffix. AffixField renders text affixes — a prefix, a suffix, or both — visually inside a native text-like `<input>`: `$ 100`, `100 timmar`, `$ 100 USD`. The affixes are plain, non-interactive text; the input remains a fully native form control that submits its own value.

The layout is a grid-stack overlay: all children share one grid area, the affixes float above the input with `pointer-events: none`, so the entire component surface stays the native input's hit target — clicking an affix focuses the field for free.

## The end-state contract (read this first)

AffixField has **no interactivity**: no popup, no keyboard model, no value logic. Everything its JS does is *compute attributes* — ids, ARIA wiring, presence attributes, character counts. All of that is equally computable server-side (a Razor Tag Helper or a Vue render function knows the affix strings at render time).

Therefore this contract specifies **the finished DOM end-state**, not where it is computed:

| Contractual end-state (must be true) | Who typically computes it |
|---|---|
| Affixes carry ids | reference: JS at init · server stack: rendered in markup |
| Input `aria-describedby` references the affix ids (unless opted out) | same |
| Root carries `data-has-prefix="true"` / `data-has-suffix="true"` for the sides that exist | same — the CSS padding gates key on them |
| Root has `--_af-prefix-chars` / `--_af-suffix-chars` set (the affix string lengths) | same — **fully symmetric:** reference JS and a server compute the *same thing* (the string length), just at different times |
| Number spinner hidden | CSS (static, no computation) |

Consequences:

1. **The reference JS is gap-filling, never overwriting.** If everything is already authored (as a server would render it), JS finds nothing to do and touches nothing. Authored values always win.
2. **The e2e suite asserts the end-state, not the mechanism** — a server-rendered implementation with **zero client JS** passes the same Playwright suite. This extends the PORTING.md story from "port to another framework" to "port to another logic placement".

## Authored vs end-state markup

Authored (minimum):

```html
<label for="af-1">Belopp</label>
<div class="AffixField" data-component="AffixField">
  <span class="AffixField-prefix">$</span>
  <input class="AffixField-input" id="af-1" name="af-1" type="text" inputmode="decimal">
  <span class="AffixField-suffix">USD</span>
</div>
```

End-state (after JS gap-fill *or* fully server-rendered — identical):

```html
<label for="af-1">Belopp</label>
<div class="AffixField" data-component="AffixField" data-initialized="true"
     data-has-prefix="true" data-has-suffix="true"
     style="--_af-prefix-chars: 1; --_af-suffix-chars: 3">
  <span class="AffixField-prefix" id="af-1-prefix">$</span>
  <input class="AffixField-input" id="af-1" name="af-1" type="text" inputmode="decimal"
         aria-describedby="af-1-prefix af-1-suffix">
  <span class="AffixField-suffix" id="af-1-suffix">USD</span>
</div>
```

- Prefix and/or suffix may each be omitted; the component works with either or both.
- The input keeps its own border/background — the native element stays the styled element. Its inline padding is gated on `data-has-prefix="true"` / `data-has-suffix="true"` and computed from the counts (`padding-inline-start: calc(var(--_af-prefix-chars) * var(--_af-ch-unit) + gap + inline padding)`, mirrored for the suffix); a side without an affix degrades to the plain inline padding.
- Logical properties throughout — RTL flips for free.

## Where the logic lives (an honesty section)

The reference implementation computes the end-state with client JS at `attach()` time. A server-rendered stack (e.g. an ASP.NET Tag Helper) can render the identical end-state with **no client JS at all** — the affix strings, ids, `aria-describedby` and the character counts are known at render time (`prefix.Length` is the whole computation). Both placements reach the same DOM; the e2e suite asserts the DOM, so both pass.

### The character-unit model

The layout speaks **one unit** across the whole component: a calibrated character slot.

- **`1ch`** is the width of the font's **"0" glyph** — nothing more. In a proportional font other characters vary around it ("i" is narrower, "W" is wider), so raw `ch`-math under- or over-shoots.
- **`--_af-ch-unit` (default `1.125ch`)** is the calibration factor: it maps "one character" to a practical average slot for the host's typeface. The default is the production-proven value from SVL — calibrate it against your typeface like any other design token.
- **`--_af-prefix-chars` / `--_af-suffix-chars`** are plain numbers — the affix string lengths. They are **content facts**: the reference JS computes `textContent.trim().length`, a server computes `prefix.Length` — the *same computation at a different time*, which is what makes this end-state fully symmetric. Counts don't change with fonts, so there is no re-measure machinery of any kind.
- **The CSS formulas own the math:** `count × unit + gap + padding` per affix side, gated on the presence attributes.

**Per-string variance, honestly:** the calibration factor matches the *average* string, not every string. Affixes are short (`$`, `kr`, `USD`, `timmar`), and `--_af-gap` absorbs normal variance. For an outlier ("WWW" runs wide, "iii" runs narrow), author a **fractional count** — `--_af-prefix-chars: 3.5` — as the tuning ventil; authored counts always win over the gap-fill.

One caveat: custom properties inherit, so a `--_af-prefix-chars` set on an *ancestor* bleeds into every AffixField inside it in a zero-JS stack — author counts per instance, inline on the root, as the end-state example does. (The reference gap-fill deliberately treats only inline-on-root values as authored: a count is an instance's content fact, so an inherited value is overridden with the correct one.)

## Attributes (on root)

| Attribute | Type | Description |
|---|---|---|
| `data-component` | `"AffixField"` | Attach hook. |
| `data-align` | `"end"` | Opt-in end-alignment of the input text (amounts). Default: `start`. There is no `center`. |
| `data-input-characters` | number | Width of the **value area** in character units — JS (or the server) maps it to `--_af-input-chars`, and the wrapper width becomes `calc(var(--_af-input-chars) * var(--_af-ch-unit) + affix slots + gaps + paddings + borders)`. **When absent** (the default) no width is imposed: the field sizes via normal CSS. |
| `data-has-prefix` / `data-has-suffix` | `"true"` | **End-state contract** — set to the literal string `"true"` for each affix side that exists, absent otherwise (the family-wide boolean convention — see `.claude/philosophy.md`). The padding gates match `[data-has-prefix="true"]` exactly — any other value is treated as absent (affix presence is load-bearing layout data, so it is expressed as end-state data — never inferred with `:has()`). Server-rendered, or gap-filled by JS from affix presence; authored attributes are never touched, so author `"true"` or nothing. |
| `data-disabled` | `"true"` | Styling hook (author also sets `disabled` on the input, as the kitchensink states do). |
| `data-invalid` | `"true"` | Styling hook (author also sets `aria-invalid="true"` on the input). |
| `data-initialized` | `"true"` | Set by JS (or authored in a server end-state). |

> **Why not the native `size` attribute for width?** `size` *is* the platform's "width in characters" API, but browsers compute it inconsistently — the same `size="4"` renders different widths across engines. `data-input-characters` keeps the deterministic cross-browser behaviour a design system needs, and ports cleanly to a server-rendered stack (it's just an attribute → custom property mapping).

## Supported input types (the allowlist)

| Type | In? | Notes |
|---|---|---|
| `text` | ✅ | The general case. For amounts, `type="text" inputmode="decimal"` is often the *right* choice — the examples show it. |
| `number` | ✅ **primary use case** | Hours / kronor / days. The WebKit spinner physically collides with a suffix at inline-end → **the contract hides it** (`appearance` + the `::-webkit-*-spin-button` pseudo-elements). Arrow-key stepping still works — hiding the spinner removes a redundant pointer affordance, not the keyboard behaviour, so it is deliberate and a11y-safe. |
| `tel` | ✅ | Prefix `+46` — the classic. |
| `url` | ✅ | Prefix `https://`, suffix `.example.se`. |
| `email` | ✅ | Suffix `@company.se` for locked domains — **honesty note:** the submitted value then isn't a full address, so the more-correct variant is usually `<input class="AffixField-input" type="text">` + `<span class="AffixField-suffix">@company.se</span>` and the server appends the domain. |
| `search` | ✅ | Harmless; rarely useful. |
| `password` | ❌ non-goal | The suffix slot becomes show/hide-button territory — an *interactive* affix, i.e. a different component. |
| `date`/`time`/`month`/`week`/`datetime-local` | ❌ non-goal | The family has dedicated fields; native picker internals clash with the overlay. |
| `color` / `range` / `file` / checkbox / radio / buttons | ❌ non-goal | Meaningless. |

> **Known gap — a steppable, garbage-proof amount.** Neither supported type gives a cost field everything at once: `type="number"` steps by keyboard but rejects grouped/locale-decimal input and its click-spinner is hidden; `type="text" inputmode="decimal"` formats freely and raises the decimal keypad but has *no* stepping and leans on `inputmode` alone to discourage letters. A visible, constrained stepper for amounts like `$ 100.75 USD` is more likely to come from a **segmented numeric input** — the same model the date/time fields use to make invalid input unrepresentable — than from either native type. Not built; recorded here as a known gap.

Enforcement: documented allowlist, not runtime policing. JS does not error on other types (it can't know better than the author) — but this table is the scope.

## Accessibility model

**Default (gap-filled by JS, or server-rendered):** affixes get ids (`<input-id>-prefix` / `<input-id>-suffix`; a generated instance id is the base when the input has no id), and the ids are **appended to the input's `aria-describedby` after any existing entries** — authored hint/error ids are preserved and keep their order. The accessible name stays stable (the label); the unit is announced after name/role/value: *"Belopp, redigeringsfält, 100, USD"*.

**Overrides (JS keeps its hands off):**

- `aria-hidden="true"` authored on an affix → skipped entirely (no id, no reference).
- The input's authored `aria-describedby`/`aria-labelledby` already references the affix ids → JS leaves everything alone.

**Decision table:**

| Situation | Do this |
|---|---|
| Unit already in the visible label? ("Antal timmar" + suffix "timmar") | Author `aria-hidden="true"` on the affix — announcing it twice is noise |
| Otherwise | Let the default wiring announce it |

Robustness guideline (authoring, not component logic): when the unit is critical to understanding the field, put it in the visible label too — screen-reader verbosity settings can suppress descriptions.

**Hard rules:**

- A **real `<label>` is required**. A placeholder is not a name.
- **Never reference the input's own id in `aria-labelledby`** — self-reference pulls the live value into the name, so the name changes as the user types.
- **`aria-describedby`, not `aria-labelledby`, for affixes** — it can never displace the label from the name computation and can never self-reference-loop.

## JS API

`AffixField` is the default export.

- `AffixField.attach(parent = document)` — mounts every `[data-component="AffixField"]` under `parent`. Idempotent: an `__affixFieldInstance` guard on the element skips already-mounted instances, so it is safe to call again after dynamic injection.
- `destroy()` (instance method) — clears the instance guard. There are no event listeners, timers or pending callbacks to cancel.
- `mergeTokenList(existing, additions)` — pure helper, exported for unit tests.

What `attach()` does per instance (all of it optional in a server stack):

1. Sets `data-has-prefix="true"` / `data-has-suffix="true"` for the affix sides that exist (skipped for authored attributes).
2. Sets `--_af-prefix-chars` / `--_af-suffix-chars` inline on the root from each affix's `textContent.trim().length` (skipped for any count already authored inline on the root — including fractional tuning values).
3. `data-input-characters` → sets `--_af-input-chars` on the root (skipped if already authored).
4. Wires affix ids + `aria-describedby` per the accessibility model (skipped where authored/overridden).
5. Sets `data-initialized="true"`.

## Events

**None.** The component dispatches no events, never reads or writes the input's value, and handles no keys — the input is native and untouched. Listen to the input's own native `input`/`change` events.

## CSS tokens

All tokens are custom properties on `.AffixField`:

| Token | Description |
|---|---|
| `--_af-ch-unit` | **Calibration** — the width of one character slot for the host's typeface (default `1.125ch`, the production-proven SVL value). Calibrate against your font like any other token |
| `--_af-gap` | Space between an affix and the value area (default `0.5ch`) |
| `--_af-inline-padding` | Inline padding inside the input (default `0.75rem`) |
| `--_af-border-width` | Input border width (also part of the sized-width calc) |
| `--_af-border-color` | Input border |
| `--_af-border-color-hover` | Input border on hover |
| `--_af-border-color-invalid` | Input border when `data-invalid` |
| `--_af-bg-hover` | Input background on hover |
| `--_af-bg-active` | Input background on active |
| `--_af-affix-color` | Affix text color |
| `--_af-prefix-chars` / `--_af-suffix-chars` | **End-state contract** — the affix string lengths as plain numbers; gap-filled (JS) or authored (server); fractional values are the tuning ventil for atypical strings |
| `--_af-input-chars` | **End-state contract** — set from `data-input-characters`; only consumed under the `[data-input-characters]` gate |

## Kernel dependencies

**None.** AffixField composes no shared primitives from [`src/kernel/`](../../../kernel/README.md) — together with FileUpload it is the simplest porting target in the repo: the component folder ports on its own.

## Required site tokens

Three `--_af-*` token defaults (`--_af-bg-hover`, `--_af-bg-active`, `--_af-affix-color`) read two host-provided site tokens (reference values live in [`src/css/site/01-Setup/tokens.css`](../../../css/site/01-Setup/tokens.css)):

- `--ui-hover` (hover/active input background)
- `--ui-muted-foreground` (affix text color)

Map onto your design system from the **values** in `tokens.css`, not from the names alone. `--ui-hover` uses CSS system-color math (`color-mix(in srgb, CanvasText 3%, transparent)`), which gives free dark-mode support; `--ui-muted-foreground` is a fixed hex (`#6e6e6e`), chosen to pass AA contrast on a light canvas. Substituting your own values is valid — but you then own dark-mode and contrast yourself.

## Non-goals

- **Interactive affixes** (buttons, dropdowns, password-reveal) — the most important non-goal; this is where scope creep starts. An affix is inert text.
- `password` and the date/time family (see the allowlist).
- **Dynamic width / size-to-content while typing.** Static sizing only.
- No validation, formatting, or masking of the value — the affix is presentation; the value is the input's own business.
- No width measurement of any kind — counts × calibrated unit is the whole layout model (counts are font-independent, so nothing needs re-measuring, ever).
- Vanilla TS only; no framework code.

## Manual accessibility testing

Test with a real screenreader before shipping. Sources: `docs/atomica11y/form/text-input.md`, `docs/atomica11y/form/hint-help-or-error.md`.

### Desktop screenreader (NVDA, JAWS, VoiceOver)

**Default wiring (e.g. the live demo: label "Belopp", prefix "$", suffix "USD")**
- [ ] Tabbing into the field, I hear the label ("Belopp"), the role (edit text), the value, and then the affixes as description — in that order (name → role → value → description)
- [ ] The affix description is read AFTER any authored hint/error text (describedby merge order — spec O4)
- [ ] The accessible name does NOT change while typing (no self-reference in the name)
- [ ] Required/disabled/invalid state is expressed when applicable

**Unit-in-label mode (label "Antal timmar", suffix "timmar" authored `aria-hidden="true"`)**
- [ ] I hear the unit exactly once (from the label) — the aria-hidden affix is never announced

**Number variant (hidden spinner)**
- [ ] The field still identifies as a number/stepper input
- [ ] ArrowUp/ArrowDown still step the value and announce the new value, despite the hidden spinner

**describedby merge variant**
- [ ] The authored hint ("Anges exklusive moms.") is read before the affix description; both survive

### Mobile screenreader (VoiceOver iOS, TalkBack Android)

- [ ] Swipe to the input — I hear label, role, value, then the affix description
- [ ] `inputmode="decimal"` / `type="number"` raises the numeric keyboard on double-tap edit
- [ ] In unit-in-label mode the unit is announced exactly once
- [ ] The affix text is not a separate swipe stop that traps exploration (it is plain text; the input is the only control)
