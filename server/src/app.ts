import express from "express";
import cors from "cors";
import { productsRouter } from "./routes/products.js";
import { pushRouter } from "./routes/push.js";
import { runScrapeCycle } from "./services/cron.js";
import { prisma } from "./db.js";

function allowedOrigins(): string[] {
  const configured = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.VERCEL_URL) {
    configured.push(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    configured.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  return [...new Set(configured)];
}

function isCronAuthorized(req: express.Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.authorization === `Bearer ${secret}`;
}

export function createApp() {
  const app = express();
  const origins = allowedOrigins();

  if (process.env.VERCEL) app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) return callback(null, true);
        const ok = origins.some((allowed) => {
          try {
            return new URL(allowed).host === new URL(origin).host;
          } catch {
            return false;
          }
        });
        return callback(null, ok);
      },
    })
  );
  app.use(express.json({ limit: "32kb" }));

  app.get(
    "/api/health",
    async (_req, res, next) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  app.use("/api/products", productsRouter);
  app.use("/api/push", pushRouter);

  const runNow: express.RequestHandler = async (req, res, next) => {
    if (!isCronAuthorized(req)) {
      res.status(401).json({ error: "Not authorized to run a scrape" });
      return;
    }
    try {
      const result = await runScrapeCycle();
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  app.get("/api/scrape/run-now", runNow);
  app.post("/api/scrape/run-now", runNow);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[http] unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
