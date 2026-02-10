# Project Memory

## Objective
- Ship a browser-first speed test with stability view and safe upload limits. See plan.md.

## Architecture Snapshot

- Next.js App Router (React 19) single-page UI with server route handlers under `src/app/api/speed/*`.
- Throughput measured client-side via `fetch()`:
  - Download: parallel streams reading `/api/speed/download` for a fixed duration.
  - Upload: parallel POSTs to `/api/speed/upload` for a fixed duration.
  - Latency/jitter: repeated GETs to `/api/speed/ping`.

## Open Problems

- Throughput methodology is still “fixed-duration average”; no explicit warmup vs sustained phases.
- No “loaded vs unloaded” latency view yet (latency can change significantly during throughput).
- No packet-loss signal (hard in-browser; likely needs server support and careful wording).

## Recent Decisions
- Template: YYYY-MM-DD | Decision | Why | Evidence (tests/logs) | Commit | Confidence (high/medium/low) | Trust (trusted/untrusted)

- 2026-02-10 | Add `/speedtest` route alias and remove broken nav links | Avoid 404 UX and align navigation with shipped scope | `npm run build` lists `/speedtest` route | f3aa106 | high | trusted
- 2026-02-10 | Tighten speed endpoint safety limits (upload <= 8 MiB, download <= 32 MiB, no-store headers) | Reduce abuse/memory risk while keeping tests functional | Oversize upload returns 413; download returns correct byte length | 7774f70 | high | trusted
- 2026-02-10 | Add stability summary stats (median/p95/range) next to sparklines | Make “stability view” interpretable beyond a sparkline | UI renders summary stats when series present | f3ebe8b | medium | trusted
- 2026-02-10 | Add GitHub Actions CI (lint + build) | Surface regressions on every push to main | CI run succeeded on GitHub Actions | f7a8482 | high | untrusted

## Mistakes And Fixes
- Template: YYYY-MM-DD | Issue | Root cause | Fix | Prevention rule | Commit | Confidence

## Known Risks

- External benchmarking expectations vary; avoid over-claiming “accuracy” and keep methodology honest.

## Next Prioritized Tasks

- 2026-02-10 | Add warmup/sustained phases + discard warmup | Impact: medium | Effort: medium | Risk: medium | Confidence: medium | Trust: trusted
- 2026-02-10 | Add loaded vs unloaded latency view | Impact: medium | Effort: medium | Risk: medium | Confidence: low | Trust: trusted
- 2026-02-10 | Add packet loss signal (if possible) with careful wording | Impact: medium | Effort: high | Risk: high | Confidence: low | Trust: trusted

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

## Historical Summary
- Keep compact summaries of older entries here when file compaction runs.
