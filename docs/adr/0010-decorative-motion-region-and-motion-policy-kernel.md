# ADR 0010: A decorative motion region governed by a `motion-policy` kernel

**Status:** Proposed
**Date:** 2026-07-08
**Decider:** Nicklas Bryntesson

_Component idea (see [`docs/adr/README.md`](README.md)). Component name: **MotionRegion** — chosen over `MotionBackdrop`/`MotionBackground` (which lock the identity to a behind-content backdrop; the beside-text figure case has no overlay) and over `AmbientMotion` (teaches the contract but breaks the repo's ≤2-word cadence). `MotionRegion` reads as the thing you place; that it is decorative (`role="presentation"`, never a landmark) is stated up front in the component `.md`._

## Context

An Umbraco project (`Playgrounds/Umbraco/AiPoc`) has a "cover composition" hero whose
**video autoplay logic is genuinely refined**: it governs a muted background video by
five independent signals (reduced-motion, save-data, connection quality, viewport
visibility, an authored autoplay opt-in), never fights an explicit user action, ships an
accessible pause control, and downloads no video bytes until policy says play
(`preload="none"` + poster) — which is what earns it ~100 % on PageSpeed on desktop and
mobile. A `<noscript>` native-controls video is the progressive-enhancement floor.

The layout/composition (background + overlaying content, usable as hero or full-width
section) is *not* what's worth extracting. Two conversations sharpened what is:

1. The reusable core is **not a video state machine** — it is a media-agnostic answer to
   *"should the decorative motion in this region run right now, and can the user stop
   it?"*. Video is one backend; a CSS/JS-animated background (blobs, canvas) is another.
   The same governance must apply to all of them.
2. **Sound is out of scope.** Audible/campaign video pulls in captions (WCAG 1.2.2),
   audio control (1.4.2) and a user-gesture constraint (unmuted autoplay is impossible) —
   a different, larger contract. That is a separate future component, not a variant here.

## Decision

Build a **decorative motion region** (`MotionRegion`) backed by a pure
`motion-policy` kernel primitive, in three tiers with clean seams:

1. **Kernel `motion-policy` (pure, media-agnostic).** `evaluateMotionPolicy(signals) →
   policy` reduces the raw signals to **three tiers** — an *autostart gate*
   (`data-autoplay`), overridable *cost blockers* (reduced-motion, save-data, slow link),
   and *universal visibility* — and `resolveMotion(policy, intent) → 'running' | 'paused'`
   is the single decision function. Keeping the autostart gate out of the blocker bucket is
   what lets an explicit user play run even when `data-autoplay="off"` or a cost blocker is
   active (visibility still pauses off-screen). No DOM, no browser globals — unit-tested
   exhaustively.
2. **The component (thin).** Gathers the live browser signals (matchMedia,
   `navigator.connection`, IntersectionObserver), tracks user intent, calls the kernel,
   and **projects `data-motion="running" | "paused"` onto the region root**. Renders the
   accessible pause/play control (WCAG 2.2.2). Ships a **built-in video adapter** because
   video is the one backend that needs imperative driving (`play()`/`pause()` + the
   `preload` gate) — and it is the refined logic being extracted.
3. **Backends conform to the `data-motion` contract.** A CSS-animated backend obeys with
   **zero JS** — `animation-play-state: paused` behind `[data-motion="paused"]` (a gate,
   per ADR-0003). A JS/canvas backend subscribes to the attribute and starts/stops its
   loop. A CSS blob is *authored content that lives inside the region*, not part of this
   component and not coupled to the kernel — the clearest proof the abstraction sits at
   the right level.

`data-motion` on the root follows the `data-*`-as-public-API contract (ADR-0002); the
CSS gate and the e2e assertions both key on it.

## Considered alternatives

1. **A video-only component** — Rejected: throws away the generality the use case needs;
   a CSS-blob background would have to live *inside* it, which is the wrong level (the
   simplest backend should need nothing from us but one gated rule).
2. **Each backend its own component, each re-implementing the policy** — Rejected: the
   five-signal policy + intent logic is exactly the kind of correctness-critical behaviour
   that drifts when re-specified (ADR-0004). It belongs in the kernel, specified once.
3. **A policy kernel that also drives the media** — Rejected: the kernel can't call
   `.play()` on a CSS blob. Keeping the kernel pure (signal in, decision out) and letting
   each backend obey in its own idiom is what makes "same logic for all" literally true.
4. **Media-agnostic region + pure `motion-policy` kernel + conforming backends (chosen)** —
   Chosen: the refined video logic is preserved as the built-in adapter, the policy is
   specified once and unit-testable, and any future motion backend plugs in via one
   attribute.

## Consequences

### Positive
- The refined autoplay-policy + PageSpeed behaviour becomes a reusable, tested reference.
- One governance model covers image (static), video, and code-animated backgrounds.
- WCAG 2.2.2 (pause) and 2.3.3 (reduced motion) are satisfied for *every* animated backend.
- The pure kernel makes the hard combinatorial logic unit-testable (see Testability).

### Costs
- The code-animated backend is **new design**, not extracted — the Umbraco source is
  video-only. We extract the *principle* and generalize the backend contract.
- Two artefacts to keep honest: the pure kernel and the component that wires it.

### Risks to manage (cleanup targets from the source)
- **Dual source of truth.** In the source, `getNextState` is a facade — `POLICY_CHANGE`
  is a no-op and the real work happens as a side effect in `syncMediaPolicy`. The port
  must make `resolveMotion` the single decision function.
- **Enum vs flags redundancy.** The source drives behaviour from `userPaused`/
  `policyPaused` booleans, not the `state` enum. The port keeps intent as the input and
  *derives* `data-motion` — the enum's lifecycle bits (idle/ready/error) belong to the
  video adapter, not the policy core.
- **`pendingPauseDetail` hack.** The native `pause` event carries no intent, so the source
  stashes intent before calling `.pause()` and reads it back in the handler. The port
  should design this away (intent is owned by the controller, not recovered from the DOM
  event).

### Non-goals
- Sound, captions/`<track>`, audio control — a separate audible-media component.
- A full video player (timeline scrubbing, volume, chapters).
- A floating/dismissible campaign player that grabs audio focus — a composition on top.
- Layout / content-overlay / hero-vs-section — the consuming composition's job (the
  Umbraco `CoverComposition` wraps this; it is not extracted).

### Kernel dependencies
- `motion-policy` (new, introduced by this component) — the pure evaluator + resolver.

## Testability

Testability drove the kernel's API shape: the policy is a **pure function** so the hard
part is unit-tested and e2e only proves the wiring.

- **Unit (vitest, jsdom):** the tier reduction + `resolveMotion` precedence (explicit pause
  wins; off-screen always pauses even when user-started; an explicit start overrides every
  cost blocker and the autostart gate; autostart only when opted in and unblocked). Fast,
  exhaustive, no browser — mirrors the existing kernel conformance tests.
- **E2E (Playwright + axe):** a handful of integration tests proving each browser signal
  reaches the kernel and the DOM reflects it. Assertions key on `data-motion` (ADR-0002),
  never on internal state.

Signal control in Playwright:

| Signal | How it's driven in e2e |
|---|---|
| reduced-motion | `page.emulateMedia({ reducedMotion })` — flippable mid-test; baseline `no-preference` in config |
| visibility (IntersectionObserver) | scroll the region out of / into view (real IO fires) |
| save-data / effectiveType | no native API — `page.addInitScript` defines `navigator.connection` as an `EventTarget` with mutable props; dispatch `change` to test transitions |
| autoplay rejection (`blocked`) | muted autoplay is always allowed → stub `HTMLMediaElement.prototype.play` to reject, to exercise the catch branch |

The PageSpeed promise is itself e2e-testable: assert `video.preload === 'none'` and that
**no request for the video source fires while blocked**, then a request after play is
permitted (`page.on('request')` / `waitForRequest`). axe covers the pause control.

## Reconsider when

- A second motion component (autoplay carousel, Lottie, marquee) needs the policy — that
  confirms the kernel boundary; fold shared signal-gathering into the kernel then.
- Audible/campaign media becomes a real requirement → a separate ADR + component, not a
  variant here.
- A future backend (Lottie, `<canvas>` beyond the demo) needs a signal the `data-motion` attribute can't carry.

## References

- Source: `Playgrounds/Umbraco/AiPoc/ClientApp/js/utils/CoverCompositionVideo.ts`,
  `Views/Shared/Partials/_CoverComposition.cshtml`,
  `ClientApp/css/04_ui/CoverComposition.css`, `ClientApp/types/global.d.ts`
- ADR-0002 (`data-motion` as public API), ADR-0003 (the CSS `animation-play-state` gate),
  ADR-0004 (why the policy is a kernel primitive), ADR-0009 (the PE/`<noscript>` floor)
- WCAG 2.2.2 Pause Stop Hide, 2.3.3 Animation from Interactions, 1.2.2 / 1.4.2 (why sound is out)
- `src/kernel/js/motion-policy.md` — the primitive's contract
