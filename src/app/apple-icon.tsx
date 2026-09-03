import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            fontSize: 118,
            fontWeight: 900,
            color: "white",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            letterSpacing: -6,
            marginTop: -8,
          }}
        >
          M
        </div>
      </div>
    ),
    size,
  );
}
