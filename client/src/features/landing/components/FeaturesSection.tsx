import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Image from '@/shared/components/Image/Image'
import { featureCards } from '../data/landingContent'
import styles from './FeaturesSection.module.css'

gsap.registerPlugin(ScrollTrigger)

const featureCardCoverPositions = [
  { x: '-9vw', y: '0vh', rotate: -8 },
  { x: '9vw', y: '1vh', rotate: 8 },
  { x: '-9vw', y: '13vh', rotate: -6 },
  { x: '9vw', y: '14vh', rotate: 6 },
  { x: '0vw', y: '7vh', rotate: 0 },
]

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const section = sectionRef.current
    const title = titleRef.current
    const cards = cardRefs.current.filter(Boolean) as HTMLElement[]

    if (!section || !title || cards.length === 0) {
      return undefined
    }

    const context = gsap.context(() => {
      gsap.set(title, {
        y: 120,
        scale: 0.92,
        autoAlpha: 0,
        transformOrigin: '50% 50%',
      })

      cards.forEach((card, index) => {
        const config = featureCards[index]

        gsap.set(card, {
          x: config.startX,
          y: config.startY,
          xPercent: -50,
          yPercent: -50,
          zIndex: featureCards.length - index,
          scale: 0.9,
          rotate: config.startRotate,
          autoAlpha: 1,
        })
      })

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=170%',
          scrub: 1.35,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      timeline
        .to(title, {
          y: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.8,
          ease: 'none',
        })
        .to(
          cards,
          {
            x: (index: number) => featureCards[index].endX,
            y: (index: number) => featureCards[index].endY,
            scale: 1.02,
            rotate: (index: number) => featureCards[index].endRotate,
            duration: 1,
            stagger: 0.03,
            ease: 'none',
          },
          0.08,
        )
        .to(
          title,
          {
            scale: 0.62,
            duration: 1,
            ease: 'none',
          },
          0.45,
        )
        .to(
          cards,
          {
            x: (index: number) => featureCardCoverPositions[index].x,
            y: (index: number) => featureCardCoverPositions[index].y,
            scale: 1.08,
            rotate: (index: number) => featureCardCoverPositions[index].rotate,
            duration: 0.8,
            stagger: 0.025,
            ease: 'none',
          },
          1.05,
        )
    }, section)

    return () => context.revert()
  }, [])

  return (
    <section className={styles.featuresSection} id="signal" ref={sectionRef}>
      <div className={styles.featuresStage}>
        <h2 className={styles.featuresTitle} ref={titleRef}>
          Get Job-Ready 
          <span>With AI</span>
        </h2>

        <div className={styles.featureCards} aria-hidden="true">
          {featureCards.map((card, index) => (
            <figure
              className={`${styles.featureCard} ${styles[card.className]}`}
              key={card.alt}
              ref={(node) => {
                cardRefs.current[index] = node
              }}
              style={
                {
                  '--feature-card-width': card.width,
                } as React.CSSProperties
              }
            >
              <Image src={card.src} alt="" fill sizes="(max-width: 760px) 42vw, 22vw" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
