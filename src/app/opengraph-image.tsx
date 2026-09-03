import { ImageResponse } from "next/og";

export const alt = "MercadosPortugues — Comparador diário de preços de supermercados";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STORES = ["Continente", "Pingo Doce", "Auchan", "Lidl", "Aldi", "Intermarché", "Mercadona"];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #052e1a 0%, #0b4a2c 55%, #0b914b 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "white",
              color: "#0b914b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 900,
            }}
          >
            M
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
            <span>Mercados</span>
            <span style={{ color: "#79e4a4" }}>Portugues</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1.02, letterSpacing: -3, maxWidth: 1000 }}>
            Decide onde comprar antes de sair de casa.
          </div>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.78)", maxWidth: 980, lineHeight: 1.3 }}>
            Preços dos supermercados portugueses comparados todos os dias — por produto e por carrinho completo.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {STORES.map((s) => (
            <div
              key={s}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                border: "2px solid rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.10)",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
