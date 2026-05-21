import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const out = (file: string) => resolve(__dir, 'states', file)

mkdirSync(resolve(__dir, 'states'), { recursive: true })

type Attrs = Record<string, string>

interface StateDefinition {
  file: string
  label: string
  root: Attrs
  input: Attrs
  items: string
  triggerText?: string   // defaults to 'Add file'
  initialFiles?: string
}

// ─── Item HTML helpers ────────────────────────────────────────────────────────

const validItem = (name: string, size: string) =>
  `\n    <li class="FileUpload-item" data-status="valid" data-entry-id="static-1">
      <span class="FileUpload-item-name">${name}</span>
      <span class="FileUpload-item-size">${size}</span>
      <button type="button" class="FileUpload-item-remove" aria-label="Remove ${name}">&#215;</button>
    </li>`

const invalidTypeItem = (name: string, size: string) =>
  `\n    <li class="FileUpload-item" data-status="invalid-type" data-entry-id="static-2">
      <span class="FileUpload-item-name">${name}</span>
      <span class="FileUpload-item-size">${size}</span>
      <span class="FileUpload-item-error" role="alert">File type not allowed</span>
      <button type="button" class="FileUpload-item-remove" aria-label="Remove ${name}">&#215;</button>
    </li>`

const invalidSizeItem = (name: string, size: string) =>
  `\n    <li class="FileUpload-item" data-status="invalid-size" data-entry-id="static-3">
      <span class="FileUpload-item-name">${name}</span>
      <span class="FileUpload-item-size">${size}</span>
      <span class="FileUpload-item-error" role="alert">File exceeds maximum size</span>
      <button type="button" class="FileUpload-item-remove" aria-label="Remove ${name}">&#215;</button>
    </li>`

const serverItem = (name: string, size: string, ref: string) =>
  `\n    <li class="FileUpload-item" data-status="valid" data-source="server" data-entry-id="static-s1">
      <span class="FileUpload-item-name">${name}</span>
      <span class="FileUpload-item-size">${size}</span>
      <button type="button" class="FileUpload-item-remove" aria-label="Remove ${name}">&#215;</button>
      <input type="hidden" name="uploaded-ref" value="${ref}">
    </li>`

// ─── Canonical markup ─────────────────────────────────────────────────────────

function canonical(
  id: string,
  label: string,
  rootAttrs: string,
  inputAttrs: string,
  items: string,
  initialFilesAttr: string,
  triggerText: string,
): string {
  return `<div
  class="FileUpload"
  data-component="FileUpload"
  role="group"
  aria-labelledby="${id}-label"${rootAttrs}${initialFilesAttr}
>
  <span id="${id}-label" class="FileUpload-label">${label}</span>
  <input
    class="FileUpload-input"
    type="file"
    aria-hidden="true"
    tabindex="-1"${inputAttrs}
  >
  <ul
    class="FileUpload-list"
    aria-live="polite"
    aria-relevant="additions removals"
    aria-label="Selected files"
  >${items}
  </ul>
  <button type="button" class="FileUpload-trigger">${triggerText}</button>
</div>
`
}

// ─── Attribute serializer ─────────────────────────────────────────────────────

function attrs(obj: Attrs): string {
  return Object.entries(obj)
    .map(([k, v]) => (v === '' ? `\n  ${k}` : `\n  ${k}="${v}"`))
    .join('')
}

// ─── State definitions ────────────────────────────────────────────────────────

const states: StateDefinition[] = [
  // Interaction states — empty
  { file: '_empty',        label: 'File', root: {},                              input: {}, items: '' },
  { file: '_empty-hover',  label: 'File', root: { 'data-test-state': 'hover'  }, input: {}, items: '' },
  { file: '_empty-focus',  label: 'File', root: { 'data-test-state': 'focus'  }, input: {}, items: '' },
  { file: '_empty-active', label: 'File', root: { 'data-test-state': 'active' }, input: {}, items: '' },

  // Interaction states — with files
  { file: '_with-files',        label: 'File', root: { 'data-has-files': ''                            }, input: {}, items: validItem('report.pdf', '200 KB') },
  { file: '_with-files-hover',  label: 'File', root: { 'data-has-files': '', 'data-test-state': 'hover'  }, input: {}, items: validItem('report.pdf', '200 KB') },
  { file: '_with-files-focus',  label: 'File', root: { 'data-has-files': '', 'data-test-state': 'focus'  }, input: {}, items: validItem('report.pdf', '200 KB') },
  { file: '_with-files-active', label: 'File', root: { 'data-has-files': '', 'data-test-state': 'active' }, input: {}, items: validItem('report.pdf', '200 KB') },

  // Disabled
  { file: '_disabled-empty',      label: 'File', root: { 'data-disabled': ''                 }, input: { disabled: '' }, items: '' },
  { file: '_disabled-with-files', label: 'File', root: { 'data-disabled': '', 'data-has-files': '' }, input: { disabled: '' }, items: validItem('report.pdf', '200 KB') },

  // Validation states
  { file: '_invalid-type',     label: 'File', root: { 'data-has-files': '', 'data-has-errors': '' }, input: { accept: '.pdf' },           items: invalidTypeItem('image.exe', '14 KB') },
  { file: '_invalid-size',     label: 'File', root: { 'data-has-files': '', 'data-has-errors': '', 'data-max-size': '5mb' }, input: {}, items: invalidSizeItem('video.mp4', '48 MB') },
  { file: '_invalid-mixed',    label: 'File', root: { 'data-has-files': '', 'data-has-errors': '' }, input: { accept: '.pdf' },           items: validItem('report.pdf', '200 KB') + invalidTypeItem('image.exe', '14 KB') },
  { file: '_required-empty',   label: 'File', root: { 'data-required': ''                         }, input: { required: '' },             items: '' },

  // Variants
  { file: '_multiple',            label: 'Files', root: { 'data-has-files': '' }, input: { multiple: '' }, items: validItem('doc1.pdf', '200 KB') + validItem('doc2.pdf', '350 KB'), triggerText: 'Add files' },
  { file: '_drop-zone',           label: 'File',  root: { 'data-drop-zone': '' },                      input: {}, items: '' },
  { file: '_drop-zone-dragging',  label: 'File',  root: { 'data-drop-zone': '', 'data-dragging-over': '' }, input: {}, items: '' },
  { file: '_server-files',        label: 'CV',    root: { 'data-has-files': '' },
    input: {},
    items: serverItem('contract.pdf', '200 KB', 'abc123'),
    initialFiles: '[{"name":"contract.pdf","size":204800,"type":"application/pdf","ref":"abc123"}]',
  },

  // Live demo (e2e test target)
  { file: '_live', label: 'Upload file', root: {}, input: {}, items: '' },
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
