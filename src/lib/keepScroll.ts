export type ScrollParent = {
  scrollTop: number
}

export type ScrollSnapshot = {
  windowY: number
  parents: Array<{ element: ScrollParent; top: number }>
}

export function snapshotScroll(start: HTMLElement | null): ScrollSnapshot {
  const parents: ScrollSnapshot['parents'] = []
  if (typeof document !== 'undefined' && start) {
    let node = start.parentElement
    while (node && node !== document.body && node !== document.documentElement) {
      if (node.scrollHeight > node.clientHeight + 1) {
        parents.push({ element: node, top: node.scrollTop })
      }
      node = node.parentElement
    }
  }
  return {
    windowY: typeof window === 'undefined' ? 0 : window.scrollY,
    parents,
  }
}

const DEFAULT_FOCUS_SCROLL_JUMP_PX = 96

/** True when scroll moved only a little (native focus nudge), not a deliberate page scroll. */
export function isLikelyFocusScrollJump(snapshot: ScrollSnapshot, maxJumpPx = DEFAULT_FOCUS_SCROLL_JUMP_PX) {
  if (typeof window !== 'undefined' && Math.abs(window.scrollY - snapshot.windowY) > maxJumpPx) {
    return false
  }
  for (const parent of snapshot.parents) {
    const el = parent.element
    if (Math.abs(el.scrollTop - parent.top) > maxJumpPx) return false
  }
  return true
}

/** Puts the page back where it was after a dropdown moves it. */
export function restoreScroll(snapshot: ScrollSnapshot) {
  for (const parent of snapshot.parents) {
    if (parent.element.scrollTop !== parent.top) parent.element.scrollTop = parent.top
  }
  if (typeof window !== 'undefined' && window.scrollY !== snapshot.windowY) {
    window.scrollTo(0, snapshot.windowY)
  }
}

export function holdScroll(snapshot: ScrollSnapshot) {
  if (!isLikelyFocusScrollJump(snapshot)) return
  restoreScroll(snapshot)
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      if (isLikelyFocusScrollJump(snapshot)) restoreScroll(snapshot)
    })
  }
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      if (isLikelyFocusScrollJump(snapshot)) restoreScroll(snapshot)
    }, 0)
  }
}
