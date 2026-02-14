import { useCallback, useEffect, useRef } from 'react'
import './ResizeHandle.css'

interface ResizeHandleProps {
  onResize: (delta: number) => void
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const isDragging = useRef(false)
  const lastX = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      lastX.current = e.clientX
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - lastX.current
      lastX.current = e.clientX
      onResize(delta)
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  return <div className="resize-handle" onMouseDown={handleMouseDown} />
}
