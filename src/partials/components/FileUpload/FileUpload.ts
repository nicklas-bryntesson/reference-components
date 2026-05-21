// src/partials/components/FileUpload/FileUpload.ts

import './FileUpload.css'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileSource = 'user' | 'server'
export type FileStatus = 'valid' | 'invalid-type' | 'invalid-size'

export interface FileEntry {
  id: string
  source: FileSource
  file: File | null
  ref: string | null
  name: string
  size: number
  type: string
  status: FileStatus
}

export interface TranslationStrings {
  labelTrigger: string
  labelTriggerMultiple: string
  labelRemove: string
  errorAccept: string
  errorSize: string
  labelDropZone: string
  announceAdded: string
  announceRemoved: string
}

// ─── Pure utilities (exported for testing) ───────────────────────────────────

export function parseMaxSize(value: string): number {
  const lower = value.toLowerCase().trim()
  if (lower.endsWith('mb')) return parseFloat(lower) * 1_000_000
  if (lower.endsWith('kb')) return parseFloat(lower) * 1_000
  return parseFloat(lower)
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1).replace(/\.0$/, '')} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1).replace(/\.0$/, '')} KB`
  return `${bytes} B`
}

export function validateAccept(
  file: { name: string; type: string },
  accept: string | undefined,
): boolean {
  if (!accept) return true
  const rules = accept.split(',').map(r => r.trim().toLowerCase())
  const nameParts = file.name.split('.')
  const ext = nameParts.length > 1 ? '.' + nameParts[nameParts.length - 1].toLowerCase() : ''
  const mime = file.type.toLowerCase()
  return rules.some(rule => {
    if (rule.startsWith('.')) return ext === rule
    if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -2) + '/')
    return mime === rule
  })
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

// ─── Constants ───────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

const DEFAULT_TRANSLATIONS: TranslationStrings = {
  labelTrigger: 'Add file',
  labelTriggerMultiple: 'Add files',
  labelRemove: 'Remove {name}',
  errorAccept: 'File type not allowed',
  errorSize: 'File exceeds maximum size',
  labelDropZone: 'Drop files here',
  announceAdded: '{name} added',
  announceRemoved: '{name} removed',
}

// ─── Global augmentation ─────────────────────────────────────────────────────

declare global {
  interface HTMLElement {
    __fileUploadInstance?: FileUpload
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

class FileUpload {
  private root: HTMLElement
  private input: HTMLInputElement
  private list: HTMLUListElement
  private trigger: HTMLButtonElement
  private _entries: FileEntry[]
  private _t: TranslationStrings
  private _dragDepth = 0

  static attach(parent: Document | HTMLElement = document): void {
    parent.querySelectorAll<HTMLElement>('[data-component="FileUpload"]').forEach(el => {
      if (el.__fileUploadInstance) return
      el.__fileUploadInstance = new FileUpload(el)
    })
  }

  constructor(el: HTMLElement) {
    this.root = el
    this.input = el.querySelector<HTMLInputElement>('.FileUpload-input')!
    this.list = el.querySelector<HTMLUListElement>('.FileUpload-list')!
    this.trigger = el.querySelector<HTMLButtonElement>('.FileUpload-trigger')!
    this._entries = []
    this._t = this._readTranslations()
    this._init()
  }

  private _readTranslations(): TranslationStrings {
    const d = this.root.dataset
    return {
      labelTrigger: d.labelTrigger ?? DEFAULT_TRANSLATIONS.labelTrigger,
      labelTriggerMultiple: d.labelTriggerMultiple ?? DEFAULT_TRANSLATIONS.labelTriggerMultiple,
      labelRemove: d.labelRemove ?? DEFAULT_TRANSLATIONS.labelRemove,
      errorAccept: d.errorAccept ?? DEFAULT_TRANSLATIONS.errorAccept,
      errorSize: d.errorSize ?? DEFAULT_TRANSLATIONS.errorSize,
      labelDropZone: d.labelDropZone ?? DEFAULT_TRANSLATIONS.labelDropZone,
      announceAdded: d.announceAdded ?? DEFAULT_TRANSLATIONS.announceAdded,
      announceRemoved: d.announceRemoved ?? DEFAULT_TRANSLATIONS.announceRemoved,
    }
  }

  private _init(): void {
    this._bootstrapFromInput()
    this._bootstrapFromDataAttribute()
    this._renderList()
    this._updateTriggerText()
    this._bindEvents()
    this.root.setAttribute('data-initialized', '')
  }

  private _bootstrapFromInput(): void {
    if (!this.input.files || this.input.files.length === 0) return
    for (const file of Array.from(this.input.files)) {
      const raw: FileEntry = {
        id: generateId(),
        source: 'user',
        file,
        ref: null,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'valid',
      }
      this._entries.push(this._validateEntry(raw))
    }
  }

  private _bootstrapFromDataAttribute(): void {
    const raw = this.root.dataset.initialFiles
    if (!raw) return
    let parsed: Array<{ name: string; size: number; type: string; ref?: string }>
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    for (const item of parsed) {
      this._entries.push({
        id: generateId(),
        source: 'server',
        file: null,
        ref: item.ref ?? null,
        name: item.name,
        size: item.size,
        type: item.type,
        status: 'valid',
      })
    }
  }

  private _validateEntry(entry: FileEntry): FileEntry {
    const accept = this.input.accept
    const maxSizeRaw = this.root.dataset.maxSize
    if (accept && !validateAccept({ name: entry.name, type: entry.type }, accept)) {
      return { ...entry, status: 'invalid-type' }
    }
    if (maxSizeRaw) {
      const maxBytes = parseMaxSize(maxSizeRaw)
      if (entry.size > maxBytes) return { ...entry, status: 'invalid-size' }
    }
    return entry
  }

  private _renderList(): void {
    this.list.innerHTML = ''
    for (const entry of this._entries) {
      this.list.appendChild(this._renderItem(entry))
    }
    this._updateRootState()
  }

  private _renderItem(entry: FileEntry): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'FileUpload-item'
    li.setAttribute('data-status', entry.status)
    li.dataset.entryId = entry.id
    if (entry.source === 'server') li.setAttribute('data-source', 'server')

    const nameSpan = document.createElement('span')
    nameSpan.className = 'FileUpload-item-name'
    nameSpan.textContent = entry.name

    const sizeSpan = document.createElement('span')
    sizeSpan.className = 'FileUpload-item-size'
    sizeSpan.textContent = formatFileSize(entry.size)

    li.appendChild(nameSpan)
    li.appendChild(sizeSpan)

    if (entry.status !== 'valid') {
      const errorSpan = document.createElement('span')
      errorSpan.className = 'FileUpload-item-error'
      errorSpan.setAttribute('role', 'alert')
      errorSpan.textContent =
        entry.status === 'invalid-type' ? this._t.errorAccept : this._t.errorSize
      li.appendChild(errorSpan)
    }

    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'FileUpload-item-remove'
    removeBtn.setAttribute(
      'aria-label',
      interpolate(this._t.labelRemove, { name: entry.name }),
    )
    removeBtn.textContent = '×'
    li.appendChild(removeBtn)

    if (entry.source === 'server' && entry.ref) {
      const hidden = document.createElement('input')
      hidden.type = 'hidden'
      hidden.name = 'uploaded-ref'
      hidden.value = entry.ref
      li.appendChild(hidden)
    }

    return li
  }

  private _updateRootState(): void {
    if (this._entries.length > 0) this.root.setAttribute('data-has-files', '')
    else this.root.removeAttribute('data-has-files')

    const hasErrors = this._entries.some(e => e.status !== 'valid')
    if (hasErrors) this.root.setAttribute('data-has-errors', '')
    else this.root.removeAttribute('data-has-errors')
  }

  private _updateTriggerText(): void {
    const isMultiple = this.input.hasAttribute('multiple')
    this.trigger.textContent = isMultiple ? this._t.labelTriggerMultiple : this._t.labelTrigger
  }

  private _handleChange = (e: Event): void => {
    const newFiles = (e.target as HTMLInputElement).files
    if (!newFiles || newFiles.length === 0) return

    const newEntries: FileEntry[] = Array.from(newFiles).map(file => {
      const raw: FileEntry = {
        id: generateId(),
        source: 'user',
        file,
        ref: null,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'valid',
      }
      return this._validateEntry(raw)
    })

    this._entries.push(...newEntries)
    this._rebuildFileInput()
    this._appendEntries(newEntries)
  }

  private _handleTriggerClick = (): void => {
    this.input.click()
  }

  private _handleListClick = (e: MouseEvent): void => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.FileUpload-item-remove')
    if (!btn) return
    const li = btn.closest<HTMLElement>('[data-entry-id]')!
    const entryId = li.dataset.entryId!
    this._moveFocusAfterRemoval(li)
    this._removeEntry(entryId)
  }

  private _handleDragEnter = (): void => {
    this._dragDepth++
    this.root.setAttribute('data-dragging-over', '')
  }

  private _handleDragLeave = (): void => {
    this._dragDepth--
    if (this._dragDepth <= 0) {
      this._dragDepth = 0
      this.root.removeAttribute('data-dragging-over')
    }
  }

  private _handleDrop = (): void => {
    this._dragDepth = 0
    this.root.removeAttribute('data-dragging-over')
  }

  private _removeEntry(entryId: string): void {
    this._entries = this._entries.filter(e => e.id !== entryId)
    this._rebuildFileInput()
    const li = this.list.querySelector(`[data-entry-id="${entryId}"]`)
    li?.remove()
    this._updateRootState()
  }

  private _moveFocusAfterRemoval(removedLi: HTMLElement): void {
    const nextLi = removedLi.nextElementSibling ?? removedLi.previousElementSibling
    const nextBtn = nextLi?.querySelector<HTMLButtonElement>('.FileUpload-item-remove')
    if (nextBtn) {
      nextBtn.focus()
    } else {
      this.trigger.focus()
    }
  }

  private _rebuildFileInput(): void {
    const dt = new DataTransfer()
    for (const entry of this._entries) {
      if (entry.source === 'user' && entry.status === 'valid' && entry.file) {
        dt.items.add(entry.file)
      }
    }
    try {
      this.input.files = dt.files
    } catch {
      // Some environments (e.g. jsdom) don't allow direct assignment to input.files
    }
  }

  private _appendEntries(entries: FileEntry[]): void {
    for (const entry of entries) {
      this.list.appendChild(this._renderItem(entry))
    }
    this._updateRootState()
  }

  private _bindEvents(): void {
    this.input.addEventListener('change', this._handleChange)
    this.trigger.addEventListener('click', this._handleTriggerClick)
    this.list.addEventListener('click', this._handleListClick)

    if (this.root.hasAttribute('data-drop-zone')) {
      this.root.addEventListener('dragenter', this._handleDragEnter)
      this.root.addEventListener('dragleave', this._handleDragLeave)
      this.root.addEventListener('drop', this._handleDrop)
    }
  }

  destroy(): void {
    this.input.removeEventListener('change', this._handleChange)
    this.trigger.removeEventListener('click', this._handleTriggerClick)
    this.list.removeEventListener('click', this._handleListClick)
    this.root.removeEventListener('dragenter', this._handleDragEnter)
    this.root.removeEventListener('dragleave', this._handleDragLeave)
    this.root.removeEventListener('drop', this._handleDrop)
    delete this.root.__fileUploadInstance
  }
}

export default FileUpload
