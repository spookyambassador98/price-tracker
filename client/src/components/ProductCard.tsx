import { useEffect, useRef, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import type { Product } from "../types";
import { Counter } from "./Counter";
import { Sparkline } from "./Sparkline";
import { prefersReducedMotion } from "../lib/motion/lenis";

const STATUS_LABEL: Record<Product["status"], string> = {
  ACTIVE: "Watching",
  PAUSED: "Paused",
  ERROR: "Scrape error",
};

/** Reveals the card once it scrolls into view, and drives the radial hover glow via CSS custom properties. */
export function ProductCard({ product, index }: { product: Product; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      el.style.opacity = "1";
      el.style.transform = "none";
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.animate(
          [
            { opacity: 0, transform: "translateY(24px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 600, delay: Math.min(index, 8) * 60, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" }
        );
        observer.disconnect();
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  function handlePointerMove(e: PointerEvent<HTMLAnchorElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  const history = product.priceHistory?.map((h) => h.price) ?? [];
  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const delta = prev != null && product.currentPrice != null ? product.currentPrice - prev : null;

  return (
    <Link to={`/product/${product.id}`} className="product-card" ref={ref} onPointerMove={handlePointerMove}>
      <div className="product-card__top">
        <span className="product-card__domain">{product.domain}</span>
        <span
          className={`status-dot ${product.status.toLowerCase()}`}
          title={STATUS_LABEL[product.status]}
        />
      </div>

      {product.imageUrl && (
        <div className="product-card__shot" aria-hidden>
          <img src={product.imageUrl} alt="" />
        </div>
      )}

      <h3 className="product-card__title">{product.title ?? product.url}</h3>

      <div className="product-card__price-row">
        {product.currentPrice != null ? (
          <Counter value={product.currentPrice} currency={product.currency} className="product-card__price" />
        ) : (
          <span className="product-card__price">—</span>
        )}
        {delta != null && delta !== 0 && (
          <span className={`price-delta ${delta < 0 ? "drop" : "rise"}`}>
            {delta < 0 ? "↓" : "↑"} {Math.abs(delta).toLocaleString("en-US")}
          </span>
        )}
      </div>

      <Sparkline points={history} />

      <div className="product-card__meta">
        <span>{product.targetPrice ? `Floor: ${product.targetPrice.toLocaleString("en-US")}` : "No floor set"}</span>
        <span>{product.lastCheckedAt ? new Date(product.lastCheckedAt).toLocaleString("en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "not checked yet"}</span>
      </div>
    </Link>
  );
}
