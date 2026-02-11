# Clone Feature Tracker

## Context Sources
- README and docs
- TODO/FIXME markers in code
- Test and build failures
- Gaps found during codebase exploration
- Bounded external market scan

## Candidate Features To Do

- [x] [P1] Add confidence grades for latency/loss and throughput stability to reduce false certainty from noisy samples. Score: impact 5, effort 3, strategic fit 5, differentiation 3, risk 2, confidence 4.
- [x] [P1] Add explicit data-usage guardrail UI (max estimate + actual usage per run) and enforce client-side byte budgets for download/upload loops. Score: impact 5, effort 3, strategic fit 5, differentiation 4, risk 2, confidence 4.
- [x] [P1] Add server identity metadata endpoint and show selected server host/region/runtime in UI. Score: impact 4, effort 2, strategic fit 4, differentiation 2, risk 1, confidence 5.
- [x] [P1] Add result export as JSON for reproducible diagnostics sharing. Score: impact 4, effort 2, strategic fit 4, differentiation 3, risk 1, confidence 5.
- [x] [P1] Add screen-reader live status announcements for phase transitions and completion/error states. Score: impact 4, effort 2, strategic fit 4, differentiation 2, risk 1, confidence 5.
- [x] [P1] Add one-command API smoke verification script for ping/download/upload safety paths. Score: impact 4, effort 2, strategic fit 5, differentiation 1, risk 1, confidence 5.
- [ ] [P1] Add adaptive concurrency ramp (start lower, increase when throughput samples stabilize) for better low-end reliability. Score: impact 4, effort 4, strategic fit 4, differentiation 3, risk 3, confidence 3.
- [ ] [P2] Extract stats helpers into `src/lib/stats.ts` and add unit tests for quantiles/jitter/summary edge cases. Score: impact 4, effort 3, strategic fit 4, differentiation 1, risk 1, confidence 4.
- [ ] [P2] Add optional longer-run mode (15-20s sustained window) to improve confidence on unstable links. Score: impact 3, effort 3, strategic fit 4, differentiation 2, risk 2, confidence 3.
- [ ] [P2] Add methodology drawer that explains warmup discard, sustained windows, and confidence grade rubric. Score: impact 3, effort 2, strategic fit 4, differentiation 2, risk 1, confidence 4.
- [ ] [P2] Add reduced-motion fallback rendering for sparkline updates and phase transitions. Score: impact 3, effort 2, strategic fit 3, differentiation 1, risk 1, confidence 4.
- [ ] [P2] Add explicit “single-server local mode” disclaimer text to reduce user misinterpretation of ISP-grade comparisons. Score: impact 3, effort 1, strategic fit 4, differentiation 1, risk 1, confidence 5.
- [ ] [P2] Add CLI follow-up design doc and compatibility checklist for future non-browser client. Score: impact 2, effort 2, strategic fit 3, differentiation 2, risk 1, confidence 4.
- [ ] [P3] Add small-history local cache (last 5 runs) for immediate trend comparison without backend storage. Score: impact 3, effort 3, strategic fit 3, differentiation 2, risk 2, confidence 3.
- [ ] [P3] Add optional endpoint for server clock skew estimate to detect severe client timer distortion. Score: impact 2, effort 2, strategic fit 2, differentiation 2, risk 2, confidence 3.

## Implemented

- [x] 2026-02-11: Add confidence grades for latency/loss and throughput stability, surfaced across metric cards and stability panels. Evidence: `src/app/speedtest/SpeedTestClient.tsx`, `npm run build`.
- [x] 2026-02-11: Add per-run data-usage guardrail UI (estimated max + actual usage) and byte-budget caps in download/upload loops. Evidence: `src/app/speedtest/SpeedTestClient.tsx`, `npm run smoke:api`.
- [x] 2026-02-11: Add `/api/speed/server` metadata route and server identity display in UI. Evidence: `src/app/api/speed/server/route.ts`, `src/app/speedtest/SpeedTestClient.tsx`, `npm run build`.
- [x] 2026-02-11: Add JSON export for completed run results. Evidence: `src/app/speedtest/SpeedTestClient.tsx`, local manual UI verification.
- [x] 2026-02-11: Add ARIA live status announcements for phase transitions and completion/error states. Evidence: `src/app/speedtest/SpeedTestClient.tsx`, `npm run lint`.
- [x] 2026-02-11: Add `npm run smoke:api` to verify ping/download/upload happy-path and oversize rejection behavior. Evidence: `scripts/api_smoke.sh`, `package.json`, `npm run smoke:api`.
- [x] 2026-02-11: Add sustained throughput methodology with warmup discard (2s warmup + 7s sustained) and sustained stability stats. Evidence: `src/app/speedtest/SpeedTestClient.tsx`, `npm run build`.
- [x] 2026-02-11: Add loaded vs unloaded latency view with per-phase delta metrics during active download/upload. Evidence: `src/app/speedtest/SpeedTestClient.tsx`, `npm run build`.
- [x] 2026-02-11: Add best-effort packet loss metric (idle + loaded phases) from ping success/failure counts with browser-safe wording. Evidence: `src/app/speedtest/SpeedTestClient.tsx`, `npm run build`.
- [x] 2026-02-11: Add cancel-run control that aborts in-flight requests and prevents stale updates. Evidence: `src/app/speedtest/SpeedTestClient.tsx`, `npm run lint`.
- [x] 2026-02-11: Harden upload route response headers (`no-store` + `x-max-bytes`) across success and error paths. Evidence: `src/app/api/speed/upload/route.ts`, local curl smoke checks.
- [x] 2026-02-10: Add `/speedtest` route alias and remove broken nav links. Evidence: `src/app/speedtest/page.tsx`, `src/app/layout.tsx`.
- [x] 2026-02-10: Tighten endpoint safety limits (upload cap 8 MiB; download cap 32 MiB; no-store headers). Evidence: `src/app/api/speed/upload/route.ts`, `src/app/api/speed/download/route.ts`.
- [x] 2026-02-10: Improve download payload generator to reduce compressibility artifacts. Evidence: `src/app/api/speed/download/route.ts`.
- [x] 2026-02-10: Add stability summary stats (median/p95/range + sample count). Evidence: `src/app/speedtest/SpeedTestClient.tsx`.
- [x] 2026-02-10: Add GitHub Actions CI for `npm ci`, `npm run lint`, `npm run build`. Evidence: `.github/workflows/ci.yml` (Actions run success).

## Insights

### Bounded Market Scan (External, Untrusted)
- Cloudflare Speed Test and docs emphasize latency/jitter, throughput, and responsiveness framing as core UX baseline: https://speed.cloudflare.com and https://developers.cloudflare.com/speedtest/
- M-Lab NDT documents browser test methods and limitations, reinforcing transparency around methodology and confidence context: https://www.measurementlab.net/tests/ndt/
- Netflix engineering write-up for FAST highlights loaded-vs-unloaded latency under throughput load as a key user-facing diagnostic signal: https://netflixtechblog.com/building-fast-com-4857fe0f8adb
- LibreSpeed (self-hosted baseline) includes download/upload/ping/jitter plus share/export-oriented flows, supporting JSON export as parity-plus value: https://github.com/librespeed/speedtest

### Gap Map (2026-02-11)
- Missing (addressed this session): confidence grading, explicit per-run data budget visibility, server identity metadata, result export, accessibility status announcements, runnable API smoke path.
- Weak (still open): adaptive concurrency ramp for weaker devices, methodology explainer, and tested stat helpers.
- Parity: latency/jitter/loss + sustained throughput + loaded latency deltas + stability view.
- Differentiator opportunities: reliability-first confidence rubric, controlled data-budget defaults, and future cross-run trend history.

## Notes
- This file is maintained by the autonomous clone loop.
