// src/partials/components/FileUpload/tests/FileUpload.unit.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseMaxSize,
  formatFileSize,
  validateAccept,
  interpolate,
} from '../FileUpload'

describe('parseMaxSize', () => {
  it('parses mb suffix', () => {
    expect(parseMaxSize('5mb')).toBe(5 * 1024 * 1024)
  })
  it('parses MB suffix (case-insensitive)', () => {
    expect(parseMaxSize('5MB')).toBe(5 * 1024 * 1024)
  })
  it('parses kb suffix', () => {
    expect(parseMaxSize('500kb')).toBe(500 * 1024)
  })
  it('parses raw bytes string', () => {
    expect(parseMaxSize('2097152')).toBe(2097152)
  })
  it('parses decimal mb', () => {
    expect(parseMaxSize('1.5mb')).toBe(1.5 * 1024 * 1024)
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
