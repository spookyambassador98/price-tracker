import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Product } from "../types";
import { api, ApiError } from "../api";
import { Counter } from "../components/Counter";
import { PriceChart } from "../components/PriceChart";

const STATUS_LABEL: Record<Product["status"], string> = {
  ACTIVE: "Watching",
  PAUSED: "Paused",
  ERROR: "Scrape error",
};

export function ProductDetail({ onToast }: { onToast: (text: string, variant?: "info" | "error") => void }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getProduct(id)
      .then((p) => {
        setProduct(p);
        setTargetInput(p.targetPrice != null ? String(p.targetPrice) : "");
        setEmailInput(p.notifyEmail ?? "");
      })
      .catch((err) => onToast(err instanceof ApiError ? err.message : "Product not found", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCheckNow() {
    if (!product) return;
    setChecking(true);
    try {
      const result = await api.checkNow(product.id);
      setProduct(result.product);
      onToast(result.alertSent ? "Price is below the floor — notification sent" : "Price updated");
      window.dispatchEvent(new Event("radar:products-changed"));
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not check the price", "error");
    } finally {
      setChecking(false);
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    try {
      const updated = await api.updateProduct(product.id, {
        targetPrice: targetInput ? Number(targetInput) : null,
        notifyEmail: emailInput || null,
      });
      setProduct(updated);
      onToast("Settings saved");
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not save", "error");
    }
  }

  async function handleTogglePause() {
    if (!product) return;
    try {
      const updated = await api.updateProduct(product.id, {
        status: product.status === "PAUSED" ? "ACTIVE" : "PAUSED",
      });
      setProduct(updated);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not change status", "error");
    }
  }

  async function handleDelete() {
    if (!product) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      await api.deleteProduct(product.id);
      onToast("Product removed");
      navigate("/");
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not delete", "error");
    }
  }

  if (loading) return <div className="shell section empty-state">Loading…</div>;
  if (!product) return <div className="shell section empty-state">Product not found</div>;

  const history = product.priceHistory ?? [];
  const prev = history.length >= 2 ? history[history.length - 2].price : null;
  const delta = prev != null && product.currentPrice != null ? product.currentPrice - prev : null;

  return (
    <div className="shell section">
      <button className="btn btn--ghost" onClick={() => navigate("/")} style={{ marginBottom: "var(--space-md)" }}>
        ← All products
      </button>

      <div className="detail-header">
        <div>
          <span className="product-card__domain">{product.domain}</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem, 2.5vw + 1rem, 2.8rem)", margin: "0.2em 0" }}>
            {product.title ?? product.url}
          </h1>
          <a href={product.url} target="_blank" rel="noreferrer" className="btn btn--ghost" style={{ padding: 0 }}>
            Open on site ↗
          </a>
        </div>

        <div style={{ textAlign: "right" }}>
          {product.currentPrice != null ? (
            <Counter value={product.currentPrice} currency={product.currency} className="detail-price" />
          ) : (
            <span className="detail-price">—</span>
          )}
          {delta != null && delta !== 0 && (
            <div className={`price-delta ${delta < 0 ? "drop" : "rise"}`} style={{ marginTop: "0.4em", display: "inline-flex" }}>
              {delta < 0 ? "↓" : "↑"} {Math.abs(delta).toLocaleString("en-US")}
            </div>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="stat">
          <div className="stat__label">Status</div>
          <div className="stat__value">{STATUS_LABEL[product.status]}</div>
        </div>
        <div className="stat">
          <div className="stat__label">All-time low</div>
          <div className="stat__value">{product.lowestPrice?.toLocaleString("en-US") ?? "—"}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Last check</div>
          <div className="stat__value">
            {product.lastCheckedAt ? new Date(product.lastCheckedAt).toLocaleString("en-US") : "—"}
          </div>
        </div>
        {product.lastError && (
          <div className="stat">
            <div className="stat__label" style={{ color: "var(--signal-rise)" }}>
              Error
            </div>
            <div className="stat__value" style={{ fontSize: "0.9rem" }}>
              {product.lastError}
            </div>
          </div>
        )}
      </div>

      <div className="chart-card">
        {history.length >= 2 ? (
          <PriceChart history={history} currency={product.currency} targetPrice={product.targetPrice} />
        ) : (
          <div className="empty-state">Not enough ticks for a chart yet — check back after the next scrape.</div>
        )}
      </div>

      <div style={{ display: "flex", gap: "var(--space-xs)", marginTop: "var(--space-md)", flexWrap: "wrap" }}>
        <button className="btn btn--primary" onClick={handleCheckNow} disabled={checking}>
          {checking ? "Checking…" : "Check now"}
        </button>
        <button className="btn" onClick={handleTogglePause}>
          {product.status === "PAUSED" ? "Resume" : "Pause"}
        </button>
        <button className="btn" onClick={handleDelete} style={confirmingDelete ? { borderColor: "var(--signal-rise)", color: "var(--signal-rise)" } : undefined}>
          {confirmingDelete ? "Delete for sure?" : "Delete"}
        </button>
      </div>

      <div className="section__label" style={{ marginTop: "var(--space-lg)" }}>
        <span className="index">03</span> Notification settings
      </div>
      <form className="add-form" onSubmit={handleSaveSettings} style={{ gridTemplateColumns: "1fr 1fr auto" }}>
        <div className="field">
          <label htmlFor="target">Price floor</label>
          <input id="target" type="number" min={0} value={targetInput} onChange={(e) => setTargetInput(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">Notify email</label>
          <input id="email" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
        </div>
        <button className="btn" type="submit">
          Save
        </button>
      </form>

      {(product.notifications?.length ?? 0) > 0 && (
        <>
          <div className="section__label" style={{ marginTop: "var(--space-lg)" }}>
            <span className="index">04</span> Notifications
          </div>
          <table className="history-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Channel</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {product.notifications!.map((n) => (
                <tr key={n.id}>
                  <td>{new Date(n.sentAt).toLocaleString("en-US")}</td>
                  <td>{n.channel === "EMAIL" ? "Email" : "Web Push"}</td>
                  <td>
                    {n.price.toLocaleString("en-US")} {product.currency}
                  </td>
                  <td>{n.success ? "sent" : n.error ?? "error"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {history.length > 0 && (
        <>
          <div className="section__label" style={{ marginTop: "var(--space-lg)" }}>
            <span className="index">{(product.notifications?.length ?? 0) > 0 ? "05" : "04"}</span> Check history
          </div>
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>In stock</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.scrapedAt).toLocaleString("en-US")}</td>
                  <td>{h.price.toLocaleString("en-US")} {h.currency}</td>
                  <td>{h.inStock ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
