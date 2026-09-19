import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "../lib/motion/lenis";

function formatMoney(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `${Math.round(price)} ${currency}`;
  }
}

/** Rolls from the previous value to `value` like a ticker/odometer instead of jump-cutting. */
export function Counter({ value, currency, className }: { value: number; currency: string; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }

    const obj = { v: prevValue.current };
    const tween = gsap.to(obj, {
      v: value,
      duration: 0.8,
      ease: "power3.out",
      onUpdate: () => setDisplay(obj.v),
      onComplete: () => {
        prevValue.current = value;
      },
    });
    return () => {
      tween.kill();
    };
  }, [value]);

  return <span className={className}>{formatMoney(display, currency)}</span>;
}
