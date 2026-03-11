# ASR — Agentic Sales Rep for Shopify  v3
### Полное руководство по установке на Gadget.dev + GitHub (март 2026)

> **Работает из любого браузера. Не нужен локальный Node.js, сервер или терминал.**
> Gadget.dev — бессерверная платформа для Shopify-приложений.
> **v3: только OpenAI** — Anthropic полностью убран. Один ключ, один счёт.

---

## МОДЕЛИ AI В ПРОЕКТЕ

| Задача | Модель | Причина |
|--------|--------|---------|
| Извлечение спеков (`update.js` call 1) | `gpt-4o-mini` | Structured Output, быстрый, дешёвый (~$0.0001/товар) |
| Переписывание описания (`update.js` call 2) | `gpt-4o-mini` | Markdown rewrite, fast (~$0.0002/товар) |
| A2A симуляция покупки (`a2ASimulation/create.js`) | `gpt-4o` | tool_use с enum-схемой, нужна точная логика рассуждений |

**Итого стоимость:** ~$0.80 за 1000 товаров (оптимизация) + ~$0.01 за A2A-симуляцию.

---

## СТРУКТУРА ПРОЕКТА

```
asr-agentic-sales-rep/               ← Название репозитория на GitHub
│
├── .env.example                     ← Шаблон переменных окружения (без реальных ключей)
├── gadget.config.json               ← Конфиг платформы Gadget.dev (env vars, scopes, webhooks)
├── package.json                     ← Зависимости (только openai, gadget, polaris)
├── schema.gadget.ts                 ← Схема БД: расширения моделей Gadget
├── shopify.app.toml                 ← Shopify CLI конфиг (2026-01 format)
│
├── api/
│   ├── actions/
│   │   └── bulkOptimize.js          ← Глобальный экшен: батч-оптимизация каталога
│   │
│   ├── models/
│   │   ├── shopifyProduct/
│   │   │   └── actions/
│   │   │       ├── create.js        ← Триггер при создании нового товара
│   │   │       └── update.js        ← Основной pipeline: 2x gpt-4o-mini + метафилды Shopify
│   │   │
│   │   ├── a2ASimulation/
│   │   │   └── actions/
│   │   │       └── create.js        ← A2A симуляция покупки (gpt-4o tool_use)
│   │   │
│   │   └── citationEvent/
│   │       └── actions/
│   │           └── create.js        ← Запись упоминаний бренда в AI-поисковиках
│   │
│   └── routes/
│       ├── POST-optimize.js         ← HTTP endpoint: внешний вызов оптимизации
│       └── POST-webhook-shopify.js  ← Shopify webhook: HMAC-верификация + триггер
│
└── web/
    ├── api.js                       ← Gadget API client (React)
    ├── routes/
    │   └── index.jsx                ← Точка входа: Polaris AppProvider + Dashboard
    └── components/
        ├── ASRDashboard.jsx         ← Главный дашборд (каталог, статистика, навигация)
        ├── ProductDetail.jsx        ← Детальный вид товара + ручные спеки
        └── CitationTracker.jsx      ← Трекер упоминаний в AI-поисковиках
```

---

## ДЕПЛОЙ: ПОШАГОВАЯ ИНСТРУКЦИЯ

### ШАГ 0 — Что тебе нужно (5 минут подготовки)

Открой четыре вкладки в браузере:

| Вкладка | URL | Действие |
|---------|-----|---------|
| 1 | https://gadget.dev | Создать аккаунт (бесплатно) |
| 2 | https://partners.shopify.com | Создать партнёрский аккаунт (бесплатно) |
| 3 | https://platform.openai.com/api-keys | Получить API ключ |
| 4 | Этот GitHub репозиторий | Копировать код |

---

### ШАГ 1 — Создай приложение в Gadget.dev

1. Открой **https://gadget.dev** → войди или зарегистрируйся
2. Нажми кнопку **"New app"** (синяя, верхний правый угол)
3. В появившемся диалоге:
   - Выбери шаблон: **"Shopify App"** ← обязательно, не выбирай другой
   - Поле "App name": введи `asr-agentic-sales-rep`
   - Нажми **"Create"**
4. Подожди ~10 секунд. Gadget создаст пустое приложение и откроет редактор.

> Ты окажешься на странице редактора с левым меню: Data, Actions, Routes, Frontend, Settings, Logs.

---

### ШАГ 2 — Установи зависимость OpenAI

1. В левом меню Gadget.dev найди раздел **"Shell"** (иконка терминала внизу меню)
2. Нажми на него — откроется терминал прямо в браузере
3. Введи команду и нажми Enter:
   ```bash
   yarn add openai
   ```
4. Подожди ~30 секунд. Ты увидишь вывод вида `success Saved 1 new dependency`.

> Больше ничего устанавливать не нужно. `@shopify/polaris`, `react`, `gadget-server` уже включены в шаблон.

---

### ШАГ 3 — Добавь переменные окружения

1. В левом меню Gadget.dev нажми **"Settings"** (шестерёнка внизу)
2. Открой раздел **"Environment Variables"**
3. Нажми **"+ Add variable"** и добавь следующие:

#### OPENAI_API_KEY (обязательно)
- Key: `OPENAI_API_KEY`
- Value: твой ключ с https://platform.openai.com/api-keys
  - Зайди на сайт → "Create new secret key" → скопируй (начинается с `sk-...`)
- Поставь галочку **"Secret"** (скрывает значение в логах)
- Нажми **"Add"**

#### SHOPIFY_WEBHOOK_SECRET (обязательно, добавишь позже)
- Key: `SHOPIFY_WEBHOOK_SECRET`
- Value: `placeholder` (заменишь на шаге 7 после подключения Shopify)
- Нажми **"Add"**

#### ASR_WEBHOOK_SECRET (опционально)
- Key: `ASR_WEBHOOK_SECRET`
- Value: любая случайная строка из 32+ символов (нужна для внешних вызовов через Zapier/cron)
- Например: `my-secret-key-change-this-to-random-32chars`
- Нажми **"Add"**

---

### ШАГ 4 — Создай поля в модели shopifyProduct

В Gadget.dev → **"Data"** → найди в списке **"shopifyProduct"** → нажми на неё.

Нажми **"+ Add field"** и добавь каждое из следующих полей:

| Field name | Type | Default | Описание |
|------------|------|---------|----------|
| `agenticScore` | Number | `0` | Оценка готовности для AI-агентов (0–100) |
| `factSummary` | String → выбери "Long Text" | — | GPT-переработанное описание товара |
| `technicalSpecsJson` | JSON | `{}` | Извлечённые технические характеристики |
| `isAgentReady` | Boolean | `false` | Флаг: товар готов для покупки агентом |
| `lastOptimizedAt` | Date Time | — | Время последней оптимизации |
| `originalBodyHtml` | String → выбери "Long Text" | — | Оригинальное описание (для rollback) |

> Для каждого поля: нажми "+ Add field" → введи Field name → выбери Type → нажми "Add".

---

### ШАГ 5 — Создай модель a2ASimulation

1. В разделе **"Data"** нажми **"+ New Model"**
2. Введи название: `a2ASimulation` (точно так, с заглавной A и S)
3. Нажми **"Create"**
4. Добавь поля:

| Field name | Type | Значения enum / настройки |
|------------|------|--------------------------|
| `product` | Has One → BelongsTo | Выбери модель: `shopifyProduct` |
| `agentType` | Enum | Значения: `Perplexity`, `SearchGPT`, `GeminiShopping`, `GPT4Agent` |
| `resultStatus` | Enum | Значения: `PASS`, `SOFT_FAIL`, `HARD_FAIL` |
| `failureReason` | Enum | Значения: `MISSING_VARIANT_ID`, `MISSING_WEIGHT`, `MISSING_DIMENSIONS`, `MISSING_MATERIAL`, `AMBIGUOUS_DESCRIPTION`, `NO_STRUCTURED_DATA`, `NONE` |
| `failureDetail` | String → Long Text | — |
| `agentPayloadSnapshot` | JSON | — |
| `autoReoptimized` | Boolean | Default: `false` |
| `runAt` | Date Time | — |

---

### ШАГ 6 — Создай модель citationEvent

1. В разделе **"Data"** нажми **"+ New Model"**
2. Введи название: `citationEvent`
3. Нажми **"Create"**
4. Добавь поля:

| Field name | Type | Значения enum |
|------------|------|--------------|
| `shop` | BelongsTo | Модель: `shopifyShop` |
| `sourceEngine` | Enum | Значения: `Perplexity`, `SearchGPT`, `GeminiAI`, `Copilot` |
| `triggerQuery` | String | — |
| `citationSnippet` | String → Long Text | — |
| `citedProduct` | BelongsTo | Модель: `shopifyProduct` |
| `detectedAt` | Date Time | — |

---

### ШАГ 7 — Вставь код backend-файлов

Для каждого файла ниже:
1. Открой файл из этого репозитория (GitHub → нажми на файл → нажми "Raw" → скопируй весь текст)
2. В Gadget.dev перейди по указанному пути
3. Удали существующий код (если есть) и вставь скопированный

#### Actions на модели shopifyProduct:
| Файл в репозитории | Путь в Gadget.dev |
|-------------------|-------------------|
| `api/models/shopifyProduct/actions/create.js` | Data → shopifyProduct → Actions → **create** → вкладка "Code" |
| `api/models/shopifyProduct/actions/update.js` | Data → shopifyProduct → Actions → **update** → вкладка "Code" |

#### Actions на модели a2ASimulation:
| Файл в репозитории | Путь в Gadget.dev |
|-------------------|-------------------|
| `api/models/a2ASimulation/actions/create.js` | Data → a2ASimulation → Actions → **create** → вкладка "Code" |

#### Actions на модели citationEvent:
| Файл в репозитории | Путь в Gadget.dev |
|-------------------|-------------------|
| `api/models/citationEvent/actions/create.js` | Data → citationEvent → Actions → **create** → вкладка "Code" |

#### Global Action (bulkOptimize):
1. В левом меню нажми **"Actions"**
2. Нажми **"+"** → **"Global Action"**
3. Название: `bulkOptimize`
4. Нажми **"Create"**
5. В поле кода вставь содержимое `api/actions/bulkOptimize.js`

#### HTTP Routes:
1. В левом меню нажми **"Routes"**
2. Нажми **"+"** → выбери метод **POST**, path введи `/optimize`
3. Вставь содержимое `api/routes/POST-optimize.js`
4. Снова нажми **"+"** → метод **POST**, path `/webhook/shopify`
5. Вставь содержимое `api/routes/POST-webhook-shopify.js`

---

### ШАГ 8 — Вставь код frontend-файлов

В левом меню нажми **"Frontend"** → откроется файловый менеджер.

| Файл в репозитории | Путь в Gadget.dev Frontend |
|-------------------|-----------------------------|
| `web/api.js` | Нажми на `web/api.js` (или создай: "+ New File" → `api.js`) |
| `web/routes/index.jsx` | `web/routes/index.jsx` |
| `web/components/ASRDashboard.jsx` | Создай папку `components` → `ASRDashboard.jsx` |
| `web/components/ProductDetail.jsx` | `web/components/ProductDetail.jsx` |
| `web/components/CitationTracker.jsx` | `web/components/CitationTracker.jsx` |

> Для создания нового файла: нажми "+" рядом с папкой → введи имя файла → нажми Enter → вставь код.

---

### ШАГ 9 — Подключи Shopify магазин

1. В левом меню Gadget.dev нажми **"Connections"**
2. Найди **"Shopify"** → нажми **"Connect"**
3. Тебя перенаправит в Shopify Partners
4. Выбери партнёрский аккаунт → **"Select store"** → выбери тестовый магазин (или создай Development Store)
5. Shopify покажет список разрешений, которые запрашивает приложение
6. Нажми **"Install"**
7. После установки вернись в Gadget.dev → Connections → Shopify
8. Найди раздел **"Webhooks"** → скопируй **"Signing secret"**
9. Перейди в Settings → Environment Variables → найди `SHOPIFY_WEBHOOK_SECRET`
10. Замени значение `placeholder` на скопированный секрет → нажми **"Save"**

---

### ШАГ 10 — Деплой в production

1. В правом верхнем углу Gadget.dev нажми **"Deploy to Production"**
2. Подожди ~60 секунд — Gadget соберёт и задеплоит приложение
3. После деплоя твоё приложение будет доступно по адресу:
   ```
   https://asr-agentic-sales-rep.gadget.app
   ```

---

### ШАГ 11 — Первый запуск

1. В Shopify Admin (твой тестовый магазин) → **Apps** → найди **"Agentic Sales Rep"** → открой
2. Ты увидишь дашборд с каталогом товаров
3. Нажми кнопку **"Optimize All"** — приложение начнёт оптимизацию всего каталога
4. Каждый товар получит оценку (0–100). Цель: 70+
5. Нажми **"Simulate"** на любом товаре → выбери агента → нажми **"Run Simulation"**
6. Через 5–10 секунд увидишь результат: PASS / SOFT_FAIL / HARD_FAIL

---

## КАК ЭТО РАБОТАЕТ

```
Shopify webhook: product/create или product/update
        ↓
Gadget Action: shopifyProduct.update
        ↓
  GPT-4o-mini Call 1: Structured Output
  → Извлекает { weight, dimensions, material, sku, compatibility, ... }
  → JSON гарантирован схемой, без парсинга
        ↓
  GPT-4o-mini Call 2: Markdown rewrite
  → Генерирует: таблица спеков + 2 предложения + <!-- AGENT_DATA JSON-LD -->
        ↓
  Расчёт agenticScore (0–100)
  isAgentReady = score >= 70
        ↓
  Запись в Shopify metafields:
    asr/agentic_score, asr/technical_specs, asr/is_agent_ready
        ↓
  Сохранение в Gadget DB
```

```
Dashboard: нажми "Simulate"
        ↓
Gadget Action: a2ASimulation.create
        ↓
  Собирает "agent view" payload (что видит агент)
        ↓
  GPT-4o tool_call: report_simulation_result (обязательный вызов инструмента)
  → Возвращает: { result_status, failure_reason, confidence_score, ... }
        ↓
  Если HARD_FAIL на data-поле → авто-ре-оптимизация
        ↓
  Сохранение в a2ASimulation таблицу
```

---

## СТОИМОСТЬ ИСПОЛЬЗОВАНИЯ

| Операция | Модель | Стоимость |
|----------|--------|-----------|
| Оптимизация 1 товара | gpt-4o-mini × 2 | ~$0.0008 |
| Оптимизация 1000 товаров | gpt-4o-mini × 2000 | ~$0.80 |
| A2A симуляция 1 товара | gpt-4o × 1 | ~$0.005–0.01 |
| A2A симуляция 1000 раз | gpt-4o × 1000 | ~$5–10 |
| Gadget.dev (бесплатный план) | Free tier: 3000 actions/день | $0 (до ~1500 товаров/день) |

> Anthropic убран в v3 — платишь только OpenAI.

---

## ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ

**Q: Нужно ли знать программирование?**
Нет. Весь код готов. Нужно только копировать и вставлять.

**Q: Что если Gadget.dev выдаёт ошибку "Cannot find module 'openai'"?**
Значит, не выполнен Шаг 2. Зайди в Shell и выполни `yarn add openai`.

**Q: Как запустить автоматическую ночную оптимизацию?**
В файле `api/actions/bulkOptimize.js` раскомментируй строку:
```js
// schedule: [{ cron: "0 2 * * *" }],
```
Это запустит оптимизацию каждую ночь в 2:00 UTC.

**Q: Как смотреть логи и ошибки?**
Gadget.dev → **Logs** (левое меню). Все ошибки записываются с полным контекстом.

**Q: Как подключить второй Shopify магазин?**
Connections → Shopify → "Add another shop".

**Q: Что такое A2A симуляция?**
Приложение запускает GPT-4o, который притворяется агентом (Perplexity, SearchGPT и т.д.) и пытается "купить" товар через Shopify Agentic Storefront API. Если товар проваливает симуляцию — приложение автоматически его переоптимизирует.

**Q: Где взять Shopify тестовый магазин?**
Shopify Partners → Stores → "Add store" → "Development store". Бесплатно.

---

## ПОДДЕРЖКА И ОБНОВЛЕНИЯ

- Документация Gadget.dev: https://docs.gadget.dev
- Shopify App Development: https://shopify.dev/docs/apps
- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- Shopify Agentic Storefront API: https://shopify.dev/docs/api/storefront (2026-01)
