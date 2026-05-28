import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'

function makeRoot(attrs = '') {
  const dom = new JSDOM(`
    <div data-component="DateTimeField" data-id="test" data-name="test" data-locale="en" ${attrs}>
      <input type="datetime-local" class="DateTimeField-native" tabindex="-1" aria-hidden="true">
      <div class="DateTimeField-overlay">
        <div class="Segments" role="group"></div>
        <button class="DateTimeField-trigger" type="button"></button>
      </div>
      <template class="DateTimeField-calendarTemplate"></template>
    </div>
  `)
  return dom.window.document.querySelector('[data-component="DateTimeField"]')
}

describe('DateTimeField.attach()', () => {
  it('sets data-initialized on the root', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    expect(root.dataset.initialized).toBeDefined()
    root.remove()
  })
})

describe('_buildSegments() — date segments', () => {
  it('builds day, month, year spinbuttons', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const segs = root.querySelectorAll('.Segment[role="spinbutton"]')
    const types = Array.from(segs).map(s => s.dataset.segment)
    expect(types).toContain('day')
    expect(types).toContain('month')
    expect(types).toContain('year')
    root.remove()
  })

  it('builds hour and minute spinbuttons', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const types = Array.from(root.querySelectorAll('.Segment[role="spinbutton"]'))
      .map(s => s.dataset.segment)
    expect(types).toContain('hour')
    expect(types).toContain('minute')
    root.remove()
  })

  it('does not build second segment when step is absent', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot()
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const types = Array.from(root.querySelectorAll('.Segment[role="spinbutton"]'))
      .map(s => s.dataset.segment)
    expect(types).not.toContain('second')
    root.remove()
  })

  it('builds second segment when step < 60', async () => {
    const { DateTimeField } = await import('../DateTimeField.ts')
    const root = makeRoot('data-step="30"')
    document.body.appendChild(root)
    DateTimeField.attach(document.body)
    const types = Array.from(root.querySelectorAll('.Segment[role="spinbutton"]'))
      .map(s => s.dataset.segment)
    expect(types).toContain('second')
    root.remove()
  })
})
