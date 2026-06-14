# MercadosPortugues

Plataforma web de **comparação diária de preços** dos principais supermercados em Portugal:
Continente, Pingo Doce, Aldi, Intermarché, Lidl, Auchan e Minipreço.

O sistema faz scraping/fetch dos preços de madrugada, normaliza os dados e mostra qual o
supermercado mais barato para um **produto individual** ou para um **carrinho de compras** completo.

> **Estado atual:** a aplicação corre out-of-the-box com um repositório **em memória** alimentado
> por dados seed realistas (sem necessidade de base de dados). A persistência **PostgreSQL está
> implementada** (Drizzle + materialized view + sink de scraping com matching) e ativa-se com
> `USE_DB=true`. O scraper do Continente funciona em modo `dry-run` com fixtures, com o ponto de
> integração real claramente isolado.

---

## Stack

| Camada      | Tecnologia                                  |
| ----------- | ------------------------------------------- |
| Frontend    | Next.js 15 (App Router) + React 19 + Tailwind |
| Gráficos    | Recharts                                    |
| API         | Route Handlers do Next.js                   |
| Validação   | Zod                                         |
| Base dados  | PostgreSQL 16 (raw DDL + Drizzle ORM)       |
| Scraper     | TypeScript + fetch nativo (Node 20+)        |
| Testes      | Vitest                                      |
| Cron        | GitHub Actions (04:00 diário)               |

---

## Arranque rápido

```bash
npm install
npm run dev        # http://localhost:3000  (usa dados seed em memória)
```

Outros comandos:

```bash
npm test                 # 59 testes: parsing, matching, query-logic, repositório
npm run typecheck        # verificação de tipos
npm run lint             # ESLint (next)
npm run build            # build de produção
npm run scrape           # corre o pipeline de scraping (dry-run)
npm run scrape:continente
```

---

## Arquitetura

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API REST
│   │   ├── products/search   # GET pesquisa + preços ordenados
│   │   ├── products/[id]     # GET produto + ofertas
│   │   ├── products/[id]/history  # GET histórico 30 dias
│   │   ├── basket/compare    # POST comparação de carrinho
│   │   └── drops             # GET maiores baixas do dia
│   ├── page.tsx              # Home (pesquisa + maiores baixas)
│   ├── pesquisa/             # Resultados de pesquisa
│   ├── produto/[id]/         # Detalhe + gráfico de evolução
│   └── carrinho/             # Carrinho + comparação
├── components/               # SearchBar, ProductCard, PriceChart, BiggestDrops, BasketLink…
├── db/
│   ├── schema.ts             # Schema Drizzle (PostgreSQL)
│   ├── client.ts             # Pool pg + instância Drizzle (singleton)
│   ├── repository.ts         # Seletor de repositório (in-memory | postgres)
│   ├── repository-types.ts   # Contrato Repository + helpers (downsample)
│   ├── query-logic.ts        # Lógica de domínio partilhada (ofertas, carrinho, drops)
│   ├── in-memory-repository.ts
│   ├── postgres-repository.ts
│   ├── seed-data.ts          # Dados seed + 365 dias de histórico gerado
│   └── seed-db.ts            # Popula PostgreSQL (npm run db:seed)
├── lib/
│   ├── types.ts              # Tipos de domínio partilhados
│   ├── parsing.ts            # Quantidade/unidade, preço, €/kg | €/L
│   ├── matching.ts           # Algoritmo de normalização (EAN + fuzzy + veto de tamanho)
│   └── use-basket.ts         # Estado do carrinho (localStorage)
├── instrumentation.ts        # Regista o repositório PostgreSQL no arranque (USE_DB=true)
└── scrapers/
    ├── core/                 # BaseAdapter, HttpClient, DryRunSink, PostgresSink
    ├── adapters/continente.ts
    └── pipeline/run-daily.ts # Orquestrador do cron
db/
└── schema.sql                # DDL PostgreSQL completo (produção)
```

---

## 1. Base de dados

O esquema relacional está em [`db/schema.sql`](db/schema.sql) (DDL puro, fonte de verdade) e
espelhado em Drizzle ([`src/db/schema.ts`](src/db/schema.ts)).

Destaques de design:

- **`price_history` particionado por mês** (`PARTITION BY RANGE (captured_at)`) — mantém as queries
  de "últimos 30 dias" rápidas mesmo com milhares de inserts diários. A função
  `ensure_price_partition()` cria a partição do mês corrente automaticamente.
- **Materialized view `latest_prices`** com `effective_price = COALESCE(promo, regular)` — centraliza
  a regra "qual o preço que o cliente paga" e acelera pesquisa/carrinho.
- **`UNIQUE (supermarket_id, market_sku)`** e **`UNIQUE (product_market_id, captured_at)`** tornam o
  scraper **idempotente** (re-correr não duplica).
- **`pg_trgm` + `unaccent`** para matching difuso no próprio motor (índice GIN trigram).
- Colunas `base_unit` / `base_quantity` guardam a quantidade normalizada (g→kg, ml→L) — base do
  veto de tamanho no matching.

### Ligar a PostgreSQL real

```bash
docker compose up -d db        # cria a DB e aplica db/schema.sql automaticamente
cp .env.example .env           # define DATABASE_URL e USE_DB=true
npm run db:seed                # popula a DB com os dados seed + histórico
npm run dev                    # a app passa a ler de PostgreSQL
```

Como funciona a comutação:

- `getRepository()` devolve `InMemoryRepository` por defeito; com `USE_DB=true`, a
  `instrumentation.ts` regista a fábrica do `PostgresRepository` no arranque (o driver `pg`
  só é carregado neste modo).
- Ambas as implementações cumprem o mesmo contrato `Repository` (`src/db/repository-types.ts`)
  e partilham a lógica de domínio (`src/db/query-logic.ts`) — **a API e o frontend não mudam**.
- O `PostgresRepository` lê os preços atuais da materialized view `latest_prices` e o histórico
  de `price_history`; a pesquisa usa `pg_trgm`/`unaccent`.
- O pipeline de scraping escreve via `PostgresSink` (`USE_DB=true npm run scrape`): faz upsert das
  ofertas, corre o matching, insere o preço do dia (idempotente) e dá `REFRESH` à view.

---

## 2. Pipeline de scraping

Cada supermercado tem um **Adapter** que implementa `BaseAdapter` e produz `RawProduct`
normalizado. O `HttpClient` faz:

- **rotação de User-Agents**,
- **delay aleatório** entre pedidos (1.5–4s, configurável),
- **retry com backoff exponencial** em 429/5xx.

O orquestrador [`run-daily.ts`](src/scrapers/pipeline/run-daily.ts) corre todos os adapters ativos,
persiste em lotes e finaliza (em produção: corre matching + `REFRESH MATERIALIZED VIEW`).

### Adapter do Continente

Plataforma Salesforce Commerce Cloud. A estratégia preferida é interceptar a **API/grid interna**
(`Search-UpdateGrid` com `cgid`/`start`/`sz`) em vez de parsing de HTML bruto. O ponto de integração
está isolado em `fetchPage()`; em `dry-run` usa fixtures deterministas.

> **Passo zero antes de produção:** abrir o site → DevTools → Network (Fetch/XHR) → confirmar o
> endpoint, os parâmetros e o formato da resposta (são voláteis) e ajustar `gridUrl`/`fetchPage`.

### Cron

[`.github/workflows/daily-scrape.yml`](.github/workflows/daily-scrape.yml) dispara às **04:00 UTC**.
Alternativa: container Docker com cron próprio.

---

## 3. Normalização / Matching

Estratégia em cascata em [`src/lib/matching.ts`](src/lib/matching.ts):

1. **EAN / código de barras** — match determinístico, confiança `1.0`.
2. **Similaridade de nome** — combinação de Levenshtein (sobre tokens canónicos, sem acentos/stop
   words, ordenados) e Jaro-Winkler.
3. **Veto de tamanho/unidade** — `sameSize()` é um **bloqueio**, não um fator de score: "Leite 1L"
   nunca é igualado a "Leite 1.5L", mesmo com nomes idênticos.

Limiares: `≥ 0.92` junta automaticamente; `0.80–0.92` vai para fila de **revisão**; abaixo cria um
novo produto global (**orphan**).

---

## 4. API

| Método | Rota                          | Descrição                                              |
| ------ | ----------------------------- | ------------------------------------------------------ |
| GET    | `/api/products/search?q=`     | Pesquisa; preços de todos os mercados, do + barato     |
| GET    | `/api/products/:id`           | Produto global com todas as ofertas                    |
| GET    | `/api/products/:id/history`   | Histórico 30 dias agregado por supermercado            |
| POST   | `/api/basket/compare`         | Custo total do carrinho por mercado + vencedor         |
| GET    | `/api/drops`                  | Maiores baixas de preço do dia                         |

Exemplo:

```bash
curl "http://localhost:3000/api/products/search?q=leite"

curl -X POST http://localhost:3000/api/basket/compare \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productGlobalId":1,"quantity":2},{"productGlobalId":2,"quantity":1}]}'
```

---

## 5. UI/UX

- **Home** — pesquisa central + "As maiores baixas de preço do dia".
- **Cartão de produto** — foto, marca, nome e lista de supermercados com preço; o mais barato tem
  badge **"Melhor preço"**.
- **Detalhe** — tabela de ofertas + **gráfico de evolução** (Recharts, lazy).
- **Carrinho** — comparação por supermercado com destaque do vencedor (e aviso quando um mercado não
  tem todos os itens, para a comparação ser justa). Persistido em `localStorage`.

Mobile-first, com Tailwind.

---

## Aviso legal

Scraping de preços de retalho envolve Termos de Serviço e proteção de bases de dados
(Diretiva 96/9/CE). Este projeto foi desenhado como "bom cidadão" (1×/dia, delays, baixa frequência)
e respeita `robots.txt`. Para uso público, valida juridicamente e obtém autorização quando aplicável.

---

## Próximos passos

1. Confirmar o endpoint do Continente no DevTools e ativar o modo real (`SCRAPER_DRY_RUN=false`).
2. Adicionar o 2.º adapter (Pingo Doce/Auchan) — é onde o matching fuzzy ganha sentido.
3. Painel de revisão para matches na faixa `0.80–0.92` (`match_status='review'`).
4. Cache de resultados de pesquisa e rate limiting na API pública.
```
