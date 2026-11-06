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
  restoreScroll(snapshot)
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => restoreScroll(snapshot))
  if (typeof window !== 'undefined') window.setTimeout(() => restoreScroll(snapshot), 0)
}
