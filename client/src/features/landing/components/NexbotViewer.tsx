import React, { Suspense, lazy, useState, useRef, useEffect, Component, type ReactNode } from 'react'
import type { Application } from '@splinetool/runtime'
import styles from './NexbotViewer.module.css'

// Lazy load official Spline runtime component
const Spline = lazy(() => import('@splinetool/react-spline'))

interface NexbotViewerProps {
  className?: string
}

interface ErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class SplineErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('Spline scene notice:', error?.message || error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// High-fidelity interactive 3D Robot Canvas (follows cursor with 3D perspective, head tracking, and expressive lighting)
const InteractiveRobotCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = 0
    let height = 0

    // Cursor tracking state
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let isInteracting = false
    let blinkValue = 1
    let blinkTimer = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.resetTransform?.()
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      targetX = (x - 0.5) * 2 // -1 to 1
      targetY = (y - 0.5) * 2
      isInteracting = true
    }

    const handlePointerLeave = () => {
      targetX = 0
      targetY = 0
      isInteracting = false
    }

    const parent = canvas.parentElement || canvas
    parent.addEventListener('pointermove', handlePointerMove)
    parent.addEventListener('pointerleave', handlePointerLeave)

    let time = 0

    const render = () => {
      time += 0.02
      animationFrameId = requestAnimationFrame(render)

      // Smooth interpolation for head turn
      const lerpFactor = isInteracting ? 0.08 : 0.04
      // Subtle idle breathing/floating when not interacting
      const idleX = isInteracting ? targetX : Math.sin(time * 0.7) * 0.12
      const idleY = isInteracting ? targetY : Math.cos(time * 0.9) * 0.08

      currentX += (idleX - currentX) * lerpFactor
      currentY += (idleY - currentY) * lerpFactor

      // Blink logic
      blinkTimer++
      if (blinkTimer > 180 + Math.sin(time) * 60) {
        blinkValue -= 0.15
        if (blinkValue <= 0) {
          blinkValue = 0
          blinkTimer = 0
        }
      } else if (blinkValue < 1) {
        blinkValue = Math.min(1, blinkValue + 0.15)
      }

      ctx.clearRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2 + 10
      const scale = Math.min(width, height) / 480

      // Head 3D offsets based on rotation
      const headTurnX = currentX * 28 * scale
      const headTurnY = currentY * 20 * scale

      ctx.save()

      // Ambient background glow
      const bgGrad = ctx.createRadialGradient(
        cx + headTurnX * 0.5,
        cy + headTurnY * 0.5,
        20 * scale,
        cx,
        cy,
        220 * scale
      )
      bgGrad.addColorStop(0, 'rgba(37, 99, 235, 0.15)')
      bgGrad.addColorStop(0.5, 'rgba(37, 99, 235, 0.03)')
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // --- Body / Torso (Shoulders) ---
      const bodyY = cy + 130 * scale
      const bodyWidth = 190 * scale
      const bodyHeight = 90 * scale

      ctx.save()
      ctx.translate(cx + headTurnX * 0.2, bodyY)
      const bodyGrad = ctx.createLinearGradient(0, -20 * scale, 0, bodyHeight)
      bodyGrad.addColorStop(0, '#1c1c22')
      bodyGrad.addColorStop(0.5, '#121217')
      bodyGrad.addColorStop(1, '#09090c')
      ctx.fillStyle = bodyGrad
      ctx.beginPath()
      ctx.roundRect(-bodyWidth / 2, -20 * scale, bodyWidth, bodyHeight, 32 * scale)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Core chest light
      ctx.beginPath()
      ctx.arc(0, 20 * scale, 10 * scale, 0, Math.PI * 2)
      ctx.fillStyle = '#2563eb'
      ctx.shadowColor = '#3b82f6'
      ctx.shadowBlur = 15
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()

      // --- Neck ---
      const neckY = cy + 85 * scale
      ctx.save()
      ctx.translate(cx + headTurnX * 0.4, neckY)
      ctx.fillStyle = '#18181f'
      ctx.beginPath()
      ctx.roundRect(-24 * scale, -10 * scale, 48 * scale, 30 * scale, 10 * scale)
      ctx.fill()
      ctx.restore()

      // --- 3D Head Base (White Sleek Helmet) ---
      const headX = cx + headTurnX
      const headY = cy + headTurnY
      const headW = 150 * scale
      const headH = 150 * scale

      ctx.save()
      ctx.translate(headX, headY)
      ctx.rotate(currentX * 0.06) // subtle 3D tilt

      // Helmet shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
      ctx.shadowBlur = 30 * scale
      ctx.shadowOffsetY = 15 * scale

      // Helmet outer casing
      const helmetGrad = ctx.createLinearGradient(-headW / 2, -headH / 2, headW / 2, headH / 2)
      helmetGrad.addColorStop(0, '#f8fafc')
      helmetGrad.addColorStop(0.5, '#e2e8f0')
      helmetGrad.addColorStop(1, '#94a3b8')

      ctx.fillStyle = helmetGrad
      ctx.beginPath()
      ctx.roundRect(-headW / 2, -headH / 2, headW, headH, 46 * scale)
      ctx.fill()
      ctx.shadowColor = 'transparent'

      // Helmet edge highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.lineWidth = 1.5 * scale
      ctx.stroke()

      // Subtle ear accents (left and right pods)
      const earW = 12 * scale
      const earH = 34 * scale
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.roundRect(-headW / 2 - earW + 4 * scale, -earH / 2, earW, earH, 6 * scale)
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(headW / 2 - 4 * scale, -earH / 2, earW, earH, 6 * scale)
      ctx.fill()

      // Glowing ear LED rings
      ctx.fillStyle = '#38bdf8'
      ctx.shadowColor = '#38bdf8'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(-headW / 2 - 2 * scale, 0, 3 * scale, 0, Math.PI * 2)
      ctx.arc(headW / 2 + 2 * scale, 0, 3 * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // --- Glossy Dark Visor ---
      const visorW = 122 * scale
      const visorH = 88 * scale
      const visorY = -8 * scale

      const visorGrad = ctx.createLinearGradient(0, visorY - visorH / 2, 0, visorY + visorH / 2)
      visorGrad.addColorStop(0, '#020617')
      visorGrad.addColorStop(0.7, '#0f172a')
      visorGrad.addColorStop(1, '#020617')

      ctx.fillStyle = visorGrad
      ctx.beginPath()
      ctx.roundRect(-visorW / 2, visorY - visorH / 2, visorW, visorH, 28 * scale)
      ctx.fill()

      // Visor border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'
      ctx.lineWidth = 1.2 * scale
      ctx.stroke()

      // --- Visor Glass Reflection ---
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(-visorW / 2, visorY - visorH / 2, visorW, visorH, 28 * scale)
      ctx.clip()

      const reflGrad = ctx.createLinearGradient(-visorW / 2, visorY - visorH / 2, visorW / 2, visorY)
      reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
      reflGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.04)')
      reflGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')

      ctx.fillStyle = reflGrad
      ctx.beginPath()
      ctx.moveTo(-visorW / 2, visorY - visorH / 2)
      ctx.lineTo(visorW / 2, visorY - visorH / 2)
      ctx.lineTo(-visorW / 4, visorY + visorH / 2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // --- Digital Eyes (Track cursor with parallax) ---
      const eyeParallaxX = currentX * 14 * scale
      const eyeParallaxY = currentY * 10 * scale
      const eyeSpacing = 28 * scale
      const eyeW = 20 * scale
      const eyeH = 14 * scale * blinkValue

      if (blinkValue > 0.05) {
        ctx.save()
        ctx.fillStyle = '#38bdf8'
        ctx.shadowColor = '#0284c7'
        ctx.shadowBlur = 16 * scale

        // Left Eye
        ctx.beginPath()
        ctx.roundRect(
          -eyeSpacing + eyeParallaxX - eyeW / 2,
          visorY + eyeParallaxY - eyeH / 2,
          eyeW,
          eyeH,
          7 * scale
        )
        ctx.fill()

        // Right Eye
        ctx.beginPath()
        ctx.roundRect(
          eyeSpacing + eyeParallaxX - eyeW / 2,
          visorY + eyeParallaxY - eyeH / 2,
          eyeW,
          eyeH,
          7 * scale
        )
        ctx.fill()

        // Inner eye pupil glint
        ctx.fillStyle = '#ffffff'
        ctx.shadowBlur = 4
        ctx.beginPath()
        ctx.arc(
          -eyeSpacing + eyeParallaxX + 3 * scale,
          visorY + eyeParallaxY - 2 * scale,
          2.5 * scale,
          0,
          Math.PI * 2
        )
        ctx.arc(
          eyeSpacing + eyeParallaxX + 3 * scale,
          visorY + eyeParallaxY - 2 * scale,
          2.5 * scale,
          0,
          Math.PI * 2
        )
        ctx.fill()

        ctx.restore()
      }

      ctx.restore() // End head transform
      ctx.restore() // End main
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
      parent.removeEventListener('pointermove', handlePointerMove)
      parent.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.fallbackCanvas} aria-label="Interactive 3D Robot" />
}

export const NexbotViewer: React.FC<NexbotViewerProps> = ({ className = '' }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Lazy load the Spline component when scrolled near viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '250px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleSplineLoad = (_app: Application) => {
    setIsLoaded(true)
  }

  // Spline scene endpoint
  const splineSceneUrl = 'https://prod.spline.design/8621ef80-8d07-42f0-b75d-53319d3eccff/scene.splinecode'

  return (
    <div className={`${styles.viewerSection} ${className}`.trim()}>
      <div className={styles.glowBackdrop} aria-hidden="true" />

      <div
        ref={containerRef}
        className={styles.container}
        aria-label="Interactive 3D Character"
      >
        <div
          className={`${styles.loadingPlaceholder} ${isLoaded ? styles.loadingPlaceholderLoaded : ''}`}
          aria-hidden={isLoaded}
        >
          <div className={styles.spinner} />
        </div>

        <div className={styles.canvasWrapper}>
          {isInView && (
            <SplineErrorBoundary fallback={<InteractiveRobotCanvas />}>
              <Suspense fallback={<InteractiveRobotCanvas />}>
                <Spline
                  scene={splineSceneUrl}
                  className={styles.splineCanvas}
                  onLoad={handleSplineLoad}
                />
              </Suspense>
            </SplineErrorBoundary>
          )}
        </div>
      </div>
    </div>
  )
}

export default NexbotViewer

