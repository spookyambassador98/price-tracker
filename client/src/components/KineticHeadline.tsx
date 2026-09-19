import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "../lib/motion/lenis";

interface Props {
  lines: ReactNode[];
  as?: "h1" | "h2";
  className?: string;
  delay?: number;
}

/**
 * Masks each line and animates it up into view on mount (SplitText-style
 * reveal, hand-rolled to avoid the GSAP club plugin dependency). Renders the
 * final, fully-visible state immediately when JS hasn't run yet or reduced
 * motion is requested, so content stays readable either way.
 */
export function KineticHeadline({ lines, as = "h1", className, delay = 0 }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const Tag = as;

  useEffect(() => {
    if (prefersReducedMotion() || !rootRef.current) return;
    const spans = rootRef.current.querySelectorAll<HTMLElement>(".split-line > span");

    const ctx = gsap.context(() => {
      gsap.fromTo(
        spans,
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.08,
          delay,
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [delay]);

  return (
    <Tag ref={rootRef as any} className={className}>
      {lines.map((line, i) => (
        <span className="split-line" key={i}>
          <span>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
