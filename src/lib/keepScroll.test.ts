import { describe, expect, it } from 'vitest'
import { restoreScroll } from './keepScroll.ts'

describe('restoreScroll', () => {
  it('returns a scrolled panel to where it was before the dropdown opened', () => {
    const parent = { scrollTop: 640 }
    const windowY = typeof window === 'undefined' ? 0 : window.scrollY
    restoreScroll({ windowY, parents: [{ element: parent, top: 40 }] })
    expect(parent.scrollTop).toBe(40)
  })

  it('leaves a panel alone when the dropdown did not move it', () => {
    const parent = { scrollTop: 10 }
    const windowY = typeof window === 'undefined' ? 0 : window.scrollY
    restoreScroll({ windowY, parents: [{ element: parent, top: 10 }] })
    expect(parent.scrollTop).toBe(10)
  })
})