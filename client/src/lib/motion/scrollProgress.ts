import gsap from "gsap";

/**
 * Drives the hairline scroll-progress bar at the top of the page from the
 * shared GSAP ticker, so it stays in sync with Lenis without its own RAF loop.
 */
export function bindScrollProgress(el: HTMLElement | null): () => void {
  if (!el) return () => {};

  const update = () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
    el.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
  };

  gsap.ticker.add(update);
  return () => gsap.ticker.remove(update);
}
