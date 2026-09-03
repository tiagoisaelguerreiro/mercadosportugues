# DEPLOY — do zero ao site online

Checklist completa para publicar o MercadosPortugues num VPS. Tempo estimado:
~45 min (a maioria é esperar builds e DNS).

## 0. Pré-requisitos (no teu PC)

- [ ] Conta GitHub + repositório criado
- [ ] `git remote add origin <url>` + `git push -u origin main`
- [ ] Secrets no repo (Settings → Secrets and variables → Actions):
  - `DATABASE_URL` — ex.: `postgresql://mp_user:<password>@<host>:5432/mercadosportugues`
  - `USE_DB` = `true`
- [ ] VPS Ubuntu 22.04/24.04 com IP público (2 GB RAM chega)
- [ ] DNS: registo A do teu domínio → IP do VPS (ex.: `precos.exemplo.pt`)

## 1. Provisionar o VPS (5 min + installs)

```bash
ssh root@<ip-do-vps>
curl -fsSL https://raw.githubusercontent.com/<org>/<repo>/main/scripts/provision-vps.sh -o provision.sh
chmod +x provision.sh
sudo APP_DIR=/opt/mercadosportugues DOMAIN=precos.exemplo.pt \
  GIT_REPO=https://github.com/<org>/<repo>.git ./provision.sh
```

Isto instala Docker, Caddy (HTTPS automático), clona o repo, abre a firewall
(22/80/443) e agenda o backup diário do Postgres às 03:00 (retenção 14 dias).

## 2. Configurar e arrancar (10–15 min de build)

```bash
cd /opt/mercadosportugues
cp .env.example .env
nano .env   # Preenche OBRIGATORIAMENTE:
            #   ADMIN_TOKEN=<64 hex: openssl rand -hex 32>
            #   DATABASE_URL=postgresql://mp_user:<password-forte>@db:5432/mercadosportugues
            #   NEXT_PUBLIC_SITE_URL=https://precos.exemplo.pt
            #   USE_DB=true
            #   SCRAPER_DRY_RUN=false

NEXT_PUBLIC_SITE_URL=https://precos.exemplo.pt ADMIN_TOKEN=<token> \
  docker compose up -d --build
```

> A app **recusa arrancar** com `ADMIN_TOKEN` em falta/fraco (fail-closed) —
> se o container reiniciar em loop, o `.env` é a primeira coisa a verificar:
> `docker compose logs app | tail -20`.

## 3. Seed inicial + verificação

```bash
docker compose --profile scrape run --rm scraper npm run db:seed
curl -sf https://precos.exemplo.pt/api/health
# esperado: {"status":"ok","stale":false,...}
```

## 4. Ligar a automação

- [ ] GitHub → Actions → "Daily Price Scrape" → Run workflow (corre o scrape real)
- [ ] GitHub → Actions → "Weekly EAN Enrichment" → Run workflow (opcional, ~1–3h)
- [ ] Uptime monitor (Uptime Kuma / Better Stack) → `GET /api/health`:
  alerta se HTTP ≠ 200 **ou** `stale: true` (ver README § Monitorização)
- [ ] Cron do host para o scrape (alternativa às Actions):
  `0 4 * * * cd /opt/mercadosportugues && docker compose --profile scrape run --rm scraper`

## 5. Pós-deploy (primeira semana)

- [ ] Confirmar no `/admin` que os 4 adapters correm com sucesso diariamente
- [ ] Rever a fila `/admin/revisao` (agora persiste entre rematches)
- [ ] Testar restauro do backup numa DB à parte (receita no README)
- [ ] Submeter o sitemap no Google Search Console

## Notas

- Mudar de domínio exige **rebuild** (`NEXT_PUBLIC_SITE_URL` é embutido no build).
- Lidl/Aldi/Intermarché ficam inativos: sem catálogo online com preços (ver README).
- Preços Mercadona vêm da loja online espanhola (ver README).
- Rollback: `docker compose down && git -C /opt/mercadosportugues checkout <tag-anterior> && docker compose up -d --build`.
- Marca uma tag por release: `git tag v1.0.0 && git push --tags`.
