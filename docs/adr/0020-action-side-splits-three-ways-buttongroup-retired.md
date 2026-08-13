# ADR 0020: The "action" side splits three ways — ButtonGroup is retired, navigation earns a contract

**Status:** Accepted
**Date:** 2026-08-13
**Decider:** Nicklas Bryntesson
**Supersedes in part:** ADR-0014 (its Toggle and ButtonGroup rulings; the selection-vs-action *test* stands)

## Context

ADR-0014 drew a line through a family of pill-shaped controls with one question — *does it
produce a value the form submits?* — and named three components on the strength of it: **Picklist**
(built, ADR-0014 flipped to Accepted), **Toggle** (segmented, animated) and **ButtonGroup**
(actions and navigation). Two remained unbuilt.

Before building them, three references were read against the taxonomy: Open Props UI's *toggle*
and *button-group* pages, and the Argyle picklists GUI challenge. Two findings put pressure on the
plan.

**Open Props UI's "Toggle" is not a switch and not an animated segmented control.** It is native
`<input type="radio|checkbox">` styled as buttons, grouped in a `div` with `role="radiogroup"` or
`role="group"` — the same semantic core Picklist already composes. Its multi-select example is
literally bold/italic with `name="text-style" value="bold"`, i.e. the very toolbar case ADR-0014
had assigned to ButtonGroup on the reasoning that a pressed formatting button is "a command mode,
not a form value". Both readings are defensible; which one applies depends on the *use*, not the
appearance.

**Open Props UI's "Button Group" carries no state at all.** Its page is four visual treatments —
text, outlined, tonal, filled — of three joined `<button>`s inside `role="group"`. No
`aria-pressed`, no `aria-current`, no roving. Across the whole library there is no `aria-pressed`
anywhere: state always lives in an `<input>`, action always in a `<button>`. An independent
library had converged on ADR-0014's discriminator without needing a third category.

That surfaced the question ADR-0014 never asked: *what is actually left for a ButtonGroup once the
line is applied correctly?*

## Decision

**The selection-vs-action test survives as a discriminator.** What does not survive is the
assumption that "action" is one category. It is three, with three different answers:

| | Bearer | Component |
|---|---|---|
| **Value** — one or many, persisted or submitted | `<fieldset>` + `<legend>` + native `<input>` | ChoiceGroup · ChoiceField · **Picklist** (built) |
| **Navigation** — which view you are on | `<nav>` + `<a href>` + `aria-current` | **NavGroup** (proposed below) |
| **Plain action** — do a thing, hold no state | `<button>` in a flex row | **none — this is layout** |

### 1. Never recreate native selection logic with buttons

A stateful pill row must use the native selection core. Native gives, for free, everything a
button-based group would have to rebuild in JavaScript:

| Native provides | With `<button>` you must build |
|---|---|
| mutual exclusion via a shared `name` | "unselect the others" logic |
| arrow-key roving inside a radio group | roving `tabindex` |
| state in the a11y tree (`checked`) | `aria-pressed`, kept in sync by hand |
| form participation and `:checked` in CSS | your own state → class → CSS hook |
| the disabled cascade via `<fieldset>` | per-button `disabled` |

This applies to the `aria-pressed` toolbar case too, which ADR-0014 had explicitly placed in
ButtonGroup. Rebuilding that machinery has no beneficiary: no user gains anything, and every line
of it can regress.

### 2. Toggle is not a component — it is Picklist's `data-segmented` axis

The only thing that would have distinguished Toggle from a Picklist was a **sliding** indicator
tracking the checked segment. Without JavaScript and without `:has()` (load-bearing behaviour may
not depend on it, ADR-0005) that needs one CSS rule per segment index, which caps how many
segments a group may have. For a decoration, on a control whose selection is already unambiguous,
that is not a trade worth making.

Picklist therefore gained two orthogonal axes instead: `data-orientation="horizontal|vertical"`
and `data-segmented="true"`. All four combinations are meaningful, and *segmented* is what people
mean by a toggle group. Recorded as a Picklist non-goal, not as a deferred component.

### 3. A plain action row is layout, not a component

What is left for ButtonGroup after (1) and (2) is genuinely stateless action clusters — a
Cut/Copy/Paste toolbar, a split button, Cancel/Save in a form footer. Those are a flex row with a
gap and joined borders. This library exists for controls that are **hard to get right**; a
`<button>` carries no contract-worthy difficulty, and neither does putting three of them in a row.

**ButtonGroup is retired.** Not deferred — retired, with reasons, so nobody re-derives it from
ADR-0014 and wonders why it never shipped. Consequently there is also no `Button` component, and
the unimported `src/css/site/03_Ui/Button.css` fossil was deleted (see ADR-0017/0018/0019 — it
violated all three).

### 4. A persisted preference is a value, even with no form

ADR-0014 phrased the test as "does it produce a value the form **submits**?" A live theme switch
stressed that wording: light/dark/system are three mutually exclusive values that persist and are
reflected back to the user, but there is no form and nothing is posted. Read literally, the test
would have pushed it towards `aria-pressed` buttons, which is plainly wrong.

The refinement: **the question is whether the control's meaning is a value or an act.** Form
submission is the most common *evidence* of a value, not its definition. A preference persisted to
`localStorage` is a value, and belongs to the selection family.

### 5. NavGroup — `Status: Proposed`

The one action-side case that survives, and it is not buttons. An `<a href>` cannot be a radio: it
navigates, it must honour middle-click and cmd-click, and its state is *which page you are on* —
owned by the URL and expressed as `aria-current`, not `checked`. It looks identical to a segmented
control and is a different thing, which is this ADR's recurring lesson: **appearance is never the
boundary.**

- **Scope:** a labelled set of sibling links with one current item; both of Picklist's axes
  (orientation, segmented) as a visual recipe **copied, not imported** — a consumer must be able to
  port one without the other (ADR-0004).
- **Non-goals it inherits:** no submitted value (for selection, see Picklist); no panels and no
  `role="tablist"` (tabs are out of family — ADR-0014 said so and this ADR keeps it); no roving
  tabindex, because links are ordinary tab stops.
- **Kernel dependencies:** none — self-contained.
- **Open at Proposed:** the final name (`NavGroup` vs `LinkGroup` vs a use-named option), and
  whether the items need a `<ul>` wrapper — an item count for screen readers, weighed against the
  extra markup and a `list-style` reset — judged against `docs/atomica11y/nav/`.

### 6. Attribute form and naming are codified, not just decided

Naming Picklist's second axis took five rounds, so the reasoning was written into
`.claude/philosophy.md` and ONBOARDING's naming table rather than left in an ADR alone:

- **Boolean when the axis is independent and stacks; enum when the values are mutually exclusive
  on one axis.** The orthogonality test decides. The failure runs both ways — splitting one axis
  into N booleans promises 2^N combinations of which few cohere, and bundling two independent axes
  into one enum makes them inexpressible together.
- **Name a `data-*` after what the thing is**, not the mechanism and not the category. And a design
  *value* is a token, never an attribute.

## Considered alternatives

1. **Build ButtonGroup as specified in ADR-0014** (`role="group"` + buttons, four visual
   treatments) — Rejected: after (1) and (2) almost nothing lands in it, and what does is a flex
   row. Shipping it would add a contract with no difficulty in it, and would invite authors to
   rebuild selection semantics in the wrong element.
2. **Build ButtonGroup only for the `role="toolbar"` + arrow-roving case** — Rejected, and this was
   the last argument standing. It is real a11y work, but it is *exactly* the machinery native gives
   free in a radio group. Open Props UI's own bold/italic example uses checkboxes, which is the
   better answer to the same problem.
3. **Build Toggle as its own component with a sliding indicator** — Rejected: one CSS rule per
   segment index (with a documented cap) or JavaScript, for a decoration. See §2.
4. **Keep Toggle deferred rather than retiring it** — Rejected: a standing promise that nobody
   intends to keep is worse than a recorded decision. It becomes folklore.
5. **Fold navigation into ButtonGroup** (ADR-0014's grouping) — Rejected: a link is not a button.
   The distinction is load-bearing for cmd-click, middle-click and `aria-current`, and burying it
   in a component named for actions guarantees someone will reach for a `<button>`.
6. **Three-way split with navigation as its own contract (chosen)** — each category is answered by
   the element that already means it, and the only new component is the one case native cannot
   express as a selection.

## Consequences

### Positive
- One promise fewer to keep and one component fewer to maintain, with the reasoning recorded so it
  is not re-derived.
- Picklist absorbed Toggle at the cost of two attributes and no new mechanism.
- The rule "never rebuild native selection logic in buttons" is a one-line litmus that catches the
  most common design-system footgun in this space.
- The value-vs-act refinement makes the test survive the no-form case instead of quietly failing.

### Costs
- ADR-0014 is now partly historical; a reader must follow the supersede pointer. Mitigated by the
  dated note on its status line.
- "No ButtonGroup" will surprise consumers who expect one. The `.md` non-goals in Picklist and
  NavGroup carry the redirect.

### Risks to manage
- **Someone builds a stateful pill row out of buttons anyway** because it looked like the reference
  screenshot. §1's table is the counter-argument, and it lives in philosophy.md.
- **NavGroup drifting into tabs** — the mutual non-goals must be written into both contracts when
  it is built.
- **Retirement read as inability.** Every statement of it should lead with *why*.

### Non-goals
- This ADR does not build NavGroup; it gives it a scope boundary at `Proposed`.
- It does not forbid `<button>` groups in a consuming project — it declines to *ship a contract*
  for them.
- It does not reopen tabs, which stay out of family pending their own ADR.

### Kernel dependencies
- None. Nothing here is promoted; NavGroup is expected to be self-contained.

## Reconsider when

- **A fourth pill-shaped control appears** that is neither a value, a navigation target, nor a
  plain action — then the three-way split needs another axis.
- **NavGroup is built** — flip it to Accepted, settle the name and the `<ul>` question, and confirm
  the mutual non-goals against its real a11y contract.
- **A stateless action row turns out to need real machinery** — e.g. a genuine toolbar where the
  controls cannot be inputs (links mixed with buttons, or overflow collapsing). That would be a new
  component with a different justification, not a revival of ButtonGroup.
- **The repo decides to own a theme** — a ThemeSwitch then becomes buildable on the segmented
  Picklist plus a preference resolver (OS signal ← user override). Today the `--ui-*` layer is
  deliberately theme-neutral (ADR-0018), so there is nothing to switch.

## References

- ADR-0014 (the taxonomy this supersedes in part), ADR-0013 (native selection family), ADR-0015
  (ChoiceField keyed on native `type`)
- ADR-0004 (clarity over DRY — why NavGroup copies rather than imports), ADR-0005 (`:has()` is
  progressive enhancement only — why the sliding indicator failed), ADR-0010 (motion policy, the
  governance Toggle would have inherited)
- ADR-0017 / ADR-0018 / ADR-0019 (the three conventions the deleted `Button.css` fossil violated)
- `src/partials/components/Picklist/Picklist.md` — the two axes and the sliding-indicator non-goal
- `.claude/philosophy.md`, `ONBOARDING.md` — the codified attribute-form and naming rules
- `docs/atomica11y/nav/`, `docs/atomica11y/form/button.md` — criteria NavGroup will be built against
- Open Props UI toggle + button-group; Argyle picklists GUI challenge — the references that
  dissolved the original plan
