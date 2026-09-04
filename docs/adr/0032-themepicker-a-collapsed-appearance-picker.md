# ADR 0032: ThemePicker — a collapsed appearance picker

**Status:** Proposed
**Date:** 2026-08-28
**Decider:** Nicklas Bryntesson

## Context

ThemeSwitch is a three-segment inline control — System · Light · Dark — and its footprint
is its cost: three always-visible segments in a header where space is contested. The
compact pattern seen in the wild is a single button, but the common *cycle-button*
carries a known ambiguity (the ongoing three-state debate in the design community turns
on exactly this): an icon-only button must mean both "this is the state" and "this is
the action", and a moon can be read as either *we are dark* or *go dark*.

The proposed shape dissolves that ambiguity structurally instead of iconographically:
the button is a **disclosure** — it mirrors, it never acts — and the actions live in a
popup of three *labelled* options (icon + text) whose checked state is visible. Same
affordance as ThemeSwitch, smaller footprint.

The boundary question is whether this is a `data-variant` of ThemeSwitch or its own
component. ThemeSwitch's contract root **is** the `<fieldset>` with three radios as the
visible surface; the collapsed shape's root is a trigger button plus a popup with the
group inside. The root's content model changes — that is earning condition 1 (ADR-0013),
not a skin.

## Decision

**ThemePicker is in scope as its own component: a disclosure button that mirrors the
current appearance preference and opens a popup containing the same three-radio group
ThemeSwitch ships.** One line of scope: it is ThemeSwitch's value model in a collapsed
posture — never a fourth appearance option, never a generic menu.

- **Inside the popup are native radios** — the `fieldset` + `legend` + three-radio recipe
  is **copied** from ThemeSwitch (ADR-0020: shared visuals are a recipe), this time with
  visible labels beside the icons; no `role="menu"`, no new ARIA widget.
- **Popup behaviour is imported**: `popup-position` and `popup-interaction` from the
  kernel, like the six components already composing them. The trigger carries
  `aria-expanded` and the family's popup semantics.
- **Choosing an option commits and closes** (test 16: a choice is a complete value),
  returning focus to the trigger. Light dismiss never refocuses the trigger (ADR-0007).
- **The trigger mirrors the *preference*, not the resolved appearance**: when the
  preference is `system`, the trigger shows the system icon — not the resolved sun/moon.
  The control sets preference, so the trigger must match what is checked in the popup it
  opens; the resolved appearance is already visible in every pixel of the page.
  (ThemeSwitch's readout vocabulary — preference vs appearance — already draws this
  line.)
- Like ThemeSwitch, its entire footprint on a consuming project is the `data-appearance`
  attribute on `<html>`; it never applies colours (ADR-0021).

Strategically this is the repo's first non-field popup-selection control — the smallest
possible one — and its skeleton (trigger, popover, choice-commits-and-closes) is the
on-ramp for the Combobox rebuild queued in the README.

## Considered alternatives

1. **A `data-variant` on ThemeSwitch** — rejected: the contract root's content model
   changes (fieldset-as-root vs trigger+popup), which is earning condition 1; a variant
   flag that swaps the entire DOM is two components sharing a name.
2. **Native `<select>`** — the native collapsed exclusive choice, and the first element
   to reach for (test 10). Rejected: icons inside options and a styled popup are not
   achievable cross-browser, and Chromium's customizable select
   (`appearance: base-select`) is progressive enhancement by house rule (ADR-0005) —
   the picker's presentation would be load-bearing on feature detection. Reconsider-when
   below.
3. **A cycle button** (one button stepping system → light → dark) — rejected: smallest
   footprint but the state-vs-action ambiguity is the documented failure of the pattern,
   plus an invisible third state the user must infer by cycling past it.
4. **`role="menu"` with `menuitemradio`** — the ARIA-canonical menu-button pattern.
   Rejected: it buys the full menu keyboard contract (arrow navigation, typeahead, focus
   wrapping) for something native radios inside a dialog-popup give for free, and the
   repo composes native semantics over ARIA widgets wherever the native element exists.
5. **Disclosure button + popup of native radios** — chosen: ThemeSwitch's tested value
   model, the kernel's tested popup model, and no new semantics anywhere.

## Consequences

### Positive
- The compact footprint without the cycle-button's ambiguity; every option keeps a
  visible label, which the inline ThemeSwitch's clipped-text icons never offered.
- Reuses two shipped contracts (radio recipe, popup kernel) — the component itself
  stays thin.
- Establishes the popup-selection skeleton the Combobox rebuild will need.

### Costs
- A second appearance control to keep in step with ThemeSwitch: shared `data-appearance`
  writes, shared `theme-change` event, one more kitchensink.
- The popup inherits the family's documented clipping limitation (ADR-0012).

### Risks to manage
- **Two live appearance controls on one page** (ThemeSwitch demo + ThemePicker demo)
  must not fight for `<html data-appearance>` — the same single-instance discipline
  ThemeSwitch's contract already enforces needs a cross-component answer in the
  kitchensink (likely: one live instance per page, inert copies elsewhere).
- The trigger-mirrors-preference rule will read as a bug to someone expecting the
  resolved icon; the contract must state the rationale, not just the rule.

### Non-goals
- Any fourth option or theme list beyond system/light/dark (the arity is ThemeSwitch's).
- A generic dropdown/menu component — the popup skeleton may inform Combobox, but this
  contract stays theme-shaped.
- Applying colours, persisting anything beyond ThemeSwitch's existing storage key, or
  any opinion on what `dark` looks like (ADR-0021, ADR-0025).

### Kernel dependencies
- `popup-position` — trigger-anchored placement, like the field pickers
- `popup-interaction` — focus containment, Escape, light dismiss (ADR-0007 semantics)

## Reconsider when

- Customizable `<select>` (`appearance: base-select`) reaches cross-browser baseline —
  alternative 2 then becomes the native answer and a new ADR should weigh deleting the
  custom popup.
- The Combobox rebuild starts — if its skeleton and ThemePicker's diverge, that is the
  moment to reconcile them, not before.

## References

- ADR-0013 (earning conditions), ADR-0020 (copied vs imported), ADR-0005 (progressive
  enhancement), ADR-0007 (light dismiss), ADR-0012 (popup clipping), ADR-0021
  (appearance is a color-scheme switch), ADR-0029 (test 16, commit-and-close)
- ThemeSwitch contract (`src/partials/components/ThemeSwitch/ThemeSwitch.md`) — the
  value model and radio recipe this component collapses
