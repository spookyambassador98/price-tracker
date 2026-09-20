import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Product } from "../types";

interface Props {
  onAdded: (product: Product) => void;
  onError: (message: string) => void;
}

export function AddProductForm({ onAdded, onError }: Props) {
  const [url, setUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const product = await api.addProduct({
        url: url.trim(),
        targetPrice: targetPrice ? Number(targetPrice) : null,
        notifyEmail: email.trim() || null,
      });
      onAdded(product);
      setUrl("");
      setTargetPrice("");
      setEmail("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not add the product";
      setError(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="url">Product URL</label>
        <input
          id="url"
          type="url"
          required
          placeholder="https://market.example.com/product/123"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="target">Price floor</label>
        <input
          id="target"
          type="number"
          min={0}
          placeholder="9990"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="email">Notify email</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button className="btn btn--primary" type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Watch"}
      </button>
      {error && <div className="form-error">{error}</div>}
    </form>
  );
}
