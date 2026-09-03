-- ============================================================================
-- MercadosPortugues — Esquema PostgreSQL
-- Plataforma de comparacao diaria de precos de supermercados em Portugal.
--
-- Aplicar:  psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================================

-- Extensoes para matching difuso e normalizacao de texto
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- Supermercados
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supermarkets (
    id          SMALLSERIAL PRIMARY KEY,
    slug        VARCHAR(40)  NOT NULL UNIQUE,        -- 'continente', 'pingo-doce'
    name        VARCHAR(80)  NOT NULL,
    logo_url    TEXT,
    base_url    TEXT         NOT NULL,
    color_hex   VARCHAR(7),                          -- cor de marca para a UI
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Categorias (hierarquicas: Mercearia > Arroz)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(140) NOT NULL UNIQUE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Produto global (identidade canonica partilhada entre supermercados)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products_global (
    id              BIGSERIAL PRIMARY KEY,
    name_global     VARCHAR(255) NOT NULL,
    brand           VARCHAR(120),
    ean_code        VARCHAR(14) UNIQUE,              -- chave de ouro do matching
    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    image_url       TEXT,
    -- Normalizacao de quantidade para comparar "maças com maças"
    quantity_value  NUMERIC(10,3),                  -- 1.5, 500, 1
    quantity_unit   VARCHAR(8),                      -- 'L', 'ml', 'kg', 'g', 'un'
    base_unit       VARCHAR(4),                      -- 'L' | 'kg' | 'un' (normalizada)
    base_quantity   NUMERIC(12,4),                  -- valor convertido para base_unit
    -- Coluna gerada para busca difusa sem acentos
    search_key      TEXT GENERATED ALWAYS AS (
                        lower(unaccent(coalesce(brand,'') || ' ' || name_global))
                    ) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_global_trgm
    ON products_global USING gin (search_key gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_global_ean
    ON products_global (ean_code) WHERE ean_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_global_category
    ON products_global (category_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Produto no mercado (a oferta especifica de cada supermercado)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products_market (
    id                  BIGSERIAL PRIMARY KEY,
    product_global_id   BIGINT REFERENCES products_global(id) ON DELETE SET NULL,
    supermarket_id      SMALLINT NOT NULL REFERENCES supermarkets(id),
    market_sku          VARCHAR(64) NOT NULL,        -- SKU interno do site
    name_market         VARCHAR(255) NOT NULL,
    brand_market        VARCHAR(120),                  -- marca tal como veio da loja
    product_url         TEXT,
    image_url           TEXT,
    raw_ean             VARCHAR(14),                 -- EAN como veio do site
    match_status        VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending|matched|review|orphan
    match_confidence    REAL,                        -- 0..1
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (supermarket_id, market_sku)              -- idempotencia por mercado
);

CREATE INDEX IF NOT EXISTS idx_pm_global  ON products_market (product_global_id);
CREATE INDEX IF NOT EXISTS idx_pm_status  ON products_market (match_status);
CREATE INDEX IF NOT EXISTS idx_pm_market  ON products_market (supermarket_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Historico de precos (particionado por mes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
    id                  BIGSERIAL,
    product_market_id   BIGINT NOT NULL REFERENCES products_market(id) ON DELETE CASCADE,
    price_regular       NUMERIC(10,2) NOT NULL,      -- preco normal / "riscado"
    price_promo         NUMERIC(10,2),               -- preco promocional (se houver)
    has_promo           BOOLEAN NOT NULL DEFAULT FALSE,
    price_per_unit      NUMERIC(10,4),               -- €/kg ou €/L
    price_per_unit_uom  VARCHAR(8),                  -- 'kg' | 'L' | 'un'
    captured_at         DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

-- Um registo por produto por dia (idempotencia se o cron correr 2x)
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_per_day
    ON price_history (product_market_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_price_history_pm
    ON price_history (product_market_id, captured_at DESC);

-- Particoes (criar adiante via cron; exemplos para arranque)
CREATE TABLE IF NOT EXISTS price_history_2025_01 PARTITION OF price_history
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS price_history_2025_02 PARTITION OF price_history
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Particao "catch-all" para nao falhar inserts fora do intervalo acima.
CREATE TABLE IF NOT EXISTS price_history_default PARTITION OF price_history DEFAULT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW materializada: preco mais recente por oferta de mercado
-- Acelera /search e /basket sem varrer o historico completo.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS latest_prices AS
SELECT DISTINCT ON (ph.product_market_id)
    ph.product_market_id,
    pm.product_global_id,
    pm.supermarket_id,
    COALESCE(ph.price_promo, ph.price_regular) AS effective_price,
    ph.price_regular,
    ph.price_promo,
    ph.has_promo,
    ph.price_per_unit,
    ph.price_per_unit_uom,
    ph.captured_at
FROM price_history ph
JOIN products_market pm ON pm.id = ph.product_market_id
ORDER BY ph.product_market_id, ph.captured_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_latest_pm ON latest_prices (product_market_id);
CREATE INDEX IF NOT EXISTS idx_latest_global ON latest_prices (product_global_id);

-- No fim do pipeline diario:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY latest_prices;

-- ─────────────────────────────────────────────────────────────────────────────
-- Execucoes do pipeline de scraping (observabilidade / painel admin)
-- Uma linha por (execucao, supermercado). Permite responder "quando foi a
-- ultima recolha?", "quantos produtos entraram em revisao?" e detetar falhas.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scrape_runs (
    id                  BIGSERIAL PRIMARY KEY,
    supermarket_id      SMALLINT NOT NULL REFERENCES supermarkets(id),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at         TIMESTAMPTZ,
    status              VARCHAR(16) NOT NULL DEFAULT 'running', -- running|success|failed
    products_received   INTEGER NOT NULL DEFAULT 0,
    new_market_products INTEGER NOT NULL DEFAULT 0,
    price_points        INTEGER NOT NULL DEFAULT 0,
    matched_count       INTEGER NOT NULL DEFAULT 0,
    review_count        INTEGER NOT NULL DEFAULT 0,
    orphan_count        INTEGER NOT NULL DEFAULT 0,
    dry_run             BOOLEAN NOT NULL DEFAULT FALSE,
    error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_started ON scrape_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_market  ON scrape_runs (supermarket_id, started_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Funcao auxiliar: cria a particao mensal do historico se nao existir.
-- Chamada pelo orquestrador antes de inserir precos.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ensure_price_partition(target DATE)
RETURNS void AS $$
DECLARE
    start_date DATE := date_trunc('month', target)::date;
    end_date   DATE := (date_trunc('month', target) + interval '1 month')::date;
    part_name  TEXT := format('price_history_%s', to_char(start_date, 'YYYY_MM'));
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF price_history FOR VALUES FROM (%L) TO (%L)',
            part_name, start_date, end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;
