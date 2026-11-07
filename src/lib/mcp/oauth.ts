import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const CODE_TTL = 5 * 60 * 1000;

function getSecret(): Buffer {
  const s = process.env.MCP_OAUTH_SECRET;
  if (!s) throw new Error("MCP_OAUTH_SECRET not set");
  return crypto.createHash("sha256").update(s).digest();
}

interface AuthCodePayload {
  access_token: string;
  refresh_token: string;
  user_id: string;
  redirect_uri: string;
  client_id: string;
  nonce: string;
}

export function encryptAuthCode(payload: Omit<AuthCodePayload, "nonce">): string {
  const key = getSecret();
  const iv = crypto.randomBytes(16);
  const nonce = crypto.randomBytes(16).toString("hex");
  const data = JSON.stringify({ ...payload, nonce, exp: Date.now() + CODE_TTL });
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptAuthCode(
  code: string,
  expectedRedirectUri: string,
  expectedClientId: string,
): AuthCodePayload {
  const key = getSecret();
  const buf = Buffer.from(code, "base64url");
  if (buf.length < 33) throw new Error("Invalid auth code");
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const dec = decipher.update(enc) + decipher.final("utf8");
  const payload = JSON.parse(dec);

  if (payload.exp < Date.now()) throw new Error("Auth code expired");
  if (payload.redirect_uri !== expectedRedirectUri) {
    throw new Error("redirect_uri mismatch");
  }
  if (payload.client_id !== expectedClientId) {
    throw new Error("client_id mismatch");
  }

  return payload;
}

const ALLOWED_REDIRECT_HOSTS = new Set([
  "app.envoy.mekari.com",
  "envoy.mekari.com",
  "localhost",
  "127.0.0.1",
]);

export function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (ALLOWED_REDIRECT_HOSTS.has(url.hostname)) return true;
    if (url.hostname.endsWith(".mekari.com")) return true;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    return false;
  } catch {
    return false;
  }
}

const MCP_ALLOWED_ORIGINS = [
  "https://app.envoy.mekari.com",
  "https://envoy.mekari.com",
  "https://mac-nu-vert.vercel.app",
];

export function getMcpCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  if (MCP_ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin.endsWith(".mekari.com")) return requestOrigin;
  try {
    const url = new URL(requestOrigin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return requestOrigin;
  } catch { /* invalid origin */ }
  return null;
}
