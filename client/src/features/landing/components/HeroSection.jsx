import { useEffect, useRef } from "react";
import gsap from "gsap";
import Image from "@/shared/components/Image/Image";
import { orbitImages, orbitRings } from "../data/landingContent";
import styles from "./HeroSection.module.css";

export default function HeroSection() {
  const heroRef = useRef(null);
  const cardRefs = useRef([]);
  const speedRef = useRef(1);

  useEffect(() => {
    const hero = heroRef.current;

    if (!hero) {
      return undefined;
    }

    let removeOrbitTicker = () => {};

    const context = gsap.context(() => {
      gsap.set(cardRefs.current, {
        transformOrigin: "50% 100%",
      });

      cardRefs.current.forEach((card, index) => {
        if (!card) {
          return;
        }

        gsap.fromTo(
          card,
          {
            autoAlpha: 0,
            scale: 0.36,
            rotate: orbitImages[index].rotate * 1.6,
          },
          {
            autoAlpha: 1,
            scale: 1,
            rotate: orbitImages[index].rotate,
            duration: 1.15,
            delay: index * 0.045,
            ease: "expo.out",
          },
        );
      });

      const orbitState = orbitRings.map(() => 0);

      const renderOrbit = () => {
        const viewportWidth = window.innerWidth;
        const mobileOrbitScale = viewportWidth <= 480 ? 2.05 : viewportWidth <= 760 ? 1.72 : 1;

        orbitRings.forEach((ring, ringIndex) => {
          const degreesPerSecond = (360 / ring.duration) * ring.direction * speedRef.current;
          orbitState[ringIndex] =
            (orbitState[ringIndex] + (degreesPerSecond * gsap.ticker.deltaRatio(60)) / 60) % 360;
        });

        orbitImages.forEach((image) => {
          const card = cardRefs.current[image.index];

          if (!card) {
            return;
          }

          const angle = image.angle + orbitState[image.ring];
          const radians = (angle * Math.PI) / 180;
          const radius = (image.radius / 100) * viewportWidth * mobileOrbitScale;
          const x = Math.cos(radians) * radius;
          const y = Math.sin(radians) * radius;

          gsap.set(card, {
            x,
            y,
            xPercent: -50,
            yPercent: -50,
            rotation: angle + 90 + image.rotate,
          });
        });
      };

      gsap.ticker.add(renderOrbit);
      renderOrbit();

      removeOrbitTicker = () => {
        gsap.ticker.remove(renderOrbit);
      };
    }, hero);

    return () => {
      removeOrbitTicker();
      context.revert();
    };
  }, []);

  const boostOrbit = () => {
    gsap.killTweensOf(speedRef);
    speedRef.current = 4.2;

    gsap.to(speedRef, {
      current: 1,
      duration: 1.2,
      delay: 0.35,
      ease: "power3.out",
    });
  };

  return (
    <section className={styles.hero} ref={heroRef} aria-label="CONCH inspiration orbit">
      <div className={styles.orbitStage} aria-hidden="true">
        {orbitRings.map((ring, ringIndex) => (
          <div className={styles.ring} key={ring.radius}>
            {orbitImages
              .filter((image) => image.ring === ringIndex)
              .map((image, index) => (
                <figure
                  className={`${styles.card} ${styles[`depth${image.depth}`]}`}
                  key={image.alt}
                  ref={(node) => {
                    cardRefs.current[image.index] = node;
                  }}
                  style={{
                    "--angle": `${image.angle}deg`,
                    "--radius": `${image.radius}vw`,
                  }}
                >
                  <div className={`${styles.tile} ${styles[image.fit]}`}>
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 700px) 12vw, 5vw"
                      priority={ringIndex === 0 && index < 2}
                    />
                  </div>
                </figure>
              ))}
          </div>
        ))}
      </div>

      <div className={styles.center} onMouseEnter={boostOrbit}>
        <p>CONCH</p>
        <h1>All in one platform for Web developers</h1>
        <div className={styles.actions}>
          <a href="/create">Start Building</a>
          <a href="#command-room">Explore Flow</a>
        </div>
      </div>
    </section>
  );
}
