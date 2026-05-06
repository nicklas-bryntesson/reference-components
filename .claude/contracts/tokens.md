🎯 Design System Manifest
Core Philosophy
Deterministic over clever
Explicit over inherited
Closed branches over cascading fallbacks
No silent overrides
Inspector should show exactly one active rule
We sacrifice DRY for clarity
Tokens are contracts, not conveniences
1️⃣ Layers (Non‑Negotiable Structure)
There are only four layers:

RAW (constants)
SEMANTIC (roles & meaning)
TONE (contextual mapping)
COMPONENT (final resolution)

No skipping layers.
No cross-layer references.
No component referencing RAW directly.

🔹 Layer 1 — RAW / CONST
Purpose: Immutable design primitives.

Examples:

--COLOR-N00
--FIRA-SANS
--GRID-COLUMNS-BASE
--FONTSIZE-H1-DESKTOP
Rules:

Never referenced by components.
Only referenced by semantic layer.
May only change during rebrand.
Numeric scales allowed here.
Hue-based names allowed here.
This is the physics engine.

🔹 Layer 2 — SEMANTIC
Purpose: Meaning without context.

This layer answers:

What does this color/type mean?

Not:
What hue?
What context?

Examples:

--color-neutral-background
--color-neutral-foreground
--color-brand-primary
--color-feedback-error

Typography:

--type-heading-lineHeight
--type-body-size-md
--type-action-weight

Rules:

No component names.
No hue names.
No numeric scale names (0–100).
No mode logic.
No theme logic.
No context logic.
Only meaning.
This is the vocabulary layer.

🔹 Layer 3 — TONE (Context Axis)
Purpose: Contextual intensity mapping.

Tone maps semantic roles into contextual slots.

Examples:

--tone-surface-primary
--tone-text-primary
--tone-text-secondary
--tone-border-primary
--tone-interactive-primary
--tone-interactive-secondary

Rules:

Slot vocabulary is fixed.
Level vocabulary is fixed.
Tone does not reference RAW.
Tone references SEMANTIC.
Themes override tone.
Tone is donut-scoped.
Tone is absolute (not relative mixing).
This is the environment layer.

🔹 Layer 4 — COMPONENT
Purpose: Final deterministic resolver.

Component tokens are derived from tone.

Examples:

--button-primary-backgroundColor
--button-primary-color
--input-borderColor

Rules:

Components never reference RAW.
Components never reference semantic directly (unless typography).
Components derive from tone.
Components do not override tone.
Component variants map to tone slots.
Component does not define color authority.
This is the implementation layer.

2️⃣ Axes (Orthogonal Only)
Each axis must answer one question.

🧭 Global Axis
data-appearance = light | dark | high-contrast

Defines tone mapping.
May override tone.
Does not override semantic.
Does not override components.

🎨 Tone Axis
data-tone = neutral | subtle | strong | inverse

Defines contextual tone.
May override tone tokens.
Does not override components directly.
Does not redefine RAW.

🧱 Elevation Axis
elevation = sm | md | lg

Defines physical depth.
May affect shadow.
Must not affect tone.
Separate axis.

🔘 Interaction Axis
variant = primary | secondary | ghost

Maps to tone-interactive slots.
Never defines raw color.
Never defines hue.

📏 Scale Axis
size = sm | md | lg | 1–6

Maps to type layer.
Never maps to tone.
Never maps to color.

📐 Layout Axis
Grid, spacing, container.
Never affects tone.
Never affects type.

3️⃣ Naming Rules
✅ Property references use PascalCase:

--surface-backgroundColor
--button-primary-borderColor
--tone-text-primary

❌ No PascalCase for semantic words:

--tone-actionContrast
--tone-actionPrimary

Slot words must be semantic, not CSS properties.

✅ Grammar Pattern
--{domain}-{slot}-{level}

Examples:

--tone-surface-primary
--tone-text-secondary
--tone-border-primary
--tone-interactive-primary

Component grammar:

--button-primary-backgroundColor
--input-borderColor

RAW grammar:

--COLOR-N00
--FONTSIZE-H1-DESKTOP

4️⃣ Determinism Rules
No nested var() chains longer than one level.
No multi-layer fallback chains inside components.
Tone overrides are scoped, not chained.
If you inspect a component, you should see:
Component token
Tone token
Semantic token
RAW value
Never see 4-level fallback resolution chains.
5️⃣ Cascade Usage Rules
We use cascade intentionally:

✅ For donut-scoped tone overrides
✅ For appearance overrides
✅ For semantic remapping

We do NOT use cascade:

❌ As conflict resolution
❌ To win specificity wars
❌ To override component rules downstream

6️⃣ Component Examples
Heading
Axes:

variant: heading | display | body
size: 1–6 / sm | md | lg
wrap: pretty | stable | balance
align: left | center | right
tone: inherited only
Heading consumes:

--tone-text-primary

It does not define color.

Button
Axes:

variant: primary | secondary | ghost
size: sm | md | lg
icon-position: left | right
tone: inherited only
Button maps:

primary → --tone-interactive-primary
secondary → --tone-interactive-primary (border + text only)

Button does not own tone.

7️⃣ Tradeoffs We Accept
More layers
More tokens
Slight duplication
Slight verbosity
In exchange for:

Deterministic resolution
Zero override guessing
Inspector clarity
Scalability across projects
Extensibility without drift
If you'd like, next we can formalize a similar manifest specifically for the Tone layer vocabulary (allowed slots + allowed levels) so that never drifts either.


Fråga

Förklara






there must be a way that you can output the code, so that it can be pasted in md WITH code blocks intact???


Assistent (GPT-5.2)
Yes ✅ — the safe way to paste Markdown with code blocks intact (especially into systems that auto-parse backticks) is to use indented code blocks instead of triple backticks.

In Markdown, any block indented with 4 spaces is treated as code.

That avoids breaking your document parser.

Below is your manifest formatted in paste-safe Markdown using indented code blocks.

🎯 Design System Manifest
Core Philosophy
Deterministic over clever
Explicit over inherited
Closed branches over cascading fallbacks
No silent overrides
Inspector should show exactly one active rule
We sacrifice DRY for clarity
Tokens are contracts, not conveniences
1️⃣ Layers (Non‑Negotiable Structure)
There are only four layers:

RAW (constants)
SEMANTIC (roles & meaning)
TONE (contextual mapping)
COMPONENT (final resolution)
No skipping layers.
No cross-layer references.
No component referencing RAW directly.

🔹 Layer 1 — RAW / CONST
Purpose: Immutable design primitives.

Examples:

--COLOR-N00
--FIRA-SANS
--GRID-COLUMNS-BASE
--FONTSIZE-H1-DESKTOP
Rules:

Never referenced by components
Only referenced by semantic layer
May only change during rebrand
Numeric scales allowed here
Hue-based names allowed here
This is the physics engine.

🔹 Layer 2 — SEMANTIC
Purpose: Meaning without context.

Examples:

--color-neutral-background
--color-neutral-foreground
--color-brand-primary
--color-feedback-error
Typography:

--type-heading-lineHeight
--type-body-size-md
--type-action-weight
Rules:

No component names
No hue names
No numeric scale names (0–100)
No mode logic
No theme logic
No context logic
Only meaning
This is the vocabulary layer.

🔹 Layer 3 — TONE (Context Axis)
Purpose: Contextual intensity mapping.

Examples:

--tone-surface-primary
--tone-text-primary
--tone-text-secondary
--tone-border-primary
--tone-interactive-primary
--tone-interactive-secondary
Rules:

Slot vocabulary is fixed
Level vocabulary is fixed
Tone does not reference RAW
Tone references SEMANTIC
Themes override tone
Tone is donut-scoped
Tone is absolute (not relative mixing)
This is the environment layer.

🔹 Layer 4 — COMPONENT
Purpose: Final deterministic resolver.

Examples:

--button-primary-backgroundColor
--button-primary-color
--input-borderColor
Rules:

Components never reference RAW
Components never reference semantic directly (unless typography)
Components derive from tone
Components do not override tone
Component variants map to tone slots
Component does not define color authority
This is the implementation layer.

2️⃣ Axes (Orthogonal Only)
Each axis must answer one question.

🧭 Global Axis
data-appearance = light | dark | high-contrast
Defines tone mapping.
May override tone.
Does not override semantic.
Does not override components.

🎨 Tone Axis
data-tone = neutral | subtle | strong | inverse
Defines contextual tone.
May override tone tokens.
Does not override components directly.
Does not redefine RAW.

🧱 Elevation Axis
elevation = sm | md | lg
Defines physical depth.
May affect shadow.
Must not affect tone.
Separate axis.

🔘 Interaction Axis
variant = primary | secondary | ghost
Maps to tone-interactive slots.
Never defines raw color.
Never defines hue.

📏 Scale Axis
size = sm | md | lg | 1–6
Maps to type layer.
Never maps to tone.
Never maps to color.

📐 Layout Axis
Grid, spacing, container.
Never affects tone.
Never affects type.

3️⃣ Naming Rules
✅ Property references use PascalCase:

--surface-backgroundColor
--button-primary-borderColor
--tone-text-primary
❌ No PascalCase for semantic words:

--tone-actionContrast
--tone-actionPrimary
Slot words must be semantic, not CSS properties.

✅ Grammar Pattern
--{domain}-{slot}-{level}
Examples:

--tone-surface-primary
--tone-text-secondary
--tone-border-primary
--tone-interactive-primary
Component grammar:

--button-primary-backgroundColor
--input-borderColor
RAW grammar:

--COLOR-N00
--FONTSIZE-H1-DESKTOP
4️⃣ Determinism Rules
No nested var() chains longer than one level
No multi-layer fallback chains inside components
Tone overrides are scoped, not chained
Inspector should reveal resolution in this order:
component → tone → semantic → raw
Never allow 4-level fallback chains in production CSS
5️⃣ Cascade Usage Rules
We use cascade intentionally:

✅ For donut-scoped tone overrides
✅ For appearance overrides
✅ For semantic remapping

We do NOT use cascade:

❌ As conflict resolution
❌ To win specificity wars
❌ To override component rules downstream

6️⃣ Component Examples
Heading
Axes:

variant: heading | display | body
size: 1–6 / sm | md | lg
wrap: pretty | stable | balance
align: left | center | right
tone: inherited only
Heading consumes:

--tone-text-primary
It does not define color.

Button
Axes:

variant: primary | secondary | ghost
size: sm | md | lg
icon-position: left | right
tone: inherited only
Button maps:

primary → --tone-interactive-primary
secondary → --tone-interactive-primary (border + text only)
Button does not own tone.

7️⃣ Tradeoffs We Accept
More layers
More tokens
Slight duplication
Slight verbosity
In exchange for:

Deterministic resolution
Zero override guessing
Inspector clarity
Scalability across projects
Extensibility without drift