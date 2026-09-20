import { useEffect, useRef, useState, useCallback } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { ProductDetail } from "./pages/ProductDetail";
import { Marquee } from "./components/Marquee";
import { ToastStack, type ToastMessage } from "./components/Toast";
import { api } from "./api";
import type { Product } from "./types";
import { initSmoothScroll } from "./lib/motion/lenis";
import { bindScrollProgress } from "./lib/motion/scrollProgress";
import { enablePushNotifications, isPushSupported } from "./lib/push";

let toastId = 0;

export default function App() {
  const [tickerProducts, setTickerProducts] = useState<Product[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pushState, setPushState] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
  const progressRef = useRef<HTMLDivElement>(null);

  const pushToast = useCallback((text: string, variant: "info" | "error" = "info") => {
    setToasts((prev) => [...prev, { id: ++toastId, text, variant }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    initSmoothScroll();
    const unbind = bindScrollProgress(progressRef.current);
    return unbind;
  }, []);

  useEffect(() => {
    const load = () => {
      api.listProducts().then(setTickerProducts).catch(() => {});
    };
    load();
    window.addEventListener("radar:products-changed", load);
    return () => window.removeEventListener("radar:products-changed", load);
  }, []);

  async function handleEnablePush() {
    const result = await enablePushNotifications();
    setPushState(result);
    if (result === "granted") pushToast("Push notifications enabled");
    if (result === "denied") pushToast("Notifications are blocked in this browser", "error");
    if (result === "unsupported") pushToast("This browser does not support Web Push", "error");
  }

  return (
    <>
      <div className="scroll-progress" ref={progressRef} />
      <header className="site-header">
        <Marquee products={tickerProducts} />
        <div className="shell topbar">
          <Link to="/" className="wordmark">
            <span className="wordmark__dot" />
            Price Radar
          </Link>
          <div className="topbar__actions">
            {isPushSupported() && pushState !== "granted" && (
              <button className="btn" onClick={handleEnablePush}>
                <span className="label">Enable push</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard onToast={pushToast} />} />
          <Route path="/product/:id" element={<ProductDetail onToast={pushToast} />} />
        </Routes>
      </main>

      <footer className="site-footer shell">
        <hr className="hairline" />
        <h2 className="footer-wordmark" aria-hidden>
          <span>Radar</span>
        </h2>
        <div className="footer-meta">
          <span>Hourly price checks · Playwright + Prisma + PostgreSQL</span>
          <span>Email + Web Push alerts</span>
        </div>
      </footer>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
