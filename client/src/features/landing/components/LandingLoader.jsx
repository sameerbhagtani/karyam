import { useEffect, useMemo, useState } from "react";
import { orbitImages } from "../data/landingContent";
import styles from "./LandingLoader.module.css";

const MINIMUM_VISIBLE_MS = 1450;
const MORPH_DURATION_MS = 760;
const MAXIMUM_VISIBLE_MS = 5200;

function getAssetUrl(asset) {
  if (!asset) return "";
  if (typeof asset === "string") return asset;
  return asset.src || "";
}

function AnimatedMark({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 240"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        pathLength="1"
        d="M176 74C162 53 138 40 110 40C66 40 30 76 30 120C30 164 66 200 110 200C138 200 162 187 176 166"
      />
      <path pathLength="1" d="M136 86C127 78 116 74 104 74C78 74 58 94 58 120C58 146 78 166 104 166C116 166 127 162 136 154" />
      <path pathLength="1" d="M174 86L210 120L174 154" />
    </svg>
  );
}

export default function LandingLoader() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("loading");
  const [isRemoved, setIsRemoved] = useState(false);
  const [morphStyle, setMorphStyle] = useState({});
  const assetUrls = useMemo(
    () => [...new Set(orbitImages.map((image) => getAssetUrl(image.src)).filter(Boolean))],
    [],
  );

  useEffect(() => {
    let isMounted = true;
    let loadedCount = 0;
    let forcedDone = false;
    let isFinishing = false;
    let removalTimer;
    let finishTimer;
    const startedAt = window.performance.now();

    const removeLoader = () => {
      if (isMounted) {
        setIsRemoved(true);
      }
    };

    const startMorph = () => {
      if (!isMounted || isFinishing) return;
      isFinishing = true;

      const target = document.querySelector('[data-nav-logo-target="primary"] img');
      const targetRect = target?.getBoundingClientRect();
      const startSize = Math.min(window.innerWidth * 0.34, 148);
      const targetSize = targetRect?.width || 34;

      if (targetRect) {
        setMorphStyle({
          "--loader-x": `${targetRect.left + targetRect.width / 2}px`,
          "--loader-y": `${targetRect.top + targetRect.height / 2}px`,
          "--loader-scale": targetSize / startSize,
        });
      }

      setPhase("morphing");
      removalTimer = window.setTimeout(removeLoader, MORPH_DURATION_MS);
    };

    if (!assetUrls.length) {
      window.queueMicrotask(() => {
        if (isMounted) {
          setProgress(100);
          startMorph();
        }
      });
      return () => {
        isMounted = false;
        window.clearTimeout(removalTimer);
      };
    }

    const updateProgress = () => {
      if (!isMounted) return;
      loadedCount += 1;
      setProgress(Math.round((loadedCount / assetUrls.length) * 100));
    };

    const preloaders = assetUrls.map((src) => {
      const image = new window.Image();
      image.onload = updateProgress;
      image.onerror = updateProgress;
      image.src = src;
      return image;
    });

    const finishWhenReady = () => {
      if (!isMounted) return;

      if (loadedCount < assetUrls.length && !forcedDone) {
        finishTimer = window.setTimeout(finishWhenReady, 80);
        return;
      }
      if (isFinishing) return;

      setProgress(100);
      const elapsed = window.performance.now() - startedAt;
      const waitTime = Math.max(0, MINIMUM_VISIBLE_MS - elapsed);

      finishTimer = window.setTimeout(startMorph, waitTime);
    };

    const forceTimer = window.setTimeout(() => {
      forcedDone = true;
      finishWhenReady();
    }, MAXIMUM_VISIBLE_MS);

    finishWhenReady();

    return () => {
      isMounted = false;
      window.clearTimeout(forceTimer);
      window.clearTimeout(finishTimer);
      window.clearTimeout(removalTimer);
      preloaders.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [assetUrls]);

  if (isRemoved) {
    return null;
  }

  return (
    <div
      className={`${styles.loader} ${phase === "morphing" ? styles.morphing : ""}`}
      style={morphStyle}
      aria-label="Loading CONCH"
      role="status"
    >
      <div className={styles.markWrap}>
        <AnimatedMark className={styles.mark} />
      </div>
      <div className={styles.progressShell} aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.max(progress, 8) / 100})` }} />
      </div>
      <p>{progress < 100 ? `${progress}%` : "Ready"}</p>
    </div>
  );
}
