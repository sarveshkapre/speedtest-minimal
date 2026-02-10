import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const maxBytes = 128 * 1024 * 1024;
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  const body = req.body;
  if (!body) {
    return Response.json({ ok: false, error: "missing body" }, { status: 400 });
  }

  const reader = body.getReader();
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value?.byteLength ?? 0;
    if (total > maxBytes) {
      return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
    }
  }

  return Response.json({
    ok: true,
    bytesReceived: total,
    iso: new Date().toISOString(),
  });
}

