# Speedtest Minimal: plan

Browser-first internet speed test. Speed tests are deceptively hard; v1 focuses on useful diagnostics with honest methodology.

## Core UX

- One big start button.
- Shows: download, upload, latency, jitter.
- Advanced view: stability over time.

## How it measures (target spec)

- Download: multiple parallel streams, ramp-up, sustained phase, discard warmup.
- Upload: same, plus careful buffering.
- Latency/jitter: repeated small pings.
- Results: median/percentiles, not just one number.

## Infra (target spec)

- Many edge servers close to users (anycast helps).
- Avoid CPU bottlenecks.
- Offer CLI later for more reliable measurements.

## V1 implementation in this repo

- Local endpoints: `/api/speed/ping`, `/api/speed/download`, `/api/speed/upload`.
- UI runs a short test and shows stability sparklines.
