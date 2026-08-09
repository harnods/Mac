// Store-network enforcement by public IP. A web app can't read the wifi SSID,
// so we match the request's public IP against an admin-set allowlist of IPs/CIDRs.

/** Best-effort client IP from proxy headers. */
export function clientIp(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip");
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * True if `ip` is allowed. `allowedRaw` is a comma/space separated list of IPv4
 * addresses and/or CIDR ranges. Empty allowlist = no restriction (allow all).
 */
export function isIpAllowed(ip: string | null, allowedRaw: string | null | undefined): boolean {
  if (!allowedRaw || !allowedRaw.trim()) return true;
  if (!ip) return false;
  const entries = allowedRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return entries.some((e) => (e.includes("/") ? inCidr(ip, e) : e === ip));
}
