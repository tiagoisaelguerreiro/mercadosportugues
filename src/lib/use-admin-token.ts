"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mp-admin-token";

/**
 * Token de administrador partilhado entre os paineis admin, guardado em
 * sessionStorage (desaparece ao fechar o separador; nunca vai para cookies).
 */
export function useAdminToken() {
  const [token, setTokenState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setTokenState(window.sessionStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      // sessionStorage indisponivel (modo privado restrito) — segue sem persistencia.
    }
    setReady(true);
  }, []);

  const setToken = useCallback((value: string) => {
    setTokenState(value);
    try {
      if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignorar
    }
  }, []);

  const authHeaders = useCallback(
    (): Record<string, string> => (token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
    [token],
  );

  return { token, setToken, ready, authHeaders, hasToken: token.trim().length > 0 };
}

/** Extrai a mensagem de erro de uma resposta JSON da API admin. */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // corpo nao-JSON
  }
  if (res.status === 401) return "Token inválido";
  if (res.status === 503) return "ADMIN_TOKEN não configurado no servidor";
  return fallback;
}
