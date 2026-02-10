function isIPv4(input: string): boolean {
  const parts = input.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

function isIPv6(input: string): boolean {
  // Minimal check: allow hex, colons, and IPv4-mapped suffix.
  if (!/^[0-9a-fA-F:.]+$/.test(input)) return false;
  return input.includes(":");
}

export function normalizeIp(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;
  // x-forwarded-for may contain a chain: "client, proxy1, proxy2"
  if (s.includes(",")) s = s.split(",")[0]?.trim() ?? s;
  // Strip IPv6 brackets: "[::1]" or "[2001:db8::1]"
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  // Strip port: "1.2.3.4:1234"
  if (s.includes(":") && isIPv4(s.split(":")[0] ?? "")) {
    s = s.split(":")[0] ?? s;
  }
  if (isIPv4(s) || isIPv6(s)) return s;
  return null;
}

export function ipVersion(ip: string): "ipv4" | "ipv6" | "unknown" {
  if (isIPv4(ip)) return "ipv4";
  if (isIPv6(ip)) return "ipv6";
  return "unknown";
}

