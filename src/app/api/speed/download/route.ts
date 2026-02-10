import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function xorshift32(state: number) {
  // Deterministic, fast pseudo-random generator.
  // Not cryptographically secure; used only to reduce compressibility artifacts.
  let x = state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sizeMbRaw = Number(searchParams.get("mb") ?? "16");
  const sizeMb = clamp(
    Number.isFinite(sizeMbRaw) ? Math.trunc(sizeMbRaw) : 16,
    1,
    32,
  );
  const totalBytes = sizeMb * 1024 * 1024;

  const chunkSize = 64 * 1024;
  let state = ((Date.now() | 0) ^ totalBytes ^ 0x6d2b79f5) | 0;

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
      // Fill with low-compressibility bytes at low CPU cost.
      for (let i = 0; i < n; i += 4) {
        state = xorshift32(state);
        buf[i] = state & 0xff;
        if (i + 1 < n) buf[i + 1] = (state >>> 8) & 0xff;
        if (i + 2 < n) buf[i + 2] = (state >>> 16) & 0xff;
        if (i + 3 < n) buf[i + 3] = (state >>> 24) & 0xff;
      }
      sent += n;
      controller.enqueue(buf);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store, no-cache, must-revalidate",
      "content-length": String(totalBytes),
      pragma: "no-cache",
      "x-bytes": String(totalBytes),
      "x-max-mb": "32",
    },
  });
}
