'use client'

import { useEffect, useRef } from 'react'

const GLYPHS = 'WOORIMSHINrainyforest0123456789{}<>/λΣ'
const COUNT = 48

interface Letter {
  x: number
  y: number
  size: number
  speed: number
  angle: number
  spin: number
  alpha: number
  glyph: string
}

function spawn(width: number, height: number, anywhere: boolean): Letter {
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -40,
    size: 10 + Math.random() * 20,
    speed: 0.15 + Math.random() * 0.45,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.01,
    alpha: 0.08 + Math.random() * 0.22,
    glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
  }
}

/** Letters drifting down behind the home page. Static when the viewer prefers reduced motion. */
export function FallingLetters() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const styles = getComputedStyle(document.documentElement)
    const color = styles.getPropertyValue('--color-fg-subtle').trim()
    const font = styles.getPropertyValue('--font-mono').trim()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()

    const letters = Array.from({ length: COUNT }, () => spawn(width, height, true))
    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = color
      for (const l of letters) {
        ctx.save()
        ctx.globalAlpha = l.alpha
        ctx.translate(l.x, l.y)
        ctx.rotate(l.angle)
        ctx.font = `${l.size}px ${font}`
        ctx.fillText(l.glyph, 0, 0)
        ctx.restore()
      }
    }

    let frame = 0
    const tick = () => {
      for (const [i, l] of letters.entries()) {
        l.y += l.speed
        l.angle += l.spin
        if (l.y > height + 40) letters[i] = spawn(width, height, false)
      }
      draw()
      frame = requestAnimationFrame(tick)
    }

    const onResize = () => {
      resize()
      draw()
    }
    window.addEventListener('resize', onResize)
    if (still) draw()
    else frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={ref} className="falling-letters" aria-hidden="true" />
}
