'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'

type Props = {
  onChange: (dataUrl: string | null) => void
  height?: number
}

type Ponto = { clientX: number; clientY: number }

export function AssinaturaCanvas({ onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [hasContent, setHasContent] = useState(false)

  const getPos = (e: Ponto, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const notifyChange = useCallback((canvas: HTMLCanvasElement) => {
    onChange(canvas.toDataURL('image/png'))
    setHasContent(true)
  }, [onChange])

  const limpar = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
    onChange(null)
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const onMouseDown = (e: MouseEvent) => {
      drawing.current = true
      lastPos.current = getPos(e, canvas)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!drawing.current || !lastPos.current) return
      const pos = getPos(e, canvas)
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPos.current = pos
    }

    const onMouseUp = () => {
      if (!drawing.current) return
      drawing.current = false
      lastPos.current = null
      notifyChange(canvas)
    }

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      drawing.current = true
      lastPos.current = getPos(e.touches[0], canvas)
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!drawing.current || !lastPos.current) return
      const pos = getPos(e.touches[0], canvas)
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPos.current = pos
    }

    const onTouchEnd = () => {
      if (!drawing.current) return
      drawing.current = false
      lastPos.current = null
      notifyChange(canvas)
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [notifyChange])

  return (
    <div className="space-y-2">
      <div
        className="relative border-2 border-dashed border-border rounded-lg bg-white overflow-hidden"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          width={700}
          height={height * 2}
          className="w-full cursor-crosshair touch-none"
          style={{ height }}
        />
        {!hasContent && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-text-secondary pointer-events-none select-none">
            Assine aqui
          </p>
        )}
      </div>
      {hasContent && (
        <button
          type="button"
          onClick={limpar}
          className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 transition-colors"
        >
          <Trash2 size={14} />
          Limpar assinatura
        </button>
      )}
    </div>
  )
}