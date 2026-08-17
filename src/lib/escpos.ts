// Minimal ESC/POS docket builder for 58mm / 80mm thermal printers.
// Produces a Uint8Array of raw bytes to send over Web Bluetooth.

const ESC = 0x1b;
const GS = 0x1d;

type DocketLine = { qty: number; name: string };
export type DocketOrder = {
  orderNumber: string;
  tableName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  items: DocketLine[];
  total: number;
  notes: string | null;
};

class Builder {
  private bytes: number[] = [];

  raw(...b: number[]) {
    this.bytes.push(...b);
    return this;
  }

  text(s: string) {
    // Encode as latin1-ish ASCII; non-ASCII chars are dropped to '?'.
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      this.bytes.push(code < 128 ? code : 0x3f);
    }
    return this;
  }

  line(s = "") {
    return this.text(s).raw(0x0a);
  }

  align(mode: "left" | "center" | "right") {
    const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    return this.raw(ESC, 0x61, n);
  }

  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** size: 0 = normal, 1 = double width+height */
  size(big: boolean) {
    return this.raw(GS, 0x21, big ? 0x11 : 0x00);
  }

  init() {
    return this.raw(ESC, 0x40);
  }

  feed(n = 1) {
    for (let i = 0; i < n; i++) this.raw(0x0a);
    return this;
  }

  cut() {
    return this.raw(GS, 0x56, 0x00);
  }

  /**
   * Native ESC/POS QR code (GS ( k), supported by virtually all modern thermal
   * printers. moduleSize is the dot size per QR cell (1-16); ec is the error-
   * correction level: 0=L, 1=M, 2=Q, 3=H.
   */
  qr(data: string, moduleSize = 6, ec: 0 | 1 | 2 | 3 = 1) {
    const storeLen = data.length + 3;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;
    // Select model 2
    this.raw(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Module size
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.max(1, Math.min(16, moduleSize)));
    // Error correction level (48 + level)
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 48 + ec);
    // Store the data in the symbol buffer
    this.raw(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) this.raw(data.charCodeAt(i) & 0xff);
    // Print the buffered symbol
    this.raw(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

export function buildDocket(order: DocketOrder): Uint8Array {
  const b = new Builder();
  const time = new Date(order.createdAt).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  b.init().align("center");
  b.bold(true).line("PESANAN").bold(false);
  b.size(true).line(order.orderNumber).size(false);
  if (order.tableName) b.bold(true).line(order.tableName).bold(false);
  b.line(time);
  b.align("left").line("--------------------------------");

  const label = order.customerName || order.customerPhone;
  if (label) {
    b.line(label);
    if (order.customerName && order.customerPhone) b.line(order.customerPhone);
  }
  b.line("--------------------------------");

  for (const it of order.items) {
    b.bold(true).text(`${it.qty}x `).bold(false).line(it.name);
  }
  b.line("--------------------------------");

  if (order.notes) {
    b.line("Catatan:");
    b.line(order.notes);
    b.line("--------------------------------");
  }

  b.feed(1).align("center").line("Terima kasih!");
  b.feed(3).cut();
  return b.build();
}

/** A table-tent docket: table name + a scannable QR to the customer order page. */
export function buildTableQrDocket(tableName: string, url: string): Uint8Array {
  const b = new Builder();
  b.init().align("center");
  b.size(true).bold(true).line(tableName).bold(false).size(false);
  b.feed(1);
  b.qr(url, 6, 1);
  b.feed(1);
  b.bold(true).line("Scan untuk pesan").bold(false);
  b.line("Menu & order dari HP");
  b.feed(3).cut();
  return b.build();
}

/** A short test receipt used to verify a paired printer works. */
export function buildTestDocket(printedAt: string, deviceLabel?: string): Uint8Array {
  const b = new Builder();
  b.init().align("center");
  b.size(true).line("Machimoto").size(false);
  b.bold(true).line("TEST PRINT").bold(false);
  b.line(printedAt);
  b.align("left").line("--------------------------------");
  if (deviceLabel) b.line(deviceLabel);
  b.line("Printer paired successfully.");
  b.line("--------------------------------");
  b.align("center").line("1234567890");
  b.line("abcdefghijklmnopqrstuvwxyz");
  b.feed(3).cut();
  return b.build();
}
