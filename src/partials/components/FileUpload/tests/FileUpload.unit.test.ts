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
  el.innerHTML = `
    <input class="FileUpload-input" type="file" aria-hidden="true" tabindex="-1"${
      Object.entries(overrides.inputAttrs ?? {}).map(([k, v]) => ` ${k}="${v}"`).join('')
    }>
    <ul class="FileUpload-list" aria-live="polite" aria-relevant="additions removals" aria-label="Selected files"></ul>
    <button type="button" class="FileUpload-trigger">Add file</button>
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
    const trigger = el.querySelector('.FileUpload-trigger') as HTMLButtonElement
    expect(trigger.textContent).toBe('Add file')
    el.remove()
  })

  it('uses data-label-trigger when present', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-label-trigger': 'Välj fil' } })
    new FileUpload(el)
    const trigger = el.querySelector('.FileUpload-trigger') as HTMLButtonElement
    expect(trigger.textContent).toBe('Välj fil')
    el.remove()
  })

  it('uses data-label-trigger-multiple when input has multiple attribute', () => {
    const el = createFileUploadEl({
      rootAttrs: { 'data-label-trigger-multiple': 'Lägg till filer' },
      inputAttrs: { multiple: '' },
    })
    new FileUpload(el)
    const trigger = el.querySelector('.FileUpload-trigger') as HTMLButtonElement
    expect(trigger.textContent).toBe('Lägg till filer')
    el.remove()
  })
})

describe('FileUpload bootstrap from data-initial-files', () => {
  it('renders server files from data-initial-files on init', () => {
    const el = createFileUploadEl({
      rootAttrs: {
        'data-initial-files': JSON.stringify([
          { name: 'contract.pdf', size: 200_000, type: 'application/pdf', ref: 'abc123' },
        ]),
      },
    })
    new FileUpload(el)
    const items = el.querySelectorAll('.FileUpload-item')
    expect(items).toHaveLength(1)
    expect(items[0].querySelector('.FileUpload-item-name')!.textContent).toBe('contract.pdf')
    expect(items[0].querySelector('.FileUpload-item-size')!.textContent).toBe('200 KB')
    expect(items[0].querySelector('input[type="hidden"]')!.getAttribute('value')).toBe('abc123')
    expect(el.hasAttribute('data-has-files')).toBe(true)
    el.remove()
  })

  it('silently ignores malformed data-initial-files JSON', () => {
    const el = createFileUploadEl({ rootAttrs: { 'data-initial-files': 'not-json' } })
    expect(() => new FileUpload(el)).not.toThrow()
    expect(el.querySelectorAll('.FileUpload-item')).toHaveLength(0)
    el.remove()
  })
})
