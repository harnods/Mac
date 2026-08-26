// Payment provider abstraction.
//   - MockProvider: inline QRIS-style QR + "simulate paid" (no account needed).
//   - DokuProvider: DOKU Checkout hosted page (QRIS / GoPay / OVO / DANA /
//     ShopeePay / VA / card). Redirect the customer, DOKU calls our webhook.
// Switch with PAYMENT_PROVIDER=doku once DOKU_CLIENT_ID/DOKU_SECRET_KEY are set.
import crypto from "node:crypto";
import QRCode from "qrcode";

export type Charge = {
  kind: "qr" | "redirect";
  method: string;
  providerRef: string;
  expiresAt: string;
  mock: boolean;
  qrDataUrl?: string; // kind "qr"
  paymentUrl?: string; // kind "redirect"
};

export type CreateChargeInput = {
  orderId: string;
  orderNumber: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  /** Where DOKU sends the customer back after payment. */
  callbackUrl: string;
};

export interface PaymentProvider {
  name: string;
  createCharge(input: CreateChargeInput): Promise<Charge>;
}

// ─── Mock ───────────────────────────────────────────────────────────────────

const MockProvider: PaymentProvider = {
  name: "mock",
  async createCharge({ orderId, orderNumber, amount }) {
    const payload = `00020101021226MACHIMOTO${orderNumber}5204581253033605802ID5909Machimoto6007Jakarta54${String(Math.round(amount))}6304MOCK`;
    const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 480, color: { dark: "#0a0a0a", light: "#ffffff" } });
    return { kind: "qr", method: "qris", qrDataUrl, providerRef: `MOCK-${orderId.slice(0, 8).toUpperCase()}`, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), mock: true };
  },
};

// ─── DOKU (Checkout / Jokul) ─────────────────────────────────────────────────

function dokuBase() {
  return (process.env.DOKU_ENV ?? "sandbox") === "production" ? "https://api.doku.com" : "https://api-sandbox.doku.com";
}
function b64(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64");
}
function sha256b64(s: string) {
  return b64(crypto.createHash("sha256").update(s, "utf8").digest());
}
function hmac256b64(secret: string, s: string) {
  return b64(crypto.createHmac("sha256", secret).update(s, "utf8").digest());
}
/** DOKU signature over the canonical component string. */
function dokuSignature(opts: { clientId: string; secret: string; requestId: string; timestamp: string; target: string; rawBody: string }) {
  const digest = sha256b64(opts.rawBody);
  const component =
    `Client-Id:${opts.clientId}\n` +
    `Request-Id:${opts.requestId}\n` +
    `Request-Timestamp:${opts.timestamp}\n` +
    `Request-Target:${opts.target}\n` +
    `Digest:${digest}`;
  return "HMACSHA256=" + hmac256b64(opts.secret, component);
}

const DokuProvider: PaymentProvider = {
  name: "doku",
  async createCharge({ orderId, orderNumber, amount, customerName, customerPhone, callbackUrl }) {
    const clientId = process.env.DOKU_CLIENT_ID!;
    const secret = process.env.DOKU_SECRET_KEY!;
    const target = "/checkout/v1/payment";
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().split(".")[0] + "Z";
    const body = {
      order: { amount: Math.round(amount), invoice_number: orderNumber, currency: "IDR", callback_url: callbackUrl },
      payment: { payment_due_date: 60 },
      customer: {
        id: orderId,
        name: customerName,
        email: `order+${customerPhone.replace(/[^0-9]/g, "")}@machimoto.cafe`,
        phone: customerPhone.replace(/[^0-9]/g, ""),
      },
    };
    const rawBody = JSON.stringify(body);
    const signature = dokuSignature({ clientId, secret, requestId, timestamp, target, rawBody });

    const res = await fetch(dokuBase() + target, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Id": clientId, "Request-Id": requestId, "Request-Timestamp": timestamp, Signature: signature },
      body: rawBody,
    });
    const json = await res.json().catch(() => ({}));
    // DOKU Checkout wraps the result in `response`: response.payment.url / token_id.
    const payment = json?.response?.payment ?? json?.payment;
    if (!res.ok || !payment?.url) {
      const msg = json?.error?.message ?? (Array.isArray(json?.message) ? json.message.join(", ") : json?.message);
      throw new Error(msg || `DOKU error (${res.status})`);
    }
    return {
      kind: "redirect",
      method: "doku",
      paymentUrl: payment.url as string,
      providerRef: (payment.token_id as string) ?? requestId,
      // DOKU's expired_date is yyyyMMddHHmmss (UTC+7); derive a clean ISO expiry from our due date instead.
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      mock: false,
    };
  },
};

/** Verify a DOKU notification (webhook) signature against the raw request body. */
export function verifyDokuNotification(headers: Headers, rawBody: string): boolean {
  const clientId = process.env.DOKU_CLIENT_ID;
  const secret = process.env.DOKU_SECRET_KEY;
  const sig = headers.get("Signature");
  const requestId = headers.get("Request-Id");
  const timestamp = headers.get("Request-Timestamp");
  if (!clientId || !secret || !sig || !requestId || !timestamp) return false;
  const expected = dokuSignature({ clientId, secret, requestId, timestamp, target: "/api/doku/notify", rawBody });
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function getPaymentProvider(): PaymentProvider {
  if ((process.env.PAYMENT_PROVIDER ?? "").toLowerCase() === "doku" && process.env.DOKU_CLIENT_ID && process.env.DOKU_SECRET_KEY) {
    return DokuProvider;
  }
  return MockProvider;
}
