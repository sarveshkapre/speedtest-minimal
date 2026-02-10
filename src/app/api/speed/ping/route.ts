export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    serverTime: Date.now(),
    iso: new Date().toISOString(),
  });
}
