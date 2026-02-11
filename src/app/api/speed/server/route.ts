import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function inferRegion() {
  return (
    process.env.VERCEL_REGION ||
    process.env.CF_REGION ||
    process.env.AWS_REGION ||
    "local"
  );
}

export async function GET(req: NextRequest) {
  return Response.json(
    {
      region: inferRegion(),
      runtime,
      host: req.nextUrl.host,
      iso: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
        pragma: "no-cache",
      },
    },
  );
}
