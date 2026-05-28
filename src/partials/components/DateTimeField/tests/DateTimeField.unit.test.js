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
