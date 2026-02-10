import { NextRequest } from "next/server";

export const runtime = "nodejs";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sizeMbRaw = Number(searchParams.get("mb") ?? "16");
  const sizeMb = clamp(Number.isFinite(sizeMbRaw) ? sizeMbRaw : 16, 1, 128);
  const totalBytes = sizeMb * 1024 * 1024;

  const chunkSize = 64 * 1024;
  const encoder = new TextEncoder();
  const seed = encoder.encode("network-reactor-speedtest-");

  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const remaining = totalBytes - sent;
      if (remaining <= 0) {
        controller.close();
        return;
      }
      const n = Math.min(chunkSize, remaining);
      const buf = new Uint8Array(n);
      // Fill deterministically (avoid compressibility being too extreme).
      for (let i = 0; i < n; i++) {
        buf[i] = seed[(sent + i) % seed.length] ?? 0x5a;
      }
      sent += n;
      controller.enqueue(buf);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
      "x-bytes": String(totalBytes),
    },
  });
}

