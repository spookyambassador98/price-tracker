import type { Product } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "";

class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // no JSON body
    }
    throw new ApiError(body?.error ?? `Ошибка запроса (${res.status})`, res.status, body?.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listProducts: () => request<Product[]>("/api/products"),
  getProduct: (id: string) => request<Product>(`/api/products/${id}`),
  addProduct: (data: { url: string; targetPrice?: number | null; notifyEmail?: string | null }) =>
    request<Product>("/api/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<{ targetPrice: number | null; notifyEmail: string | null; status: "ACTIVE" | "PAUSED" }>) =>
    request<Product>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request<void>(`/api/products/${id}`, { method: "DELETE" }),
  checkNow: (id: string) => request<{ product: Product; priceChanged: boolean; alertSent: boolean }>(
    `/api/products/${id}/check`,
    { method: "POST" }
  ),
  getVapidPublicKey: () => request<{ publicKey: string }>("/api/push/vapid-public-key"),
  subscribePush: (subscription: PushSubscriptionJSON) =>
    request<{ ok: true }>("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
};

export { ApiError };
