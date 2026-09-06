import chunk0 from "@/data/commerce-image/chunk0";
import chunk1 from "@/data/commerce-image/chunk1";
import chunk2 from "@/data/commerce-image/chunk2";

export const runtime = "nodejs";

export async function GET() {
  const image = Buffer.from(`${chunk0}${chunk1}${chunk2}`, "base64");

  return new Response(image, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(image.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
