export type TurnoverPoint = { label: string; end: number };

/** Lightweight inline-SVG line chart of month-end headcount (no chart lib). */
export function TurnoverTrendChart({ data }: { data: TurnoverPoint[] }) {
  const W = 720;
  const H = 200;
  const padL = 30;
  const padR = 14;
  const padT = 16;
  const padB = 26;
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
        className="h-auto w-full max-w-2xl text-primary"
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
                strokeDasharray={g === 0 ? undefined : "3 3"}
              />
              <text x={padL - 6} y={gy + 3} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                {v}
              </text>
            </g>
          );
        })}

        {n > 1 && <path d={area} fill="url(#turnoverTrendGrad)" stroke="none" />}
        {n > 1 && (
          <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r={3.5} fill="currentColor" />
            <text x={p.cx} y={p.cy - 8} textAnchor="middle" className="fill-foreground text-[10px] tabular-nums">
              {p.end}
            </text>
            <text x={p.cx} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
