import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carrega variaveis de um ficheiro `.env` simples (KEY=valor, com # comentarios)
 * sem dependencia externa. Nao sobrepoe variaveis ja definidas no ambiente —
 * o ambiente (secrets de CI, compose) tem sempre prioridade.
 */
export function loadDotEnv(path = resolve(".env")): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}
