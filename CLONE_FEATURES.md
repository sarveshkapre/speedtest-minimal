# Clone Feature Tracker

## Context Sources
- README and docs
- TODO/FIXME markers in code
- Test and build failures
- Gaps found during codebase exploration

## Candidate Features To Do

- [ ] [P1] Add adaptive concurrency ramp (start lower, increase if samples are stable) to reduce low-end device overload. Score: impact 4, effort 4, strategic fit 4, differentiation 3, risk 3, confidence 3.
- [ ] [P1] Add confidence grade for each metric based on sample count and variance to avoid over-trusting noisy tests. Score: impact 4, effort 3, strategic fit 4, differentiation 3, risk 2, confidence 3.
- [ ] [P1] Add explicit data-usage estimator per run (download+upload MB) before starting test. Score: impact 4, effort 2, strategic fit 4, differentiation 3, risk 1, confidence 4.
- [ ] [P2] Add optional server region label endpoint and show selected test server identity in UI. Score: impact 3, effort 2, strategic fit 3, differentiation 2, risk 1, confidence 4.
- [ ] [P2] Add result export as JSON for reproducible diagnostics sharing. Score: impact 3, effort 2, strategic fit 3, differentiation 2, risk 1, confidence 4.
- [ ] [P2] Add keyboard and screen-reader status announcements for phase transitions. Score: impact 3, effort 2, strategic fit 3, differentiation 1, risk 1, confidence 4.
- [ ] [P2] Add npm smoke script for API routes to reduce manual verification effort in CI/local. Score: impact 3, effort 2, strategic fit 4, differentiation 1, risk 1, confidence 4.
- [ ] [P2] Add lightweight unit tests for stat helpers (quantiles, jitter, medians) to reduce regression risk. Score: impact 3, effort 3, strategic fit 4, differentiation 1, risk 1, confidence 4.
- [ ] [P3] Add CLI follow-up design doc and compatibility checklist for a future non-browser test client. Score: impact 2, effort 2, strategic fit 3, differentiation 2, risk 1, confidence 4.
- [ ] [P3] Add privacy note clarifying what is and is not transmitted/stored during runs. Score: impact 2, effort 1, strategic fit 3, differentiation 1, risk 1, confidence 5.

## Implemented

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
- Observed baseline expectations: multi-connection throughput sampling, idle + loaded responsiveness, and clear methodology notes about variance/context. Sources:
  - Cloudflare Speed Test (AIM): https://speed.cloudflare.com and docs: https://developers.cloudflare.com/speedtest/
  - Ookla methodology summary: https://support.speedtest.net/hc/en-us/articles/360038679354-How-does-Speedtest-measure-my-network-speed
  - Fast.com methodology (idle/loaded latency framing): https://fast.com/#how
  - LibreSpeed feature set (self-hosted benchmark baseline): https://github.com/librespeed/speedtest

### Gap Map (2026-02-11)
- Missing (addressed this session): warmup-discarded sustained throughput, loaded-vs-idle latency delta, packet loss signal.
- Weak (still open): confidence grading and adaptive concurrency for low-end devices.
- Parity: latency/jitter + throughput stability view + capped upload/download endpoints.
- Differentiator opportunities: explicit data-usage estimator and reliability confidence indicator to make results more actionable.

## Notes
- This file is maintained by the autonomous clone loop.
