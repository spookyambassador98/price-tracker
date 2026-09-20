import nodemailer, { type Transporter } from "nodemailer";
import webpush from "web-push";
import { prisma } from "../db.js";
import type { Product } from "@prisma/client";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

let vapidConfigured = false;
function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);
    vapidConfigured = true;
  }
  return true;
}

function formatMoney(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      price
    );
  } catch {
    return `${price} ${currency}`;
  }
}

/**
 * Sends a price-drop alert for a product over every channel it can reach
 * (email always if configured; web push to every subscriber), and logs each
 * attempt to NotificationLog so the dashboard can show notification history.
 */
export async function sendPriceDropAlert(product: Product, newPrice: number): Promise<void> {
  const currency = product.currency || "RUB";
  const priceLabel = formatMoney(newPrice, currency);
  const targetLabel = product.targetPrice != null ? formatMoney(product.targetPrice, currency) : null;
  const title = product.title ?? product.url;

  // --- Email ---
  if (product.notifyEmail && process.env.SMTP_HOST) {
    try {
      await getTransporter().sendMail({
        from: process.env.MAIL_FROM ?? "Price Tracker <alerts@example.com>",
        to: product.notifyEmail,
        subject: `Price dropped: ${title} — ${priceLabel}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px;">
            <h2 style="margin-bottom: 4px;">${escapeHtml(title)}</h2>
            <p style="color:#555;">New price <strong>${priceLabel}</strong>${
          targetLabel ? ` — below your floor of ${targetLabel}` : ""
        }.</p>
            <p><a href="${product.url}" style="color:#0a7;">Open product →</a></p>
          </div>
        `,
      });
      await logNotification(product.id, "EMAIL", newPrice, product.targetPrice, true, null);
    } catch (err) {
      await logNotification(
        product.id,
        "EMAIL",
        newPrice,
        product.targetPrice,
        false,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // --- Web Push ---
  if (ensureVapid()) {
    const subscriptions = await prisma.pushSubscription.findMany();
    const payload = JSON.stringify({
      title: `Price dropped: ${title}`,
      body: `New price ${priceLabel}${targetLabel ? `, below floor ${targetLabel}` : ""}`,
      url: product.url,
      productId: product.id,
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        await logNotification(product.id, "WEB_PUSH", newPrice, product.targetPrice, true, null);
      } catch (err: any) {
        // 410/404 means the subscription is gone (browser unsubscribed) — clean it up.
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        await logNotification(
          product.id,
          "WEB_PUSH",
          newPrice,
          product.targetPrice,
          false,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }
}

async function logNotification(
  productId: string,
  channel: "EMAIL" | "WEB_PUSH",
  price: number,
  targetPrice: number | null,
  success: boolean,
  error: string | null
): Promise<void> {
  await prisma.notificationLog.create({
    data: { productId, channel, price, targetPrice, success, error },
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
