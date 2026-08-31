"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/site";

export type MenuItem = { id: string; name: string; description: string | null; imageUrl: string | null };
export type MenuCategory = { id: string; name: string; items: MenuItem[] };

type Card = MenuItem & { cat: string; key: string };
type Pos = { x: number; y: number; rot: number; z: number };

const CW = 180, CH = 262, GAP = 15, PITCH_X = CW + GAP, PITCH_Y = CH + GAP, MAX_COLS = 5;
const INK = "#3d3929", ACCENT = "#a4562f", PAPER = "#f0eee6", CARD = "#fffdf9", DARK = "#1c1a17", TILE = "#eae7dd";
const SANS = "'Scoutie Sans','ScoutieSans',ui-sans-serif,system-ui,-apple-system,'Helvetica Neue',sans-serif";
const MONO = "ui-monospace,Menlo,monospace";

const PAPER_TEX = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23p)' opacity='0.115'/%3E%3C/svg%3E\")";
const FIBER_TEX = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.012 0.5' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='320' height='320' filter='url(%23f)' opacity='0.075'/%3E%3C/svg%3E\")";
const CARD_TEX = "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22200%22%20height=%22200%22%3E%3Cfilter%20id=%22c%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.9%22%20numOctaves=%224%22%20stitchTiles=%22stitch%22/%3E%3CfeColorMatrix%20type=%22saturate%22%20values=%220%22/%3E%3C/filter%3E%3Crect%20width=%22200%22%20height=%22200%22%20filter=%22url%28%23c%29%22%20opacity=%220.09%22/%3E%3C/svg%3E";

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

export function MenuBoard({ categories }: { categories: MenuCategory[] }) {
  const allCards: Card[] = categories.flatMap((c) => c.items.map((it) => ({ ...it, cat: c.name, key: `${c.name}/${it.id}` })));
  const cats = ["All", ...categories.map((c) => c.name)];

  const [cat, setCat] = useState("All");
  const [pos, setPos] = useState<Record<string, Pos>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [height, setHeight] = useState(1200);
  const [open, setOpen] = useState<Card | null>(null);
  const [showSticky, setShowSticky] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const lastW = useRef(0);
  const zTop = useRef(1);
  const drag = useRef<{ key: string; el: HTMLElement; sx: number; sy: number; ox: number; oy: number; rot: number; nx: number; ny: number; moved: boolean } | null>(null);

  const visible = useCallback((c: string): Card[] => {
    const list = c === "All" ? shuffle(allCards) : allCards.filter((i) => i.cat === c);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const layout = useCallback((c: string) => {
    const w = (canvasRef.current?.clientWidth ?? 1000);
    lastW.current = w;
    const cols = Math.max(1, Math.min(MAX_COLS, Math.floor((w + GAP) / PITCH_X)));
    const spanW = cols * PITCH_X - GAP;
    const left = Math.max(0, (w - spanW) / 2);
    const list = visible(c);
    const next: Record<string, Pos> = {};
    list.forEach((it, i) => {
      const col = i % cols, row = (i / cols) | 0;
      next[it.key] = {
        x: left + col * PITCH_X + (Math.random() - 0.5) * 15,
        y: row * PITCH_Y + (Math.random() - 0.5) * 17 + (col % 2 ? 9 : 0),
        rot: (Math.random() - 0.5) * 6.4, z: 1,
      };
    });
    const rows = Math.ceil(list.length / cols) || 1;
    zTop.current = 1;
    setOrder(list.map((i) => i.key));
    setPos(next);
    setHeight(rows * PITCH_Y + 40);
  }, [visible]);

  useEffect(() => { layout("All"); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      if (Math.abs(nw - lastW.current) > 2) layout(cat);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cat, layout]);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 200);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("keydown", onKey); };
  }, []);

  function pickCat(c: string) { setCat(c); layout(c); window.scrollTo({ top: 0, behavior: "smooth" }); }

  // Collision resolve on drop (ported from the design).
  function resolve(p: Record<string, Pos>, pinned: string): number {
    const ids = Object.keys(p), PAD = 5;
    for (let iter = 0; iter < 60; iter++) {
      let hit = false;
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const A = p[ids[i]], B = p[ids[j]];
        const dx = B.x - A.x, dy = B.y - A.y;
        const ox = (CW + PAD) - Math.abs(dx), oy = (CH + PAD) - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        hit = true;
        const aPin = ids[i] === pinned, bPin = ids[j] === pinned;
        if (ox / (CW + PAD) < oy / (CH + PAD)) {
          const s = (dx >= 0 ? 1 : -1) * ox;
          if (aPin) B.x += s; else if (bPin) A.x -= s; else { A.x -= s / 2; B.x += s / 2; }
        } else {
          const s = (dy >= 0 ? 1 : -1) * oy;
          if (aPin) B.y += s; else if (bPin) A.y -= s; else { A.y -= s / 2; B.y += s / 2; }
        }
      }
      if (!hit) break;
    }
    const w = lastW.current || 1000;
    let maxY = 0;
    ids.forEach((k) => {
      const q = p[k];
      q.x = Math.max(-6, Math.min(w - CW + 6, q.x));
      q.y = Math.max(0, q.y);
      if (q.y + CH > maxY) maxY = q.y + CH;
    });
    return maxY + 40;
  }

  function onCardDown(e: React.PointerEvent, key: string) {
    const el = e.currentTarget as HTMLElement;
    const p = pos[key];
    if (!p) return;
    el.setPointerCapture(e.pointerId);
    zTop.current += 1;
    drag.current = { key, el, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, rot: p.rot, nx: p.x, ny: p.y, moved: false };
    el.style.transition = "none";
    el.style.zIndex = "500";
    el.style.cursor = "grabbing";
  }
  function onCardMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    d.moved = true; d.nx = d.ox + dx; d.ny = d.oy + dy;
    d.el.style.transform = `translate3d(${d.nx}px,${d.ny}px,0) rotate(${d.rot * 0.4}deg) scale(1.045)`;
  }
  function onCardUp(key: string) {
    const d = drag.current; if (!d) return;
    drag.current = null;
    d.el.style.cursor = "grab";
    if (!d.moved) { setOpen(allCards.find((i) => i.key === key) ?? null); return; }
    const next: Record<string, Pos> = {};
    Object.keys(pos).forEach((k) => (next[k] = { ...pos[k] }));
    next[key] = { ...next[key], x: d.nx, y: d.ny, z: zTop.current };
    const h = resolve(next, key);
    setPos(next);
    setHeight(Math.max(h, 400));
  }

  const cards = order.map((k) => allCards.find((i) => i.key === k)).filter(Boolean) as Card[];
  const hasHours = SITE.hours.length > 0;
  const hasAddress = SITE.address.some((a) => a && !a.startsWith("["));

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK }}>
      <style>{`
        .mm-board{}
        @media (max-width: 900px){
          .mm-board{flex-direction:column !important}
          .mm-info{position:static !important;width:auto !important;order:-1;display:flex;flex-wrap:wrap;gap:26px !important}
          .mm-info > *{margin-top:0 !important}
        }
        @media (max-width: 720px){
          .mm-modal{grid-template-columns:1fr !important}
        }
      `}</style>
      {/* Header */}
      <header style={{ position: "relative", zIndex: 900, background: PAPER, borderBottom: "1px solid rgba(61,57,41,.09)" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 22px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-machimoto.svg" alt="Machimoto" style={{ height: 88, width: "auto" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <a href={SITE.order} target="_blank" rel="noopener" style={{ font: `500 13px/1 ${SANS}`, color: "#faf9f5", background: DARK, borderRadius: 999, padding: "13px 22px", letterSpacing: ".02em" }}>Grab &amp; Go</a>
            <button type="button" onClick={() => layout(cat)} title="Shuffle every card back onto the grid" style={{ font: `500 13px/1 ${SANS}`, color: INK, background: CARD, border: "1px solid rgba(61,57,41,.16)", borderRadius: 999, padding: "12px 19px", cursor: "pointer", letterSpacing: ".02em" }}>Tidy the table</button>
          </div>
        </div>
      </header>

      {/* Board */}
      <div className="mm-board" style={{ maxWidth: 1360, margin: "0 auto", padding: "26px 22px 0", display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Cards canvas */}
        <div
          ref={canvasRef}
          style={{
            position: "relative", flex: "1 1 auto", minWidth: 0, height,
            backgroundImage: `${PAPER_TEX},${FIBER_TEX},linear-gradient(to right,rgba(61,57,41,.055) 1px,transparent 1px),linear-gradient(to bottom,rgba(61,57,41,.055) 1px,transparent 1px)`,
            backgroundSize: "200px 200px,320px 320px,39px 39px,39px 39px",
          }}
        >
          {cards.map((c) => {
            const p = pos[c.key] ?? { x: 0, y: 0, rot: 0, z: 1 };
            return (
              <div
                key={c.key}
                onPointerDown={(e) => onCardDown(e, c.key)}
                onPointerMove={onCardMove}
                onPointerUp={() => onCardUp(c.key)}
                onPointerCancel={() => onCardUp(c.key)}
                style={{
                  position: "absolute", left: 0, top: 0, width: CW, height: CH,
                  transform: `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) rotate(${p.rot.toFixed(2)}deg)`,
                  zIndex: p.z + 10, cursor: "grab", touchAction: "none", userSelect: "none",
                  transition: drag.current?.key === c.key ? "none" : "transform .42s cubic-bezier(.2,.9,.25,1)",
                }}
              >
                <div style={{ width: "100%", height: "100%", boxSizing: "border-box", background: `${CARD} url(${CARD_TEX})`, border: "1px solid rgba(61,57,41,.1)", borderRadius: 15, boxShadow: "0 1px 2px rgba(61,57,41,.08),0 14px 26px -20px rgba(61,57,41,.45)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ position: "relative", width: "100%", aspectRatio: "1", overflow: "hidden", background: TILE, flex: "none" }}>
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.name} draggable={false} loading="lazy" decoding="async" width={480} height={480} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none", userSelect: "none" }} />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "repeating-linear-gradient(135deg,#eae7dd 0 7px,#e3dfd3 7px 14px)" }}>
                        <span style={{ font: `400 9px/1.3 ${MONO}`, color: "rgba(61,57,41,.5)", textAlign: "center", padding: "0 8px" }}>photo<br />pending</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 13px 16px" }}>
                    <div style={{ font: `500 9.5px/1 ${SANS}`, letterSpacing: ".09em", textTransform: "uppercase", color: "rgba(61,57,41,.5)" }}>{c.cat}</div>
                    <div style={{ font: `500 13px/1.35 ${SANS}`, color: INK, minHeight: "2.7em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.name}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info sidebar */}
        <aside className="mm-info" style={{ position: "sticky", top: 24, width: CW, flex: "none", alignSelf: "flex-start", paddingTop: 4 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ font: `500 9.5px/1 ${SANS}`, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(61,57,41,.42)" }}>Menu</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
              {cats.map((c) => {
                const on = c === cat;
                return (
                  <button key={c} type="button" onClick={() => pickCat(c)} style={{ font: `${on ? "600" : "500"} 12.5px/1.55 ${SANS}`, textAlign: "left", padding: "2px 0", background: "none", border: "none", cursor: "pointer", color: on ? ACCENT : "rgba(61,57,41,.72)", textDecoration: on ? "underline" : "none", textUnderlineOffset: 3 }}>
                    {c === "All" ? "Everything" : c}
                  </button>
                );
              })}
            </div>
          </div>

          {hasAddress && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 26 }}>
              <div style={{ font: `500 9.5px/1 ${SANS}`, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(61,57,41,.42)" }}>Find us</div>
              <div style={{ font: `500 12.5px/1.6 ${SANS}`, color: INK }}>{SITE.name}</div>
              <div style={{ font: `400 10.5px/1.7 ${MONO}`, color: "rgba(61,57,41,.5)" }}>
                {SITE.address.map((l, i) => <span key={i}>{l}<br /></span>)}
                {SITE.mapsUrl && <a href={SITE.mapsUrl} target="_blank" rel="noopener">Google Maps</a>}
              </div>
            </div>
          )}

          {hasHours && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 22 }}>
              <div style={{ font: `500 9.5px/1 ${SANS}`, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(61,57,41,.42)" }}>Hours</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {SITE.hours.map((h, i) => (
                  <div key={i} style={{ font: `400 10.5px/1.5 ${MONO}`, color: "rgba(61,57,41,.5)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ minWidth: 58, display: "inline-block" }}>{h.days}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {h.sun && <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>☀️</span>}
                      {h.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 22, alignItems: "flex-start" }}>
            <a href={SITE.instagram} target="_blank" rel="noopener" style={{ font: `400 12px/1.6 ${SANS}`, color: ACCENT }}>Instagram</a>
            <a href={SITE.order} target="_blank" rel="noopener" style={{ font: `400 12px/1.6 ${SANS}`, color: ACCENT }}>Grab &amp; Go</a>
          </div>
        </aside>
      </div>

      <footer style={{ maxWidth: 1360, margin: "44px auto 0", padding: "26px 22px 40px", borderTop: "1px solid rgba(61,57,41,.09)", font: `400 11.5px/1.6 ${SANS}`, color: "rgba(61,57,41,.45)" }}>© 2026 Machimoto</footer>

      {/* Sticky CTA */}
      <a href={SITE.order} target="_blank" rel="noopener" style={{ position: "fixed", left: "50%", bottom: 26, zIndex: 950, transform: showSticky ? "translate(-50%,0)" : "translate(-50%,22px)", opacity: showSticky ? 1 : 0, pointerEvents: showSticky ? "auto" : "none", transition: "opacity .28s cubic-bezier(.22,.61,.36,1),transform .28s cubic-bezier(.22,.61,.36,1)", font: `500 13px/1 ${SANS}`, letterSpacing: ".02em", color: "#faf9f5", background: DARK, borderRadius: 999, padding: "15px 26px", boxShadow: "0 10px 30px -10px rgba(28,26,23,.55)" }}>Grab &amp; Go</a>

      {/* Modal */}
      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(40,37,28,.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(760px,100%)", maxHeight: "88vh", overflow: "auto", background: "#faf9f5", borderRadius: 24, boxShadow: "0 40px 90px -30px rgba(40,37,28,.55)", display: "grid", gridTemplateColumns: "minmax(0,300px) 1fr" }} className="mm-modal">
            <div style={{ position: "relative", background: TILE, minHeight: 260 }}>
              {open.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.imageUrl} alt={open.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "repeating-linear-gradient(135deg,#eae7dd 0 10px,#e3dfd3 10px 20px)" }}>
                  <span style={{ font: `400 11px/1.4 ${MONO}`, color: "rgba(61,57,41,.5)" }}>product photo pending</span>
                </div>
              )}
            </div>
            <div style={{ padding: "34px 34px 30px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ font: `500 10px/1 ${SANS}`, letterSpacing: ".14em", textTransform: "uppercase", color: ACCENT }}>{open.cat}</div>
              <div style={{ font: `500 26px/1.25 ${SANS}`, color: INK }}>{open.name}</div>
              <div style={{ height: 1, background: "rgba(61,57,41,.11)" }} />
              {open.description && <div style={{ font: `400 12.5px/1.7 ${SANS}`, color: "rgba(61,57,41,.7)" }}>{open.description}</div>}
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 6 }}>
                <a href={SITE.order} target="_blank" rel="noopener" style={{ font: `500 13px/1 ${SANS}`, color: "#faf9f5", background: DARK, borderRadius: 999, padding: "14px 22px" }}>Grab &amp; Go</a>
                <button type="button" onClick={() => setOpen(null)} style={{ font: `500 13px/1 ${SANS}`, color: INK, background: "transparent", border: "1px solid rgba(61,57,41,.18)", borderRadius: 999, padding: "14px 20px", cursor: "pointer" }}>Back to the table</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
