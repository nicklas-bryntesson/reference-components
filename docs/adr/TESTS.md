# The decision tests

Every ADR here records a decision. Many of them also establish a **test** — a question you ask to
reach the same kind of decision again. Those tests were spread across twenty-five documents, and
this file collects them.

It is an index, not a second source. The ADR is authoritative; if this file and an ADR disagree, the
ADR wins and this file is wrong.

**Why it exists.** While building the range family, the "does this earn its own component?" question
was re-derived from scratch and answered with a worse rule — *"does it own a box and axes?"* — while
the canonical three-condition version sat in ADR-0014 the whole time. The re-derived version omitted
the mental-model condition, which is the very thing that separates Picklist from a ButtonGroup. The
tests are useless if they cannot be found.

**When an ADR introduces a new test, add it here in the same pass.** An ADR alone does not stop
drift; that rule already applies to `philosophy.md` and `CLAUDE.md`, and it applies here.

---

## 1 · Does a variation earn its own component?

**Any one of three conditions suffices** (ADR-0013, third added by ADR-0014):

1. the item's **content model** changes, or
2. **motion or interaction is itself the designed thing**, or
3. it forms a **distinct visual family bound to a distinct usage context** — a separate mental model
   the user holds ("pick chips" vs "toggle a setting" vs "trigger actions") — *even when the item and
   the interaction are otherwise unchanged*.

Everything else is a `data-variant` skin.

> **Worked:** Picklist and a ButtonGroup can be visually identical, so appearance cannot separate
> them; condition 3 does. **Notice** and a future **Card** qualify under 3 as well, despite having no
> behaviour at all. A **value bubble** fails all three — same element, same interaction, same mental
> model, only a different position — so it is a recipe (`RangeScale.md`).

## 2 · Does shared behaviour earn a place in `src/kernel/`?

**A second consumer.** That is the whole bar (ADR-0004, restated in ADR-0013).

One component needing something is not reuse; it is that component's code. The kernel is the single
deliberate exception to clarity-over-DRY, and it stays narrow by making the bar countable.

> **Worked:** `popup-position` is imported by six components (DateField, DateTimeField, MonthField,
> TimeField, WeekField, ToggleTip) and `popup-interaction` by five — the bar cleared many times over.
> A `range-scale` primitive was *not* created for the range family, because only RangeScale needs the
> maths; the ADR records it as a candidate if a third component ever wants the same value↔position
> conversion.

## 3 · Is it selection or action?

**Does it produce a value the form submits?** (ADR-0014; the test survives ADR-0020 even though two
of that ADR's components did not.)

Value → `<fieldset>` + `<legend>` + native `<input>`. Navigation → `<nav>` + `<a href>` +
`aria-current`. Plain action holding no state → `<button>` in a flex row, which is **layout, not a
component**.

## 4 · Does the category survive its own discriminator?

Apply the test, then ask **what is actually left** (ADR-0020).

ADR-0014 named three components on the strength of the selection-vs-action line. Applying that line
correctly left ButtonGroup with nothing: no value, no state, no ARIA — just buttons in a row. The
category was retired rather than built.

> Use this whenever a taxonomy feels satisfying. A category that survives naming but not application
> is a label, not a component.

## 5 · Boolean or enum?

**Does the axis stack, or do the values exclude each other?** (`philosophy.md`, from ADR-0014/0020.)

- **Boolean** when the axis is independent and stacks — `data-invalid`, `data-icon`, `data-segmented`.
  Notice is the proof: three independent toggles, all eight combinations meaningful.
- **Enum** when the values are mutually exclusive positions on **one** axis — `data-legend`,
  `data-orientation`, `data-variant`.

The failure runs both ways. Splitting one axis into N booleans promises 2^N combinations of which two
are coherent; bundling two independent axes into one enum makes both inexpressible.

> **Worked:** a segmented Picklist was nearly shipped as `data-joined` + `data-wrap` + `data-equal`
> — eight combinations, two meaningful — when wrap and equal-width are simply *derived* from being
> segmented.

## 6 · Is a possible combination forbidden anyway?

Sometimes a combination is coherent and still wrong, because **another component already owns that
cell**. This is not the "no impossible states" rule; the state is possible.

> **Worked:** a `Heading` with `element="p"` and `variant="body"` renders exactly what `Prose`
> renders. Forbidding it keeps one path to each result. `element="p"` with `variant="heading"` stays
> legal, because `Prose` cannot do that.

Not yet an ADR — recorded here from the Heading discussion, and from the per-project
`ForbiddenCombinations` list in the consuming project's own Card helper.

## 7 · Is a selector load-bearing?

**If removing the feature breaks behaviour, it is load-bearing, and load-bearing selectors do not get
to depend on feature detection** (ADR-0005).

A load-bearing DOM fact is made explicit as a `data-*` attribute and CSS gates on that — never on
`:has()`. `:has()` is progressive enhancement only.

> **Worked:** in a two-field lane the inputs must give up the pointer or the lower thumb is
> unreachable. That rule is load-bearing, so the lane carries an authored `data-fields="2"` rather
> than a `:has(.RangeField ~ .RangeField)` reading of the DOM.

## 8 · Does the contract specify the end state or the mechanism?

**Specify the finished DOM, not where it is computed** (ADR-0009).

The reference JS gap-fills and never overwrites: a server that already rendered the end state must be
able to ship JS-free. The e2e suite therefore asserts the end state, not the mechanism.

> **Worked:** `--_rs-p` is server-rendered for a correct first paint, and the class keeps it live.
> Both paths satisfy one contract and one suite.

## 9 · Copied or imported?

**A consumer must be able to port one component without the other** (ADR-0020, from ADR-0004).

Shared *visuals* are a recipe that is copied. Shared *behaviour* passes test 2 and becomes a kernel
module that is imported. Picklist copies ChoiceGroup's legend recipe rather than importing its CSS.

## 10 · Which element, before any styling?

**Does the same distance along the track mean the same thing everywhere?** (ADR-0022.)

If there is no unit to answer in, there is no scale — only ordered options, which are radios, or a
`<select>` when the list is long. A measurement that is read but not set is `<meter>`, never a
disabled range.

Two symptoms that the element is wrong: the control needs a "no answer yet" state but the element
always carries a value; and the word list is written twice, once in markup and once in CSS or JS.

## 11 · Semantics or behaviour?

**The element test settles semantics. It does not settle the interaction model** (ADR-0024).

Dragging, clicking anywhere on a lane and sweeping on touch are one continuous pointer gesture over a
shared surface; N discrete targets offer none of them. So a control can legitimately want slider
behaviour over an ordered set, and radios are the right *default* rather than the only answer.

## 12 · Mechanics or taste?

**Does the value follow from a mechanism or a criterion, or is it taste?** (ADR-0025.)

The operational form: **remove the declaration.** If something measurably breaks, it is mechanics and
ours. If it only looks worse, it is taste and the consumer's.

> **Worked:** `tabular-nums` on a value that changes in place is mechanics — without it the digits
> jump. `letter-spacing: 0.05em` on a legend is taste, and was deleted.

## 13 · Private or public variable?

**All component-local custom properties are private and prefixed `--_<prefix>-*`, including those
set by JS.** The public surface is the `--ui-*` seam plus `data-*` attributes (ADR-0017, ADR-0018).

One rule, no two-tier split inside a component. Reconsider only when a component genuinely needs a
documented reach-in variable distinct from a token.

---

## 14 · Is this name identity or decoration?

**If a test, a `querySelector`, or another component needs to *find* it, it is identity → `data-part`.
If only a stylesheet needs it, it is decoration → a class, and the consuming project may delete it**
(ADR-0026).

A lowercase element class cannot be both, because the two jobs have opposite lifetimes: identity must
survive a restyle, decoration is meant not to. Keeping them in one string is what makes ADR-0019's
swap map nearly-true instead of true.

> **Worked:** `.popup` is identity — 118 occurrences in the suite depend on finding it — so it becomes
> `[data-part="popup"]`. The rounded corner on it is decoration and stays in a class the consumer may
> throw away. Part identity was already an attribute in 31 selectors (`data-panel`, `data-picker`,
> `data-segment`) before this decision; ADR-0019's own worked example mixes both mechanisms in a
> single rule.

---

## 15 · Which tier does an accessibility assertion belong to?

**If it can be read from the accessibility tree, it belongs in e2e+axe. If it is about what is
*spoken* — announcement on change, silence, repetition — it belongs in the spoken suite
(`test:vo`). If it needs human judgment — is this noise, does the order make sense, mobile — it
stays on the manual checklist** (ADR-0027).

The failure mode this guards: a correct-looking tree that speaks wrongly. Both 2026-08-25 speech
defects (RangeField's frozen `aria-valuetext`, MotionRegion's silent label swap) passed every tree
check; and conversely, listening for what the tree already proves wastes the scarce manual pass.

> **Worked:** "the trigger has `aria-haspopup="dialog"`" → tree, e2e. "arrowing announces the new
> value once" → spoken. "is announcing the placeholder as 'dd' confusing?" → human.

## Conventions you do not need to re-decide

Not tests — settled rules, listed so they are not re-litigated:

| | |
|---|---|
| `data-*` attributes are the component's public API | ADR-0002 |
| Bounded CSS: gate selectors over the mobile-first cascade | ADR-0003 |
| Boolean state carries the explicit literal `"true"` | `philosophy.md` |
| Class naming: PascalCase = component; part identity is `data-part` | ADR-0019, ADR-0026 |
| Demos default to English | ADR-0011 |
| Custom controls fall back to native on coarse pointers | ADR-0006 |
| Popover light-dismiss never refocuses the trigger | ADR-0007 |
| Popover clipping in overflow ancestors is a documented limitation | ADR-0012 |
| Appearance is a `color-scheme` switch, not a token system | ADR-0021 |
| Typography is the consuming project's; we own the mechanics | ADR-0025 |
| ADR references never appear in consumer docs — only in `docs/adr/`, `philosophy.md`, `CLAUDE.md` | convention |
