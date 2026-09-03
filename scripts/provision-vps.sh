#!/usr/bin/env bash
# Provisionamento de VPS Ubuntu 22.04/24.04 para o MercadosPortugues.
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/<org>/<repo>/main/scripts/provision-vps.sh -o provision.sh
#   chmod +x provision.sh
#   sudo APP_DIR=/opt/mercadosportugues DOMAIN=precos.exemplo.pt \
#     GIT_REPO=https://github.com/<org>/<repo>.git ./provision.sh
#
# O que faz (idempotente, seguro correr 2x):
#   1. Instala Docker + Compose plugin (se em falta)
#   2. Instala Caddy (reverse proxy com HTTPS automatico via Let's Encrypt)
#   3. Clona/atualiza o repo em APP_DIR
#   4. Configura UFW (22, 80, 443)
#   5. Cria /etc/caddy/Caddyfile a apontar para a app (porta 3000)
#   6. Agenda backup diario do Postgres as 03:00
# Depois corre os passos manuais do DEPLOY.md (secrets, .env, seed).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mercadosportugues}"
DOMAIN="${DOMAIN:-}"
GIT_REPO="${GIT_REPO:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Corre com sudo." >&2
  exit 1
fi
if [ -z "$DOMAIN" ] || [ -z "$GIT_REPO" ]; then
  echo "Define DOMAIN e GIT_REPO. Ex.:" >&2
  echo "  sudo DOMAIN=precos.exemplo.pt GIT_REPO=https://github.com/org/repo.git ./provision.sh" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
echo "==> [1/6] Dependencias base"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw cron > /dev/null

echo "==> [2/6] Docker"
if ! command -v docker > /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin > /dev/null
  systemctl enable --now docker
else
  echo "    Docker ja instalado."
fi

echo "==> [3/6] Codigo em $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$GIT_REPO" "$APP_DIR"
fi

echo "==> [4/6] Firewall (22, 80, 443)"
ufw allow 22/tcp > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw --force enable > /dev/null 2>&1 || true

echo "==> [5/6] Caddy (HTTPS automatico)"
if ! command -v caddy > /dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy > /dev/null
fi
cat > /etc/caddy/Caddyfile <<EOF
# Gerado pelo provision.sh — MercadosPortugues
$DOMAIN {
	reverse_proxy 127.0.0.1:3000
}
EOF
systemctl enable --now caddy
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

echo "==> [6/6] Backup diario do Postgres (03:00)"
mkdir -p /backups
DOCKER_BIN="$(command -v docker)"
CRON_LINE="0 3 * * * root cd $APP_DIR && $DOCKER_BIN compose exec -T db pg_dump -U mp_user mercadosportugues | gzip > /backups/mp-\$(date +\%F).sql.gz && find /backups -name 'mp-*.sql.gz' -mtime +14 -delete"
echo "$CRON_LINE" > /etc/cron.d/mp-backup
chmod 644 /etc/cron.d/mp-backup

echo ""
echo "OK. Falta (ver DEPLOY.md):"
echo "  1. cd $APP_DIR && cp .env.example .env && edita ADMIN_TOKEN, DATABASE_URL, NEXT_PUBLIC_SITE_URL=https://$DOMAIN"
echo "  2. docker compose up -d --build"
echo "  3. docker compose --profile scrape run --rm scraper npm run db:seed"
echo "  4. curl -sf https://$DOMAIN/api/health"
