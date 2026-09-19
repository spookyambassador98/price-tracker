import cron from "node-cron";
import { prisma } from "../db.js";
import { checkProductPrice } from "./checkPrice.js";

const CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY ?? 2);

/** Runs `worker` over `items` with at most `limit` in flight at once. */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function runScrapeCycle(): Promise<{ checked: number; alerts: number; errors: number }> {
  const products = await prisma.product.findMany({ where: { status: { not: "PAUSED" } } });

  let alerts = 0;
  let errors = 0;

  await runWithConcurrency(products, CONCURRENCY, async (product) => {
    try {
      const result = await checkProductPrice(product);
      if (result.alertSent) alerts += 1;
      if (result.product.status === "ERROR") errors += 1;
    } catch (err) {
      errors += 1;
      console.error(`[cron] failed to check product ${product.id}:`, err);
    }
  });

  console.log(`[cron] cycle complete — checked ${products.length}, alerts ${alerts}, errors ${errors}`);
  return { checked: products.length, alerts, errors };
}

/** Registers the hourly (configurable) job. Call once at server startup. */
export function startScrapeCron(): void {
  const expression = process.env.SCRAPE_CRON ?? "0 * * * *";
  if (!cron.validate(expression)) {
    console.warn(`[cron] invalid SCRAPE_CRON "${expression}", falling back to hourly`);
  }
  const schedule = cron.validate(expression) ? expression : "0 * * * *";

  cron.schedule(schedule, () => {
    runScrapeCycle().catch((err) => console.error("[cron] cycle threw:", err));
  });

  console.log(`[cron] scheduled price checks with expression "${schedule}"`);
}
