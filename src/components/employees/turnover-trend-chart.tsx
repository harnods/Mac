export type TurnoverPoint = { label: string; end: number };

/** Lightweight inline-SVG line chart of month-end headcount (no chart lib). */
export function TurnoverTrendChart({ data }: { data: TurnoverPoint[] }) {
  // Wide viewBox so the chart fills the card width without ballooning in height.
  const W = 1400;
  const H = 220;
  const padL = 44;
  const padR = 24;
  const padT = 24;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const maxV = Math.max(1, ...data.map((d) => d.end));

  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + (1 - v / maxV) * plotH;

  const pts = data.map((d, i) => ({ ...d, cx: x(i), cy: y(d.end) }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(" ");
  const baseline = padT + plotH;
  const area = n > 1 ? `${line} L ${pts[n - 1].cx.toFixed(1)} ${baseline} L ${pts[0].cx.toFixed(1)} ${baseline} Z` : "";
  const grid = [0, 0.5, 1]; // fractions of maxV

  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm font-semibold">Headcount trend</div>
      <div className="mb-3 text-xs text-muted-foreground">Active crew at the end of each month</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full text-primary"
        role="img"
        aria-label="Monthly headcount trend"
      >
        <defs>
          <linearGradient id="turnoverTrendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
          </linearGradient>
        </defs>
        {grid.map((g) => {
          const v = Math.round(g * maxV);
          const gy = y(g * maxV);
          return (
            <g key={g}>
              <line
                x1={padL}
                y1={gy}
                x2={W - padR}
                y2={gy}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={g === 0 ? undefined : "4 4"}
              />
              <text x={padL - 8} y={gy + 4} textAnchor="end" className="fill-muted-foreground text-[12px] tabular-nums">
                {v}
              </text>
            </g>
          );
        })}

        {n > 1 && <path d={area} fill="url(#turnoverTrendGrad)" stroke="none" />}
        {n > 1 && (
          <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r={4.5} fill="currentColor" />
            <text x={p.cx} y={p.cy - 12} textAnchor="middle" className="fill-foreground text-[13px] tabular-nums">
              {p.end}
            </text>
            <text x={p.cx} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[13px]">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
