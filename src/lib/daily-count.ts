/**
 * Daily stock reconciliation math.
 *
 *   expected closing = opening + received − R&D − waste
 *   variance         = counted − expected closing
 *
 * Sold is deliberately NOT subtracted here. The daily count is created after
 * the day's sales are recorded, and recording a sale already draws the
 * ingredients down through the recipe — so the opening snapshot is net of
 * sales. Subtracting Sold again would double-count it. The Sold column is
 * carried for reference: it is the theoretical usage already baked into
 * opening.
 *
 * A negative variance means stock is missing beyond what R&D and waste
 * account for (shrinkage); a positive variance means more was found than the
 * movements explain.
 */
export type DailyCountLine = {
  opening_qty: number;
  received_qty: number | null;
  sold_qty: number;
  rnd_qty: number | null;
  waste_qty: number | null;
};

export function expectedClosing(line: DailyCountLine): number {
  return (
    Number(line.opening_qty) +
    Number(line.received_qty ?? 0) -
    Number(line.rnd_qty ?? 0) -
    Number(line.waste_qty ?? 0)
  );
}

export function varianceOf(line: DailyCountLine, counted: number | null): number | null {
  if (counted == null || !Number.isFinite(counted)) return null;
  return counted - expectedClosing(line);
}
