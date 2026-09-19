# Ценовой радар — трекер цен на маркетплейсах

Скрапит страницу товара по ссылке (универсальный парсер: JSON-LD / Open Graph /
микроразметка / эвристика по CSS-классам — работает на большинстве
интернет-магазинов без привязки к конкретной площадке), раз в час проверяет
цену повторно, хранит историю в PostgreSQL и уведомляет по email и/или
браузерным push (Web Push API), когда цена падает ниже заданного порога.

## Стек

- **Backend**: Node.js + TypeScript, Express, Playwright (скрапинг), Prisma + PostgreSQL, node-cron, Nodemailer, web-push.
- **Frontend**: React + Vite + TypeScript, Chart.js (график истории цены), GSAP + Lenis (motion).

## Структура

```
price-tracker/
  server/     # API + скрапер + cron
  client/     # React-дашборд
  api/        # Vercel serverless entry
  docker-compose.yml   # Postgres для локальной разработки
```

## Запуск

### 1. База данных

```bash
docker compose up -d
```

Или укажите Neon / любой PostgreSQL в `server/.env` (`DATABASE_URL` и `DIRECT_DATABASE_URL`).

### 2. Backend

```bash
cd server
cp .env.example .env      # проверьте DATABASE_URL, SMTP_*, VAPID_*
npm install
npx web-push generate-vapid-keys   # вставьте ключи в .env, если нужен Web Push
npm run prisma:migrate -- --name init
npm run dev                # http://localhost:4000
```

Локально backend сам поднимет cron (по умолчанию — каждый час, `SCRAPE_CRON` в `.env`).
В проде часовую проверку дергает GitHub Action (`/.github/workflows/hourly-scrape.yml`).

### 3. Frontend

```bash
cd client
cp .env.example .env       # VITE_API_URL можно оставить пустым — Vite проксирует /api
npm install
npm run dev                 # http://localhost:5173
```

### 4. Email-уведомления

В `.env` backend'а укажите SMTP (подойдёт SendGrid: `host=smtp.sendgrid.net`,
`user=apikey`, `pass=<API KEY>`). Письмо уходит на `notifyEmail`, указанный при
добавлении товара.

### 5. Web Push

1. Сгенерируйте ключи: `npx web-push generate-vapid-keys` (в папке `server`).
2. Впишите `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` в `server/.env`.
3. Откройте дашборд, разрешите уведомления в браузере — подписка сохранится
   в БД, и при падении цены браузер получит push даже если вкладка закрыта
   (сервис-воркер `client/public/sw.js`).

## Как добавить товар

На дашборде — поле «Ссылка на товар» + опционально «Порог цены» и email.
Сервис сразу же скрапит страницу разово, чтобы показать текущую цену, не
дожидаясь часового cron.

## Универсальный парсер

`server/src/scraper/extractor.ts` пробует по очереди:

1. `<script type="application/ld+json">` со схемой `Product`/`Offer`.
2. Open Graph / `product:price:*` мета-теги.
3. Микроразметку `itemprop="price"`.
4. Эвристику: первый текстовый узел с классом/id, похожим на `price`.

Сначала идёт обычный HTTP-запрос (этого хватает магазинам с JSON-LD / Open Graph).
Если цены в сыром HTML нет — поднимается Playwright и рендерит страницу.

Если для площадки с антибот-защитой (Ozon, Wildberries, Amazon) парсер не
находит цену — в `lastError` товара будет причина.
