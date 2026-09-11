import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./VideoRevealSection.module.css";

gsap.registerPlugin(ScrollTrigger);

const setTheme = (theme) => {
  if (typeof document === "undefined") {
    return;
  }

  if (theme === "dark") {
    document.body.dataset.theme = "dark";
    return;
  }

  delete document.body.dataset.theme;
};

export default function VideoRevealSection() {
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const frame = frameRef.current;
    const video = videoRef.current;

    if (!section || !frame || !video) {
      return undefined;
    }

    video.play().catch(() => {});

    const context = gsap.context(() => {
      gsap.set(frame, {
        scale: 1,
        borderRadius: 32,
        opacity: 1,
        filter: "brightness(1)",
        transformOrigin: "50% 50%",
      });

      const getRevealScale = () => {
        const bounds = frame.getBoundingClientRect();

        return Math.max(window.innerWidth / bounds.width, 1.08);
      };

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=190%",
          scrub: 1.25,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            setTheme(self.progress >= 0.72 ? "dark" : "light");
          },
          onLeave: () => setTheme("dark"),
          onEnterBack: () => setTheme("light"),
        },
      });

      timeline
        .to(frame, {
          scale: getRevealScale,
          borderRadius: 0,
          duration: 0.72,
          ease: "none",
        })
        .to(frame, {
          opacity: 0.24,
          filter: "brightness(0.58)",
          duration: 0.28,
          ease: "none",
        });
    }, section);

    return () => {
      context.revert();
      setTheme("light");
    };
  }, []);

  return (
    <section
      className={styles.videoSection}
      id="incident-flow"
      ref={sectionRef}
      aria-label="CONCH product preview"
    >
      <div className={styles.videoStage}>
        <div className={styles.videoFrame} ref={frameRef}>
          <video
            ref={videoRef}
            className={styles.video}
            src="/vdo.mp4"
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
          />
        </div>
      </div>
    </section>
  );
}
