# Clone Feature Tracker

## Context Sources
- README and docs
- TODO/FIXME markers in code
- Test and build failures
- Gaps found during codebase exploration

## Candidate Features To Do

- [ ] Fix broken navigation by adding `/speedtest` route (alias of current speed test UI) and removing/hiding links to non-existent pages.
- [ ] Enforce safe server-side limits for test endpoints (upload max bytes, download max MB, strict validation, and no-store headers).
- [ ] Improve download payload generation to reduce compression/CPU artifacts (fast pseudo-random stream instead of repeating text seed).
- [ ] Add stability summary stats (median/p95 + min/max) alongside sparklines to better explain variability.
- [ ] Add warmup/sustained phases for throughput (discard warmup samples; report sustained throughput + stability percentiles).
- [ ] Add “loaded vs unloaded” latency view (ping during idle and during active download/upload; report delta).
- [ ] Add packet loss metric (best-effort UDP-like approximation is hard in browser; may need server support and careful wording).
- [ ] Add GitHub Actions CI for `npm ci`, `npm run lint`, `npm run build` to surface regressions early.

## Implemented

## Insights

### Bounded Market Scan (External, Untrusted)
- Users expect multi-stream tests plus latency/jitter; many tools also highlight stability and “loaded” effects during throughput. Sources:
  - Cloudflare Speed Test (AIM): https://speed.cloudflare.com and docs: https://developers.cloudflare.com/speedtest/
  - Ookla methodology summary (Speedtest Support): https://support.speedtest.net/hc/en-us/articles/360038679354-How-does-Speedtest-measure-my-network-speed
  - Fast.com methodology (loaded/unloaded): https://fast.com/#how

## Notes
- This file is maintained by the autonomous clone loop.
