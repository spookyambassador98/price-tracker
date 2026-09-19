import { useEffect, useState } from "react";
import type { Product } from "../types";
import { api, ApiError } from "../api";
import { AddProductForm } from "../components/AddProductForm";
import { ProductCard } from "../components/ProductCard";
import { KineticHeadline } from "../components/KineticHeadline";

export function Dashboard({ onToast }: { onToast: (text: string, variant?: "info" | "error") => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .listProducts()
      .then((data) => !cancelled && setProducts(data))
      .catch((err) => onToast(err instanceof ApiError ? err.message : "Не удалось загрузить товары", "error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdded(product: Product) {
    setProducts((prev) => [product, ...prev]);
    onToast(`Добавлено: ${product.title ?? product.url}`);
    window.dispatchEvent(new Event("radar:products-changed"));
  }

  return (
    <>
      <section className="hero shell">
        <KineticHeadline
          as="h1"
          className="hero__headline"
          lines={[
            <>Радар</>,
            <>
              следит <em>за ценой</em>
            </>,
          ]}
        />
        <p className="hero__sub">
          Вставьте ссылку на товар — раз в час мы проверяем цену на странице и сигналим,
          как только она падает ниже вашего порога.
        </p>
      </section>

      <section className="section shell">
        <div className="section__label">
          <span className="index">01</span> Добавить товар
        </div>
        <AddProductForm onAdded={handleAdded} onError={(m) => onToast(m, "error")} />
      </section>

      <section className="section shell">
        <div className="section__label">
          <span className="index">02</span> Отслеживаемые товары ({products.length})
        </div>

        {loading ? (
          <div className="empty-state">Загружаем…</div>
        ) : products.length === 0 ? (
          <div className="empty-state">Пока ничего не отслеживается — добавьте первую ссылку выше.</div>
        ) : (
          <div className="product-grid">
            {products.map((p, i) => (
              <ProductCard product={p} index={i} key={p.id} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
