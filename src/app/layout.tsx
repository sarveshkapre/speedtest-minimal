import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Network Reactor",
  description: "Minimal, modern internet diagnostics: page load, IP metadata, BGP/ASN, and speed tests.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-dvh bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(900px_circle_at_90%_10%,rgba(34,197,94,0.18),transparent_55%),linear-gradient(to_bottom,#0b0f1a,#070913_25%,#060815)] text-zinc-100">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-black/20 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="group inline-flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <span className="text-sm font-semibold tracking-tight">NR</span>
                </span>
                <span className="text-sm font-semibold tracking-tight text-white/90 group-hover:text-white">
                  Network Reactor
                </span>
              </Link>
              <nav className="hidden items-center gap-2 text-sm md:flex">
                <Link href="/page-load" className="rounded-full px-3 py-1 text-white/70 hover:bg-white/10 hover:text-white">
                  Page Load
                </Link>
                <Link href="/my-ip" className="rounded-full px-3 py-1 text-white/70 hover:bg-white/10 hover:text-white">
                  My IP
                </Link>
                <Link href="/bgp" className="rounded-full px-3 py-1 text-white/70 hover:bg-white/10 hover:text-white">
                  BGP
                </Link>
                <Link href="/speedtest" className="rounded-full px-3 py-1 text-white/70 hover:bg-white/10 hover:text-white">
                  Speed Test
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
          <footer className="border-t border-white/10 bg-black/20">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-white/55 md:flex-row md:items-center md:justify-between">
              <div>
                Built for fast diagnostics. Enrichment is best-effort; treat external data as approximate.
              </div>
              <div className="font-mono">v0.1</div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
