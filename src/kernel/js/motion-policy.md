# motion-policy (kernel / pure logic)

Whether decorative motion in a region should run **right now**, given the environment and
the user's intent. The pure heart of the `MotionRegion` component (ADR-0010), extracted so
the governance is specified once and unit-tested exhaustively — never re-derived (and
drifted) per motion backend.

No DOM, no browser globals. The component reads the live signals from the platform and
projects the result onto the region root as `data-motion` (ADR-0002); each backend obeys
that attribute in its own idiom.

## The three tiers (why this isn't a flat blocker list)

Conflating these is the bug this design avoids — the source treated the autoplay opt-in as
just another blocker, so an explicit user play could never override it (its markup hid the
bug by always opting in):

1. **Autostart gate** (`data-autoplay`) — governs *only* whether motion may start on its
   own. Never a reason to stop motion the user started.
2. **Cost blockers** (reduced-motion, save-data, slow link) — hold back autostart, but an
   explicit user play overrides them: the user accepted the cost.
3. **Visibility** — universal. Off-screen always pauses (pure perf), for autostarted *and*
   user-started motion, and resumes on return. Deliberately not a cost blocker.

## Public API

```ts
evaluateMotionPolicy(signals: MotionSignals): MotionPolicy
resolveMotion(policy: MotionPolicy, intent: MotionIntent): 'running' | 'paused'

interface MotionSignals {
  autoplay: 'off' | 'policy'   // authored autostart opt-in (data-autoplay)
  reducedMotion: boolean       // prefers-reduced-motion: reduce
  visible: boolean             // region sufficiently in view (component owns the threshold)
  saveData: boolean            // navigator.connection.saveData
  effectiveType: string        // navigator.connection.effectiveType ('' if unavailable)
}

interface MotionPolicy {
  visible: boolean                                  // universal gate
  autoplayEnabled: boolean                          // data-autoplay === 'policy'
  costBlockers: { reducedMotion; saveData; slowConnection }
  anyCostBlocker: boolean
  autostart: boolean                                // opted in && no cost blocker && visible
}

interface MotionIntent {
  userPaused: boolean          // explicit pause — wins over everything
  userStarted: boolean         // explicit start, not since paused — overrides the cost blockers
}
```

## Semantics

- **`evaluateMotionPolicy`** reduces the raw signals to the tiers. A slow connection is
  `effectiveType` in `{ slow-2g, 2g }`; `autoplayEnabled` is `autoplay === 'policy'`;
  `autostart` is `autoplayEnabled && !anyCostBlocker && visible`.
- **`resolveMotion` precedence** (the single decision function — no second imperative path):
  1. `userPaused` → `paused` (always wins).
  2. `!visible` → `paused` (universal perf gate; pauses even user-started motion, resumes on return).
  3. `userStarted` → `running` (cost blockers *and* the autostart gate overridden — the user
     accepted the cost; an OS setting change does not revoke an active choice).
  4. `autostart` → `running` (opted in, no cost blocker; visibility already cleared at step 2).
  5. otherwise → `paused`.
- **Intent is owned by the component**, never recovered from a DOM event. (The source stashed
  intent before `.pause()` and read it back in the handler; ADR-0010 designs that away.)

## Conformance

Black-box unit tests: [`tests/motion-policy.unit.test.ts`](tests/motion-policy.unit.test.ts)
cover the tier reduction and every branch of `resolveMotion` — user-pause precedence, the
universal off-screen pause (even when user-started), an explicit start overriding the cost
blockers, and a user starting motion when `autoplay` is `off` (the case the old flat model
got wrong). Pure functions → no jsdom needed.

## Consumed by

`MotionRegion` (ADR-0010). The component's e2e suite proves the live browser signals reach
these functions and the DOM reflects the result (`data-motion`).
