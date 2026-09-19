import "dotenv/config";
import { createApp } from "./app.js";
import { startScrapeCron } from "./services/cron.js";
import { closeBrowser } from "./scraper/scrape.js";
import { disconnectDb } from "./db.js";

export { createApp };

const app = createApp();

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT ?? 4000);
  const server = app.listen(PORT, () => {
    console.log(`[http] price-tracker API listening on :${PORT}`);
    startScrapeCron();
  });

  async function shutdown(signal: string) {
    console.log(`[shutdown] received ${signal}, closing gracefully...`);
    server.close();
    await closeBrowser();
    await disconnectDb();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
