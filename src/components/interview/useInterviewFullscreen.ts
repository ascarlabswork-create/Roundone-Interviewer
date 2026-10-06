import { useCallback, useEffect, useState, type RefObject } from 'react'

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

function requestNativeFullscreen(element: FullscreenElement) {
  if (element.requestFullscreen) return element.requestFullscreen()
  if (element.webkitRequestFullscreen) return Promise.resolve(element.webkitRequestFullscreen())
  return Promise.reject(new Error('unsupported'))
}

function exitNativeFullscreen() {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void }
  if (document.fullscreenElement && document.exitFullscreen) return document.exitFullscreen()
  if (doc.webkitExitFullscreen) return Promise.resolve(doc.webkitExitFullscreen())
  return Promise.resolve()
}

export function useInterviewFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false)
  const [cssFallback, setCssFallback] = useState(false)
  const active = native || cssFallback

  useEffect(() => {
    const onChange = () => {
      const current = document.fullscreenElement
      const target = targetRef.current
      setNative(Boolean(current && target && current === target))
      if (current) setCssFallback(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCssFallback(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('keydown', onKey)
    }
  }, [targetRef])

  const enter = useCallback(async () => {
    const node = targetRef.current
    if (!node) return
    try {
      await requestNativeFullscreen(node)
    } catch {
      setCssFallback(true)
    }
  }, [targetRef])

  const exit = useCallback(async () => {
    setCssFallback(false)
    try {
      await exitNativeFullscreen()
    } catch {
      // CSS fallback still closes on Escape / the exit control.
    }
  }, [])

  const toggle = useCallback(() => {
    if (active) void exit()
    else void enter()
  }, [active, enter, exit])

  return { active, toggle, exit }
}
