import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Icone da aplicacao gerado em runtime (sem binarios no repositorio). */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #17b35e 0%, #0a733e 100%)",
          borderRadius: 112,
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 320,
            fontWeight: 900,
            color: "white",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            letterSpacing: -16,
            marginTop: -20,
          }}
        >
          M
        </div>
        <div
          style={{
            position: "absolute",
            top: 72,
            right: 72,
            width: 88,
            height: 88,
            borderRadius: 999,
            background: "#ef4444",
            border: "16px solid white",
          }}
        />
      </div>
    ),
    size,
  );
}
