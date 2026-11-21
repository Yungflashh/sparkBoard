import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Small ⓘ button. Hover (mouse) or tap (touch) to read what something does.
// The bubble is portalled to <body> so scrolling panels and the zoomed canvas can't clip it.
export default function Info({ text, label = 'What is this?' }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const b = btnRef.current.getBoundingClientRect()
    const width = Math.min(260, window.innerWidth - 24)
    const left = Math.max(12, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - width - 12))
    const popH = popRef.current?.offsetHeight || 80
    const below = b.bottom + 8 + popH < window.innerHeight
    setPos({ left, width, top: below ? b.bottom + 8 : b.top - 8 - popH })
  }, [open, text])

  useEffect(() => {
    if (!pinned) return
    const close = e => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setPinned(false); setOpen(false)
    }
    const onKey = e => { if (e.key === 'Escape') { setPinned(false); setOpen(false) } }
    const onScroll = () => { setPinned(false); setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [pinned])

  if (!text) return null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`rk-info ${open ? 'rk-info-open' : ''}`}
        aria-label={label}
        aria-expanded={open}
        draggable={false}
        onPointerEnter={e => { if (e.pointerType === 'mouse' && !pinned) setOpen(true) }}
        onPointerLeave={e => { if (e.pointerType === 'mouse' && !pinned) setOpen(false) }}
        onMouseDown={e => e.stopPropagation()}
        onDragStart={e => { e.preventDefault(); e.stopPropagation() }}
        onClick={e => {
          e.stopPropagation()
          e.preventDefault()
          const next = !pinned
          setPinned(next)
          setOpen(next)
        }}
      >i</button>
      {open && createPortal(
        <div
          ref={popRef}
          role="tooltip"
          className="rk-info-pop"
          style={pos
            ? { left: pos.left, top: pos.top, width: pos.width }
            : { left: -9999, top: 0 }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  )
}
