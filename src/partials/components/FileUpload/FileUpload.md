# FileUpload

Custom accessible file upload component wrapping a hidden native `input[type=file]`.

## Contract

```html
<div
  class="FileUpload"
  data-component="FileUpload"
  role="group"
  aria-labelledby="LABEL_ID"
>
  <span id="LABEL_ID" class="label">Label text</span>
  <input
    class="input"
    type="file"
    aria-hidden="true"
    tabindex="-1"
  >
  <ul
    class="list"
    aria-live="polite"
    aria-relevant="additions removals"
    aria-label="Selected files"
  ></ul>
  <button type="button" class="trigger">Add file</button>
</div>
```

`LABEL_ID` must be unique on the page. The `aria-labelledby` value must match the `id` of the label element.

The file container has two forms, chosen by whether the native input has `multiple`:

- **multiple:** `<ul class="list" aria-live="polite" aria-relevant="additions removals" aria-label="Selected files">` — each file is an `<li class="item">` (shown empty above).
- **single:** `<div class="selected" aria-live="polite" aria-atomic="true">` — the file's spans and button render inline, with no `<li>` wrapper.

JS renders the entries — do not author them. In multiple mode each `<li>` carries `data-status` (`valid` / `invalid-type` / `invalid-size`), a `data-entry-id`, and `data-source="server"` for server-seeded files. In single mode the `.selected` container carries only `data-status` — no `data-entry-id` or `data-source` (the hidden `uploaded-ref` input is still emitted for server files):

```html
<li class="item" data-status="valid" data-entry-id="...">
  <span class="item-name">report.pdf</span>
  <span class="item-size">200 KB</span>
  <span class="item-error" role="alert">File type not allowed</span> <!-- only when data-status is an error -->
  <button type="button" class="item-remove" aria-label="Remove report.pdf">&#215;</button>
  <input type="hidden" name="uploaded-ref" value="..."> <!-- only when data-source="server" -->
</li>
```

## Usage

```html
<div class="FileUpload" data-component="FileUpload" role="group" aria-labelledby="cv-label">
  <span id="cv-label" class="label">CV</span>
  <input class="input" type="file" accept=".pdf,.docx" aria-hidden="true" tabindex="-1">
  <ul class="list" aria-live="polite" aria-relevant="additions removals" aria-label="Selected files"></ul>
  <button type="button" class="trigger">Add file</button>
</div>
```

```javascript
FileUpload.attach()
```

### JS API

- `FileUpload.attach(parent = document)` — mounts every `[data-component="FileUpload"]` under `parent`. Idempotent: a `__fileUploadInstance` guard on the element skips already-mounted instances, so it is safe to call again after dynamic injection.
- `destroy()` (instance method) — removes all event listeners and clears the instance guard.

## Attributes

### On root element

| Attribute | Type | Description |
|---|---|---|
| `data-max-size` | `"5mb"` / `"500kb"` / bytes | Frontend max file size validation |
| `data-drop-zone` | `"true"` | Opt-in native drag-and-drop |
| `data-label-drop-zone` | string | Visible drop-zone hint text (default: "Drop files here"). JS injects it as an `aria-hidden` `.drop-label` span — the trigger button remains the accessible action |
| `data-initial-files` | JSON string | Server-provided files (persistent state) |
| `data-label-trigger` | string | Trigger button text (default: "Add file") |
| `data-label-trigger-multiple` | string | Trigger text with `multiple` (default: "Add files") |
| `data-label-remove` | string | Remove button aria-label, `{name}` interpolated |
| `data-error-accept` | string | File type error message |
| `data-error-size` | string | File size error message |

### State attributes (set by JS)

All boolean state attributes carry the literal value `"true"` when on and are absent when off (see `.claude/philosophy.md`).

| Attribute | Set when |
|---|---|
| `data-has-files="true"` | List is non-empty |
| `data-has-errors="true"` | At least one file has a validation error |
| `data-dragging-over="true"` | User is dragging over the drop zone |
| `data-initialized="true"` | Component has been mounted |

### On native input

All native `input[type=file]` attributes are supported: `accept`, `multiple`, `required`, `disabled`.

### Disabled

JS does not derive a disabled state from the input's `disabled` attribute — author it explicitly, as the kitchensink states do: `data-disabled="true"` and `aria-disabled="true"` on the root (the CSS keys its disabled visuals off `[data-disabled="true"]`), plus `disabled` on both the native input and the trigger button.

## Persistent state (server-render multi-step forms)

When navigating back to a step in a server-rendered multi-step form, the server cannot repopulate `input.files` (browser security restriction). Instead, provide already-uploaded file metadata via `data-initial-files`:

```html
<div class="FileUpload"
     data-initial-files='[{"name":"cv.pdf","size":204800,"type":"application/pdf","ref":"server-id-123"}]'>
```

The component renders these as list items with `data-source="server"` and creates a hidden input per file:

```html
<input type="hidden" name="uploaded-ref" value="server-id-123">
```

The server reads these hidden fields to know which previously-uploaded files to retain.

## Validation

Invalid entries (`data-status="invalid-type"` / `"invalid-size"`) render in the list so the user can see and remove them, but they are never submitted: only user-selected entries with a `valid` status are written back to `input.files` (via `DataTransfer`), so invalid files are excluded from the form payload.

## Accessibility notes

- The native input is `aria-hidden="true"` and `tabindex="-1"` — screen readers never reach it
- `role="group"` + `aria-labelledby` on root groups the component semantically
- `aria-live="polite"` on the list announces file additions and removals
- Per-file error spans use `role="alert"` for immediate error announcement
- Focus management: removing a file focuses the next file's remove button (or the previous one when the last item was removed), falling back to the trigger when the list is empty; in single mode focus always returns to the trigger
- The component is keyboard-accessible: Tab → remove buttons → trigger (the file list precedes the trigger in DOM order), Enter/Space to activate

## Kernel dependencies

None. FileUpload composes no shared primitives from [`src/kernel/`](../../../kernel/README.md) and reads no `--SITE--*` tokens — its `--_fu-*` tokens are self-contained. Port the component folder on its own.

## Manual accessibility testing

Test with a real screenreader before shipping. Sources: `docs/atomica11y/form/button.md`, `docs/atomica11y/form/text-input.md`, `docs/atomica11y/form/hint-help-or-error.md`, `docs/atomica11y/form/alert-notification.md`.

### Desktop screenreader (NVDA, JAWS, VoiceOver)

**Component group**
- [ ] When tabbing into the component, the group label is announced (e.g. "CV, group")
- [ ] Purpose of the group is clear from the label alone

**Trigger button**
- [ ] Purpose is clear ("Add file" or localised equivalent)
- [ ] Identifies itself as a button
- [ ] When `multiple` is set, the label changes to "Add files" (or localised equivalent)
- [ ] When disabled, expresses its state

**File list — file added**
- [ ] When a file is selected, the filename is announced via the live region
- [ ] Focus does not transfer to the live region automatically

**File list — remove button**
- [ ] Each remove button announces the filename it will remove (e.g. "Remove cv.pdf, button")
- [ ] Pressing Space or Enter removes the file and announces the removal
- [ ] After removal, focus moves to the next file's remove button (the previous one when the last item was removed), or to the trigger if the list is empty

**Validation errors**
- [ ] When an invalid file is added, the error message is announced immediately (role="alert")
- [ ] The error is identified as an alert
- [ ] Focus does NOT transfer to the error automatically

### Mobile screenreader (VoiceOver iOS, TalkBack Android)

- [ ] Swipe to trigger — purpose is clear, identifies as button
- [ ] Double-tap opens the system file picker
- [ ] Swipe to file items — filename and remove button come into focus
- [ ] Double-tap on remove — file is removed, announcement is heard
- [ ] Error is announced automatically when an invalid file is added

## Non-goals

- No image preview thumbnails
- No upload progress (submit-time upload is handled by the form, not this component)
- No custom file picker UI (system picker only)
- No `maxFiles` constraint (use `multiple` + `data-max-size`)
