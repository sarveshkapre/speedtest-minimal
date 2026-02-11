# Project Memory

## Objective
- Ship a browser-first speed test with stability view and safe upload limits. See plan.md.

## Architecture Snapshot

- Next.js App Router (React 19) single-page UI with server route handlers under `src/app/api/speed/*`.
- Throughput measured client-side via `fetch()` with warmup-discarded sustained windows:
  - Download: parallel streams reading `/api/speed/download`, 2s warmup + 7s sustained window.
  - Upload: parallel POSTs to `/api/speed/upload`, 2s warmup + 7s sustained window.
- Latency/jitter/loss:
  - Idle: repeated GETs to `/api/speed/ping`.
  - Loaded: concurrent ping sampling during active download/upload.

## Open Problems

- Packet loss remains best-effort HTTP ping loss, not true UDP packet-loss measurement.
- No confidence-grade model yet (sample count + variance scoring).
- No adaptive concurrency ramp for low-end device reliability.

## Recent Decisions
- Template: YYYY-MM-DD | Decision | Why | Evidence (tests/logs) | Commit | Confidence (high/medium/low) | Trust (trusted/untrusted)

- 2026-02-10 | Add `/speedtest` route alias and remove broken nav links | Avoid 404 UX and align navigation with shipped scope | `npm run build` lists `/speedtest` route | f3aa106 | high | trusted
- 2026-02-10 | Tighten speed endpoint safety limits (upload <= 8 MiB, download <= 32 MiB, no-store headers) | Reduce abuse/memory risk while keeping tests functional | Oversize upload returns 413; download returns correct byte length | 7774f70 | high | trusted
- 2026-02-10 | Add stability summary stats (median/p95/range) next to sparklines | Make “stability view” interpretable beyond a sparkline | UI renders summary stats when series present | f3ebe8b | medium | trusted
- 2026-02-10 | Add GitHub Actions CI (lint + build) | Surface regressions on every push to main | CI run succeeded on GitHub Actions | f7a8482 | high | untrusted
- 2026-02-11 | Prioritize sustained throughput + loaded latency + packet loss as cycle-1 work | Bounded market scan showed this as baseline expectation and best strategic fit for objective | Cloudflare/Ookla/Fast/LibreSpeed sources in `CLONE_FEATURES.md`; selected tasks executed | acd126d | medium | untrusted
- 2026-02-11 | Compute download/upload headline values from sustained window only (discard warmup) | Reduces ramp-up distortion and improves stability interpretation | `npm run build`; UI now labels warmup discard and sustained windows | acd126d | high | trusted
- 2026-02-11 | Add loaded-latency deltas and packet-loss counters (idle + loaded phases) | Improves congestion visibility and surfaces reliability degradation during throughput | `npm run build`; local manual UI/API smoke checks | acd126d | medium | trusted
- 2026-02-11 | Add run cancellation with request abort registry | Prevents hung/stale runs and improves resilience on flaky networks | `npm run lint`; cancel path aborts active controllers | acd126d | high | trusted
- 2026-02-11 | Standardize upload `no-store` + `x-max-bytes` response headers across success/error paths | Keeps safety metadata predictable and cache behavior consistent | local curl smoke shows headers for 200 and 413 responses | acd126d | high | trusted

## Mistakes And Fixes
- Template: YYYY-MM-DD | Issue | Root cause | Fix | Prevention rule | Commit | Confidence

## Known Risks

- External benchmarking expectations vary; avoid over-claiming “accuracy” and keep methodology honest.
- Browser runtime and tab scheduling can still bias metrics under heavy CPU contention.

## Next Prioritized Tasks

- 2026-02-11 | Add confidence grading for metrics based on sample count + variance | Impact: high | Effort: medium | Risk: low | Confidence: medium | Trust: trusted
- 2026-02-11 | Add adaptive concurrency ramp for weak devices | Impact: medium | Effort: medium/high | Risk: medium | Confidence: medium | Trust: trusted
- 2026-02-11 | Add data-usage estimator before run start | Impact: medium | Effort: low/medium | Risk: low | Confidence: high | Trust: trusted

## Verification Evidence
- Template: YYYY-MM-DD | Command | Key output | Status (pass/fail)

- 2026-02-10 | npm ci | added 357 packages; 0 vulnerabilities | pass
- 2026-02-10 | npm run lint | exit 0 | pass
- 2026-02-10 | npm run build | compiled successfully; routes include `/speedtest` and `/api/speed/*` | pass
- 2026-02-10 | npm run dev -- -p 3001 | Ready in ~262ms | pass
- 2026-02-10 | curl -sS http://localhost:3001/api/speed/ping | HTTP 200 + JSON body | pass
- 2026-02-10 | curl -sS "http://localhost:3001/api/speed/download?mb=1" | content-length 1048576; file size 1048576 | pass
- 2026-02-10 | head -c 1048576 /dev/urandom | curl -sS -X POST http://localhost:3001/api/speed/upload | HTTP 200 + bytesReceived 1048576 | pass
- 2026-02-10 | head -c $((9*1024*1024)) /dev/urandom | curl -sS -X POST http://localhost:3001/api/speed/upload | HTTP 413 payload too large | pass
- 2026-02-10 | gh run view 21863650905 | conclusion: success | pass
- 2026-02-10 | gh run view 21863685096 | conclusion: success | pass
- 2026-02-11 | gh issue list --repo sarveshkapre/speedtest-minimal --state open --limit 50 --json number,title,author | [] | pass
- 2026-02-11 | gh run list --repo sarveshkapre/speedtest-minimal --limit 12 --json databaseId,status,conclusion | recent completed runs all success before session changes | pass
- 2026-02-11 | npm run lint | exit 0 | pass
- 2026-02-11 | npm run build | compiled successfully; routes include `/speedtest` and `/api/speed/*` | pass
- 2026-02-11 | npm run dev -- -p 3003 | dev server started; endpoints reachable | pass
- 2026-02-11 | curl -i -sS http://localhost:3003/api/speed/ping | HTTP 200 + `cache-control: no-store` | pass
- 2026-02-11 | curl -i -sS "http://localhost:3003/api/speed/download?mb=1" | HTTP 200 + `content-length: 1048576` + `x-max-mb: 32` | pass
- 2026-02-11 | head -c 1048576 /dev/urandom | curl -i -sS -X POST http://localhost:3003/api/speed/upload --data-binary @- | HTTP 200 + `x-max-bytes: 8388608` | pass
- 2026-02-11 | head -c $((9*1024*1024)) /dev/urandom | curl -i -sS -X POST http://localhost:3003/api/speed/upload --data-binary @- | HTTP 413 + `x-max-bytes: 8388608` | pass
- 2026-02-11 | gh run view 21893767244 --repo sarveshkapre/speedtest-minimal --json status,conclusion | completed + success | pass
- 2026-02-11 | gh run view 21893800872 --repo sarveshkapre/speedtest-minimal --json status,conclusion | completed + success | pass

## Historical Summary
- Keep compact summaries of older entries here when file compaction runs.
