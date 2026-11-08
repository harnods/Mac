/** wa.me link for an Indonesian phone number ("0812…" → "62812…"). */
export function waLink(whatsapp: string): string {
  const digits = whatsapp.replace(/[^\d]/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}`;
}
