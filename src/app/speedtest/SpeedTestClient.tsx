"use client";

import { useRef, useState } from "react";

type Phase =
  | "idle"
  | "ping"
  | "download"
  | "upload"
  | "done"
  | "canceled"
  | "error";

type RequestControl = {
  registerController: (controller: AbortController) => () => void;
  isCanceled: () => boolean;
};

type PingSummary = {
  latenciesMs: number[];
  sent: number;
  received: number;
  lost: number;
  lossPct: number;
  medianMs: number | null;
  jitterMs: number | null;
};

function mbps(bytes: number, ms: number) {
  const bits = bytes * 8;
  const seconds = ms / 1000;
  return seconds > 0 ? bits / seconds / 1_000_000 : 0;
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(1);
}

function fmtMs(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n)} ms`;
}

function fmtSignedMs(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "-";
  const rounded = Math.round(n);
  return `${rounded >= 0 ? "+" : ""}${rounded} ms`;
}

function fmtPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${n.toFixed(1)}%`;
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const clamped = Math.min(1, Math.max(0, q));
  const idx = Math.floor(clamped * (sorted.length - 1));
  return sorted[idx] ?? null;
}

function median(series: number[]) {
  if (!series.length) return null;
  const sorted = [...series].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
}

function medianAbsDiff(series: number[]) {
  if (series.length < 2) return null;
  const diffs = series.slice(1).map((v, i) => Math.abs(v - series[i]!));
  return median(diffs);
}

function summarize(series: number[]) {
  if (!series.length) return null;
  const finite = series.filter((v) => Number.isFinite(v) && v >= 0);
  if (!finite.length) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const med = quantile(sorted, 0.5) ?? 0;
  const p95 = quantile(sorted, 0.95) ?? 0;
  return { min, max, median: med, p95, n: sorted.length };
}

function buildPingSummary(latenciesMs: number[], sent: number): PingSummary {
  const finite = latenciesMs.filter((v) => Number.isFinite(v) && v >= 0);
  const received = finite.length;
  const lost = Math.max(0, sent - received);
  return {
    latenciesMs: finite,
    sent,
    received,
    lost,
    lossPct: sent > 0 ? (lost / sent) * 100 : 0,
    medianMs: median(finite),
    jitterMs: medianAbsDiff(finite),
  };
}

export default function SpeedTestClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [unloadedPing, setUnloadedPing] = useState<PingSummary | null>(null);
  const [loadedDownloadPing, setLoadedDownloadPing] =
    useState<PingSummary | null>(null);
  const [loadedUploadPing, setLoadedUploadPing] =
    useState<PingSummary | null>(null);
  const [downloadMbps, setDownloadMbps] = useState<number | null>(null);
  const [uploadMbps, setUploadMbps] = useState<number | null>(null);
  const [downloadSeries, setDownloadSeries] = useState<number[]>([]);
  const [uploadSeries, setUploadSeries] = useState<number[]>([]);

  const controllersRef = useRef(new Set<AbortController>());
  const runIdRef = useRef(0);

  const registerController = (controller: AbortController) => {
    controllersRef.current.add(controller);
    return () => {
      controllersRef.current.delete(controller);
    };
  };

  const clearControllers = () => {
    controllersRef.current.clear();
  };

  const abortActiveControllers = () => {
    for (const controller of controllersRef.current) {
      controller.abort();
    }
    clearControllers();
  };

  const isRunning =
    phase === "ping" || phase === "download" || phase === "upload";

  const run = async () => {
    setError("");
    setUnloadedPing(null);
    setLoadedDownloadPing(null);
    setLoadedUploadPing(null);
    setDownloadMbps(null);
    setUploadMbps(null);
    setDownloadSeries([]);
    setUploadSeries([]);

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    abortActiveControllers();

    const control: RequestControl = {
      registerController,
      isCanceled: () => runId !== runIdRef.current,
    };

    try {
      setPhase("ping");
      const p = await measurePing({
        samples: 12,
        gapMs: 120,
        timeoutMs: 1200,
        ...control,
      });
      if (control.isCanceled()) return;
      setUnloadedPing(p);

      setPhase("download");
      const downloadDurationMs = 9000;
      const downloadWarmupMs = 2000;
      const [d, dLoaded] = await Promise.all([
        measureDownload({
          durationMs: downloadDurationMs,
          warmupMs: downloadWarmupMs,
          concurrency: 4,
          mbPerRequest: 16,
          ...control,
        }),
        measurePingForDuration({
          durationMs: downloadDurationMs,
          intervalMs: 180,
          timeoutMs: 1200,
          ...control,
        }),
      ]);
      if (control.isCanceled()) return;
      setDownloadMbps(d.mbps);
      setDownloadSeries(d.seriesMbps);
      setLoadedDownloadPing(dLoaded);

      setPhase("upload");
      const uploadDurationMs = 9000;
      const uploadWarmupMs = 2000;
      const [u, uLoaded] = await Promise.all([
        measureUpload({
          durationMs: uploadDurationMs,
          warmupMs: uploadWarmupMs,
          concurrency: 3,
          mbPerPost: 2,
          ...control,
        }),
        measurePingForDuration({
          durationMs: uploadDurationMs,
          intervalMs: 180,
          timeoutMs: 1200,
          ...control,
        }),
      ]);
      if (control.isCanceled()) return;
      setUploadMbps(u.mbps);
      setUploadSeries(u.seriesMbps);
      setLoadedUploadPing(uLoaded);

      setPhase("done");
    } catch (e) {
      if (control.isCanceled()) return;
      setPhase("error");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearControllers();
    }
  };

  const cancelRun = () => {
    if (!isRunning) return;
    runIdRef.current += 1;
    abortActiveControllers();
    setPhase("canceled");
    setError("Run canceled by user.");
  };

  const unloadedMedian = unloadedPing?.medianMs ?? null;

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Speed Test
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-white/65">
          Browser-first throughput test using local endpoints. Throughput uses a
          short warmup and reports sustained performance only. Loaded latency is
          measured during active download/upload to expose congestion effects.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-white/70">
            Phase:{" "}
            <span className="font-mono text-xs text-white/85">
              {phase === "idle" ? "READY" : phase.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-emerald-400/20 px-4 py-3 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-300/30 hover:bg-emerald-400/25 disabled:opacity-50"
              onClick={() => void run()}
              disabled={isRunning}
            >
              {isRunning ? "Running..." : "Run speed test"}
            </button>
            <button
              className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white/80 ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-40"
              onClick={cancelRun}
              disabled={!isRunning}
            >
              Cancel run
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric
          label="Latency (idle median)"
          value={fmtMs(unloadedPing?.medianMs ?? null)}
        />
        <Metric
          label="Jitter (idle median |Δ|)"
          value={fmtMs(unloadedPing?.jitterMs ?? null)}
        />
        <Metric
          label="Packet loss (idle)"
          value={fmtPct(unloadedPing?.lossPct ?? null)}
          note={
            unloadedPing
              ? `${unloadedPing.lost}/${unloadedPing.sent} lost`
              : "-"
          }
        />
        <Metric
          label="Download / Upload sustained"
          value={`${downloadMbps != null ? fmt(downloadMbps) : "-"} / ${
            uploadMbps != null ? fmt(uploadMbps) : "-"
          } Mbps`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Metric
          label="Loaded latency during download"
          value={fmtMs(loadedDownloadPing?.medianMs ?? null)}
          note={
            loadedDownloadPing
              ? `delta ${fmtSignedMs(
                  loadedDownloadPing.medianMs != null && unloadedMedian != null
                    ? loadedDownloadPing.medianMs - unloadedMedian
                    : null,
                )} | loss ${fmtPct(loadedDownloadPing.lossPct)}`
              : "-"
          }
        />
        <Metric
          label="Loaded latency during upload"
          value={fmtMs(loadedUploadPing?.medianMs ?? null)}
          note={
            loadedUploadPing
              ? `delta ${fmtSignedMs(
                  loadedUploadPing.medianMs != null && unloadedMedian != null
                    ? loadedUploadPing.medianMs - unloadedMedian
                    : null,
                )} | loss ${fmtPct(loadedUploadPing.lossPct)}`
              : "-"
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Download stability (sustained Mbps)">
          <div className="mb-2 text-xs text-white/60">
            Warmup is discarded (2s warmup, 7s sustained window).
          </div>
          <Sparkline series={downloadSeries} />
          <SeriesStats series={downloadSeries} />
        </Panel>
        <Panel title="Upload stability (sustained Mbps)">
          <div className="mb-2 text-xs text-white/60">
            Warmup is discarded (2s warmup, 7s sustained window).
          </div>
          <Sparkline series={uploadSeries} />
          <SeriesStats series={uploadSeries} />
        </Panel>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-xs font-semibold text-white/60">{label}</div>
      <div className="mt-2 font-mono text-2xl text-white/90">{value}</div>
      {note ? <div className="mt-1 text-xs text-white/55">{note}</div> : null}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Sparkline({ series }: { series: number[] }) {
  if (!series.length) {
    return <div className="text-sm text-white/55">No data yet.</div>;
  }
  const max = Math.max(...series, 0.1);
  return (
    <div className="flex h-20 items-end gap-1 rounded-xl bg-black/25 p-3 ring-1 ring-white/10">
      {series.slice(-24).map((v, i) => (
        <div
          key={i}
          className="w-2 rounded-sm bg-white/70"
          style={{
            height: `${Math.max(4, Math.round((v / max) * 64))}px`,
            opacity: 0.55 + 0.45 * (v / max),
          }}
          title={`${fmt(v)} Mbps`}
        />
      ))}
    </div>
  );
}

function SeriesStats({ series }: { series: number[] }) {
  const s = summarize(series);
  if (!s) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
      <span className="font-mono">n={s.n}</span>
      <span className="font-mono">median {fmt(s.median)}</span>
      <span className="font-mono">p95 {fmt(s.p95)}</span>
      <span className="font-mono">
        range {fmt(s.min)}-{fmt(s.max)}
      </span>
    </div>
  );
}

async function measurePing(
  opts: {
    samples: number;
    gapMs: number;
    timeoutMs: number;
  } & RequestControl,
) {
  const latenciesMs: number[] = [];
  let sent = 0;

  for (let i = 0; i < opts.samples; i++) {
    if (opts.isCanceled()) break;

    sent += 1;
    const controller = new AbortController();
    const unregister = opts.registerController(controller);
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const t0 = performance.now();
      const res = await fetch("/api/speed/ping", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.ok) {
        await res.json();
        latenciesMs.push(performance.now() - t0);
      }
    } catch {
      // Count as loss.
    } finally {
      clearTimeout(timeout);
      unregister();
    }

    if (i < opts.samples - 1) await sleep(opts.gapMs);
  }

  return buildPingSummary(latenciesMs, sent);
}

async function measurePingForDuration(
  opts: {
    durationMs: number;
    intervalMs: number;
    timeoutMs: number;
  } & RequestControl,
) {
  const endAt = performance.now() + opts.durationMs;
  const latenciesMs: number[] = [];
  let sent = 0;

  while (performance.now() < endAt && !opts.isCanceled()) {
    sent += 1;
    const controller = new AbortController();
    const unregister = opts.registerController(controller);
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const t0 = performance.now();
      const res = await fetch("/api/speed/ping", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.ok) {
        await res.json();
        latenciesMs.push(performance.now() - t0);
      }
    } catch {
      // Count as loss.
    } finally {
      clearTimeout(timeout);
      unregister();
    }

    if (opts.intervalMs > 0) await sleep(opts.intervalMs);
  }

  return buildPingSummary(latenciesMs, sent);
}

async function measureDownload(
  opts: {
    durationMs: number;
    warmupMs: number;
    concurrency: number;
    mbPerRequest: number;
  } & RequestControl,
) {
  const startAt = performance.now();
  const endAt = startAt + opts.durationMs;
  const warmupAt = startAt + Math.min(Math.max(opts.warmupMs, 0), opts.durationMs);
  let totalBytes = 0;
  let bytesAtWarmup = 0;
  let warmupCaptured = warmupAt <= startAt;
  const seriesMbps: number[] = [];

  let lastSampleAt = performance.now();
  let lastBytes = 0;

  const sampler = setInterval(() => {
    const now = performance.now();
    if (!warmupCaptured && now >= warmupAt) {
      bytesAtWarmup = totalBytes;
      warmupCaptured = true;
    }

    const dt = now - lastSampleAt;
    const db = totalBytes - lastBytes;
    if (now >= warmupAt) {
      seriesMbps.push(mbps(db, dt));
    }

    lastSampleAt = now;
    lastBytes = totalBytes;
  }, 1000);

  const workers = Array.from({ length: opts.concurrency }, async () => {
    while (performance.now() < endAt && !opts.isCanceled()) {
      const controller = new AbortController();
      const unregister = opts.registerController(controller);
      const timeout = setTimeout(() => controller.abort(), Math.max(1500, opts.durationMs));
      try {
        const res = await fetch(`/api/speed/download?mb=${opts.mbPerRequest}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`download HTTP ${res.status}`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("download missing body");
        while (performance.now() < endAt && !opts.isCanceled()) {
          const { value, done } = await reader.read();
          if (done) break;
          totalBytes += value?.byteLength ?? 0;
        }
        controller.abort();
      } catch {
        // Ignore transient aborts and network races.
      } finally {
        clearTimeout(timeout);
        unregister();
      }
    }
  });

  await Promise.all(workers);
  clearInterval(sampler);

  if (!warmupCaptured) {
    bytesAtWarmup = totalBytes;
    warmupCaptured = true;
  }

  const sustainedMs = Math.max(0, opts.durationMs - (warmupAt - startAt));
  const sustainedBytes = Math.max(0, totalBytes - bytesAtWarmup);

  return {
    mbps: sustainedMs > 0 ? mbps(sustainedBytes, sustainedMs) : 0,
    seriesMbps,
  };
}

async function measureUpload(
  opts: {
    durationMs: number;
    warmupMs: number;
    concurrency: number;
    mbPerPost: number;
  } & RequestControl,
) {
  const startAt = performance.now();
  const endAt = startAt + opts.durationMs;
  const warmupAt = startAt + Math.min(Math.max(opts.warmupMs, 0), opts.durationMs);
  let totalBytes = 0;
  let bytesAtWarmup = 0;
  let warmupCaptured = warmupAt <= startAt;
  const seriesMbps: number[] = [];

  const payload = new Uint8Array(opts.mbPerPost * 1024 * 1024);
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 31) & 0xff;

  let lastSampleAt = performance.now();
  let lastBytes = 0;

  const sampler = setInterval(() => {
    const now = performance.now();
    if (!warmupCaptured && now >= warmupAt) {
      bytesAtWarmup = totalBytes;
      warmupCaptured = true;
    }

    const dt = now - lastSampleAt;
    const db = totalBytes - lastBytes;
    if (now >= warmupAt) {
      seriesMbps.push(mbps(db, dt));
    }

    lastSampleAt = now;
    lastBytes = totalBytes;
  }, 1000);

  const workers = Array.from({ length: opts.concurrency }, async () => {
    while (performance.now() < endAt && !opts.isCanceled()) {
      const controller = new AbortController();
      const unregister = opts.registerController(controller);
      const timeout = setTimeout(() => controller.abort(), Math.max(1500, opts.durationMs));
      try {
        const res = await fetch("/api/speed/upload", {
          method: "POST",
          body: payload,
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`upload HTTP ${res.status}`);
        const json = (await res.json()) as { bytesReceived?: number };
        totalBytes += json.bytesReceived ?? payload.byteLength;
      } catch {
        // Ignore transient aborts and network races.
      } finally {
        clearTimeout(timeout);
        unregister();
      }
    }
  });

  await Promise.all(workers);
  clearInterval(sampler);

  if (!warmupCaptured) {
    bytesAtWarmup = totalBytes;
    warmupCaptured = true;
  }

  const sustainedMs = Math.max(0, opts.durationMs - (warmupAt - startAt));
  const sustainedBytes = Math.max(0, totalBytes - bytesAtWarmup);

  return {
    mbps: sustainedMs > 0 ? mbps(sustainedBytes, sustainedMs) : 0,
    seriesMbps,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
