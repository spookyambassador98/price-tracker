# Hourly price checks (production)

Vercel Hobby не даёт hourly cron. Два рабочих варианта:

## Вариант A — GitHub Actions (рекомендуется)

**Секреты уже добавлены** в репозиторий (`APP_URL`, `CRON_SECRET`).

Осталось один раз положить workflow-файл:

1. Открой: https://github.com/spookyambassador98/price-tracker/new/master?filename=.github/workflows/hourly-scrape.yml
2. Скопируй содержимое из [`scripts/hourly-scrape.workflow.yml`](../scripts/hourly-scrape.workflow.yml)
3. Commit → **Commit directly to the master branch**

Проверка: **Actions** → **Hourly price check** → **Run workflow**.

Или из терминала (один раз дать `workflow` scope токену):

```bash
gh auth refresh -h github.com -s workflow
git push origin master
```

---

## Вариант B — cron-job.org

1. Регистрация: https://console.cron-job.org/signup
2. **Cronjobs** → **Create cronjob**
3. **URL:** `https://price-tracker-psi-red.vercel.app/api/scrape/run-now`
4. **Schedule:** Every hour (`0 * * * *`)
5. **Request method:** POST
6. **Headers** (Add header):
   - Name: `Authorization`
   - Value: `Bearer <CRON_SECRET>` — значение из Vercel env `CRON_SECRET`
7. Save → **Enable**

Проверка: кнопка **Run now** в cron-job.org, затем на дашборде обновится `lastCheckedAt` у товаров.

---

## Ручной ping (отладка)

```bash
curl -X POST \
  -H "Authorization: Bearer <CRON_SECRET>" \
  https://price-tracker-psi-red.vercel.app/api/scrape/run-now
```

Ответ: `{"checked":N,"alerts":M,"errors":K}`
