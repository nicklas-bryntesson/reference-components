// src/partials/components/FileUpload/tests/FileUpload.unit.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseMaxSize,
  formatFileSize,
  validateAccept,
  interpolate,
} from '../FileUpload'
import FileUpload from '../FileUpload'

describe('parseMaxSize', () => {
  it('parses mb suffix', () => {
    expect(parseMaxSize('5mb')).toBe(5 * 1_000_000)
  })
  it('parses MB suffix (case-insensitive)', () => {
    expect(parseMaxSize('5MB')).toBe(5 * 1_000_000)
  })
  it('parses kb suffix', () => {
    expect(parseMaxSize('500kb')).toBe(500 * 1_000)
  })
  it('parses raw bytes string', () => {
    expect(parseMaxSize('2097152')).toBe(2097152)
  })
  it('parses decimal mb', () => {
    expect(parseMaxSize('1.5mb')).toBe(1.5 * 1_000_000)
  })
  it('handles raw decimal bytes', () => {
    expect(parseMaxSize('5.5')).toBe(5.5)
  })
  it('returns 0 for "0"', () => {
    expect(parseMaxSize('0')).toBe(0)
  })
})

describe('formatFileSize', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })
  it('formats KB (SI: 1000 bytes = 1 KB)', () => {
    expect(formatFileSize(200_000)).toBe('200 KB')
  })
  it('formats MB with one decimal', () => {
    expect(formatFileSize(1_500_000)).toBe('1.5 MB')
  })
  it('formats exact MB without decimal', () => {
    expect(formatFileSize(5_000_000)).toBe('5 MB')
  })
  it('formats exactly 1000 bytes as 1 KB', () => {
    expect(formatFileSize(1000)).toBe('1 KB')
  })
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })
})

describe('validateAccept', () => {
  it('returns true when accept is empty', () => {
    expect(validateAccept({ name: 'file.exe', type: 'application/x-msdownload' }, '')).toBe(true)
  })
  it('matches by file extension', () => {
    expect(validateAccept({ name: 'report.pdf', type: 'application/pdf' }, '.pdf,.jpg')).toBe(true)
  })
  it('rejects non-matching extension', () => {
    expect(validateAccept({ name: 'image.exe', type: 'application/x-msdownload' }, '.pdf,.jpg')).toBe(false)
  })
  it('matches exact MIME type', () => {
    expect(validateAccept({ name: 'doc.pdf', type: 'application/pdf' }, 'application/pdf')).toBe(true)
  })
  it('matches MIME wildcard (image/*)', () => {
    expect(validateAccept({ name: 'photo.jpg', type: 'image/jpeg' }, 'image/*')).toBe(true)
  })
  it('rejects MIME outside wildcard', () => {
    expect(validateAccept({ name: 'doc.pdf', type: 'application/pdf' }, 'image/*')).toBe(false)
  })
  it('returns false for file with no extension when accept has extensions', () => {
    expect(validateAccept({ name: 'Makefile', type: '' }, '.pdf,.jpg')).toBe(false)
  })
  it('returns true for file with no extension when accept is empty', () => {
    expect(validateAccept({ name: 'Makefile', type: '' }, '')).toBe(true)
  })
})

describe('interpolate', () => {
  it('replaces {name} placeholder', () => {
    expect(interpolate('Remove {name}', { name: 'report.pdf' })).toBe('Remove report.pdf')
  })
  it('leaves unknown placeholders intact', () => {
    expect(interpolate('{name} added', { name: 'file.pdf' })).toBe('file.pdf added')
  })
  it('handles template with no placeholders', () => {
    expect(interpolate('Add file', {})).toBe('Add file')
  })
})

// ─── DOM helper ──────────────────────────────────────────────────────────────

function createFileUploadEl(overrides: {
  rootAttrs?: Record<string, string>
  inputAttrs?: Record<string, string>
} = {}): HTMLElement {
  const el = document.createElement('div')
  el.className = 'FileUpload'
  el.setAttribute('data-component', 'FileUpload')
  for (const [k, v] of Object.entries(overrides.rootAttrs ?? {})) {
    el.setAttribute(k, v)
  }
  const isMultiple = 'multiple' in (overrides.inputAttrs ?? {})
  const inputAttrsStr = Object.entries(overrides.inputAttrs ?? {}).map(([k, v]) => ` ${k}="${v}"`).join('')
  const fileContainer = isMultiple
    ? `<ul data-part="list" aria-live="polite" aria-relevant="additions removals" aria-label="Selected files"></ul>`
    : `<div data-part="selected" aria-live="polite" aria-atomic="true"></div>`
  el.innerHTML = `
    <input data-part="input" type="file" aria-hidden="true" tabindex="-1"${inputAttrsStr}>
    ${fileContainer}
    <button type="button" data-part="trigger">Add file</button>
  `
  document.body.appendChild(el)
  return el
}

describe('FileUpload.attach', () => {
  it('instantiates on elements with data-component="FileUpload"', () => {
    const el = createFileUploadEl()
    FileUpload.attach()
    expect((el as any).__fileUploadInstance).toBeInstanceOf(FileUpload)
    el.remove()
  })

  it('does not re-instantiate already attached elements', () => {
    const el = createFileUploadEl()
    FileUpload.attach()
    const first = (el as any).__fileUploadInstance
    FileUpload.attach()
    expect((el as any).__fileUploadInstance).toBe(first)
    el.remove()
  })
})

describe('FileUpload translations', () => {
  it('uses default trigger label when no data attribute', () => {
    const el = createFileUploadEl()
    const instance = new FileUpload(el)
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLButtonElement
    expect(trigger.textContent).toBe('Add file')
    el.remove()
  })

  it('uses data-label-trigger when present', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-label-trigger': 'Välj fil' } })
    new FileUpload(el)
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLButtonElement
    expect(trigger.textContent).toBe('Välj fil')
    el.remove()
  })

  it('uses data-label-trigger-multiple when input has multiple attribute', () => {
    const el = createFileUploadEl({
      rootAttrs: { 'data-label-trigger-multiple': 'Lägg till filer' },
      inputAttrs: { multiple: '' },
    })
    new FileUpload(el)
    const trigger = el.querySelector('[data-part="trigger"]') as HTMLButtonElement
    expect(trigger.textContent).toBe('Lägg till filer')
    el.remove()
  })
})

describe('FileUpload bootstrap from data-initial-files', () => {
  it('renders server files from data-initial-files on init (single mode)', () => {
    const el = createFileUploadEl({
      rootAttrs: {
        'data-initial-files': JSON.stringify([
          { name: 'contract.pdf', size: 200_000, type: 'application/pdf', ref: 'abc123' },
        ]),
      },
    })
    new FileUpload(el)
    const container = el.querySelector('[data-part="selected"]')!
    expect(container.querySelector('[data-part="item-name"]')!.textContent).toBe('contract.pdf')
    expect(container.querySelector('[data-part="item-size"]')!.textContent).toBe('200 KB')
    expect(container.querySelector('input[type="hidden"]')!.getAttribute('value')).toBe('abc123')
    expect(el.getAttribute('data-has-files')).toBe('true')
    el.remove()
  })

  it('silently ignores malformed data-initial-files JSON', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-initial-files': 'not-json' } })
    expect(() => new FileUpload(el)).not.toThrow()
    expect(el.querySelector('[data-part="selected"] [data-part="item-name"]')).toBeNull()
    el.remove()
  })
})

describe('FileUpload static pre-rendered items', () => {
  it('preserves pre-rendered list items when there is no data source on init (multiple mode)', () => {
    const el = createFileUploadEl({ inputAttrs: { multiple: '' } })
    el.querySelector('[data-part="list"]')!.innerHTML = `
      <li data-part="item" data-status="valid" data-entry-id="static-1">
        <span data-part="item-name">report.pdf</span>
        <span data-part="item-size">200 KB</span>
        <button type="button" data-part="item-remove" aria-label="Remove report.pdf">×</button>
      </li>`
    new FileUpload(el)
    expect(el.querySelectorAll('[data-part="item"]')).toHaveLength(1)
    expect(el.querySelector('[data-part="item-name"]')!.textContent).toBe('report.pdf')
    el.remove()
  })

  it('does not preserve pre-rendered items when data-initial-files is present (multiple mode)', () => {
    const el = createFileUploadEl({
      inputAttrs: { multiple: '' },
      rootAttrs: {
        'data-initial-files': JSON.stringify([
          { name: 'server.pdf', size: 100_000, type: 'application/pdf', ref: 'xyz' },
        ]),
      },
    })
    el.querySelector('[data-part="list"]')!.innerHTML = `
      <li data-part="item" data-status="valid" data-entry-id="old-static">
        <span data-part="item-name">old.pdf</span>
      </li>`
    new FileUpload(el)
    expect(el.querySelectorAll('[data-part="item"]')).toHaveLength(1)
    expect(el.querySelector('[data-part="item-name"]')!.textContent).toBe('server.pdf')
    el.remove()
  })
})

describe('FileUpload container semantics', () => {
  it('uses selected div (not ul) for single-file mode', () => {
    const el = createFileUploadEl()
    new FileUpload(el)
    expect(el.querySelector('[data-part="selected"]')).not.toBeNull()
    expect(el.querySelector('[data-part="list"]')).toBeNull()
    el.remove()
  })

  it('uses list ul for multiple-file mode', () => {
    const el = createFileUploadEl({ inputAttrs: { multiple: '' } })
    new FileUpload(el)
    expect(el.querySelector('[data-part="list"]')).not.toBeNull()
    expect(el.querySelector('[data-part="selected"]')).toBeNull()
    el.remove()
  })

  it('adds file as inline spans (no li) in single-file mode', () => {
    const el = createFileUploadEl()
    new FileUpload(el)
    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(new File(['data'], 'photo.jpg', { type: 'image/jpeg' }))
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const container = el.querySelector('[data-part="selected"]')!
    expect(container.querySelector('li')).toBeNull()
    expect(container.querySelector('[data-part="item-name"]')!.textContent).toBe('photo.jpg')
    el.remove()
  })

  it('adds file as li inside ul in multiple-file mode', () => {
    const el = createFileUploadEl({ inputAttrs: { multiple: '' } })
    new FileUpload(el)
    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(new File(['data'], 'doc.pdf', { type: 'application/pdf' }))
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const list = el.querySelector('[data-part="list"]')!
    expect(list.querySelector('li[data-part="item"]')).not.toBeNull()
    el.remove()
  })
})

describe('FileUpload add files', () => {
  it('replaces existing file when a second file is added in single-file mode', () => {
    const el = createFileUploadEl()
    new FileUpload(el)
    const input = el.querySelector('[data-part="input"]') as HTMLInputElement

    const file1 = new File(['a'], 'first.pdf', { type: 'application/pdf' })
    const dt1 = new DataTransfer()
    dt1.items.add(file1)
    Object.defineProperty(input, 'files', { value: dt1.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const file2 = new File(['b'], 'second.pdf', { type: 'application/pdf' })
    const dt2 = new DataTransfer()
    dt2.items.add(file2)
    Object.defineProperty(input, 'files', { value: dt2.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const container = el.querySelector('[data-part="selected"]')!
    expect(container.querySelectorAll('[data-part="item-name"]')).toHaveLength(1)
    expect(container.querySelector('[data-part="item-name"]')!.textContent).toBe('second.pdf')
    el.remove()
  })

  it('adds a valid file to the list on change', () => {
    const el = createFileUploadEl()
    new FileUpload(el)

    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' })
    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(file)
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const container = el.querySelector('[data-part="selected"]')!
    expect(container.querySelector('[data-part="item-name"]')!.textContent).toBe('report.pdf')
    expect(container.getAttribute('data-status')).toBe('valid')
    expect(el.getAttribute('data-has-files')).toBe('true')
    el.remove()
  })

  it('marks file as invalid-type when it does not match accept', () => {
    const el = createFileUploadEl({ inputAttrs: { accept: '.pdf' } })
    new FileUpload(el)

    const file = new File(['data'], 'image.exe', { type: 'application/x-msdownload' })
    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(file)
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const container = el.querySelector('[data-part="selected"]')!
    expect(container.getAttribute('data-status')).toBe('invalid-type')
    expect(container.querySelector('[data-part="item-error"]')!.textContent).toBe('File type not allowed')
    expect(el.getAttribute('data-has-errors')).toBe('true')
    el.remove()
  })

  it('marks file as invalid-size when it exceeds data-max-size', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-max-size': '1kb' } })
    new FileUpload(el)

    const file = new File([new Uint8Array(2000)], 'big.pdf', { type: 'application/pdf' })
    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(file)
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const container = el.querySelector('[data-part="selected"]')!
    expect(container.getAttribute('data-status')).toBe('invalid-size')
    expect(container.querySelector('[data-part="item-error"]')!.textContent).toBe('File exceeds maximum size')
    el.remove()
  })

  it('appends new files to existing list without removing previous entries', () => {
    const el = createFileUploadEl({ inputAttrs: { multiple: '' } })
    new FileUpload(el)

    const input = el.querySelector('[data-part="input"]') as HTMLInputElement

    const dt1 = new DataTransfer()
    dt1.items.add(new File(['a'], 'first.pdf', { type: 'application/pdf' }))
    Object.defineProperty(input, 'files', { value: dt1.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const dt2 = new DataTransfer()
    dt2.items.add(new File(['b'], 'second.pdf', { type: 'application/pdf' }))
    Object.defineProperty(input, 'files', { value: dt2.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    expect(el.querySelectorAll('[data-part="item"]')).toHaveLength(2)
    el.remove()
  })
})

describe('FileUpload remove files', () => {
  function addFileToInstance(el: HTMLElement, name: string): void {
    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(new File(['data'], name, { type: 'application/pdf' }))
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))
  }

  it('removes a file when its remove button is clicked', () => {
    const el = createFileUploadEl()
    new FileUpload(el)
    addFileToInstance(el, 'report.pdf')
    expect(el.querySelector('[data-part="selected"] [data-part="item-name"]')).not.toBeNull()

    const removeBtn = el.querySelector('[data-part="item-remove"]') as HTMLButtonElement
    removeBtn.click()

    expect(el.querySelector('[data-part="selected"] [data-part="item-name"]')).toBeNull()
    expect(el.hasAttribute('data-has-files')).toBe(false)
    el.remove()
  })

  it('removes data-has-errors when last invalid file is removed', () => {
    const el = createFileUploadEl({ inputAttrs: { accept: '.pdf' } })
    new FileUpload(el)

    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(new File(['x'], 'bad.exe', { type: 'application/x-msdownload' }))
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    expect(el.getAttribute('data-has-errors')).toBe('true')

    const removeBtn = el.querySelector('[data-part="item-remove"]') as HTMLButtonElement
    removeBtn.click()

    expect(el.hasAttribute('data-has-errors')).toBe(false)
    el.remove()
  })

  it('aria-label of remove button includes the filename', () => {
    const el = createFileUploadEl()
    new FileUpload(el)
    addFileToInstance(el, 'my-doc.pdf')

    const removeBtn = el.querySelector('[data-part="item-remove"]') as HTMLButtonElement
    expect(removeBtn.getAttribute('aria-label')).toBe('Remove my-doc.pdf')
    el.remove()
  })

  it('focuses next remove button after removal when one exists', () => {
    const el = createFileUploadEl({ inputAttrs: { multiple: '' } })
    document.body.appendChild(el)
    new FileUpload(el)

    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(new File(['a'], 'first.pdf', { type: 'application/pdf' }))
    dt.items.add(new File(['b'], 'second.pdf', { type: 'application/pdf' }))
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const btns = el.querySelectorAll<HTMLButtonElement>('[data-part="item-remove"]')
    btns[0].focus()
    btns[0].click()

    expect(document.activeElement).toBe(el.querySelector('[data-part="item-remove"]'))
    el.remove()
  })

  it('focuses trigger button when last file is removed', () => {
    const el = createFileUploadEl()
    document.body.appendChild(el)
    new FileUpload(el)

    const input = el.querySelector('[data-part="input"]') as HTMLInputElement
    const dt = new DataTransfer()
    dt.items.add(new File(['a'], 'only.pdf', { type: 'application/pdf' }))
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true })
    input.dispatchEvent(new Event('change'))

    const removeBtn = el.querySelector<HTMLButtonElement>('[data-part="item-remove"]')!
    removeBtn.focus()
    removeBtn.click()

    expect(document.activeElement).toBe(el.querySelector('[data-part="trigger"]'))
    el.remove()
  })
})

describe('FileUpload drop-zone', () => {
  it('sets data-dragging-over on dragenter when data-drop-zone is present', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-drop-zone': 'true' } })
    new FileUpload(el)

    el.dispatchEvent(new Event('dragenter', { bubbles: true }))
    expect(el.getAttribute('data-dragging-over')).toBe('true')
    el.remove()
  })

  it('removes data-dragging-over on dragleave when depth returns to zero', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-drop-zone': 'true' } })
    new FileUpload(el)

    el.dispatchEvent(new Event('dragenter', { bubbles: true }))
    el.dispatchEvent(new Event('dragleave', { bubbles: true }))
    expect(el.hasAttribute('data-dragging-over')).toBe(false)
    el.remove()
  })

  it('removes data-dragging-over on drop', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-drop-zone': 'true' } })
    new FileUpload(el)

    el.dispatchEvent(new Event('dragenter', { bubbles: true }))
    el.dispatchEvent(new Event('drop', { bubbles: true }))
    expect(el.hasAttribute('data-dragging-over')).toBe(false)
    el.remove()
  })

  it('does not set data-dragging-over when data-drop-zone is absent', () => {
    const el = createFileUploadEl()
    new FileUpload(el)

    el.dispatchEvent(new Event('dragenter', { bubbles: true }))
    expect(el.hasAttribute('data-dragging-over')).toBe(false)
    el.remove()
  })

  it('injects an aria-hidden drop label with the default text', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-drop-zone': 'true' } })
    new FileUpload(el)

    const label = el.querySelector('[data-part="drop-label"]')!
    expect(label).not.toBeNull()
    expect(label.getAttribute('aria-hidden')).toBe('true')
    expect(label.textContent).toBe('Drop files here')
    el.remove()
  })

  it('uses data-label-drop-zone for the drop label text', () => {
    const el = createFileUploadEl({
      rootAttrs: { 'data-drop-zone': 'true', 'data-label-drop-zone': 'Släpp filer här' },
    })
    new FileUpload(el)

    expect(el.querySelector('[data-part="drop-label"]')!.textContent).toBe('Släpp filer här')
    el.remove()
  })

  it('does not inject a drop label without data-drop-zone', () => {
    const el = createFileUploadEl()
    new FileUpload(el)

    expect(el.querySelector('[data-part="drop-label"]')).toBeNull()
    el.remove()
  })
})
