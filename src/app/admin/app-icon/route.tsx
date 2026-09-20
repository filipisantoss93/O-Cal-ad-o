import { ImageResponse } from "next/og";

/** Ícone público de marca. Nenhuma informação privada é retornada. */
export function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("size");
  const size = raw === "180" ? 180 : raw === "192" ? 192 : 512;
  const scale = size / 512;

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", backgroundColor: "#071017",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      color: "#fff", fontFamily: "sans-serif",
    }}>
      <div style={{
        display: "flex", width: 340 * scale, height: 340 * scale,
        alignItems: "center", justifyContent: "center",
        border: String(Math.max(3, Math.round(13 * scale))) + "px solid #ff921f",
        borderRadius: 100 * scale,
        backgroundColor: "#14232a",
        fontSize: 244 * scale, fontWeight: 900, lineHeight: 1,
      }}>A</div>
      <div style={{
        display: "flex", marginTop: 10 * scale, color: "#ffbe31",
        fontSize: 47 * scale, fontWeight: 900, letterSpacing: 9 * scale,
      }}>ADMIN</div>
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
