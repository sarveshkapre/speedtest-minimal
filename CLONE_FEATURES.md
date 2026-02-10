# Clone Feature Tracker

## Context Sources
- README and docs
- TODO/FIXME markers in code
- Test and build failures
- Gaps found during codebase exploration

## Candidate Features To Do

- [ ] Add warmup/sustained phases for throughput (discard warmup samples; report sustained throughput + stability percentiles).
- [ ] Add “loaded vs unloaded” latency view (ping during idle and during active download/upload; report delta).
- [ ] Add packet loss metric (best-effort UDP-like approximation is hard in browser; may need server support and careful wording).

## Implemented

- [x] 2026-02-10: Add `/speedtest` route alias and remove broken nav links. Evidence: `src/app/speedtest/page.tsx`, `src/app/layout.tsx`.
- [x] 2026-02-10: Tighten endpoint safety limits (upload cap 8 MiB; download cap 32 MiB; no-store headers). Evidence: `src/app/api/speed/upload/route.ts`, `src/app/api/speed/download/route.ts`.
- [x] 2026-02-10: Improve download payload generator to reduce compressibility artifacts. Evidence: `src/app/api/speed/download/route.ts`.
- [x] 2026-02-10: Add stability summary stats (median/p95/range + sample count). Evidence: `src/app/speedtest/SpeedTestClient.tsx`.
- [x] 2026-02-10: Add GitHub Actions CI for `npm ci`, `npm run lint`, `npm run build`. Evidence: `.github/workflows/ci.yml` (Actions run success).

## Insights

### Bounded Market Scan (External, Untrusted)
- Users expect multi-stream tests plus latency/jitter; many tools also highlight stability and “loaded” effects during throughput. Sources:
  - Cloudflare Speed Test (AIM): https://speed.cloudflare.com and docs: https://developers.cloudflare.com/speedtest/
  - Ookla methodology summary (Speedtest Support): https://support.speedtest.net/hc/en-us/articles/360038679354-How-does-Speedtest-measure-my-network-speed
  - Fast.com methodology (loaded/unloaded): https://fast.com/#how

## Notes
- This file is maintained by the autonomous clone loop.
