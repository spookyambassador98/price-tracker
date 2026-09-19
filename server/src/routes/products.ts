import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { extractDomain, scrapeProductPage } from "../scraper/scrape.js";
import { checkProductPrice } from "../services/checkPrice.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const productsRouter = Router();

const createProductSchema = z.object({
  url: z.string().url(),
  targetPrice: z.number().positive().nullable().optional(),
  notifyEmail: z.string().email().nullable().optional(),
});

const updateProductSchema = z.object({
  targetPrice: z.number().positive().nullable().optional(),
  notifyEmail: z.string().email().nullable().optional(),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
});

const historyInclude = {
  orderBy: { scrapedAt: "desc" as const },
  take: 48,
};

const productDetailInclude = {
  priceHistory: { orderBy: { scrapedAt: "asc" as const } },
  notifications: { orderBy: { sentAt: "desc" as const }, take: 20 },
};

function withChronologicalHistory<T extends { priceHistory?: Array<unknown> }>(product: T): T {
  if (!product.priceHistory) return product;
  return { ...product, priceHistory: [...product.priceHistory].reverse() };
}

productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { priceHistory: historyInclude },
    });
    res.json(products.map(withChronologicalHistory));
  })
);

productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: productDetailInclude,
    });
    if (!product) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    res.json(product);
  })
);

productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные данные", details: parsed.error.flatten() });
      return;
    }
    const { url, targetPrice, notifyEmail } = parsed.data;

    const existing = await prisma.product.findUnique({ where: { url } });
    if (existing) {
      res.status(409).json({ error: "Этот товар уже отслеживается", product: existing });
      return;
    }

    const scraped = await scrapeProductPage(url);

    const product = await prisma.product.create({
      data: {
        url,
        domain: extractDomain(url),
        targetPrice: targetPrice ?? null,
        notifyEmail: notifyEmail ?? null,
        title: scraped.title,
        imageUrl: scraped.imageUrl,
        currency: scraped.currency ?? "RUB",
        currentPrice: scraped.price,
        lowestPrice: scraped.price,
        status: scraped.ok ? "ACTIVE" : "ERROR",
        lastError: scraped.error,
        lastCheckedAt: new Date(),
      },
    });

    if (scraped.ok && scraped.price != null) {
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: scraped.price,
          currency: product.currency,
          inStock: scraped.inStock,
        },
      });
    }

    const created = await prisma.product.findUnique({
      where: { id: product.id },
      include: { priceHistory: historyInclude },
    });
    res.status(201).json(created ? withChronologicalHistory(created) : product);
  })
);

productsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Некорректные данные", details: parsed.error.flatten() });
      return;
    }
    try {
      const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
      res.json(product);
    } catch {
      res.status(404).json({ error: "Товар не найден" });
    }
  })
);

productsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      await prisma.product.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch {
      res.status(404).json({ error: "Товар не найден" });
    }
  })
);

productsRouter.post(
  "/:id/check",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }

    const result = await checkProductPrice(product);
    const full = await prisma.product.findUnique({
      where: { id: product.id },
      include: productDetailInclude,
    });
    res.json({ ...result, product: full ?? result.product });
  })
);
