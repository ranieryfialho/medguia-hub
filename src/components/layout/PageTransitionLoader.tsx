'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function PageTransitionLoader() {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
    const hideTimer = setTimeout(() => setIsLoading(false), 0)
    return () => clearTimeout(hideTimer)
  }, [pathname])

  useEffect(() => {
    const stopWithFallback = () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
      }
      fallbackTimerRef.current = setTimeout(() => setIsLoading(false), 5000)
    }

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target instanceof Element ? event.target : null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null

      if (!anchor || anchor.target || anchor.hasAttribute('download')) {
        return
      }

      const nextUrl = new URL(anchor.href)
      const currentUrl = new URL(window.location.href)

      if (
        nextUrl.origin !== currentUrl.origin ||
        (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search)
      ) {
        return
      }

      setIsLoading(true)
      stopWithFallback()
    }

    const handlePageShow = () => setIsLoading(false)

    document.addEventListener('click', handleClick, true)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('pageshow', handlePageShow)
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
      }
    }
  }, [])

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[500] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin" />
              <span className="text-sm font-medium text-text-primary">Carregando...</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
