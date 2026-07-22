# ADR 0016: Notice is a presentational message; the live region is a separate, persistent container

**Status:** Accepted
**Date:** 2026-07-22
**Decider:** Nicklas Bryntesson

## Context

ChoiceGroup ships a group-level error as an inline `<p class="Error" role="alert">…</p>`.
That placeholder exposed two problems:

1. **It is really a reusable message, not a ChoiceGroup part.** The same thing recurs as a
   field error, a form-level error summary, an inline success/info note, and (later) a toast.
   atomica11y already carries the criteria: `alert-notification.md`, `toast-snackbar.md`,
   `hint-help-or-error.md`.
2. **The live-region mechanics don't work the way inline markup implies.** `role="alert"`
   (= `aria-live="assertive"` + `aria-atomic="true"`) announces a **content change inside a
   live region that already exists** in the accessibility tree. Injecting a *pre-filled*
   `<p role="alert">text</p>` as one node is **unreliable** across SR/browser combos (region
   and content register in the same tick), and a filled alert present at **page load**
   announces on load — an anti-pattern. The announcer must pre-exist; the message is what
   changes inside it.

## Decision

Split the concern into a payload and an announcer — the same item/wrapper separation as
ChoiceField (item) / ChoiceGroup (wrapper):

1. **Notice** — a **presentational** message component: a severity `data-variant`
   (`error` · `warning` · `success` · `info`), an **inline SVG** icon, and text. It carries
   **no live role**, no announcement responsibility, no dismissal/timing. It is the payload
   that gets rendered, injected, or removed.

2. **The live region is a separate, persistent container the context owns.** It is present
   in the DOM from load (empty) and the consumer swaps Notice content into it:

   ```html
   <div class="NoticeRegion" role="alert"><!-- empty at load; Notice injected here --></div>
   ```

   Politeness follows severity: **`role="alert"`** (assertive) for `error`/`warning`,
   **`role="status"`** (polite) for `success`/`info`. Reliable announcement = keep the
   region mounted and change its contents (clear → next frame → set), never inject the
   region itself pre-filled.

3. **Icons are inline SVG using `currentColor`**, so the icon and text share the severity
   colour from a single `color`. This is deliberately **not** a CSS `mask`/`background`
   icon. (Contrast ChoiceField's tick, which *is* a mask: there the mark colour is the
   contrast colour on the accent fill — *not* the text colour — so `currentColor` couldn't
   work and a token-tinted mask was correct. Two different needs; do not "harmonize" them.)

## Considered alternatives

1. **Inline `<p role="alert">` per consumer (current placeholder)** — Rejected: not reusable,
   and a pre-filled injected alert is unreliable / announces on load.
2. **Notice owns its own live-region wrapper** — Rejected: injecting the live node together
   with its content is the unreliable case; the announcer has to be the part that already
   existed.
3. **One "Alert" component bundling region + content** — Rejected: couples announcer to
   payload, so the payload can't be reused statically (no announcement wanted) or inside a
   shared toast region; and "Alert" collides with the ARIA role name.
4. **Notice (payload) + context-owned persistent live region (chosen)** — reusable payload,
   correct announcement centralised in the container, icons theme via `currentColor`.

## Consequences

### Positive
- One Notice serves field errors, form-level errors, static page notes, and (later) toasts;
  only the container's politeness differs.
- Announcement correctness lives in one place (the persistent region), not smeared across
  every consumer's markup.
- `currentColor` icons re-tint with the severity colour for free.

### Costs
- Consumers must provide the persistent region **and** do the clear → (next frame) → set
  content swap for reliable announcement. This must be documented in Notice's contract.
- A little more markup than a bare `<p role="alert">`.

### Risks to manage
- Someone puts the live role on Notice itself → unreliable announcement. The contract must
  state the role belongs on the persistent container.
- Someone converts the inline-SVG icons to a CSS mask and loses `currentColor` inheritance.

### Explicitly deferred — future components/primitives, not this ADR
- **Toast / Snackbar** — transient, auto-dismiss, stacked, positioned. That behaviour is the
  designed thing, so it is its own component (it will *reuse* Notice as its content and a
  shared live region as its announcer).
- **A `LiveRegion` kernel primitive** — the persistent region + politeness + the
  clear→frame→set timing dance. Promote it only when a second consumer (toast) earns it
  (kernel is earned by reuse); until then the container is a documented pattern in Notice.

### ChoiceGroup in the meantime
ChoiceGroup's `<p class="Error" role="alert">` stays as a **documented placeholder**. When
Notice ships, ChoiceGroup's error slot becomes `<div role="alert"><Notice variant="error">
…</Notice></div>`, and the same for a future hint→Notice(info) if wanted.

### Non-goals
- No dismissal/close affordance, auto-timeout, stacking, or positioning — those are toast
  concerns. Notice is inline content only.
- Notice does not own the `aria-describedby` wiring that ChoiceGroup uses for its hint — that
  is the consumer's field/group association.

### Kernel dependencies
- None now. `LiveRegion` is a future candidate (see deferred), earned by the toast consumer.

## Reconsider when

- Notice is built — flip to `Accepted`; build the variants + inline-SVG icon set, and
  refactor ChoiceGroup's error slot to compose it.
- Toast/Snackbar is built — extract the `LiveRegion` kernel primitive then, with the form
  error region as its first consumer and toast as the second.

## References

- `docs/atomica11y/form/alert-notification.md`, `toast-snackbar.md`, `hint-help-or-error.md`
- ADR-0004 (kernel earned by reuse), ADR-0006 (native-first), ADR-0013 (item/wrapper
  separation precedent — ChoiceField/ChoiceGroup)
- WAI-ARIA live-region semantics (`role="alert"` / `role="status"`, `aria-live`, `aria-atomic`)
