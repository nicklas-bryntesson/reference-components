// src/partials/components/FileUpload/FileUpload.ts

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
  if (lower.endsWith('mb')) return parseFloat(lower) * 1024 * 1024
  if (lower.endsWith('kb')) return parseFloat(lower) * 1024
  return parseInt(lower, 10)
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1).replace(/\.0$/, '')} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1).replace(/\.0$/, '')} KB`
  return `${bytes} B`
}

export function validateAccept(
  file: { name: string; type: string },
  accept: string,
): boolean {
  if (!accept) return true
  const rules = accept.split(',').map(r => r.trim().toLowerCase())
  const ext = '.' + file.name.split('.').pop()!.toLowerCase()
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
