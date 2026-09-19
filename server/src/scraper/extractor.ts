import { parseHTML } from "linkedom";

export interface ExtractedProduct {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  inStock: boolean;
  strategy: string;
}

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  "₽": "RUB",
  руб: "RUB",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "₴": "UAH",
  "₸": "KZT",
};

/**
 * Turns a raw price string ("12 990,00 ₽", "$1,299.99", "1299.99") into a number.
 * Handles both comma-decimal (RU/EU) and dot-decimal (US) formats heuristically.
 */
function parsePriceString(raw: string): number | null {
  if (!raw) return null;
  let s = raw.replace(/\s|\u00a0/g, "");
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 1 || decimals === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    if (decimals === 3) {
      s = s.replace(/\./g, "");
    }
  }

  const value = parseFloat(s);
  return Number.isFinite(value) ? value : null;
}

function detectCurrency(raw: string | null | undefined, fallback: string | null = null): string | null {
  if (!raw) return fallback;
  const upper = raw.toUpperCase();
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOL_MAP)) {
    if (raw.includes(symbol)) return code;
  }
  const isoMatch = upper.match(/\b(RUB|USD|EUR|GBP|UAH|KZT|BYN|CNY)\b/);
  if (isoMatch) return isoMatch[1];
  return fallback;
}

function flattenGraph(items: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (Array.isArray(record["@graph"])) out.push(...flattenGraph(record["@graph"]));
    else out.push(record);
  }
  return out;
}

function readAttr(el: Element | null, ...attrs: string[]): string | null {
  if (!el) return null;
  for (const attr of attrs) {
    const value = el.getAttribute(attr);
    if (value) return value;
  }
  return el.textContent?.trim() || null;
}

function absolutize(src: string | null, baseUrl: string): string | null {
  if (!src) return null;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

function extractFromJsonLd(document: Document): Partial<ExtractedProduct> | null {
  const blocks = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
    (n) => n.textContent || ""
  );

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of flattenGraph(candidates)) {
        const type = candidate["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct) continue;

        const offersRaw = candidate.offers;
        const offers = offersRaw
          ? Array.isArray(offersRaw)
            ? (offersRaw[0] as Record<string, unknown>)
            : (offersRaw as Record<string, unknown>)
          : null;

        const spec = offers?.priceSpecification as Record<string, unknown> | undefined;
        const price = offers?.price ?? spec?.price ?? offers?.lowPrice ?? null;
        const currency = (offers?.priceCurrency ?? spec?.priceCurrency ?? null) as string | null;
        const availability = typeof offers?.availability === "string" ? offers.availability : undefined;

        const image = candidate.image;
        const imageUrl = Array.isArray(image) ? String(image[0] ?? "") : image ? String(image) : null;

        if (price != null || candidate.name || imageUrl) {
          return {
            title: candidate.name ? String(candidate.name) : null,
            imageUrl: imageUrl || null,
            price: price != null ? parsePriceString(String(price)) : null,
            currency: detectCurrency(currency),
            inStock: availability ? !/OutOfStock/i.test(availability) : true,
          };
        }
      }
    } catch {
      // Malformed JSON-LD block; skip it and keep trying others.
    }
  }
  return null;
}

function extractFromMetaTags(document: Document): Partial<ExtractedProduct> | null {
  const get = (selector: string) => document.querySelector(selector)?.getAttribute("content") ?? null;
  const ogTitle = get('meta[property="og:title"]');
  const ogImage = get('meta[property="og:image"]');
  const ogPriceAmount = get('meta[property="og:price:amount"]') ?? get('meta[property="product:price:amount"]');
  const ogPriceCurrency =
    get('meta[property="og:price:amount"]') !== null
      ? get('meta[property="og:price:currency"]')
      : get('meta[property="product:price:currency"]');
  const twitterData1 = get('meta[name="twitter:data1"]');
  const availability = get('meta[property="product:availability"]');

  const priceRaw = ogPriceAmount ?? twitterData1;
  if (!priceRaw && !ogTitle) return null;

  return {
    title: ogTitle,
    imageUrl: ogImage,
    price: priceRaw ? parsePriceString(priceRaw) : null,
    currency: detectCurrency(ogPriceCurrency ?? priceRaw),
    inStock: availability ? !/out of stock/i.test(availability) : true,
  };
}

function extractFromMicrodata(document: Document): Partial<ExtractedProduct> | null {
  const readProp = (name: string) => {
    const el = document.querySelector(`[itemprop="${name}"]`);
    return readAttr(el, "content", "value");
  };

  const name = readProp("name");
  const price = readProp("price");
  const priceCurrency = readProp("priceCurrency");
  const image = readProp("image");
  const availability = readProp("availability");

  if (!price && !name) return null;
  return {
    title: name,
    imageUrl: image,
    price: price ? parsePriceString(price) : null,
    currency: detectCurrency(priceCurrency ?? price),
    inStock: availability ? !/OutOfStock/i.test(availability) : true,
  };
}

function extractFromHeuristics(document: Document): Partial<ExtractedProduct> | null {
  const priceSelector =
    '[class*="price" i]:not([class*="old" i]):not([class*="was" i]):not(del):not(s), ' +
    '[id*="price" i], [data-testid*="price" i], [class*="cost" i]';
  const nodes = Array.from(document.querySelectorAll(priceSelector));
  const text =
    nodes
      .map((n) => n.textContent?.trim() || "")
      .find((t) => /\d/.test(t) && t.length < 40) ?? null;

  const title = document.querySelector("h1")?.textContent?.trim() ?? document.title ?? null;
  const image =
    document.querySelector('img[class*="product" i]')?.getAttribute("src") ??
    document.querySelector("img")?.getAttribute("src") ??
    null;

  if (!text) return null;
  return {
    title,
    imageUrl: image,
    price: parsePriceString(text),
    currency: detectCurrency(text),
    inStock: true,
  };
}

/**
 * Runs extraction strategies in order of reliability and merges their results,
 * preferring earlier (more structured) sources but filling gaps from later ones.
 */
export function extractFromHtml(html: string, pageUrl: string): ExtractedProduct {
  const { document } = parseHTML(html);

  const strategies: Array<[string, () => Partial<ExtractedProduct> | null]> = [
    ["json-ld", () => extractFromJsonLd(document)],
    ["meta-tags", () => extractFromMetaTags(document)],
    ["microdata", () => extractFromMicrodata(document)],
    ["heuristic", () => extractFromHeuristics(document)],
  ];

  const merged: ExtractedProduct = {
    title: null,
    imageUrl: null,
    price: null,
    currency: null,
    inStock: true,
    strategy: "none",
  };

  for (const [name, run] of strategies) {
    let result: Partial<ExtractedProduct> | null = null;
    try {
      result = run();
    } catch {
      continue;
    }
    if (!result) continue;

    if (merged.price == null && result.price != null) {
      merged.price = result.price;
      merged.currency = result.currency ?? merged.currency;
      merged.strategy = merged.strategy === "none" ? name : `${merged.strategy}+${name}`;
    }
    if (!merged.title && result.title) merged.title = result.title;
    if (!merged.imageUrl && result.imageUrl) merged.imageUrl = result.imageUrl;
    if (!merged.currency && result.currency) merged.currency = result.currency;
    if (result.inStock === false) merged.inStock = false;

    if (merged.price != null && merged.title && merged.imageUrl) break;
  }

  if (!merged.currency) merged.currency = "RUB";
  merged.imageUrl = absolutize(merged.imageUrl, pageUrl);
  return merged;
}
