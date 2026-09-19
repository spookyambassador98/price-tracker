import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { Product } from "../types";
import { prefersReducedMotion } from "../lib/motion/lenis";

function formatMoney(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

/** Horizontal ticker of tracked products — the "radar sweep" reading of the dashboard state. */
export function Marquee({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || prefersReducedMotion() || products.length === 0) return;

    // Duplicate the content once so the loop can wrap seamlessly at -50%.
    const distance = track.scrollWidth / 2;
    const tween = gsap.to(track, {
      x: -distance,
      duration: Math.max(20, distance / 40),
      ease: "none",
      repeat: -1,
    });

    return () => {
      tween.kill();
      gsap.set(track, { x: 0 });
    };
  }, [products]);

  if (products.length === 0) return null;

  const items = products.map((p) => {
    const delta =
      p.priceHistory && p.priceHistory.length >= 2
        ? p.priceHistory[p.priceHistory.length - 1].price - p.priceHistory[p.priceHistory.length - 2].price
        : null;
    const trend = delta == null ? "" : delta < 0 ? "is-drop" : delta > 0 ? "is-rise" : "";
    return (
      <span className={`marquee__item ${trend}`} key={p.id}>
        {p.title ?? p.domain}
        <strong>{p.currentPrice != null ? formatMoney(p.currentPrice, p.currency) : "—"}</strong>
      </span>
    );
  });

  return (
    <div className="marquee">
      <div className="marquee__track" ref={trackRef}>
        {items}
        {items}
      </div>
    </div>
  );
}
