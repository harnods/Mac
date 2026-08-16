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
