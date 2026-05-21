# FileUpload

Custom accessible file upload component wrapping a hidden native `input[type=file]`.

## Usage

```html
<div class="FileUpload" data-component="FileUpload" role="group" aria-labelledby="cv-label">
  <span id="cv-label" class="FileUpload-label">CV</span>
  <input class="FileUpload-input" type="file" accept=".pdf,.docx" aria-hidden="true" tabindex="-1">
  <ul class="FileUpload-list" aria-live="polite" aria-relevant="additions removals" aria-label="Selected files"></ul>
  <button type="button" class="FileUpload-trigger">Add file</button>
</div>
```

```javascript
FileUpload.attach()
```

## Attributes

### On root element

| Attribute | Type | Description |
|---|---|---|
| `data-max-size` | `"5mb"` / `"500kb"` / bytes | Frontend max file size validation |
| `data-drop-zone` | boolean | Opt-in native drag-and-drop |
| `data-initial-files` | JSON string | Server-provided files (persistent state) |
| `data-label-trigger` | string | Trigger button text (default: "Add file") |
| `data-label-trigger-multiple` | string | Trigger text with `multiple` (default: "Add files") |
| `data-label-remove` | string | Remove button aria-label, `{name}` interpolated |
| `data-error-accept` | string | File type error message |
| `data-error-size` | string | File size error message |
| `data-label-drop-zone` | string | Visible drop zone text |

### State attributes (set by JS)

| Attribute | Set when |
|---|---|
| `data-has-files` | List is non-empty |
| `data-has-errors` | At least one file has a validation error |
| `data-dragging-over` | User is dragging over the drop zone |
| `data-initialized` | Component has been mounted |

### On native input

All native `input[type=file]` attributes are supported: `accept`, `multiple`, `required`, `disabled`.

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

## Accessibility notes

- The native input is `aria-hidden="true"` and `tabindex="-1"` — screen readers never reach it
- `role="group"` + `aria-labelledby` on root groups the component semantically
- `aria-live="polite"` on the list announces file additions and removals
- Per-file error spans use `role="alert"` for immediate error announcement
- Focus management: removing a file focuses the next remove button, or the trigger if the list is empty
- The component is keyboard-accessible: Tab → trigger → remove buttons, Enter/Space to activate

## Non-goals

- No image preview thumbnails
- No upload progress (submit-time upload is handled by the form, not this component)
- No custom file picker UI (system picker only)
- No `maxFiles` constraint (use `multiple` + `data-max-size`)
