import { prisma } from "../db.js";
import { scrapeProductPage } from "../scraper/scrape.js";
import { sendPriceDropAlert } from "./notify.js";
import type { Product } from "@prisma/client";

export interface CheckResult {
  product: Product;
  priceChanged: boolean;
  alertSent: boolean;
}

/**
 * Re-scrapes a single product, records the observation in PriceHistory, and
 * fires a notification when the new price crosses the user's target for the
 * first time (i.e. the previous price was still above it, or this is the
 * first successful check and it's already below target).
 */
export async function checkProductPrice(product: Product): Promise<CheckResult> {
  const result = await scrapeProductPage(product.url);

  if (!result.ok || result.price == null) {
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { status: "ERROR", lastError: result.error ?? "Unknown scrape error", lastCheckedAt: new Date() },
    });
    return { product: updated, priceChanged: false, alertSent: false };
  }

  const previousPrice = product.currentPrice;
  const newPrice = result.price;
  const currency = result.currency ?? product.currency;

  await prisma.priceHistory.create({
    data: { productId: product.id, price: newPrice, currency, inStock: result.inStock },
  });

  const lowestPrice =
    product.lowestPrice == null ? newPrice : Math.min(product.lowestPrice, newPrice);

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      title: result.title ?? product.title,
      imageUrl: result.imageUrl ?? product.imageUrl,
      currency,
      currentPrice: newPrice,
      lowestPrice,
      status: "ACTIVE",
      lastError: null,
      lastCheckedAt: new Date(),
    },
  });

  const priceChanged = previousPrice == null || previousPrice !== newPrice;

  const crossedThreshold =
    updated.targetPrice != null &&
    newPrice <= updated.targetPrice &&
    (previousPrice == null || previousPrice > updated.targetPrice);

  let alertSent = false;
  if (crossedThreshold) {
    await sendPriceDropAlert(updated, newPrice);
    alertSent = true;
  }

  return { product: updated, priceChanged, alertSent };
}
