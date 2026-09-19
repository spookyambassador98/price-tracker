import { extractFromHtml, type ExtractedProduct } from "./extractor.js";

const TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS ?? 30000);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface ScrapeResult extends ExtractedProduct {
  ok: boolean;
  error: string | null;
}

type PlaywrightBrowser = {
  newContext: (options: Record<string, unknown>) => Promise<{
    route: (pattern: RegExp, handler: (route: { abort: () => Promise<void> }) => void) => Promise<void>;
    newPage: () => Promise<{
      goto: (url: string, options: { waitUntil: "domcontentloaded"; timeout: number }) => Promise<unknown>;
      waitForTimeout: (ms: number) => Promise<void>;
      content: () => Promise<string>;
    }>;
    close: () => Promise<void>;
  }>;
  close: () => Promise<void>;
};

let browserPromise: Promise<PlaywrightBrowser> | null = null;

function emptyResult(error: string): ScrapeResult {
  return {
    title: null,
    imageUrl: null,
    price: null,
    currency: null,
    inStock: true,
    strategy: "none",
    ok: false,
    error,
  };
}

function toResult(extracted: ExtractedProduct, error: string | null = null): ScrapeResult {
  if (extracted.price == null) {
    return { ...extracted, ok: false, error: error ?? "Не удалось найти цену на странице" };
  }
  return { ...extracted, ok: true, error: null };
}

async function scrapeWithFetch(url: string): Promise<ScrapeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) {
      return emptyResult(`HTTP ${res.status} при загрузке страницы`);
    }
    const html = await res.text();
    return toResult(extractFromHtml(html, url));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emptyResult(message);
  } finally {
    clearTimeout(timer);
  }
}

async function launchBrowser(): Promise<PlaywrightBrowser> {
  const isServerless = Boolean(process.env.VERCEL);
  if (isServerless) {
    const chromiumPack = (await import("@sparticuz/chromium")).default;
    const { chromium } = await import("playwright-core");
    chromiumPack.setGraphicsMode = false;
    return chromium.launch({
      args: chromiumPack.args,
      executablePath: await chromiumPack.executablePath(),
      headless: true,
    }) as unknown as PlaywrightBrowser;
  }

  const { chromium } = await import("playwright-core");
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (executablePath) {
    return chromium.launch({
      executablePath,
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    }) as unknown as PlaywrightBrowser;
  }

  try {
    return (await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    })) as unknown as PlaywrightBrowser;
  } catch {
    return chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    }) as unknown as PlaywrightBrowser;
  }
}

function getBrowser(): Promise<PlaywrightBrowser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    await browser?.close().catch(() => {});
    browserPromise = null;
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

async function scrapeWithPlaywright(url: string): Promise<ScrapeResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: UA,
    locale: "ru-RU",
    viewport: { width: 1366, height: 900 },
  });
  await context.route(/\.(png|jpe?g|gif|webp|svg|woff2?|mp4)(\?.*)?$/i, (route) => void route.abort());

  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForTimeout(1200);
    const html = await page.content();
    await context.close();
    const extracted = extractFromHtml(html, url);
    extracted.strategy = extracted.strategy === "none" ? "playwright" : `playwright+${extracted.strategy}`;
    return toResult(extracted);
  } catch (err) {
    await context.close().catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    return emptyResult(message);
  } finally {
    if (process.env.VERCEL) {
      await closeBrowser();
    }
  }
}

/**
 * Opens the given product URL, waits for the page to settle, and runs the
 * universal extractor against it. Tries a cheap HTML fetch first (covers
 * JSON-LD / Open Graph shops), then Playwright for client-rendered prices.
 */
export async function scrapeProductPage(url: string): Promise<ScrapeResult> {
  const fetched = await scrapeWithFetch(url);
  if (fetched.ok) return fetched;

  try {
    const rendered = await scrapeWithPlaywright(url);
    if (rendered.ok) return rendered;
    return {
      ...rendered,
      error: rendered.error ?? fetched.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fetched.price != null ? fetched : emptyResult(fetched.error ?? message);
  }
}
