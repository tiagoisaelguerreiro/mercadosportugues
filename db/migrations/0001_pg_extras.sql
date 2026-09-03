-- 0001_pg_extras.sql — extras PostgreSQL nao geridos pelo Drizzle.
--
-- Aplica-se UMA vez, logo apos 0000, apenas em bases de dados provisionadas via
-- `drizzle-kit migrate` (ex.: Neon/Supabase). Bases criadas pelo docker-compose
-- (db/schema.sql via docker-entrypoint) JA incluem tudo isto — o workflow diario
-- deteta esse caso com `npm run db:check` e salta o migrate.
--
-- Conteudo (copia fiel de db/schema.sql, fonte de verdade do DDL):
--   1. extensoes unaccent + pg_trgm (pesquisa e fuzzy matching no motor)
--   2. price_history como tabela PARTICIONADA (o 0000 cria-a simples; aqui e
--      recriada particionada por mes — seguro porque a tabela esta vazia neste
--      ponto da instalacao) + particao DEFAULT catch-all
--   3. materialized view latest_prices + indices
--   4. funcao ensure_price_partition(date)

-- ── 1. Extensoes ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

--> statement-breakpoint

-- ── 2. price_history particionada ────────────────────────────────────────────
DROP TABLE IF EXISTS price_history;

--> statement-breakpoint

CREATE TABLE price_history (
    id                  BIGSERIAL,
    product_market_id   BIGINT NOT NULL REFERENCES products_market(id) ON DELETE CASCADE,
    price_regular       NUMERIC(10,2) NOT NULL,
    price_promo         NUMERIC(10,2),
    has_promo           BOOLEAN NOT NULL DEFAULT FALSE,
    price_per_unit      NUMERIC(10,4),
    price_per_unit_uom  VARCHAR(8),
    captured_at         DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

--> statement-breakpoint

CREATE UNIQUE INDEX uq_price_per_day
    ON price_history (product_market_id, captured_at);

--> statement-breakpoint

CREATE INDEX idx_price_history_pm
    ON price_history (product_market_id, captured_at DESC);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS price_history_default PARTITION OF price_history DEFAULT;

--> statement-breakpoint

-- ── 3. Materialized view latest_prices ───────────────────────────────────────
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

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_latest_pm ON latest_prices (product_market_id);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_latest_global ON latest_prices (product_global_id);

--> statement-breakpoint

-- ── 4. Funcao de particao mensal ─────────────────────────────────────────────
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
