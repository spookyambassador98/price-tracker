export type ProductStatus = "ACTIVE" | "PAUSED" | "ERROR";

export interface PriceHistoryPoint {
  id: string;
  price: number;
  currency: string;
  inStock: boolean;
  scrapedAt: string;
}

export interface NotificationLog {
  id: string;
  channel: "EMAIL" | "WEB_PUSH";
  price: number;
  targetPrice: number | null;
  sentAt: string;
  success: boolean;
  error: string | null;
}

export interface Product {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  imageUrl: string | null;
  currency: string;
  currentPrice: number | null;
  lowestPrice: number | null;
  targetPrice: number | null;
  status: ProductStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
  notifyEmail: string | null;
  createdAt: string;
  updatedAt: string;
  priceHistory?: PriceHistoryPoint[];
  notifications?: NotificationLog[];
}
