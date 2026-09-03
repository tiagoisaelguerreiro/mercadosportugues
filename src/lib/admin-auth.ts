import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export type AdminAuthStatus = "authorized" | "not_configured" | "unauthorized";

export function adminAuthStatus(
  authorizationHeader: string | null,
  configuredToken = process.env.ADMIN_TOKEN,
): AdminAuthStatus {
  if (!configuredToken) return "not_configured";
  const token = extractBearerToken(authorizationHeader);
  if (!token) return "unauthorized";
  return tokensEqual(token, configuredToken) ? "authorized" : "unauthorized";
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  const status = adminAuthStatus(req.headers.get("authorization"));
  if (status === "authorized") return null;
  if (status === "not_configured") {
    return NextResponse.json(
      { error: "ADMIN_TOKEN nao configurado" },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "nao autorizado" }, { status: 401 });
}

function extractBearerToken(authorizationHeader: string | null): string | null {
  const value = authorizationHeader?.trim();
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return (match?.[1] ?? value).trim();
}

/**
 * Comparacao em tempo constante para nao expor o token a timing attacks.
 * Comprimentos diferentes chumbam antes (o comprimento do segredo nao e sensivel).
 */
export function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
