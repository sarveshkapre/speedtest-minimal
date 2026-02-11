# Speedtest Minimal

Browser-first speed test focused on practical diagnostics:
- Sustained download/upload throughput (warmup discarded).
- Idle latency + jitter + best-effort packet loss.
- Loaded latency during active download/upload with delta from idle.
- Stability sparklines with median/p95/range summaries.

See `plan.md` for the full spec and roadmap.

## Safety Limits

- Upload API cap: `8 MiB` per request (`/api/speed/upload`).
- Download API cap: `32 MiB` per request (`/api/speed/download?mb=`).
- Speed endpoints return `no-store` caching headers.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000/speedtest` (or `/`).
