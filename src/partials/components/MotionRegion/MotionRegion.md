# MotionRegion

A **decorative** region whose motion — a background video, a CSS/JS animation, an animated
`<figure>` beside text — is governed for accessibility and performance. MotionRegion decides
*whether that motion should run right now*, exposes an accessible pause control, and lets any
kind of animated content obey through a single attribute.

It is **not** a layout: it carries no opinion about content on top of it or beside it. It can
be a full-bleed hero with text overlaid, or a lone animated figure in a text-media section with
nothing over it. The motion is always **decorative** (`role="presentation"`) — never essential
content. That decorative nature is the precondition for everything below: it is *why* the motion
may be paused, killed by reduced-motion, and shipped without captions.

## The problem (read this first)

Decorative motion is great UX when it's welcome and cheap — and a liability the moment it isn't.
Teams re-solve the same five problems on every project and get subtle pieces wrong:

- **It ignores the user.** `prefers-reduced-motion: reduce` means "stop moving things at me," yet
  most background video/animation plays anyway (a WCAG 2.3.3 miss).
- **It has no off switch.** Anything that auto-plays for more than 5s needs a pause/stop control
  (WCAG **2.2.2**). Background videos routinely ship without one.
- **It burns battery and data** off-screen, on metered links, and when the OS is in Data Saver.
- **It tanks performance.** An eagerly-loaded hero video downloads megabytes before first paint —
  the fastest way to wreck a PageSpeed score on mobile.
- **It fights re-implementation.** Every one of these rules gets re-derived per component and drifts.

**MotionRegion solves it once.** Motion runs **only when it's welcome** — the author opted in, the
user hasn't asked for reduced motion, the region is on-screen, the connection isn't Data-Saver or
2g — and it **never fights an explicit user choice**. It ships the pause control for free. And it
costs **nothing** until it's allowed to run: a video keeps `preload="none"` behind a poster, so no
media bytes download until policy says play. Get "the Lord of the Rings in 4K" wrong and it's still
on you — but for a sane hero, this is how you keep 100 on PageSpeed on desktop *and* mobile.

The governance is one thing (the [`motion-policy`](../../../kernel/js/motion-policy.md) kernel
primitive); the media is interchangeable.

## The `data-motion` contract

The single seam. The component resolves policy + user intent to one value and projects it onto the
root (the `data-*`-as-public-API model — see [`.claude/philosophy.md`](../../../../.claude/philosophy.md)):

```html
<div class="MotionRegion" data-component="MotionRegion" data-motion="running">…</div>
```

`data-motion` is `"running"` or `"paused"`. Every backend obeys it in its own idiom — **that is what
makes one governance model cover all media**:

| Backend | How it obeys `data-motion` |
|---|---|
| **CSS animation** | `animation-play-state: paused` behind `[data-motion="paused"] …` — a gate, **zero JS** |
| **Video** (built-in adapter) | mapped to `play()` / `pause()` + the `preload` gate |
| **JS / `<canvas>`** | subscribe to the attribute; start/stop the rAF loop |

A CSS-animated backend is therefore *authored content that lives inside the region* — it is not part
of this component and never touches the kernel. That the simplest backend needs nothing from us but
one gated rule is the proof the seam sits at the right level.

## The policy model

`data-motion` is the resolution of the environment and the user's intent. The truth table and
precedence live in and are unit-tested by the kernel
([`motion-policy.md`](../../../kernel/js/motion-policy.md)); the component only gathers the live
signals and feeds them in. The signals fall into **three tiers** — conflating them is the bug this
design avoids (autoplay-`off` must mean "don't autostart", never "can't play"):

| Tier | Signal | Source | Effect |
|---|---|---|---|
| **Autostart gate** | autoplay opt-in | `data-autoplay` | governs *only* whether motion may start on its own |
| **Cost blockers** | reduced motion | `matchMedia('(prefers-reduced-motion: reduce)')` | hold back **autostart**, but an explicit user play overrides them |
| | Data Saver | `navigator.connection.saveData` | |
| | slow link | `navigator.connection.effectiveType` (`slow-2g`/`2g`) | |
| **Universal** | visibility | `IntersectionObserver` (threshold owned by the component) | off-screen **always** pauses (perf); resumes on return — even for user-started motion |

Precedence: an explicit **pause** always wins → off-screen always pauses → an explicit **start**
runs (overriding every cost blocker *and* the autostart gate — the user accepted the cost; an OS
setting change doesn't revoke an active choice) → otherwise motion autostarts only when opted in
with no cost blocker. There is deliberately **no** `"force"` mode that autostarts through
reduced-motion — that is an accessibility footgun (WCAG 2.3.3), and a non-goal.

## Accessibility

- **Decorative, always.** The region is `role="presentation"`; the animated media carries no
  alt/label and is never in the accessibility tree as content. If the media *is* meaningful, this is
  the wrong component.
- **Pause control (WCAG 2.2.2).** When motion can run, the component renders a real `<button>` toggle
  (accessible label swaps play/pause via `data-play-text` / `data-pause-text`, `aria-controls` points
  at the media, icon is `aria-hidden`). This is a requirement, not a nicety.
- **Reduced motion (WCAG 2.3.3).** Respected by default; the user opt-in override above is the only
  exception, and it re-evaluates on every reduced-motion change.
- **Progressive-enhancement floor.** With no JS, a `<noscript>` native-controls `<video>` renders — a
  fully accessible, user-controllable fallback. JS upgrades it to the policy-governed instance.

## Attributes (on root)

| Attribute | Type | Description |
|---|---|---|
| `data-component` | `"MotionRegion"` | Attach hook. |
| `data-autoplay` | `"off"` \| `"policy"` | Author opt-in, the autostart gate. `"policy"` (default) lets motion autostart when unblocked; `"off"` never autostarts — motion waits for the user, who can still play it. |
| `data-motion` | `"running"` \| `"paused"` | **Set by JS.** The resolved state; the CSS gate and e2e assertions key on it. Absent until the component initializes. |
| `data-play-text` / `data-pause-text` | string | Accessible labels for the toggle (default `"Play video"` / `"Pause video"`; override per media). |
| `data-initialized` | `"true"` | Set by JS once attached. |

## JS API

`MotionRegion` is the default export.

- `MotionRegion.attach(parent = document)` — mounts every `[data-component="MotionRegion"]` under
  `parent`. Idempotent (an instance guard skips already-mounted roots).
- `destroy()` (instance) — disconnects the observer, removes listeners and the injected control.

Intent is owned by the instance and never recovered from a DOM event — the native `pause` event
carries no "who paused" information, so the controller tracks it directly (ADR-0010).

## Kernel dependencies

| Kernel module | Kind | Used for |
|---|---|---|
| [`js/motion-policy`](../../../kernel/js/motion-policy.md) | JS (pure) | the five-signal blocker truth table + intent resolution → `running`/`paused` |

## Testability

Testability shaped the design: the governance is a **pure function**, so the hard combinatorial logic
is unit-tested and e2e only proves the wiring.

- **Unit (vitest):** the full blocker truth table + intent precedence — in the kernel, no browser.
- **E2E (Playwright + axe):** each browser signal reaches the kernel and the DOM reflects it —
  `reducedMotion` via `page.emulateMedia`, visibility via scroll, `navigator.connection` stubbed via
  `addInitScript`, autoplay-rejection via a stubbed `play()`. Assertions key on `data-motion`, never on
  internal state. The PageSpeed promise is asserted directly: `preload === 'none'` and **no request for
  the video source until motion is permitted**.

## Non-goals

- **Sound, captions/`<track>`, audio control** — audible media is a different, larger contract
  (WCAG 1.2.2 / 1.4.2 + a user-gesture constraint). A separate future component.
- **A full video player** — timeline scrubbing, volume, chapters. This governs *decorative* motion.
- **A floating/dismissible campaign player that grabs audio focus** — a composition on top of this.
- **Layout / content overlay / hero-vs-section placement** — the consuming page owns that; MotionRegion
  governs motion, not arrangement.
- Vanilla TS only; no framework code.

## Decision record

The *why* — scope, the three-tier architecture, the naming, and the testability model — lives in
[ADR-0010](../../../../docs/adr/0010-decorative-motion-region-and-motion-policy-kernel.md).
