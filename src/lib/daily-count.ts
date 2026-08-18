/**
 * Daily stock reconciliation math.
 *
 *   expected closing = opening + received − sold − R&D − waste
 *   variance         = counted − expected closing
 *
 * A negative variance means stock is missing beyond what sales, R&D and waste
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
    Number(line.sold_qty) -
    Number(line.rnd_qty ?? 0) -
    Number(line.waste_qty ?? 0)
  );
}

export function varianceOf(line: DailyCountLine, counted: number | null): number | null {
  if (counted == null || !Number.isFinite(counted)) return null;
  return counted - expectedClosing(line);
}
