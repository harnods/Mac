// Payment provider abstraction. Today a mock QRIS provider drives the full
// flow with no external account; swapping in Midtrans (sandbox → live) later is
// just another implementation of PaymentProvider + a PAYMENT_PROVIDER env flag.
import QRCode from "qrcode";

export type Charge = {
  /** e.g. "qris" */
  method: string;
  /** QR image as a data: URL, ready to render in an <img>. */
  qrDataUrl: string;
  /** Provider's charge/transaction reference. */
  providerRef: string;
  /** ISO expiry. */
  expiresAt: string;
  /** True for the mock provider — the UI can offer a "simulate paid" action. */
  mock: boolean;
};

export interface PaymentProvider {
  name: string;
  createCharge(input: { orderId: string; orderNumber: string; amount: number }): Promise<Charge>;
}

const MockProvider: PaymentProvider = {
  name: "mock",
  async createCharge({ orderId, orderNumber, amount }) {
    // A realistic-looking QRIS payload string (not a real MPM QR, just for the
    // demo). Encoded to an actual scannable QR so the screen looks genuine.
    const payload = `00020101021226MACHIMOTO${orderNumber}5204581253033605802ID5909Machimoto6007Jakarta54${String(Math.round(amount))}6304MOCK`;
    const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 480, color: { dark: "#0a0a0a", light: "#ffffff" } });
    return {
      method: "qris",
      qrDataUrl,
      providerRef: `MOCK-${orderId.slice(0, 8).toUpperCase()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      mock: true,
    };
  },
};

export function getPaymentProvider(): PaymentProvider {
  // switch on process.env.PAYMENT_PROVIDER later ("midtrans" → MidtransProvider)
  return MockProvider;
}
