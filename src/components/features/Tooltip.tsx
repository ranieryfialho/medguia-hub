'use client'

import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

type TooltipProps = {
  texto: string
}

export function Tooltip({ texto }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isVisible || !buttonRef.current) return

    const rect = buttonRef.current.getBoundingClientRect()
    setPosition({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    })
  }, [isVisible])

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#bcc9c4]/30 hover:bg-[#bcc9c4]/50 transition-colors flex-shrink-0"
      >
        <Info size={14} className="text-[#006b5a]" />
      </button>

      {isVisible && (
        <div
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          className="fixed bg-[#171d1c] text-white text-xs rounded-lg px-3 py-2 z-[9999] shadow-xl"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translate(-50%, -100%)',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
          }}
        >
          {texto}
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-[#171d1c]" />
        </div>
      )}
    </div>
  )
}
