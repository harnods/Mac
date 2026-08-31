"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/site";

export type MenuItem = { id: string; name: string; description: string | null; imageUrl: string | null };
export type MenuCategory = { id: string; name: string; items: MenuItem[] };

type Card = MenuItem & { cat: string; key: string };
type Pos = { x: number; y: number; rot: number; z: number };

const CW = 180, CH = 262, GAP = 15, PITCH_X = CW + GAP, PITCH_Y = CH + GAP, MAX_COLS = 8;
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

/** The card face (image + category + name), shared by the board and the mobile grid. */
function CardFace({ c, drop, delay }: { c: Card; drop?: boolean; delay?: number }) {
  return (
    <div className={drop ? "mm-card mm-drop" : "mm-card"} style={{ width: "100%", height: "100%", boxSizing: "border-box", background: `${CARD} url(${CARD_TEX})`, border: "1px solid rgba(61,57,41,.1)", borderRadius: 15, boxShadow: "0 1px 2px rgba(61,57,41,.08),0 14px 26px -20px rgba(61,57,41,.45)", overflow: "hidden", display: "flex", flexDirection: "column", animationDelay: drop ? `${delay ?? 0}ms` : undefined }}>
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
  );
}

/** Store info block (Find us / Hours / Follow) — sidebar on desktop, footer on mobile. */
function StoreInfo({ row }: { row?: boolean }) {
  const hasAddress = SITE.address.some((a) => a && !a.startsWith("["));
  const label = { font: `600 9.5px/1 ${SANS}`, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "rgba(61,57,41,.5)" };
  const val = { font: `500 12.5px/1.6 ${SANS}`, color: INK };
  return (
    <div style={{ display: "flex", flexDirection: row ? "row" : "column", flexWrap: "wrap", gap: row ? "24px 56px" : 22 }}>
      {hasAddress && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={label}>Find us</div>
          <div style={val}>
            {SITE.address.map((l, i) => <div key={i}>{l}</div>)}
            {SITE.mapsUrl && <a href={SITE.mapsUrl} target="_blank" rel="noopener" style={{ color: ACCENT }}>Google Maps</a>}
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={label}>Hours</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {SITE.hours.map((h, i) => (
            <div key={i} style={{ ...val, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ minWidth: 62, display: "inline-block" }}>{h.days}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {h.sun && <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>☀️</span>}
                {h.time}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={label}>Follow</div>
        <a href={SITE.instagram} target="_blank" rel="noopener" style={{ ...val, color: ACCENT }}>Instagram</a>
      </div>
    </div>
  );
}

export function MenuBoard({ categories }: { categories: MenuCategory[] }) {
  const allCards: Card[] = categories.flatMap((c) => c.items.map((it) => ({ ...it, cat: c.name, key: `${c.name}/${it.id}` })));
  const cats = ["All", ...categories.map((c) => c.name)];

  const [cat, setCat] = useState("All");
  const [pos, setPos] = useState<Record<string, Pos>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [height, setHeight] = useState(1200);
  const [open, setOpen] = useState<Card | null>(null);
  const [mobile, setMobile] = useState(false);
  const [gridCards, setGridCards] = useState<Card[]>([]);
  const [animateIn, setAnimateIn] = useState(true);
  const [dim, setDim] = useState({ cw: CW, ch: CH });

  const canvasRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef({ cw: CW, ch: CH });
  const lastW = useRef(0);
  const zTop = useRef(1);
  const drag = useRef<{ key: string; el: HTMLElement; sx: number; sy: number; ox: number; oy: number; rot: number; nx: number; ny: number; moved: boolean } | null>(null);

  const visible = useCallback((c: string): Card[] => {
    return c === "All" ? shuffle(allCards) : allCards.filter((i) => i.cat === c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const tidyRef = useRef(false);
  const layout = useCallback((c: string, tidy?: boolean) => {
    if (tidy !== undefined) tidyRef.current = tidy;
    const neat = tidyRef.current;
    const w = (canvasRef.current?.clientWidth ?? 1000);
    lastW.current = w;
    // Cards grow on bigger screens.
    const cw = w >= 1600 ? 234 : w >= 1280 ? 210 : w >= 1000 ? 194 : 180;
    const ch = cw + 82;
    setDim({ cw, ch });
    dimRef.current = { cw, ch };
    // Both layouts keep a real gap between cards so every product name stays
    // fully visible. Neat = straight grid; scattered = same gaps but tilted +
    // jittered so it reads as cards spread on a table (no name-covering overlap).
    const gapX = neat ? GAP : 15;
    const gapY = neat ? 22 : 14;
    const cols = Math.max(2, Math.floor((w + gapX) / (cw + gapX)));
    const colStep = cols > 1 ? (w - cw) / (cols - 1) : 0;
    const rowStep = ch + gapY;
    const jitterX = neat ? 9 : 14;
    const jitterY = neat ? 9 : 14;
    const rotAmp = neat ? 4.5 : 9;
    const list = visible(c);
    const next: Record<string, Pos> = {};
    list.forEach((it, i) => {
      const col = i % cols, row = (i / cols) | 0;
      let x = col * colStep + (Math.random() - 0.5) * jitterX;
      x = Math.max(-6, Math.min(w - cw + 6, x));
      next[it.key] = {
        x,
        y: 8 + row * rowStep + (Math.random() - 0.5) * jitterY,
        rot: (Math.random() - 0.5) * rotAmp, z: neat ? row * cols + col + 1 : 1 + ((Math.random() * list.length) | 0),
      };
    });
    const rows = Math.ceil(list.length / cols) || 1;
    zTop.current = list.length + 1;
    setOrder(list.map((i) => i.key));
    setPos(next);
    setHeight(8 + (rows - 1) * rowStep + ch + 60);
  }, [visible]);

  // Track viewport: mobile = simple 2-col grid (no drag, no category sidebar).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const apply = () => {
      setMobile(mq.matches);
      if (mq.matches) setGridCards(shuffle(allCards));
      else layout("All", false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mobile) return;
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      if (Math.abs(nw - lastW.current) > 2) layout(cat);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cat, layout, mobile]);

  // Drop-in plays once on first load; stop it after the cards have settled.
  useEffect(() => {
    const t = setTimeout(() => setAnimateIn(false), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pickCat(c: string) { setAnimateIn(false); setCat(c); layout(c, false); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function resolve(p: Record<string, Pos>, pinned: string): number {
    const ids = Object.keys(p), PAD = 5;
    const { cw, ch } = dimRef.current;
    for (let iter = 0; iter < 60; iter++) {
      let hit = false;
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const A = p[ids[i]], B = p[ids[j]];
        const dx = B.x - A.x, dy = B.y - A.y;
        const ox = (cw + PAD) - Math.abs(dx), oy = (ch + PAD) - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        hit = true;
        const aPin = ids[i] === pinned, bPin = ids[j] === pinned;
        if (ox / (cw + PAD) < oy / (ch + PAD)) {
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
    // Free-roam: a card can be dropped almost anywhere on screen (only kept
    // from getting fully lost off an edge).
    const minKeep = 46;
    const maxX = w + 300; // allow dragging over the sidebar / far right
    let maxY = 0;
    ids.forEach((k) => {
      const q = p[k];
      q.x = Math.max(-(cw - minKeep), Math.min(maxX, q.x));
      q.y = Math.max(-(ch - minKeep), q.y);
      if (q.y + ch > maxY) maxY = q.y + ch;
    });
    return maxY + 40;
  }

  function onCardDown(e: React.PointerEvent, key: string) {
    const el = e.currentTarget as HTMLElement;
    const p = pos[key];
    if (!p) return;
    if (animateIn) setAnimateIn(false);
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
  // Scatter wave: bottom cards land first, rising toward the logo (south→north).
  const maxCardY = cards.reduce((m, c) => Math.max(m, pos[c.key]?.y ?? 0), 1);

  return (
    <div
      style={{
        minHeight: "100vh", color: INK,
        backgroundColor: PAPER,
        backgroundImage: `${PAPER_TEX},${FIBER_TEX},linear-gradient(to right,rgba(61,57,41,.055) 1px,transparent 1px),linear-gradient(to bottom,rgba(61,57,41,.055) 1px,transparent 1px)`,
        backgroundSize: "200px 200px,320px 320px,39px 39px,39px 39px",
      }}
    >
      <style>{`
        .mm-card{transition:transform .24s cubic-bezier(.22,.61,.36,1),box-shadow .24s cubic-bezier(.22,.61,.36,1)}
        @media (hover:hover){
          .mm-card:hover{transform:scale(1.05);box-shadow:0 10px 20px -6px rgba(61,57,41,.2),0 34px 54px -24px rgba(61,57,41,.6)}
        }
        @media (max-width:720px){.mm-modal{grid-template-columns:1fr !important}}
        @keyframes mmDrop{0%{opacity:0;transform:translateY(240px) scale(.82)}55%{opacity:1}100%{opacity:1;transform:translateY(0) scale(1)}}
        .mm-drop{animation:mmDrop .42s cubic-bezier(.18,.7,.28,1) both}
      `}</style>
      {/* Header — transparent so the grid shows through (full-screen texture) */}
      <header style={{ position: "relative", zIndex: 900 }}>
        <div style={{ padding: "26px 22px 22px", display: "flex", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-machimoto.svg" alt="Machimoto" style={{ height: mobile ? 104 : 132, width: "auto" }} />
        </div>
      </header>

      {/* Tidy — top-right corner (desktop) */}
      {!mobile && (
        <button type="button" onClick={() => { setAnimateIn(false); layout(cat, true); }} title="Neatly arrange the cards" style={{ position: "fixed", top: 22, right: 22, zIndex: 960, font: `500 13px/1 ${SANS}`, color: INK, background: CARD, border: "1px solid rgba(61,57,41,.16)", borderRadius: 999, padding: "12px 19px", cursor: "pointer", letterSpacing: ".02em", boxShadow: "0 4px 14px -6px rgba(61,57,41,.3)" }}>Tidy the table</button>
      )}

      {mobile ? (
        /* Mobile: simple 2-column grid, no category sidebar */
        <div style={{ padding: "20px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {gridCards.map((c, i) => (
            <button key={c.key} type="button" onClick={() => setOpen(c)} style={{ display: "block", width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left", height: 262 }}>
              <CardFace c={c} drop={animateIn} delay={Math.min(i * 40, 700)} />
            </button>
          ))}
        </div>
      ) : (
        /* Desktop: full-width draggable board + category sidebar */
        <div style={{ margin: "0 auto", padding: "26px 22px 0", display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div ref={canvasRef} style={{ position: "relative", flex: "1 1 auto", minWidth: 0, height }}>
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
                    position: "absolute", left: 0, top: 0, width: dim.cw, height: dim.ch,
                    transform: `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) rotate(${p.rot.toFixed(2)}deg)`,
                    zIndex: p.z + 10, cursor: "grab", touchAction: "none", userSelect: "none",
                    transition: drag.current?.key === c.key ? "none" : "transform .42s cubic-bezier(.2,.9,.25,1)",
                  }}
                >
                  <CardFace c={c} drop={animateIn} delay={Math.round(((maxCardY - p.y) / maxCardY) * 520)} />
                </div>
              );
            })}
          </div>

          <aside style={{ position: "sticky", top: 24, width: CW, flex: "none", alignSelf: "flex-start", paddingTop: 4 }}>
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
            <div style={{ marginTop: 28 }}><StoreInfo /></div>
          </aside>
        </div>
      )}

      {/* Footer — store info only on mobile (desktop shows it in the sidebar) */}
      <footer style={{ margin: "44px auto 0", padding: "26px 22px 40px", borderTop: "1px solid rgba(61,57,41,.09)", display: "flex", flexDirection: "column", gap: 24 }}>
        {mobile && <StoreInfo row />}
        <div style={{ font: `400 11.5px/1.6 ${SANS}`, color: "rgba(61,57,41,.45)" }}>© 2026 Machimoto</div>
      </footer>

      {/* Sticky CTA — always visible, bottom center */}
      <a href={SITE.order} target="_blank" rel="noopener" style={{ position: "fixed", left: "50%", bottom: 26, zIndex: 950, transform: "translateX(-50%)", font: `500 14px/1 ${SANS}`, letterSpacing: ".02em", color: "#faf9f5", background: DARK, borderRadius: 999, padding: "16px 28px", boxShadow: "0 10px 30px -10px rgba(28,26,23,.55)" }}>Grab &amp; Go</a>

      {/* Modal */}
      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(40,37,28,.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <div onClick={(e) => e.stopPropagation()} className="mm-modal" style={{ position: "relative", width: "min(1040px,100%)", maxHeight: "90vh", overflow: "auto", background: "#faf9f5", borderRadius: 24, boxShadow: "0 40px 90px -30px rgba(40,37,28,.55)", display: "grid", gridTemplateColumns: "minmax(0,1.15fr) 1fr" }}>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, zIndex: 2, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(255,253,249,.92)", border: "1px solid rgba(61,57,41,.14)", cursor: "pointer", boxShadow: "0 2px 8px rgba(40,37,28,.18)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
            <div style={{ position: "relative", background: TILE, minHeight: 320 }}>
              {open.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.imageUrl} alt={open.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "repeating-linear-gradient(135deg,#eae7dd 0 10px,#e3dfd3 10px 20px)" }}>
                  <span style={{ font: `400 11px/1.4 ${MONO}`, color: "rgba(61,57,41,.5)" }}>product photo pending</span>
                </div>
              )}
            </div>
            <div style={{ padding: "40px 38px 34px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ font: `600 10.5px/1 ${SANS}`, letterSpacing: ".14em", textTransform: "uppercase", color: ACCENT }}>{open.cat}</div>
              <div style={{ font: `500 30px/1.22 ${SANS}`, color: INK }}>{open.name}</div>
              <div style={{ height: 1, background: "rgba(61,57,41,.11)" }} />
              {open.description && <div style={{ font: `450 16px/1.7 ${SANS}`, color: INK }}>{open.description}</div>}
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 8 }}>
                <a href={SITE.order} target="_blank" rel="noopener" style={{ font: `500 14px/1 ${SANS}`, color: "#faf9f5", background: DARK, borderRadius: 999, padding: "15px 24px" }}>Grab &amp; Go</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
