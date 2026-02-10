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

- Header nav points to non-existent routes (`/speedtest`, `/page-load`, `/my-ip`, `/bgp`) causing 404 UX.
- Server-side safety limits are loose (upload allows up to 128 MiB/request; download allows up to 128 MiB/request).
- “Stability view” exists as sparklines, but lacks summary stats and phase methodology (warmup vs sustained).

## Recent Decisions
- Template: YYYY-MM-DD | Decision | Why | Evidence (tests/logs) | Commit | Confidence (high/medium/low) | Trust (trusted/untrusted)

## Mistakes And Fixes
- Template: YYYY-MM-DD | Issue | Root cause | Fix | Prevention rule | Commit | Confidence

## Known Risks

- External benchmarking expectations vary; avoid over-claiming “accuracy” and keep methodology honest.

## Next Prioritized Tasks

- 2026-02-10 | Add `/speedtest` route alias + remove/hide broken nav links | Impact: high | Effort: low | Risk: low | Confidence: high | Trust: trusted
- 2026-02-10 | Tighten `/api/speed/*` safety limits (upload bytes cap, download size cap, validation, headers) | Impact: high | Effort: low | Risk: low | Confidence: high | Trust: trusted
- 2026-02-10 | Add CI workflow for lint/build | Impact: medium | Effort: low | Risk: low | Confidence: high | Trust: trusted
- 2026-02-10 | Add stability summary stats (median/p95/min/max) | Impact: medium | Effort: low | Risk: low | Confidence: medium | Trust: trusted
- 2026-02-10 | Add warmup/sustained phases + discard warmup | Impact: medium | Effort: medium | Risk: medium | Confidence: medium | Trust: trusted
- 2026-02-10 | Add loaded vs unloaded latency view | Impact: medium | Effort: medium | Risk: medium | Confidence: low | Trust: trusted

## Verification Evidence
- Template: YYYY-MM-DD | Command | Key output | Status (pass/fail)

## Historical Summary
- Keep compact summaries of older entries here when file compaction runs.
