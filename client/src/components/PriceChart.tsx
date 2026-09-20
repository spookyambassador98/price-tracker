import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, type ChartData, type ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import type { PriceHistoryPoint } from "../types";
import { prefersReducedMotion } from "../lib/motion/lenis";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export function PriceChart({ history, currency, targetPrice }: { history: PriceHistoryPoint[]; currency: string; targetPrice: number | null }) {
  const labels = history.map((h) =>
    new Date(h.scrapedAt).toLocaleDateString("en-US", { day: "2-digit", month: "short" })
  );
  const values = history.map((h) => h.price);

  const rootStyles = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const signal = rootStyles?.getPropertyValue("--signal-drop").trim() || "#c8ff4d";
  const fg = rootStyles?.getPropertyValue("--fg").trim() || "#f2f0ea";
  const hairline = rootStyles?.getPropertyValue("--hairline").trim() || "rgba(255,255,255,0.14)";

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : { duration: 900, easing: "easeOutExpo" },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(
              ctx.parsed.y ?? 0
            ),
        },
      },
    },
    scales: {
      x: { grid: { color: hairline }, ticks: { color: fg, font: { family: "JetBrains Mono", size: 10 } } },
      y: { grid: { color: hairline }, ticks: { color: fg, font: { family: "JetBrains Mono", size: 10 } } },
    },
  };

  const data: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "Price",
        data: values,
        borderColor: signal,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "transparent";
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${signal}33`);
          gradient.addColorStop(1, `${signal}00`);
          return gradient;
        },
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
      ...(targetPrice != null
        ? [
            {
              label: "Floor",
              data: labels.map(() => targetPrice),
              borderColor: "rgba(242, 240, 234, 0.45)",
              backgroundColor: "transparent",
              borderDash: [6, 6],
              pointRadius: 0,
              fill: false,
              tension: 0,
              borderWidth: 1,
            },
          ]
        : []),
    ],
  };

  return (
    <div style={{ height: 320 }}>
      <Line options={options} data={data} />
    </div>
  );
}
