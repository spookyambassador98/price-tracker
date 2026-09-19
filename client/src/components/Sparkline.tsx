interface Props {
  points: number[];
  positiveIsGood?: boolean;
}

/** Lightweight inline SVG price trend — avoids mounting a full Chart.js instance per card. */
export function Sparkline({ points, positiveIsGood = true }: Props) {
  if (points.length < 2) {
    return <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 36 - ((p - min) / range) * 32;
    return `${x},${y}`;
  });

  const trendUp = points[points.length - 1] > points[0];
  const good = positiveIsGood ? !trendUp : trendUp;
  const stroke = trendUp ? (good ? "var(--signal-drop)" : "var(--signal-rise)") : good ? "var(--signal-drop)" : "var(--signal-rise)";

  return (
    <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="История цены">
      <polyline points={coords.join(" ")} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
