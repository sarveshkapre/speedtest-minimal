"use client";

import { useMemo, useState } from "react";

type Phase = "idle" | "ping" | "download" | "upload" | "done" | "error";

function mbps(bytes: number, ms: number) {
  const bits = bytes * 8;
  const seconds = ms / 1000;
  return seconds > 0 ? bits / seconds / 1_000_000 : 0;
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(1);
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const clamped = Math.min(1, Math.max(0, q));
  const idx = Math.floor(clamped * (sorted.length - 1));
  return sorted[idx] ?? null;
}

function summarize(series: number[]) {
  if (!series.length) return null;
  const finite = series.filter((v) => Number.isFinite(v) && v >= 0);
  if (!finite.length) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const median = quantile(sorted, 0.5) ?? 0;
  const p95 = quantile(sorted, 0.95) ?? 0;
  return { min, max, median, p95, n: sorted.length };
}

export default function SpeedTestClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [latencies, setLatencies] = useState<number[]>([]);
  const [downloadMbps, setDownloadMbps] = useState<number | null>(null);
  const [uploadMbps, setUploadMbps] = useState<number | null>(null);
  const [downloadSeries, setDownloadSeries] = useState<number[]>([]);
  const [uploadSeries, setUploadSeries] = useState<number[]>([]);

  const jitter = useMemo(() => {
    if (latencies.length < 2) return null;
    const diffs = latencies.slice(1).map((v, i) => Math.abs(v - latencies[i]!));
    diffs.sort((a, b) => a - b);
    return diffs[Math.floor(diffs.length / 2)] ?? null;
  }, [latencies]);

  const medianLatency = useMemo(() => {
    if (!latencies.length) return null;
    const a = [...latencies].sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)] ?? null;
  }, [latencies]);

  const run = async () => {
    setError("");
    setLatencies([]);
    setDownloadMbps(null);
    setUploadMbps(null);
    setDownloadSeries([]);
    setUploadSeries([]);

    try {
      setPhase("ping");
      const p = await measurePing({ samples: 10 });
      setLatencies(p.latenciesMs);

      setPhase("download");
      const d = await measureDownload({
        durationMs: 8000,
        concurrency: 4,
        mbPerRequest: 16,
      });
      setDownloadMbps(d.mbps);
      setDownloadSeries(d.seriesMbps);

      setPhase("upload");
      const u = await measureUpload({
        durationMs: 8000,
        concurrency: 3,
        mbPerPost: 2,
      });
      setUploadMbps(u.mbps);
      setUploadSeries(u.seriesMbps);

      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Speed Test
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-white/65">
          Browser-first throughput test using local endpoints. Results vary by
          device, browser, Wi-Fi, VPN, and server proximity. Treat this as a
          diagnostic, not a lab instrument.
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
          <button
            className="rounded-xl bg-emerald-400/20 px-4 py-3 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-300/30 hover:bg-emerald-400/25 disabled:opacity-50"
            onClick={() => void run()}
            disabled={phase !== "idle" && phase !== "done" && phase !== "error"}
          >
            {phase === "idle" || phase === "done" || phase === "error"
              ? "Run speed test"
              : "Running…"}
          </button>
        </div>
        {error ? (
          <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric
          label="Latency (median)"
          value={medianLatency != null ? `${Math.round(medianLatency)} ms` : "-"}
        />
        <Metric
          label="Jitter (median |Δ|)"
          value={jitter != null ? `${Math.round(jitter)} ms` : "-"}
        />
        <Metric
          label="Download / Upload"
          value={`${downloadMbps != null ? fmt(downloadMbps) : "-"} / ${
            uploadMbps != null ? fmt(uploadMbps) : "-"
          } Mbps`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Download stability (Mbps)">
          <Sparkline series={downloadSeries} />
          <SeriesStats series={downloadSeries} />
        </Panel>
        <Panel title="Upload stability (Mbps)">
          <Sparkline series={uploadSeries} />
          <SeriesStats series={uploadSeries} />
        </Panel>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-xs font-semibold text-white/60">{label}</div>
      <div className="mt-2 font-mono text-2xl text-white/90">{value}</div>
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

async function measurePing(opts: { samples: number }) {
  const latenciesMs: number[] = [];
  for (let i = 0; i < opts.samples; i++) {
    const t0 = performance.now();
    const res = await fetch("/api/speed/ping", { cache: "no-store" });
    if (!res.ok) throw new Error(`ping HTTP ${res.status}`);
    await res.json();
    const dt = performance.now() - t0;
    latenciesMs.push(dt);
    await sleep(120);
  }
  return { latenciesMs };
}

async function measureDownload(opts: {
  durationMs: number;
  concurrency: number;
  mbPerRequest: number;
}) {
  const endAt = performance.now() + opts.durationMs;
  let totalBytes = 0;
  const seriesMbps: number[] = [];

  let lastSampleAt = performance.now();
  let lastBytes = 0;

  const sampler = setInterval(() => {
    const now = performance.now();
    const dt = now - lastSampleAt;
    const db = totalBytes - lastBytes;
    seriesMbps.push(mbps(db, dt));
    lastSampleAt = now;
    lastBytes = totalBytes;
  }, 1000);

  const workers = Array.from({ length: opts.concurrency }, async () => {
    while (performance.now() < endAt) {
      const controller = new AbortController();
      const t = setTimeout(
        () => controller.abort(),
        Math.max(1500, opts.durationMs),
      );
      try {
        const res = await fetch(`/api/speed/download?mb=${opts.mbPerRequest}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`download HTTP ${res.status}`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("download missing body");
        while (performance.now() < endAt) {
          const { value, done } = await reader.read();
          if (done) break;
          totalBytes += value?.byteLength ?? 0;
        }
        controller.abort();
      } catch {
        // ignore transient aborts
      } finally {
        clearTimeout(t);
      }
    }
  });

  await Promise.all(workers);
  clearInterval(sampler);

  const elapsedMs = opts.durationMs;
  return { mbps: mbps(totalBytes, elapsedMs), seriesMbps };
}

async function measureUpload(opts: {
  durationMs: number;
  concurrency: number;
  mbPerPost: number;
}) {
  const endAt = performance.now() + opts.durationMs;
  let totalBytes = 0;
  const seriesMbps: number[] = [];

  const payload = new Uint8Array(opts.mbPerPost * 1024 * 1024);
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 31) & 0xff;

  let lastSampleAt = performance.now();
  let lastBytes = 0;

  const sampler = setInterval(() => {
    const now = performance.now();
    const dt = now - lastSampleAt;
    const db = totalBytes - lastBytes;
    seriesMbps.push(mbps(db, dt));
    lastSampleAt = now;
    lastBytes = totalBytes;
  }, 1000);

  const workers = Array.from({ length: opts.concurrency }, async () => {
    while (performance.now() < endAt) {
      const controller = new AbortController();
      const t = setTimeout(
        () => controller.abort(),
        Math.max(1500, opts.durationMs),
      );
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
        // ignore transient aborts
      } finally {
        clearTimeout(t);
      }
    }
  });

  await Promise.all(workers);
  clearInterval(sampler);

  const elapsedMs = opts.durationMs;
  return { mbps: mbps(totalBytes, elapsedMs), seriesMbps };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
