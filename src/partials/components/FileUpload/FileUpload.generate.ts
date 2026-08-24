import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const out = (file: string) => resolve(__dir, 'states', file)

// states/ is a gitignored build artifact, so wipe it before writing. Without
// this, renaming or removing a state leaves an orphan .hbs behind that still
// resolves as a partial — it silently keeps rendering the old markup.
rmSync(resolve(__dir, 'states'), { recursive: true, force: true })
mkdirSync(resolve(__dir, 'states'), { recursive: true })

type Attrs = Record<string, string>

interface StateDefinition {
  file: string
  label: string
  root: Attrs
  input: Attrs
  items: string
  isMultiple?: boolean
  triggerText?: string
  triggerDisabled?: boolean
  initialFiles?: string
}

// ─── Item HTML helpers — multiple mode (<li>) ─────────────────────────────────

const validItem = (name: string, size: string, id = 'static-1') =>
  `\n    <li class="item" data-status="valid" data-entry-id="${id}">
      <span class="item-name">${name}</span>
      <span class="item-size">${size}</span>
      <button type="button" class="item-remove" aria-label="Remove ${name}">&#215;</button>
    </li>`

const invalidTypeItem = (name: string, size: string) =>
  `\n    <li class="item" data-status="invalid-type" data-entry-id="static-2">
      <span class="item-name">${name}</span>
      <span class="item-size">${size}</span>
      <span class="item-error" role="alert">File type not allowed</span>
      <button type="button" class="item-remove" aria-label="Remove ${name}">&#215;</button>
    </li>`

const serverItem = (name: string, size: string, ref: string) =>
  `\n    <li class="item" data-status="valid" data-source="server" data-entry-id="static-server">
      <span class="item-name">${name}</span>
      <span class="item-size">${size}</span>
      <button type="button" class="item-remove" aria-label="Remove ${name}">&#215;</button>
      <input type="hidden" name="uploaded-ref" value="${ref}">
    </li>`

// ─── Item HTML helpers — single mode (inline spans in selected) ───

const validSingleFile = (name: string, size: string) =>
  `\n    <span class="item-name">${name}</span>
    <span class="item-size">${size}</span>
    <button type="button" class="item-remove" aria-label="Remove ${name}">&#215;</button>`

const invalidTypeSingleFile = (name: string, size: string) =>
  `\n    <span class="item-name">${name}</span>
    <span class="item-size">${size}</span>
    <span class="item-error" role="alert">File type not allowed</span>
    <button type="button" class="item-remove" aria-label="Remove ${name}">&#215;</button>`

const invalidSizeSingleFile = (name: string, size: string) =>
  `\n    <span class="item-name">${name}</span>
    <span class="item-size">${size}</span>
    <span class="item-error" role="alert">File exceeds maximum size</span>
    <button type="button" class="item-remove" aria-label="Remove ${name}">&#215;</button>`

// ─── Canonical markup ─────────────────────────────────────────────────────────

function canonical(
  id: string,
  label: string,
  rootAttrs: string,
  inputAttrs: string,
  items: string,
  initialFilesAttr: string,
  triggerText: string,
  triggerDisabled = false,
  isMultiple = false,
): string {
  const triggerDisabledAttr = triggerDisabled ? ' disabled' : ''
  const fileContainer = isMultiple
    ? `<ul
    class="list"
    aria-live="polite"
    aria-relevant="additions removals"
    aria-label="Selected files"
  >${items}
  </ul>`
    : `<div
    class="selected"
    aria-live="polite"
    aria-atomic="true"
  >${items}
  </div>`
  return `<div
  class="FileUpload"
  data-component="FileUpload"
  role="group"
  aria-labelledby="${id}-label"${rootAttrs}${initialFilesAttr}
>
  <span id="${id}-label" class="label">${label}</span>
  <input
    class="input"
    type="file"
    aria-hidden="true"
    tabindex="-1"${inputAttrs}
  >
  ${fileContainer}
  <button type="button" class="trigger"${triggerDisabledAttr}>${triggerText}</button>
</div>
`
}

// ─── Attribute serializer ─────────────────────────────────────────────────────

function attrs(obj: Attrs): string {
  return Object.entries(obj)
    .map(([k, v]) => (v === '' ? `\n    ${k}` : `\n    ${k}="${v}"`))
    .join('')
}

// ─── data-initial-files payloads ──────────────────────────────────────────────
// Sizes are chosen to render the same labels as the static markup via
// formatFileSize() (SI units: 200000 → "200 KB", 48000000 → "48 MB").

const seedReport = '[{"name":"report.pdf","size":200000,"type":"application/pdf"}]'
const seedInvalidType = '[{"name":"image.exe","size":14000,"type":"application/x-msdownload"}]'
const seedInvalidSize = '[{"name":"video.mp4","size":48000000,"type":"video/mp4"}]'
const seedMixed = '[{"name":"report.pdf","size":200000,"type":"application/pdf"},{"name":"image.exe","size":14000,"type":"application/x-msdownload"}]'
const seedServer = '[{"name":"contract.pdf","size":200000,"type":"application/pdf","ref":"abc123"}]'

// ─── State definitions ────────────────────────────────────────────────────────

const states: StateDefinition[] = [
  // Interaction states — empty
  { file: '_empty',        label: 'File', root: {},                              input: {}, items: '' },
  { file: '_empty-hover',  label: 'File', root: { 'data-test-state': 'hover'  }, input: {}, items: '' },
  { file: '_empty-focus',  label: 'File', root: { 'data-test-state': 'focus'  }, input: {}, items: '' },
  { file: '_empty-active', label: 'File', root: { 'data-test-state': 'active' }, input: {}, items: '' },

  // Interaction states — with files (single mode → selected).
  // Seeded via data-initial-files so the rendered chip is entry-backed and its
  // remove button works (static markup alone is display-only and not removable).
  { file: '_with-files',        label: 'File', root: { 'data-has-files': 'true'                            }, input: {}, items: validSingleFile('report.pdf', '200 KB'), initialFiles: seedReport },
  { file: '_with-files-hover',  label: 'File', root: { 'data-has-files': 'true', 'data-test-state': 'hover'  }, input: {}, items: validSingleFile('report.pdf', '200 KB'), initialFiles: seedReport },
  { file: '_with-files-focus',  label: 'File', root: { 'data-has-files': 'true', 'data-test-state': 'focus'  }, input: {}, items: validSingleFile('report.pdf', '200 KB'), initialFiles: seedReport },
  { file: '_with-files-active', label: 'File', root: { 'data-has-files': 'true', 'data-test-state': 'active' }, input: {}, items: validSingleFile('report.pdf', '200 KB'), initialFiles: seedReport },

  // Disabled (chip is entry-backed too, but pointer-events:none correctly blocks removal)
  { file: '_disabled-empty',      label: 'File', root: { 'data-disabled': 'true', 'aria-disabled': 'true'                     }, input: { disabled: '' }, items: '', triggerDisabled: true },
  { file: '_disabled-with-files', label: 'File', root: { 'data-disabled': 'true', 'aria-disabled': 'true', 'data-has-files': 'true' }, input: { disabled: '' }, items: validSingleFile('report.pdf', '200 KB'), triggerDisabled: true, initialFiles: seedReport },

  // Validation states (seeded files re-validate on bootstrap → correct status + removable)
  { file: '_invalid-type',   label: 'File', root: { 'data-has-files': 'true', 'data-has-errors': 'true' }, input: { accept: '.pdf' }, items: invalidTypeSingleFile('image.exe', '14 KB'), initialFiles: seedInvalidType },
  { file: '_invalid-size',   label: 'File', root: { 'data-has-files': 'true', 'data-has-errors': 'true', 'data-max-size': '5mb' }, input: {}, items: invalidSizeSingleFile('video.mp4', '48 MB'), initialFiles: seedInvalidSize },
  { file: '_invalid-mixed',  label: 'File', root: { 'data-has-files': 'true', 'data-has-errors': 'true' }, input: { accept: '.pdf', multiple: '' }, isMultiple: true, items: validItem('report.pdf', '200 KB', 'static-1') + invalidTypeItem('image.exe', '14 KB'), initialFiles: seedMixed },
  { file: '_required-empty', label: 'File', root: { 'data-required': 'true' }, input: { required: '' }, items: '' },

  // Variants
  { file: '_multiple',           label: 'Files', root: { 'data-has-files': 'true' }, input: { multiple: '' }, isMultiple: true, items: validItem('doc1.pdf', '200 KB', 'static-1') + validItem('doc2.pdf', '350 KB', 'static-2'), triggerText: 'Add files' },
  { file: '_drop-zone',          label: 'File',  root: { 'data-drop-zone': 'true' }, input: {}, items: '' },
  { file: '_drop-zone-dragging', label: 'File',  root: { 'data-drop-zone': 'true', 'data-dragging-over': 'true' }, input: {}, items: '' },
  { file: '_server-files',       label: 'CV',    root: { 'data-has-files': 'true' },
    input: { multiple: '' },
    isMultiple: true,
    items: serverItem('contract.pdf', '200 KB', 'abc123'),
    initialFiles: seedServer,
    triggerText: 'Add files',
  },

  // Live demo (e2e test target). Multiple mode exercises the richer list UI the
  // e2e suite asserts against (list semantics, sibling-focus, server data-source).
  { file: '_live', label: 'Upload files', root: {}, input: { multiple: '' }, isMultiple: true, items: '', triggerText: 'Add files' },
]

// ─── Generate ─────────────────────────────────────────────────────────────────

for (const state of states) {
  const id = `fu${state.file.replace(/_/g, '-')}`
  const initialFilesAttr = state.initialFiles
    ? `\n  data-initial-files='${state.initialFiles}'`
    : ''
  const content = canonical(
    id,
    state.label,
    attrs(state.root),
    attrs(state.input),
    state.items,
    initialFilesAttr,
    state.triggerText ?? 'Add file',
    state.triggerDisabled ?? false,
    state.isMultiple ?? false,
  )
  writeFileSync(out(`${state.file}.hbs`), content)
  console.log(`  ${state.file}.hbs`)
}

// Native reference
writeFileSync(
  out('_native-single.hbs'),
  `<label for="fu-native-single">File</label>\n<input type="file" id="fu-native-single" name="fu-native-single">\n`,
)
writeFileSync(
  out('_native-multiple.hbs'),
  `<label for="fu-native-multiple">Files</label>\n<input type="file" id="fu-native-multiple" name="fu-native-multiple" multiple>\n`,
)

console.log('  _native-single.hbs')
console.log('  _native-multiple.hbs')
console.log('done — 21 state files written')
