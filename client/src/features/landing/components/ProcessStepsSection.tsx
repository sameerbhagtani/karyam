import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import styles from './ProcessStepsSection.module.css'

gsap.registerPlugin(ScrollTrigger)

interface Step {
  label: string
  tone: string
  icon: string
}

const steps: Step[] = [
  { label: 'RESUME AI', tone: 'green', icon: '+' },
  { label: 'MOCK INTERVIEW', tone: 'blue', icon: '^' },
  { label: 'SKILL AUDIT', tone: 'pink', icon: '!' },
  { label: 'MATCH JOBS', tone: 'amber', icon: '/' },
  { label: 'GET HIRED', tone: 'ink', icon: '>' },
]

const getStackPositions = (count: number) => {
  const viewportWidth = window.innerWidth
  const gap = viewportWidth <= 420 ? 66 : viewportWidth <= 760 ? 88 : 132
  const centerOffset = ((count - 1) * gap) / 2

  return Array.from({ length: count }, (_, index) => index * gap - centerOffset)
}

export default function ProcessStepsSection() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const section = sectionRef.current
    const stepNodes = stepRefs.current.filter(Boolean) as HTMLDivElement[]

    if (!section || stepNodes.length === 0) {
      return undefined
    }

    const context = gsap.context(() => {
      gsap.set(stepNodes, {
        x: 0,
        xPercent: 0,
        yPercent: -50,
        y: () => Math.min(window.innerHeight * 0.72, 560),
        autoAlpha: 0,
        scale: 0.9,
        transformOrigin: '50% 50%',
      })

      gsap.set(stepNodes[0], {
        y: 0,
        autoAlpha: 1,
        scale: 1,
      })

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=280%',
          scrub: 1.35,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      steps.slice(1).forEach((_, stepIndex) => {
        const visibleCount = stepIndex + 2
        const activeRows = stepNodes.slice(0, visibleCount)

        timeline.to(activeRows, {
          y: (index: number) => getStackPositions(visibleCount)[index],
          autoAlpha: 1,
          scale: 1,
          duration: 0.95,
          stagger: 0.025,
          ease: 'none',
        })
      })

      timeline.to(stepNodes, {
        scale: 0.98,
        duration: 0.45,
        ease: 'none',
      })
    }, section)

    return () => context.revert()
  }, [])

  return (
    <section
      className={styles.processSection}
      id="command-room"
      ref={sectionRef}
      aria-label="Karyam process steps"
    >
      <div className={styles.processStage}>
        <div className={styles.stepStack}>
          {steps.map((step, index) => (
            <div
              className={`${styles.stepRow} ${styles[step.tone]}`}
              key={step.label}
              ref={(node) => {
                stepRefs.current[index] = node
              }}
            >
              <span className={styles.stepIcon} aria-hidden="true">
                {step.icon}
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
