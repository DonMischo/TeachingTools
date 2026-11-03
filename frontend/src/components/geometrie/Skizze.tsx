"use client";
/**
 * Zeichnet eine `Skizze` (lib/geometrie/skizze.ts) maßstabsgetreu in ein SVG:
 * Flächen, Strecken mit Beschriftung außen, Winkelbögen, rechte Winkel,
 * Kreise, Eckpunktnamen und auf Wunsch ein Kästchenraster. `skizzeAlsPng`
 * liefert dasselbe Bild für den Word-Export.
 */
import type { ReactNode } from "react";
import { svgZuPng } from "@/lib/docx";
import { allePunkte, aussen, bogenPunkt, rahmen, schwerpunkt, type Pt, type Skizze } from "@/lib/geometrie/skizze";

export const SKIZZE_W = 560, SKIZZE_H = 320;
const RAND = 44;
const ORANGE = "#d97706", ROT = "#dc2626";

function Txt({ x, y, children, farbe = "var(--text)", groesse = 15 }: { x: number; y: number; children: ReactNode; farbe?: string; groesse?: number }) {
  return <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={groesse} fontWeight={700} fill={farbe}
    stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">{children}</text>;
}

/** Nur der Inhalt (ohne <svg>), damit Spiele mehrere Skizzen nebeneinander setzen können. */
export function SkizzenInhalt({ s, w = SKIZZE_W, h = SKIZZE_H }: { s: Skizze; w?: number; h?: number }) {
  const r = rahmen(s);
  const k = Math.min((w - 2 * RAND) / r.breite, (h - 2 * RAND) / r.hoehe);
  const ox = (w - r.breite * k) / 2 - r.minX * k, oy = (h - r.hoehe * k) / 2 - r.minY * k;
  const T = (p: Pt) => ({ x: ox + p.x * k, y: oy + p.y * k });
  const figur = (s.flaechen ?? []).flatMap(f => f.pts);
  const innen = T(schwerpunkt(figur.length ? figur : allePunkte(s)));
  const pfad = (pts: Pt[]) => pts.map(p => { const q = T(p); return `${q.x},${q.y}`; }).join(" ");

  const raster: ReactNode[] = [];
  if (s.raster) {
    const x0 = Math.floor(r.minX), x1 = Math.ceil(r.minX + r.breite), y0 = Math.floor(r.minY), y1 = Math.ceil(r.minY + r.hoehe);
    for (let x = x0; x <= x1; x++) raster.push(<line key={`x${x}`} x1={T({ x, y: y0 }).x} y1={T({ x, y: y0 }).y} x2={T({ x, y: y1 }).x} y2={T({ x, y: y1 }).y} />);
    for (let y = y0; y <= y1; y++) raster.push(<line key={`y${y}`} x1={T({ x: x0, y }).x} y1={T({ x: x0, y }).y} x2={T({ x: x1, y }).x} y2={T({ x: x1, y }).y} />);
  }

  return (
    <g>
      {raster.length > 0 && <g stroke="var(--border)" strokeWidth={1}>{raster}</g>}
      {(s.flaechen ?? []).map((f, i) => (
        <polygon key={`f${i}`} points={pfad(f.pts)} strokeLinejoin="round"
          fill={f.ausgespart ? "var(--surface)" : f.farbe ?? "var(--accent)"} fillOpacity={f.ausgespart ? 1 : f.deckkraft ?? 0.16}
          stroke={f.ausgespart ? "var(--text-muted)" : f.farbe ?? "var(--accent)"} strokeWidth={f.ausgespart ? 2 : 3}
          strokeDasharray={f.ausgespart ? "6 4" : undefined} />
      ))}
      {(s.kreise ?? []).map((c, i) => {
        const m = T(c.m);
        return <circle key={`k${i}`} cx={m.x} cy={m.y} r={c.r * k} fill={c.farbe ?? "var(--accent)"} fillOpacity={c.deckkraft ?? 0.12}
          stroke={c.farbe ?? "var(--accent)"} strokeWidth={3} strokeDasharray={c.gestrichelt ? "6 4" : undefined} />;
      })}
      {(s.boegen ?? []).map((b, i) => {
        const p1 = T(bogenPunkt(b.m, b.r, b.von)), p2 = T(bogenPunkt(b.m, b.r, b.bis)), m = T(b.m), rr = b.r * k;
        const span = b.bis - b.von;
        // Gegen den Uhrzeigersinn auf dem Bildschirm = sweep-flag 0 im SVG.
        const arc = `A ${rr} ${rr} 0 ${Math.abs(span) > 180 ? 1 : 0} ${span > 0 ? 0 : 1} ${p2.x} ${p2.y}`;
        const d = b.flaeche === "sektor" ? `M ${m.x} ${m.y} L ${p1.x} ${p1.y} ${arc} Z` : b.flaeche === "segment" ? `M ${p1.x} ${p1.y} ${arc} Z` : `M ${p1.x} ${p1.y} ${arc}`;
        const farbe = b.farbe ?? "var(--accent)";
        const mitte = T(bogenPunkt(b.m, b.r + (16 + (b.text?.length ?? 0) * 2.6) / k, (b.von + b.bis) / 2));
        return (
          <g key={`b${i}`}>
            <path d={d} fill={b.flaeche ? farbe : "none"} fillOpacity={b.deckkraft ?? 0.2} stroke={farbe} strokeWidth={3}
              strokeLinejoin="round" strokeDasharray={b.gestrichelt ? "6 4" : undefined} />
            {b.text && <Txt x={mitte.x} y={mitte.y}>{b.text}</Txt>}
          </g>
        );
      })}
      {(s.winkel ?? []).map((wi, i) => {
        const p = T(wi.p), a = T(wi.von), b = T(wi.bis);
        const ua = { x: a.x - p.x, y: a.y - p.y }, ub = { x: b.x - p.x, y: b.y - p.y };
        const la = Math.hypot(ua.x, ua.y) || 1, lb = Math.hypot(ub.x, ub.y) || 1;
        ua.x /= la; ua.y /= la; ub.x /= lb; ub.y /= lb;
        const halb = { x: ua.x + ub.x, y: ua.y + ub.y }, lh = Math.hypot(halb.x, halb.y) || 1;
        if (wi.recht) {
          const e = 14;
          return (
            <g key={`w${i}`}>
              <path d={`M ${p.x + ua.x * e} ${p.y + ua.y * e} L ${p.x + (ua.x + ub.x) * e} ${p.y + (ua.y + ub.y) * e} L ${p.x + ub.x * e} ${p.y + ub.y * e}`}
                fill="none" stroke="var(--text-muted)" strokeWidth={1.5} />
              <circle cx={p.x + halb.x / lh * e * 0.75} cy={p.y + halb.y / lh * e * 0.75} r={1.8} fill="var(--text-muted)" />
              {wi.text && <Txt x={p.x + halb.x / lh * (e + 22)} y={p.y + halb.y / lh * (e + 22)} farbe={ORANGE}>{wi.text}</Txt>}
            </g>
          );
        }
        const rad = 26;
        const d = Math.atan2(ua.x * ub.y - ua.y * ub.x, ua.x * ub.x + ua.y * ub.y);
        const ab = rad + 12 + (wi.text ? wi.text.length * 3 : 0);
        return (
          <g key={`w${i}`}>
            <path d={`M ${p.x} ${p.y} L ${p.x + ua.x * rad} ${p.y + ua.y * rad} A ${rad} ${rad} 0 0 ${d > 0 ? 1 : 0} ${p.x + ub.x * rad} ${p.y + ub.y * rad} Z`}
              fill="#fbbf24" fillOpacity={0.6} stroke={ORANGE} strokeWidth={1.5} />
            {wi.text && <Txt x={p.x + halb.x / lh * ab} y={p.y + halb.y / lh * ab} farbe={ORANGE}>{wi.text}</Txt>}
          </g>
        );
      })}
      {(s.strecken ?? []).map((st, i) => {
        const a = T(st.a), b = T(st.b), n = aussen(a, b, innen);
        const art = st.art ?? "seite";
        const farbe = art === "gesucht" ? ROT : art === "hilfe" ? ORANGE : "var(--accent)";
        const ab = 14 + (st.text ? st.text.length * 2.6 : 0);
        return (
          <g key={`s${i}`}>
            {art !== "unsichtbar" && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={farbe} strokeWidth={art === "seite" ? 3 : 2}
              strokeDasharray={art === "seite" ? undefined : "6 4"} strokeLinecap="round" />}
            {st.text && <Txt x={(a.x + b.x) / 2 + n.x * ab} y={(a.y + b.y) / 2 + n.y * ab} farbe={art === "gesucht" ? ROT : art === "hilfe" ? ORANGE : "var(--text)"}>{st.text}</Txt>}
          </g>
        );
      })}
      {(s.marken ?? []).map((m, i) => {
        const p = T(m.p);
        // Ein Buchstabe ist ein Eckpunktname: rückt nach außen und bekommt einen Punkt.
        if (/^[A-Z]['′]?$/.test(m.text)) {
          const dx = p.x - innen.x, dy = p.y - innen.y, l = Math.hypot(dx, dy) || 1;
          return (
            <g key={`m${i}`}>
              <circle cx={p.x} cy={p.y} r={3.5} fill="var(--text)" />
              <Txt x={p.x + dx / l * 17} y={p.y + dy / l * 17}>{m.text}</Txt>
            </g>
          );
        }
        return <Txt key={`m${i}`} x={p.x} y={p.y} groesse={m.groesse ?? 15}>{m.text}</Txt>;
      })}
      {s.nichtMassstaeblich && <text x={w - 8} y={h - 8} textAnchor="end" fontSize={11} fill="var(--text-muted)">Skizze nicht maßstäblich</text>}
    </g>
  );
}

export function SkizzenBild({ s, label, className = "" }: { s: Skizze; label: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${SKIZZE_W} ${SKIZZE_H}`} className={`w-full h-auto max-h-[calc(100vh-10rem)] rounded-xl border border-line ${className}`} role="img" aria-label={label}>
      <SkizzenInhalt s={s} />
    </svg>
  );
}

/** Farben der Seite gibt es im Word-Bild nicht — dort feste Druckfarben. */
export const DRUCKFARBEN: [string, string][] = [
  ["var(--text-muted)", "#6b7280"], ["var(--text)", "#1f2937"], ["var(--border)", "#cbd5e1"], ["var(--accent)", "#2563eb"], ["var(--surface)", "#ffffff"],
];

export async function skizzeAlsPng(s: Skizze): Promise<Uint8Array> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  let svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SKIZZE_W} ${SKIZZE_H}`} width={SKIZZE_W} height={SKIZZE_H} fontFamily="Segoe UI, Arial, sans-serif">
      <rect width={SKIZZE_W} height={SKIZZE_H} fill="#fff" />
      <SkizzenInhalt s={s} />
    </svg>,
  );
  for (const [a, b] of DRUCKFARBEN) svg = svg.split(a).join(b);
  return svgZuPng(svg, SKIZZE_W, SKIZZE_H);
}
