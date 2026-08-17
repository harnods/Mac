/**
 * Where customers land when they scan a table QR.
 *
 * Set NEXT_PUBLIC_ORDER_BASE_URL (e.g. https://myorder.machimoto.cafe) to point
 * QR codes at the customer domain. Until it's set, QR codes fall back to the
 * app's own origin so they keep working during development / before DNS is live.
 */
export function customerOrderBaseUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_ORDER_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Full URL a customer opens for a given table QR code. */
export function tableOrderUrl(code: string, fallbackOrigin?: string): string {
  return `${customerOrderBaseUrl(fallbackOrigin)}/order/t/${code}`;
}
