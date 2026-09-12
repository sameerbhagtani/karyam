import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import vectorMark from '@/assets/svg/Vector 1.svg'
// import ConchModelViewer from './ConchModelViewer'
import NexbotViewer from './NexbotViewer'
import styles from './ConchStatementSection.module.css'

gsap.registerPlugin(ScrollTrigger)

interface MarkSvgState {
  path: string
  viewBox: string
}

export default function ConchStatementSection() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const pathRef = useRef<SVGPathElement | null>(null)
  const deployRef = useRef<HTMLSpanElement | null>(null)
  const actionRef = useRef<HTMLSpanElement | null>(null)
  const easeRef = useRef<HTMLSpanElement | null>(null)
  const headlineRef = useRef<HTMLSpanElement | null>(null)
  const [markSvg, setMarkSvg] = useState<MarkSvgState>({ path: '', viewBox: '0 0 354 540' })
  const [touchedTargets, setTouchedTargets] = useState<boolean[]>([])

  useEffect(() => {
    const markUrl = typeof vectorMark === 'string' ? vectorMark : (vectorMark as { src: string }).src

    fetch(markUrl)
      .then((response) => response.text())
      .then((svgText) => {
        const svgDocument = new DOMParser().parseFromString(svgText, 'image/svg+xml')
        const svg = svgDocument.querySelector('svg')
        const path = svgDocument.querySelector('path')

        if (!path) {
          return
        }

        setMarkSvg({
          path: path.getAttribute('d') ?? '',
          viewBox: svg?.getAttribute('viewBox') ?? '0 0 354 540',
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    const path = pathRef.current

    if (!section || !path || !markSvg.path) {
      return undefined
    }

    const pathLength = path.getTotalLength()
    const hitTargets = [deployRef.current, actionRef.current, easeRef.current, headlineRef.current]

    const context = gsap.context(() => {
      gsap.set(path, {
        stroke: '#2563eb',
        strokeDasharray: pathLength,
        strokeDashoffset: pathLength,
      })

      gsap.set(`.${styles.drawingMark}`, {
        yPercent: 34,
      })

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 50%',
          endTrigger: headlineRef.current,
          end: 'center center',
          scrub: 0.02,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (self.direction < 0) {
              setTouchedTargets([])
              return
            }

            gsap.set(path, { stroke: '#2563eb' })

            const matrix = path.getScreenCTM()

            if (!matrix) {
              return
            }

            const touchPadding = Math.max(10, window.innerWidth * 0.012)
            const currentLength = pathLength * self.progress
            const sampleStart = 0
            const sampleStep = Math.max(pathLength * 0.006, 10)
            const nextTouchedTargets = hitTargets.map((target) => {
              if (!target) {
                return false
              }

              const bounds = target.getBoundingClientRect()

              for (let sample = sampleStart; sample <= currentLength; sample += sampleStep) {
                const point = path.getPointAtLength(sample)
                const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix)
                const isTouching =
                  screenPoint.x >= bounds.left - touchPadding &&
                  screenPoint.x <= bounds.right + touchPadding &&
                  screenPoint.y >= bounds.top - touchPadding &&
                  screenPoint.y <= bounds.bottom + touchPadding

                if (isTouching) {
                  return true
                }
              }

              return false
            })

            setTouchedTargets((currentTargets) =>
              nextTouchedTargets.map((isTouched, index) => isTouched || currentTargets[index]),
            )
          },
          onLeaveBack: () => {
            setTouchedTargets([])
          },
        },
      })

      timeline.to(
        `.${styles.drawingMark}`,
        {
          yPercent: -24,
          ease: 'none',
        },
        0,
      )

      timeline.to(
        path,
        {
          strokeDashoffset: 0,
          ease: 'none',
        },
        0,
      )
    }, section)

    return () => {
      context.revert()
      setTouchedTargets([])
    }
  }, [markSvg.path])

  return (
    <section
      className={styles.statementSection}
      id="deploy"
      ref={sectionRef}
      aria-label="What Karyam does"
    >
      <svg
        className={styles.drawingMark}
        viewBox={markSvg.viewBox}
        fill="none"
        aria-hidden="true"
      >
        <path
          ref={pathRef}
          d={markSvg.path}
          stroke="#2563eb"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </svg>
      <div className={styles.statementInner}>
        <div className={styles.copyBlock}>
          <p>
            We help candidates <strong>build</strong> ATS-optimized, high-impact resumes and
            <span
              ref={deployRef}
              className={`${styles.highlight} ${touchedTargets[0] ? styles.highlightTouched : ''}`}
            >
              {' '}
              apply with total confidence
            </span>
            .
          </p>

          <p>
            Before your interview, Karyam gets you ready. Our AI runs realistic mock interviews, pinpoints weak spots, and turns hesitation into
            <span
              ref={actionRef}
              className={`${styles.highlight} ${touchedTargets[1] ? styles.highlightTouched : ''}`}
            >
              {' '}
              winning answers
            </span>
            .
          </p>

          <p>
            From targeted skill prep to automated job matching, we connect ready talent with the right opportunities, so you can
            <span
              ref={easeRef}
              className={`${styles.highlightWide} ${
                touchedTargets[2] ? styles.highlightTouched : ''
              }`}
            >
              {' '}
              get hired with ease
            </span>
            .
          </p>
        </div>

        <h2 className={styles.heroLine}>
          Karyam is your{' '}
          <span
            ref={headlineRef}
            className={touchedTargets[3] ? styles.heroLineTouched : undefined}
          >
            AI career acceleration platform.
          </span>
        </h2>

        {/* <ConchModelViewer className={styles.modelViewer} /> */}
        <NexbotViewer />
        <div id="postmortem" aria-hidden="true" />
      </div>
    </section>
  )
}
