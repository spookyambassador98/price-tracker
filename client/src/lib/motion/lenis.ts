import Lenis from "lenis";
import gsap from "gsap";

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let lenis: Lenis | null = null;

/**
 * Boots Lenis smooth scroll driven by GSAP's own ticker, so Lenis and any
 * ScrollTrigger instances share a single requestAnimationFrame loop instead
 * of drifting out of sync. No-ops (returns null) under reduced motion.
 */
export function initSmoothScroll(): Lenis | null {
  if (prefersReducedMotion()) return null;
  if (lenis) return lenis;

  lenis = new Lenis({
    duration: 1.1,
    easing: (t: number) => 1 - Math.pow(1 - t, 3),
    smoothWheel: true,
  });

  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export function getLenis(): Lenis | null {
  return lenis;
}

export function destroySmoothScroll(): void {
  lenis?.destroy();
  lenis = null;
}
