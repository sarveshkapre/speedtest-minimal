"use client";

import { useEffect, useRef, useState } from "react";

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

type ServerInfo = {
  region: string;
  runtime: string;
  host: string;
  iso: string;
};

type ThroughputMeasurement = {
  mbps: number;
  seriesMbps: number[];
  totalBytes: number;
};

type ConfidenceGrade = "A" | "B" | "C" | "D";

type RunResult = {
  finishedAtIso: string;
  phase: "done";
  server: ServerInfo | null;
  config: {
    ping: typeof TEST_CONFIG.ping;
    download: typeof TEST_CONFIG.download;
    upload: typeof TEST_CONFIG.upload;
  };
  metrics: {
    idlePing: PingSummary | null;
    loadedDownloadPing: PingSummary | null;
    loadedUploadPing: PingSummary | null;
    downloadMbps: number | null;
    uploadMbps: number | null;
    downloadSeriesMbps: number[];
    uploadSeriesMbps: number[];
    downloadBytes: number;
    uploadBytes: number;
    totalBytes: number;
  };
};

const MB = 1024 * 1024;

const TEST_CONFIG = {
  ping: {
    samples: 12,
    gapMs: 120,
    timeoutMs: 1200,
  },
  download: {
    durationMs: 9000,
    warmupMs: 2000,
    concurrency: 4,
    mbPerRequest: 16,
    maxBytes: 192 * MB,
  },
  upload: {
    durationMs: 9000,
    warmupMs: 2000,
    concurrency: 3,
    mbPerPost: 2,
    maxBytes: 48 * MB,
  },
} as const;

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

function fmtMiB(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  return `${(bytes / MB).toFixed(1)} MiB`;
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

function pingConfidence(summary: PingSummary | null): ConfidenceGrade | null {
  if (!summary) return null;
  if (summary.received >= 10 && summary.lossPct <= 2) return "A";
  if (summary.received >= 8 && summary.lossPct <= 5) return "B";
  if (summary.received >= 5 && summary.lossPct <= 12) return "C";
  return "D";
}

function throughputConfidence(series: number[]): ConfidenceGrade | null {
  const s = summarize(series);
  if (!s || s.n < 2 || s.median <= 0) return null;
  const spreadRatio = (s.p95 - s.median) / s.median;
  if (s.n >= 6 && spreadRatio <= 0.25) return "A";
  if (s.n >= 5 && spreadRatio <= 0.45) return "B";
  if (s.n >= 3 && spreadRatio <= 0.7) return "C";
  return "D";
}

function phaseAnnouncement(phase: Phase, error: string) {
  switch (phase) {
    case "idle":
      return "Speed test is ready to start.";
    case "ping":
      return "Running idle latency and jitter sampling.";
    case "download":
      return "Running sustained download test and loaded latency checks.";
    case "upload":
      return "Running sustained upload test and loaded latency checks.";
    case "done":
      return "Speed test finished. Results are ready.";
    case "canceled":
      return "Speed test canceled.";
    case "error":
      return `Speed test failed${error ? `: ${error}` : "."}`;
    default:
      return "Speed test status updated.";
  }
}

function confidenceBadgeClasses(grade: ConfidenceGrade) {
  if (grade === "A") return "bg-emerald-400/20 text-emerald-200 ring-emerald-300/30";
  if (grade === "B") return "bg-cyan-400/20 text-cyan-200 ring-cyan-300/30";
  if (grade === "C") return "bg-amber-400/20 text-amber-100 ring-amber-300/30";
  return "bg-red-400/20 text-red-200 ring-red-300/30";
}

export default function SpeedTestClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [announcement, setAnnouncement] = useState("Speed test is ready to start.");
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
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

  useEffect(() => {
    setAnnouncement(phaseAnnouncement(phase, error));
  }, [phase, error]);

  useEffect(() => {
    let active = true;
    const loadServerInfo = async () => {
      try {
        const res = await fetch("/api/speed/server", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as ServerInfo;
        if (active) setServerInfo(json);
      } catch {
        // Keep UI functional even when metadata probe fails.
      }
    };
    void loadServerInfo();
    return () => {
      active = false;
    };
  }, []);

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

  const estimatedDownloadBytes = TEST_CONFIG.download.maxBytes;
  const estimatedUploadBytes = TEST_CONFIG.upload.maxBytes;
  const estimatedTotalBytes = estimatedDownloadBytes + estimatedUploadBytes;

  const run = async () => {
    setError("");
    setLastResult(null);
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
      const p = await measurePing({ ...TEST_CONFIG.ping, ...control });
      if (control.isCanceled()) return;
      setUnloadedPing(p);

      setPhase("download");
      const [d, dLoaded] = await Promise.all([
        measureDownload({ ...TEST_CONFIG.download, ...control }),
        measurePingForDuration({
          durationMs: TEST_CONFIG.download.durationMs,
          intervalMs: 180,
          timeoutMs: TEST_CONFIG.ping.timeoutMs,
          ...control,
        }),
      ]);
      if (control.isCanceled()) return;
      setDownloadMbps(d.mbps);
      setDownloadSeries(d.seriesMbps);
      setLoadedDownloadPing(dLoaded);

      setPhase("upload");
      const [u, uLoaded] = await Promise.all([
        measureUpload({ ...TEST_CONFIG.upload, ...control }),
        measurePingForDuration({
          durationMs: TEST_CONFIG.upload.durationMs,
          intervalMs: 180,
          timeoutMs: TEST_CONFIG.ping.timeoutMs,
          ...control,
        }),
      ]);
      if (control.isCanceled()) return;
      setUploadMbps(u.mbps);
      setUploadSeries(u.seriesMbps);
      setLoadedUploadPing(uLoaded);

      setLastResult({
        finishedAtIso: new Date().toISOString(),
        phase: "done",
        server: serverInfo,
        config: TEST_CONFIG,
        metrics: {
          idlePing: p,
          loadedDownloadPing: dLoaded,
          loadedUploadPing: uLoaded,
          downloadMbps: d.mbps,
          uploadMbps: u.mbps,
          downloadSeriesMbps: d.seriesMbps,
          uploadSeriesMbps: u.seriesMbps,
          downloadBytes: d.totalBytes,
          uploadBytes: u.totalBytes,
          totalBytes: d.totalBytes + u.totalBytes,
        },
      });

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

  const exportResultJson = () => {
    if (!lastResult) return;
    const blob = new Blob([JSON.stringify(lastResult, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeIso = lastResult.finishedAtIso.replace(/[:.]/g, "-");
    a.href = url;
    a.download = `speedtest-result-${safeIso}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unloadedMedian = unloadedPing?.medianMs ?? null;
  const idleConfidence = pingConfidence(unloadedPing);
  const loadedDownloadConfidence = pingConfidence(loadedDownloadPing);
  const loadedUploadConfidence = pingConfidence(loadedUploadPing);
  const downloadConfidence = throughputConfidence(downloadSeries);
  const uploadConfidence = throughputConfidence(uploadSeries);

  return (
    <div className="grid gap-6">
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

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
          <div className="space-y-1 text-sm text-white/70">
            <div>
              Phase:{" "}
              <span className="font-mono text-xs text-white/85">
                {phase === "idle" ? "READY" : phase.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-white/60">
              Estimated max data usage per run: {fmtMiB(estimatedTotalBytes)}
              {" "}({fmtMiB(estimatedDownloadBytes)} down +{" "}
              {fmtMiB(estimatedUploadBytes)} up)
            </div>
            {lastResult ? (
              <div className="text-xs text-white/60">
                Last run used {fmtMiB(lastResult.metrics.totalBytes)} (
                {fmtMiB(lastResult.metrics.downloadBytes)} down +{" "}
                {fmtMiB(lastResult.metrics.uploadBytes)} up).
              </div>
            ) : null}
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
            <button
              className="rounded-xl bg-sky-400/20 px-4 py-3 text-sm font-semibold text-sky-100 ring-1 ring-sky-300/30 hover:bg-sky-400/25 disabled:opacity-40"
              onClick={exportResultJson}
              disabled={!lastResult || isRunning}
            >
              Export JSON
            </button>
          </div>
        </div>
        {serverInfo ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/65">
            Server: {serverInfo.region} | runtime {serverInfo.runtime} |{" "}
            {serverInfo.host}
          </div>
        ) : null}
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
          grade={idleConfidence}
        />
        <Metric
          label="Jitter (idle median |Δ|)"
          value={fmtMs(unloadedPing?.jitterMs ?? null)}
          grade={idleConfidence}
        />
        <Metric
          label="Packet loss (idle)"
          value={fmtPct(unloadedPing?.lossPct ?? null)}
          grade={idleConfidence}
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
          note={`confidence D:${downloadConfidence ?? "-"} U:${uploadConfidence ?? "-"}`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Metric
          label="Loaded latency during download"
          value={fmtMs(loadedDownloadPing?.medianMs ?? null)}
          grade={loadedDownloadConfidence}
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
          grade={loadedUploadConfidence}
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
            Warmup is discarded (2s warmup, 7s sustained window). Confidence{" "}
            {downloadConfidence ?? "-"}.
          </div>
          <Sparkline series={downloadSeries} />
          <SeriesStats series={downloadSeries} />
        </Panel>
        <Panel title="Upload stability (sustained Mbps)">
          <div className="mb-2 text-xs text-white/60">
            Warmup is discarded (2s warmup, 7s sustained window). Confidence{" "}
            {uploadConfidence ?? "-"}.
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
  grade,
}: {
  label: string;
  value: string;
  note?: string;
  grade?: ConfidenceGrade | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold text-white/60">{label}</div>
        {grade ? <ConfidenceBadge grade={grade} /> : null}
      </div>
      <div className="mt-2 font-mono text-2xl text-white/90">{value}</div>
      {note ? <div className="mt-1 text-xs text-white/55">{note}</div> : null}
    </div>
  );
}

function ConfidenceBadge({ grade }: { grade: ConfidenceGrade }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${confidenceBadgeClasses(
        grade,
      )}`}
      title="Confidence grade based on sample count, packet loss, and stability variance."
    >
      {grade}
    </span>
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
    maxBytes: number;
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
    while (
      performance.now() < endAt &&
      totalBytes < opts.maxBytes &&
      !opts.isCanceled()
    ) {
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
        while (
          performance.now() < endAt &&
          totalBytes < opts.maxBytes &&
          !opts.isCanceled()
        ) {
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
    totalBytes,
  } satisfies ThroughputMeasurement;
}

async function measureUpload(
  opts: {
    durationMs: number;
    warmupMs: number;
    concurrency: number;
    mbPerPost: number;
    maxBytes: number;
  } & RequestControl,
) {
  const startAt = performance.now();
  const endAt = startAt + opts.durationMs;
  const warmupAt = startAt + Math.min(Math.max(opts.warmupMs, 0), opts.durationMs);
  let totalBytes = 0;
  let bytesAtWarmup = 0;
  let warmupCaptured = warmupAt <= startAt;
  const seriesMbps: number[] = [];

  const payload = new Uint8Array(opts.mbPerPost * MB);
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
    while (
      performance.now() < endAt &&
      totalBytes < opts.maxBytes &&
      !opts.isCanceled()
    ) {
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
    totalBytes,
  } satisfies ThroughputMeasurement;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
