import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxBytes = 8 * 1024 * 1024;

const noStoreHeaders = {
  "cache-control": "no-store, no-cache, must-revalidate",
  pragma: "no-cache",
  "x-max-bytes": String(maxBytes),
};

export async function POST(req: NextRequest) {
  // Keep per-request uploads capped to reduce abuse risk and avoid memory pressure.
  const contentLength = Number(req.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return Response.json(
      { ok: false, error: "payload too large" },
      {
        status: 413,
        headers: noStoreHeaders,
      },
    );
  }

  const body = req.body;
  if (!body) {
    return Response.json(
      { ok: false, error: "missing body" },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const reader = body.getReader();
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value?.byteLength ?? 0;
    if (total > maxBytes) {
      await reader.cancel("payload too large");
      return Response.json(
        { ok: false, error: "payload too large" },
        {
          status: 413,
          headers: noStoreHeaders,
        },
      );
    }
  }

  return Response.json(
    {
      ok: true,
      bytesReceived: total,
      iso: new Date().toISOString(),
      maxBytes,
    },
    { headers: noStoreHeaders },
  );
}
