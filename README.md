# MercadosPortugues

Comparador **diário e independente de preços de supermercados** em Portugal: Continente, Pingo Doce,
Auchan, Lidl, Aldi, Intermarché e Mercadona (o Minipreço está registado como inativo, integrado na rede
Auchan).

Todas as manhãs um pipeline recolhe os preços das lojas online, liga o mesmo produto entre cadeias
(EAN + nome normalizado + veto de tamanho) e guarda o histórico. O site mostra, para cada produto e para
um **carrinho completo**, onde fica mais barato — com evolução de preços, descidas do dia, ranking de
supermercados e promoções.

> **Estado:** por defeito corre em **modo demo** (dados seed em memória). Sem PostgreSQL, `npm run scrape`
> com `SCRAPER_DRY_RUN=false` grava um catálogo real em `data/snapshots/live-catalog.json` e o site passa
> a mostrar esses preços e fotos. Com Docker, `USE_DB=true` persiste em PostgreSQL.

---

## Stack

| Camada     | Tecnologia                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router, RSC) + React 19 + Tailwind CSS  |
| Gráficos   | Recharts                                                |
| API        | Route Handlers (cache TTL + rate limiting em memória)   |
| Validação  | Zod                                                     |
| Base dados | PostgreSQL 16 (DDL puro + Drizzle ORM)                  |
| Scraper    | TypeScript + `fetch` nativo (Node 20+), `tsx`           |
| Testes     | Vitest                                                  |
| Cron       | GitHub Actions (04:00 UTC) ou Docker Compose            |

---

## Arranque rápido

```bash
npm install
npm run dev        # http://localhost:3000 — modo demo (dados em memória)
```

```bash
npm test                 # testes unitários
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint (next)
npm run build            # build de produção
npm run scrape           # pipeline (dry-run / fixtures por defeito)
npm run scrape -- --only=continente,auchan
```

### Preços reais neste PC (sem Docker / PostgreSQL)

```bash
cp .env.example .env     # SCRAPER_DRY_RUN=false, USE_DB=false
npm run scrape           # Continente, Pingo Doce, Auchan, Mercadona → data/snapshots/live-catalog.json
npm run dev              # o site lê o ficheiro em vez dos dados demo
```

Reinicia o `next dev` depois de cada scrape para recarregar o catálogo. Lidl, Aldi e Intermarché não
têm catálogo online completo — ficam inativos até haver importação de folhetos.

### Com PostgreSQL

```bash
docker compose up -d db          # cria a DB e aplica db/schema.sql
cp .env.example .env             # USE_DB=true, DATABASE_URL, ADMIN_TOKEN, NEXT_PUBLIC_SITE_URL
npm run db:seed                  # popula com dados seed + histórico
npm run dev
```

### Tudo em Docker (app + DB)

```bash
docker compose up -d --build                                   # app em http://localhost:3000
docker compose --profile scrape run --rm scraper npm run db:seed   # seed inicial (uma vez)
docker compose --profile scrape run --rm scraper               # correr o pipeline manualmente
```

Para agendar no host: `0 4 * * * cd /caminho && docker compose --profile scrape run --rm scraper`.

### Monitorização (uptime + frescura dos dados)

O endpoint `GET /api/health` devolve `status` (`ok` | `degraded` | `error`), `version`,
`dataSource`, `lastCapturedAt` e `stale` (`true` quando há mais de 2 dias sem preços novos).

Liga um monitor externo (Uptime Kuma, Better Stack, Healthchecks.io) a
`https://o-teu-dominio/api/health` com duas condições de alerta:

1. HTTP diferente de 200, ou `status: "error"`;
2. `stale: true` (o scrape corre mas não produz dados — ex.: sites mudaram o layout).

Exemplo com cron + curl (alerta quando stale ou em erro):

```bash
curl -sf https://o-teu-dominio/api/health | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.exit(j.status==='ok'&&!j.stale?0:1)})" \
  || echo "ALERTA: site em baixo ou dados desatualizados"
```

As falhas do workflow diário também geram notificação do GitHub para quem ativar
"Actions" em Settings → Notifications (ver cabeçalho de `.github/workflows/daily-scrape.yml`).

### Backup da base de dados

O volume `mp_pgdata` guarda tudo. Sem backup, perder o VPS = perder o histórico.
Cron diário no host (03:00, antes do scrape das 04:00):

```bash
0 3 * * * docker compose exec -T db pg_dump -U mp_user mercadosportugues | gzip > /backups/mp-$(date +\%F).sql.gz
# reter 14 dias:
0 3 * * * find /backups -name 'mp-*.sql.gz' -mtime +14 -delete
```

Restauro (testar numa DB à parte antes de precisar):

```bash
gunzip -c /backups/mp-2026-01-01.sql.gz | docker compose exec -T db psql -U mp_user -d mercadosportugues
npm run db:check   # valida que ficou consistente
```

Idealmente, sincroniza `/backups` para fora do servidor (rsync/S3) — backup no mesmo disco não é backup.

### Migrações (evoluir o schema sem ALTER manual)

Duas vias de provisionamento, ambas suportadas:

| Via | Quando | Como |
| --- | ------ | ---- |
| `db/schema.sql` | Docker local / VPS com compose (volumes novos) | aplicado automaticamente pelo `docker-entrypoint-initdb.d` |
| `db/migrations` | DBs geridas (Neon/Supabase) ou DBs existentes | `npm run db:migrate` (Drizzle) |

Fluxo para alterar o schema:

```bash
# 1. Edita src/db/schema.ts (e db/schema.sql se envolver extras PG:
#    extensoes, particionamento, views, funcoes)
npm run db:generate   # cria a migracao em db/migrations
# 2. Revê o SQL gerado; extras PG vao num ficheiro 00NN_* manual + entrada no meta/_journal.json
npm run db:migrate    # aplica (DATABASE_URL)
npm run db:check      # valida extensoes, tabelas, view e funcao
```

O workflow diário faz `db:check` → `db:migrate` (só se o check falhar) → `db:check`, por isso
DBs docker (já com schema) saltam o migrate e DBs geridas vazias são migradas automaticamente.

---

## Páginas

| Rota                    | Conteúdo                                                                        |
| ----------------------- | ------------------------------------------------------------------------------- |
| `/`                     | Pesquisa, data real da última recolha, maior descida, líder do ranking, categorias, destaques |
| `/pesquisa`             | Catálogo com filtros na URL (categoria, supermercado, promoções), ordenação e paginação |
| `/produto/[id]`         | Ofertas por supermercado, diferença vs. mais barato, histórico 30d–1 ano com mín/máx/média, relacionados, JSON-LD `Product` |
| `/promocoes`            | Descidas do dia + todos os produtos em promoção ordenados por desconto          |
| `/categorias`, `/categoria/[slug]` | Visão por categoria com contagens e amostra; catálogo filtrado          |
| `/supermercados`, `/supermercado/[slug]` | Ranking (quota de "mais barato", índice de preço) e página por cadeia |
| `/carrinho`             | Comparação do cabaz por supermercado, produtos em falta, poupança, **partilha por URL** (`?itens=1x2,5`) |
| `/sobre`                | Como funciona, FAQ, API                                                         |
| `/admin`, `/admin/revisao` | Dashboard (stats, saúde do scraping por supermercado, histórico de execuções) e revisão de matches |

Também: `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, ícones e imagem Open Graph gerados em runtime;
`loading.tsx`/`error.tsx`/`not-found.tsx`; tema claro/escuro.

---

## Arquitetura

```
src/
├── app/                        # App Router (páginas acima + API)
│   └── api/
│       ├── products/search|browse|[id]|[id]/history
│       ├── basket/compare      # POST
│       ├── drops, supermarkets, categories, stats, health
│       └── admin/scrapes, admin/matches/review[/…]
├── components/
│   ├── layout/                 # SiteHeader, MainNav, MobileNav, SiteFooter
│   ├── catalog/                # CatalogBrowser (filtros por URL + paginação), SortSelect
│   ├── ui/                     # Badge, SupermarketDot/Chip/Avatar, SectionHeading, EmptyState,
│   │                           # Pagination, StatCard, Skeleton
│   └── …                       # ProductCard, PriceChart, InteractivePriceHistory, BiggestDrops, …
├── db/
│   ├── schema.ts               # Drizzle (espelha db/schema.sql)
│   ├── repository-types.ts     # Contrato Repository
│   ├── query-logic.ts          # Domínio partilhado: ofertas, carrinho, drops, browse, stats
│   ├── in-memory-repository.ts # Modo demo
│   ├── postgres-repository.ts  # Produção
│   └── seed-data.ts / seed-db.ts
├── lib/
│   ├── types.ts, format.ts, parsing.ts, matching.ts
│   ├── data.ts                 # Loaders server-side com cache curta (60 s)
│   ├── browse-url.ts           # Estado de filtros ⇄ URL
│   ├── basket-share.ts         # Codificação do carrinho para partilha
│   ├── api-cache.ts, rate-limit.ts, api-route.ts, admin-auth.ts
│   └── use-basket.ts, use-admin-token.ts
└── scrapers/
    ├── core/                   # BaseAdapter, HttpClient, html.ts, DryRunSink, PostgresSink
    ├── adapters/               # continente, pingo-doce, auchan, mercadona
    └── pipeline/run-daily.ts   # Orquestrador: corre adapters, regista scrape_runs, resumo
db/schema.sql                   # DDL PostgreSQL (fonte de verdade)
```

---

## 1. Base de dados

Esquema em [`db/schema.sql`](db/schema.sql), espelhado em [`src/db/schema.ts`](src/db/schema.ts).

- **`price_history` particionado por mês** — queries de "últimos N dias" rápidas com milhares de inserts
  diários; `ensure_price_partition()` cria a partição corrente.
- **Materialized view `latest_prices`** com `effective_price = COALESCE(promo, regular)`.
- **`scrape_runs`** — uma linha por adapter/execução: estado, produtos lidos, novos, preços gravados,
  matched/review/orphan, erro, dry-run. Alimenta o dashboard admin.
- `UNIQUE (supermarket_id, market_sku)` e `UNIQUE (product_market_id, captured_at)` tornam o scraper
  idempotente.
- `pg_trgm` + `unaccent` para pesquisa/matching difuso.

`getRepository()` devolve o `InMemoryRepository` por defeito; com `USE_DB=true` a `instrumentation.ts`
regista o `PostgresRepository`. Ambos implementam `Repository` e partilham `query-logic.ts`, por isso a
API e o frontend não mudam. Supermercados inativos são excluídos de ofertas, histórico e descidas.

---

## 2. Pipeline de scraping

Cada supermercado tem um **Adapter** (`BaseAdapter` → `RawProduct[]`). O `HttpClient` roda User-Agents,
aplica delay aleatório (1.5–4 s) e retry com backoff em 429/5xx. [`run-daily.ts`](src/scrapers/pipeline/run-daily.ts)
corre todos os adapters (ou `--only=…`), persiste em lotes, **regista cada execução** em `scrape_runs`,
isola falhas por adapter e imprime um resumo.

| Adapter     | Fonte                                                                 | Estado |
| ----------- | --------------------------------------------------------------------- | ------ |
| Continente  | Sitemap de categorias → 1.ª página HTML de cada folha de mercearia    | Live com `SCRAPER_DRY_RUN=false` |
| Pingo Doce  | Sitemap `/home/produtos/` → 1.ª página HTML de cada folha             | Live; sem `?start=` (robots) |
| Auchan      | Sitemap `/pt/alimentacao/` + paginação pública `?start=`              | Live |
| Mercadona   | API JSON: todas as categorias-folha de `tienda.mercadona.es`          | Live (preços da loja online ibérica) |

Preços promocionais: lidos dos microdata SFCC (`.sales`/`.strike-through .value[content]`,
ver `extractMicrodataPrice`) no Pingo Doce e Auchan, do preço riscado no Continente e de
`previous_unit_price` na API Mercadona. Preço por unidade: rótulos `.product-unit` /
`.auc-measures--price-per-unit`, `bulk_price`+`reference_format` (Mercadona) ou cálculo €/kg|€/L.
Sem EAN nas grelhas — o matching é por nome + veto de tamanho (enriquecimento via JSON-LD das
páginas de produto é o próximo passo para EANs).

### Enriquecimento de EANs (`npm run enrich:eans`)

As grelhas e a API não trazem EANs, mas as páginas de produto sim. Fontes confirmadas:

| Loja | Fonte do EAN |
| ---- | ------------ |
| Auchan | JSON-LD `gtin` da página de produto |
| Continente | parâmetro `ean=` do data-url nutricional (`ean=A%7cB`) |
| Pingo Doce, Mercadona | OpenFoodFacts com critério estrito (marca + tamanho + similaridade ≥ 0.82/0.97) |

```bash
npm run enrich:eans -- --limit=200            # prioriza produtos em 2+ lojas
npm run enrich:eans -- --only=auchan --limit=500
npm run enrich:eans -- --source=off --dry-run # pre-visualiza
npm run rematch                                # religa os EANs novos entre lojas
```

Grava de forma incremental (abortar a meio não perde progresso) e salta ofertas que já
têm EAN. Todos os EANs são validados pelo dígito de controlo antes de gravar. Em PostgreSQL,
o sink preserva EANs enriquecidos (nunca faz null-overwrite) e usa-os no matching seguinte.
O workflow [`weekly-enrich.yml`](.github/workflows/weekly-enrich.yml) corre isto ao domingo.

Sem PostgreSQL o sink é `FileCatalogSink` (`LIVE_CATALOG_PATH`). Com `USE_DB=true` grava na base.

> Os `robots.txt` do Continente e do Pingo Doce bloqueiam `?start=`, `?sz=` e endpoints Demandware.
> Nessas lojas o modo real percorre **todas as categorias-folha** dos sitemaps públicos (primeira
> página HTML de cada uma). No Auchan a paginação `?start=` é permitida. A Mercadona usa a API
> pública de categorias. `SCRAPER_MAX_CATEGORIES` limita o número de categorias por loja (útil em testes).

Cron: [`.github/workflows/daily-scrape.yml`](.github/workflows/daily-scrape.yml) às 04:00 UTC
(`DATABASE_URL`, `USE_DB`, `SCRAPER_DRY_RUN` como secrets), ou o serviço `scraper` do Compose.

---

## 3. Matching

Cascata em [`src/lib/matching.ts`](src/lib/matching.ts): **EAN** (confiança 1.0) → **nome**
(Levenshtein sobre tokens canónicos + Jaro-Winkler) com **veto de tamanho** (`1L` nunca iguala `1.5L`).
`≥ 0.92` junta; `0.80–0.92` vai para revisão; abaixo cria produto global novo (orphan).

A revisão humana faz-se em `/admin/revisao` (aprovar sugestão, associar ID manual, criar produto global).
O token fica em `sessionStorage` e é enviado como `Authorization: Bearer <ADMIN_TOKEN>`. Sem
`ADMIN_TOKEN`, as rotas admin respondem `503`.

> **Produção (fail-closed):** com `NODE_ENV=production` a app **recusa arrancar** se `ADMIN_TOKEN`
> estiver ausente, for o placeholder do `.env.example` ou tiver menos de 32 caracteres
> (validado em `src/instrumentation.ts`). O `docker compose` também falha sem `ADMIN_TOKEN`
> definido. Gera um com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## 4. API

| Método | Rota                                   | Descrição                                                       |
| ------ | -------------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/products/search?q=&limit=`       | Pesquisa com ofertas ordenadas do mais barato                   |
| GET    | `/api/products/browse?q=&category=<id>&supermarket=<slug>&promo=1&sort=&page=&pageSize=` | Catálogo paginado (`sort`: relevance, cheapest, savings, promo, name) |
| GET    | `/api/products/:id`                    | Produto global com todas as ofertas                             |
| GET    | `/api/products/:id/history?days=30`    | Histórico por supermercado + `stats` (min/max/avg/variação)     |
| POST   | `/api/basket/compare`                  | Total do carrinho por supermercado, vencedor e itens em falta   |
| GET    | `/api/drops?limit=`                    | Maiores descidas face ao preço anterior                         |
| GET    | `/api/supermarkets`                    | Ranking: ofertas, promoções, quota de mais barato, índice       |
| GET    | `/api/categories`                      | Categorias                                                      |
| GET    | `/api/stats`                           | Contagens globais e data da última recolha                      |
| GET    | `/api/health`                          | Estado da origem de dados (para healthchecks)                   |
| GET    | `/api/admin/scrapes?limit=`            | Histórico de execuções do scraping *(admin)*                    |
| GET/POST | `/api/admin/matches/review[/…]`      | Fila de revisão e ações *(admin)*                               |

Cache TTL e rate limiting são **best-effort por instância** (`API_CACHE_TTL_SECONDS`,
`API_RATE_LIMIT_*`); em multi-instância usar Redis/Upstash. Respostas limitadas devolvem `429` com
`Retry-After` e `X-RateLimit-*`.

```bash
curl "http://localhost:3000/api/products/browse?promo=1&sort=promo"
curl -X POST http://localhost:3000/api/basket/compare \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productGlobalId":1,"quantity":2},{"productGlobalId":2,"quantity":1}]}'
```

---

## 5. Design

Sistema de design em Tailwind com tokens HSL (`globals.css`) para claro/escuro, pilha de fontes de
sistema (sem downloads em build; `--font-sans`/`--font-display` podem apontar para Inter via `next/font`),
primitivas reutilizáveis em `src/components/ui/`, header sticky com navegação ativa e menu mobile,
footer com supermercados e data da última recolha. Mobile-first, acessível (skip link, `aria-current`,
`aria-pressed`, foco visível) e com filtros que funcionam sem JavaScript.

---

## Variáveis de ambiente

Ver [`.env.example`](.env.example): `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `USE_DB`, `PG_POOL_MAX`,
`PG_SSL`, `ADMIN_TOKEN`, `API_*`, `SCRAPER_*`.

---

## Aviso legal

Scraping de preços envolve Termos de Serviço e proteção de bases de dados (Diretiva 96/9/CE). O projeto
é "bom cidadão" (1×/dia, delays, baixa frequência) e respeita `robots.txt`. Para uso público, valida
juridicamente e obtém autorização quando aplicável. Os preços são das lojas online e podem diferir das
lojas físicas.

---

## Próximos passos

1. Adapters / importação de folhetos para Lidl, Aldi e Intermarché.
2. Histórico de vários dias (correr o scrape diariamente) e PostgreSQL em produção.
3. Alertas de preço por e-mail e carrinhos guardados (requer contas).
4. Produção: backups Postgres, alertas quando um adapter falha 2 dias seguidos, Redis para rate limiting global.
