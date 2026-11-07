import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const CODE_TTL = 5 * 60 * 1000;

function getSecret(): Buffer {
  const s = process.env.MCP_OAUTH_SECRET;
  if (!s) throw new Error("MCP_OAUTH_SECRET not set");
  return crypto.createHash("sha256").update(s).digest();
}

export function encryptAuthCode(payload: {
  access_token: string;
  refresh_token: string;
  user_id: string;
}): string {
  const key = getSecret();
  const iv = crypto.randomBytes(16);
  const data = JSON.stringify({ ...payload, exp: Date.now() + CODE_TTL });
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptAuthCode(code: string): {
  access_token: string;
  refresh_token: string;
  user_id: string;
} {
  const key = getSecret();
  const buf = Buffer.from(code, "base64url");
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const dec = decipher.update(enc) + decipher.final("utf8");
  const payload = JSON.parse(dec);
  if (payload.exp < Date.now()) throw new Error("Auth code expired");
  return payload;
}
