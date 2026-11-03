"use client";
/**
 * Sachaufgaben mit Bild: Turm, Leiter, Fluss, Schiff anpeilen, Wanderweg,
 * Steigung, Doppelpeilung, Dach, Sonnenstand. Jede Runde neue Zahlen, Tipps
 * einzeln aufdecken, dann der Lösungsweg. »Arbeitsblatt« baut daraus ein
 * Word-Dokument mit Bildern und auf Wunsch den Lösungen hinten.
 */
import { useEffect, useState, type ReactNode } from "react";
import { SZENARIO_ARTEN, cosG, erzeugeSzenario, sinG, tanG, type Szenario, type SzenarioArt } from "@/lib/trigonometrie";
import { leseZahl, z } from "@/lib/prozent";
import { LEER, zaehle } from "@/components/prozent/ui";
import { baueDocx, herunterladen, svgZuPng, type DocxBlock } from "@/lib/docx";

const W = 560, H = 300;
const ORANGE = "#f59e0b", ROT = "#ef4444", BLAU = "#3b82f6";

function Txt({ x, y, children, farbe = "var(--text)", anker = "middle" }: { x: number; y: number; children: ReactNode; farbe?: string; anker?: "start" | "middle" | "end" }) {
  return <text x={x} y={y} textAnchor={anker} dominantBaseline="central" fontSize={14} fontWeight={700} fill={farbe}
    stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">{children}</text>;
}
/** Winkelbogen an P von Richtung `von` bis `bis` (Grad, mathematisch); die Beschriftung sitzt
 *  auf der Winkelhalbierenden knapp außerhalb des Bogens. */
const WINKEL_FARBE = "#d97706";
function Bogen({ x, y, von, bis, r = 30, text }: { x: number; y: number; von: number; bis: number; r?: number; text?: string }) {
  const p = (w: number) => `${x + r * Math.cos(w * Math.PI / 180)} ${y - r * Math.sin(w * Math.PI / 180)}`;
  const mitte = ((von + bis) / 2) * Math.PI / 180, ab = r + 12 + (text ? text.length * 3.2 : 0);
  return (
    <g>
      <path d={`M ${x} ${y} L ${p(von)} A ${r} ${r} 0 0 0 ${p(bis)} Z`} fill="#fbbf24" fillOpacity={0.7} stroke={WINKEL_FARBE} strokeWidth={1.5} />
      {text && (
        <text x={x + ab * Math.cos(mitte)} y={y - ab * Math.sin(mitte)} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={800}
          fill={WINKEL_FARBE} stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">{text}</text>
      )}
    </g>
  );
}
const Boden = ({ y = H - 40 }: { y?: number }) => <line x1={10} y1={y} x2={W - 10} y2={y} stroke="var(--text-muted)" strokeWidth={2} />;
const Rechts = ({ x, y, links = false }: { x: number; y: number; links?: boolean }) =>
  <rect x={links ? x : x - 14} y={y - 14} width={14} height={14} fill="none" stroke="var(--text-muted)" />;

function Szene({ s }: { s: Szenario }) {
  const p = s.p, G = H - 40;
  switch (s.art) {
    case "turm": {
      const tx = 470, ax = 80, ay = G - 24, top = 30;
      const w = Math.atan2(ay - top, tx - ax) * 180 / Math.PI;
      return (<>
        <Boden />
        <rect x={tx - 18} y={top} width={36} height={G - top} fill="var(--border)" />
        <path d={`M ${tx - 24} ${top + 10} L ${tx} ${top - 22} L ${tx + 24} ${top + 10} Z`} fill="var(--border)" />
        <circle cx={ax} cy={ay - 8} r={7} fill="var(--text)" /><line x1={ax} y1={ay} x2={ax} y2={G} stroke="var(--text)" strokeWidth={4} />
        <line x1={ax} y1={ay} x2={tx} y2={top} stroke={ROT} strokeDasharray="6 4" strokeWidth={2} />
        <line x1={ax} y1={ay} x2={tx} y2={ay} stroke={BLAU} strokeDasharray="6 4" strokeWidth={2} />
        <Bogen x={ax} y={ay} von={0} bis={w} r={44} text={`${p.a}°`} />
        <Txt x={(ax + tx) / 2} y={G + 18}>{p.d} m</Txt>
        <Txt x={ax - 30} y={(ay + G) / 2}>{z(p.auge, 1)} m</Txt>
        <Txt x={tx + 34} y={(top + ay) / 2} farbe={ROT}>h = ?</Txt>
      </>);
    }
    case "leiter": {
      const sc = 30, wx = 400, fx = wx - p.L * cosG(p.a) * sc, hy = G - p.L * sinG(p.a) * sc;
      return (<>
        <Boden />
        <rect x={wx} y={20} width={40} height={G - 20} fill="var(--border)" />
        <line x1={fx} y1={G} x2={wx} y2={hy} stroke={ORANGE} strokeWidth={6} />
        <Bogen x={fx} y={G} von={0} bis={p.a} r={36} text={`${p.a}°`} />
        <Rechts x={wx} y={G} />
        <Txt x={(fx + wx) / 2 - 30} y={(G + hy) / 2} anker="end">{z(p.L, 1)} m</Txt>
        <Txt x={wx + 60} y={(G + hy) / 2} farbe={ROT}>h = ?</Txt>
        <Txt x={(fx + wx) / 2} y={G + 18} farbe={BLAU}>x = ?</Txt>
      </>);
    }
    case "fluss": {
      // Basis und Flussbreite gemeinsam skalieren: steile Winkel nicht zu einem Strich zusammendrücken
      let basis = Math.max(150, Math.min(360, 170 / tanG(p.b))), breite = basis * tanG(p.b);
      if (breite > 180) { breite = 180; basis = breite / tanG(p.b); }
      const y2 = 235, y1 = y2 - breite, ax = 120, bx = ax + basis;
      return (<>
        <rect x={10} y={y1} width={W - 20} height={y2 - y1} fill={BLAU} fillOpacity={0.18} />
        <line x1={10} y1={y1} x2={W - 10} y2={y1} stroke={BLAU} /><line x1={10} y1={y2} x2={W - 10} y2={y2} stroke={BLAU} />
        <text x={ax} y={y1 - 22} textAnchor="middle" fontSize={28}>🌳</text>
        <line x1={ax} y1={y1} x2={ax} y2={y2} stroke={ROT} strokeDasharray="6 4" strokeWidth={2} />
        <line x1={ax} y1={y2} x2={bx} y2={y2} stroke="var(--text)" strokeWidth={3} />
        <line x1={bx} y1={y2} x2={ax} y2={y1} stroke={ORANGE} strokeDasharray="6 4" strokeWidth={2} />
        <Bogen x={bx} y={y2} von={180 - Math.atan2(y2 - y1, bx - ax) * 180 / Math.PI} bis={180} r={36} text={`${p.b}°`} />
        <Rechts x={ax} y={y2} links />
        <Txt x={ax} y={y2 + 18}>A</Txt><Txt x={bx} y={y2 + 18}>B</Txt>
        <Txt x={(ax + bx) / 2} y={y2 + 36}>{p.s} m</Txt>
        <Txt x={ax - 40} y={(y1 + y2) / 2} farbe={ROT}>? m</Txt>
      </>);
    }
    case "peilung": {
      const yk = 250, c = 180 - p.a - p.b, as = (p.s * sinG(p.b)) / sinG(c);
      // Maßstab so, dass Basis und Schiff ins Bild passen — Winkel bleiben echt
      const minX = Math.min(0, as * cosG(p.a)), maxX = Math.max(p.s, as * cosG(p.a));
      const sc = Math.min(400 / (maxX - minX), (yk - 50) / (as * sinG(p.a)));
      const ax = (W - (maxX - minX) * sc) / 2 - minX * sc, bx = ax + p.s * sc;
      const sx = ax + as * cosG(p.a) * sc, sy = yk - as * sinG(p.a) * sc;
      return (<>
        <rect x={10} y={10} width={W - 20} height={yk - 10} fill={BLAU} fillOpacity={0.15} />
        <line x1={10} y1={yk} x2={W - 10} y2={yk} stroke="var(--text-muted)" strokeWidth={3} />
        <line x1={ax} y1={yk} x2={sx} y2={sy} stroke={ORANGE} strokeDasharray="6 4" strokeWidth={2} />
        <line x1={bx} y1={yk} x2={sx} y2={sy} stroke={ORANGE} strokeDasharray="6 4" strokeWidth={2} />
        <line x1={sx} y1={sy} x2={sx} y2={yk} stroke={ROT} strokeDasharray="3 4" />
        <text x={sx} y={sy - 4} textAnchor="middle" fontSize={26}>🚢</text>
        <Bogen x={ax} y={yk} von={0} bis={p.a} r={34} text={`${p.a}°`} /><Bogen x={bx} y={yk} von={180 - p.b} bis={180} r={34} text={`${p.b}°`} />
        <Txt x={ax} y={yk + 18}>A</Txt><Txt x={bx} y={yk + 18}>B</Txt>
        <Txt x={(ax + bx) / 2} y={yk + 36}>{z(p.s, 1)} km</Txt>
      </>);
    }
    case "wanderung": {
      const sc = 200 / Math.max(p.a, p.b, 3), sx = 90, sy = 60;
      const kx = sx + p.a * sc, ky = sy; // erste Strecke nach rechts (Osten)
      const ex = kx + p.b * sc * cosG(-p.d) * 0.9, ey = ky - p.b * sc * sinG(-p.d) * 0.9;
      const wege: [number, number, number, number][] = [[sx, sy, kx, ky], [kx, ky, ex, ey], [sx, sy, ex, ey]];
      const frei = (x: number, y: number) => wege.every(([x1, y1, x2, y2]) => {
        const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(x - x1 - t * dx, y - y1 - t * dy) > 34;
      });
      // feste Streuung (Goldener Schnitt), damit der Wald beim Neuzeichnen nicht springt
      const baeume = Array.from({ length: 70 }, (_, i) => ({ x: 20 + ((i * 0.618034) % 1) * (W - 40), y: 22 + ((i * 0.381966 * 7) % 1) * (H - 34), art: i % 3 }))
        .filter(b => frei(b.x, b.y - 8));
      return (<>
        <rect width={W} height={H} fill="#16a34a" fillOpacity={0.1} />
        {baeume.map((b, i) => <text key={i} x={b.x} y={b.y} textAnchor="middle" fontSize={b.art === 2 ? 20 : 24}>{b.art === 1 ? "🌳" : "🌲"}</text>)}
        <line x1={sx} y1={sy} x2={kx} y2={ky} stroke="#a16207" strokeWidth={10} strokeOpacity={0.35} strokeLinecap="round" />
        <line x1={kx} y1={ky} x2={ex} y2={ey} stroke="#a16207" strokeWidth={10} strokeOpacity={0.35} strokeLinecap="round" />
        <line x1={sx} y1={sy} x2={kx} y2={ky} stroke="var(--text)" strokeWidth={4} />
        <line x1={kx} y1={ky} x2={ex} y2={ey} stroke="var(--text)" strokeWidth={4} />
        <line x1={kx} y1={ky} x2={kx + 70} y2={ky} stroke="var(--text-muted)" strokeDasharray="4 4" />
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={ROT} strokeDasharray="6 4" strokeWidth={2} />
        <Bogen x={kx} y={ky} von={-p.d} bis={0} r={30} />
        <Txt x={kx + 36} y={ky - 16} anker="start" farbe="#d97706">{p.d}° rechts</Txt>
        <text x={sx - 6} y={sy + 4} textAnchor="end" fontSize={22}>🚩</text><text x={ex + 8} y={ey + 4} fontSize={22}>🥾</text>
        <Txt x={(sx + kx) / 2} y={sy - 16}>{z(p.a, 1)} km</Txt>
        <Txt x={(kx + ex) / 2 + 30} y={(ky + ey) / 2}>{z(p.b, 1)} km</Txt>
        <Txt x={(sx + ex) / 2 - 20} y={(sy + ey) / 2 + 14} farbe={ROT}>? km</Txt>
      </>);
    }
    case "strasse": {
      const x0 = 60, x1 = 500, y0 = G, y1 = G - (x1 - x0) * Math.min(0.55, p.p / 100 * 2);
      const w = Math.atan2(y0 - y1, x1 - x0) * 180 / Math.PI;
      return (<>
        <path d={`M ${x0} ${y0} L ${x1} ${y1} L ${x1} ${y0} Z`} fill="#22c55e" fillOpacity={0.15} />
        <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--text)" strokeWidth={6} />
        <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={BLAU} strokeDasharray="6 4" />
        <line x1={x1} y1={y0} x2={x1} y2={y1} stroke={ROT} strokeDasharray="6 4" />
        <Bogen x={x0} y={y0} von={0} bis={w} r={60} text="α = ?" />
        <Rechts x={x1} y={y0} />
        <Txt x={(x0 + x1) / 2 - 20} y={(y0 + y1) / 2 - 22}>{z(p.L, 1)} km Straße</Txt>
        <Txt x={x1 - 30} y={(y0 + y1) / 2} anker="end" farbe={ROT}>h = ?</Txt>
        <g transform={`translate(${x0 + 40} ${30})`}>
          <path d="M 0 50 L 30 0 L 60 50 Z" fill="#fff" stroke={ROT} strokeWidth={5} />
          <text x={30} y={38} textAnchor="middle" fontSize={13} fontWeight={900} fill="#111">{p.p} %</text>
        </g>
        <Txt x={(x0 + x1) / 2} y={y0 + 18} farbe={BLAU}>(waagerecht, Steigung nicht maßstäblich)</Txt>
      </>);
    }
    case "berg": {
      const hx = 470, top = 40, px = 60, qx = px + 140;
      const wa = Math.atan2(G - top, hx - px) * 180 / Math.PI, wb = Math.atan2(G - top, hx - qx) * 180 / Math.PI;
      return (<>
        <Boden />
        <path d={`M ${hx - 120} ${G} L ${hx} ${top} L ${hx + 80} ${G} Z`} fill="var(--border)" />
        <line x1={hx} y1={top} x2={hx} y2={G} stroke={ROT} strokeDasharray="6 4" strokeWidth={2} />
        <line x1={px} y1={G} x2={hx} y2={top} stroke={ORANGE} strokeDasharray="6 4" />
        <line x1={qx} y1={G} x2={hx} y2={top} stroke={ORANGE} strokeDasharray="6 4" />
        <Bogen x={px} y={G} von={0} bis={wa} r={50} text={`${p.a}°`} /><Bogen x={qx} y={G} von={0} bis={wb} r={40} text={`${p.b}°`} />
        <Txt x={px} y={G + 18}>P</Txt><Txt x={qx} y={G + 18}>Q</Txt>
        <Txt x={(px + qx) / 2} y={G + 30}>{p.d} m</Txt>
        <Txt x={hx + 30} y={(top + G) / 2} farbe={ROT}>h = ?</Txt>
      </>);
    }
    case "dach": {
      const ym = 190, half = Math.min(180, (ym - 25) / tanG(p.a)), x0 = W / 2 - half, x1 = W / 2 + half, fy = ym - half * tanG(p.a);
      return (<>
        <rect x={x0} y={ym} width={x1 - x0} height={G - ym} fill="var(--border)" />
        <path d={`M ${x0} ${ym} L ${x0 + half} ${fy} L ${x1} ${ym} Z`} fill={ROT} fillOpacity={0.2} stroke={ROT} strokeWidth={3} />
        <line x1={x0 + half} y1={fy} x2={x0 + half} y2={ym} stroke={BLAU} strokeDasharray="6 4" strokeWidth={2} />
        <Bogen x={x0} y={ym} von={0} bis={p.a} r={40} text={`${p.a}°`} />
        <Rechts x={x0 + half} y={ym} />
        <Txt x={x0 + half / 2 - 26} y={(ym + fy) / 2 - 10} anker="end" farbe={ROT}>Sparren = ?</Txt>
        <Txt x={x0 + half + 16} y={(ym + fy) / 2} anker="start" farbe={BLAU}>First = ?</Txt>
        <Txt x={(x0 + x1) / 2} y={G + 18}>{z(p.w, 1)} m</Txt>
      </>);
    }
    case "schatten": {
      const mx = 140, sc = Math.min(180 / p.h, 340 / p.s), top = G - p.h * sc, ex = mx + p.s * sc;
      const w = Math.atan2(G - top, ex - mx) * 180 / Math.PI;
      return (<>
        <Boden />
        <text x={24} y={44} fontSize={32}>☀️</text>
        <line x1={58} y1={44} x2={mx} y2={top} stroke={ORANGE} strokeDasharray="2 6" strokeOpacity={0.6} />
        <line x1={mx} y1={G} x2={mx} y2={top} stroke="var(--text)" strokeWidth={5} />
        <path d={`M ${mx} ${top} l 30 8 l -30 8 Z`} fill={ROT} />
        <line x1={mx} y1={G} x2={ex} y2={G} stroke="var(--text-muted)" strokeWidth={8} strokeOpacity={0.6} />
        <line x1={mx} y1={top} x2={ex} y2={G} stroke={ORANGE} strokeDasharray="6 4" strokeWidth={2} />
        <Bogen x={ex} y={G} von={180 - w} bis={180} r={40} text="α = ?" />
        <Rechts x={mx} y={G} links />
        <Txt x={mx - 30} y={(G + top) / 2} anker="end">{z(p.h, 1)} m</Txt>
        <Txt x={(mx + ex) / 2} y={G + 18}>Schatten {z(p.s, 1)} m</Txt>
      </>);
    }
  }
}

/** Farben der Seite gibt es im Word-Bild nicht — dort feste Druckfarben. */
const DRUCK: [string, string][] = [
  ["var(--text-muted)", "#6b7280"], ["var(--text)", "#1f2937"], ["var(--border)", "#cbd5e1"], ["var(--accent)", "#2563eb"], ["var(--surface)", "#ffffff"],
];

async function szeneAlsPng(s: Szenario) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  let svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} fontFamily="Segoe UI, Arial, sans-serif">
      <rect width={W} height={H} fill="#fff" />
      <Szene s={s} />
    </svg>,
  );
  for (const [a, b] of DRUCK) svg = svg.split(a).join(b);
  return svgZuPng(svg, W, H);
}

/** Arbeitsblatt: Aufgaben mit Bild und Antwortlinien, Lösungen auf eigener Seite. */
export async function arbeitsblatt(aufgaben: Szenario[], loesungen: boolean): Promise<Blob> {
  const b: DocxBlock[] = [
    { art: "titel", text: "Trigonometrie – Anwendungsaufgaben" },
    { art: "text", text: "Name: ______________________   Klasse: ________   Datum: ____________", grau: true },
  ];
  for (const [i, s] of aufgaben.entries()) {
    b.push({ art: "ueberschrift", text: `Aufgabe ${i + 1}: ${s.titel}` }, { art: "text", text: s.text });
    b.push({ art: "bild", png: await szeneAlsPng(s), breite: W, hoehe: H });
    for (const g of s.gesucht) b.push({ art: "linie", text: `${g.label} (${g.einheit}):` });
  }
  if (loesungen) {
    b.push({ art: "umbruch" }, { art: "titel", text: "Lösungen" });
    for (const [i, s] of aufgaben.entries()) {
      b.push({ art: "ueberschrift", text: `Aufgabe ${i + 1}: ${s.titel}` });
      for (const x of s.loesung) b.push({ art: "text", text: x, mono: true });
      b.push({ art: "text", text: "Ergebnis: " + s.gesucht.map(g => `${g.label} ≈ ${z(g.wert, 2)} ${g.einheit}`).join(" · "), fett: true });
    }
  }
  return baueDocx(b);
}

function Export({ art }: { art: SzenarioArt }) {
  const [anzahl, setAnzahl] = useState(6);
  const [gemischt, setGemischt] = useState(true);
  const [mitLoesung, setMitLoesung] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const los = async () => {
    setStatus("Arbeitsblatt wird gebaut …");
    try {
      // gemischt: jede Art einmal, bevor sich eine wiederholt
      const reihe = [...SZENARIO_ARTEN].sort(() => Math.random() - 0.5).map(a => a.id);
      const aufgaben = Array.from({ length: anzahl }, (_, i) => erzeugeSzenario(gemischt ? reihe[i % reihe.length] : art));
      herunterladen(await arbeitsblatt(aufgaben, mitLoesung), "Trigonometrie-Anwendungen.docx");
      setStatus(null);
    } catch (e) {
      setStatus("Export fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)));
    }
  };
  const name = SZENARIO_ARTEN.find(a => a.id === art)!;
  return (
    <div className="rounded-xl border border-line p-3 flex flex-wrap items-center gap-3 text-sm">
      <strong>📄 Arbeitsblatt für Word</strong>
      <label className="flex items-center gap-1.5">
        <select className="input w-auto" value={anzahl} onChange={e => setAnzahl(Number(e.target.value))} aria-label="Anzahl Aufgaben">
          {[3, 4, 6, 8, 9, 12].map(n => <option key={n} value={n}>{n}</option>)}
        </select> Aufgaben
      </label>
      <div className="flex gap-1.5">
        <button className={`chip ${gemischt ? "chip-on" : ""}`} onClick={() => setGemischt(true)}>gemischt</button>
        <button className={`chip ${!gemischt ? "chip-on" : ""}`} onClick={() => setGemischt(false)}>nur {name.icon} {name.label}</button>
      </div>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={mitLoesung} onChange={e => setMitLoesung(e.target.checked)} /> Lösungen anhängen</label>
      <button className="btn btn-primary" onClick={los} disabled={status !== null && !status.startsWith("Export")}>⬇ .docx herunterladen</button>
      {status && <span className={status.startsWith("Export") ? "text-bad" : "text-muted"}>{status}</span>}
    </div>
  );
}

export default function Anwendungen() {
  const [art, setArt] = useState<SzenarioArt>("turm");
  const [s, setS] = useState<Szenario | null>(null);
  const [ein, setEin] = useState<Record<string, string>>({});
  const [urteil, setUrteil] = useState<Record<string, boolean> | null>(null);
  const [tipps, setTipps] = useState(0);
  const [weg, setWeg] = useState(false);
  const [gezaehlt, setGezaehlt] = useState(false);
  const [punkte, setPunkte] = useState(LEER);
  const [export_, setExport] = useState(false);

  const neu = (a = art) => { setS(erzeugeSzenario(a)); setEin({}); setUrteil(null); setTipps(0); setWeg(false); setGezaehlt(false); };
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;

  const pruefen = () => {
    const u: Record<string, boolean> = {};
    for (const g of s.gesucht) { const x = leseZahl(ein[g.key] ?? ""); u[g.key] = x !== null && Math.abs(x - g.wert) <= g.tol; }
    setUrteil(u);
    if (!gezaehlt && !tipps && !weg) { setPunkte(p => zaehle(p, Object.values(u).every(Boolean))); setGezaehlt(true); }
  };

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 items-center">
        {SZENARIO_ARTEN.map(a => (
          <button key={a.id} className={`chip ${art === a.id ? "chip-on" : ""}`} onClick={() => { setArt(a.id); neu(a.id); }}>{a.icon} {a.label}</button>
        ))}
        <span className="flex-1" />
        {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt}</span>}
        <button className={`btn ${export_ ? "btn-primary" : ""}`} onClick={() => setExport(x => !x)}>📄 Arbeitsblatt (.docx)</button>
        <button className="btn" onClick={() => neu()}>🎲 Neue Zahlen</button>
      </div>
      {export_ && <Export art={art} />}
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-black">{s.titel}</h3>
          <p>{s.text}</p>
          {s.gesucht.map(g => (
            <label key={g.key} className="flex flex-wrap items-center gap-2">
              <span className="min-w-44 text-sm font-bold">{g.label}</span>
              <input className={`input w-28 ${urteil?.[g.key] === false ? "border-bad" : urteil?.[g.key] ? "border-ok" : ""}`} inputMode="decimal"
                aria-label={g.label} value={ein[g.key] ?? ""} onChange={e => { setEin({ ...ein, [g.key]: e.target.value }); setUrteil(null); }}
                onKeyDown={e => { if (e.key === "Enter") pruefen(); }} />
              <span className="text-muted">{g.einheit}</span>
              {urteil && <span className={urteil[g.key] ? "text-ok" : "text-bad"}>{urteil[g.key] ? "✔" : "✘"}</span>}
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={pruefen}>✔ Prüfen</button>
            <button className="btn" onClick={() => setTipps(t => t + 1)} disabled={tipps >= s.hinweise.length}>💡 Tipp {tipps ? `(${tipps}/${s.hinweise.length})` : ""}</button>
            <button className="btn" onClick={() => setWeg(true)} disabled={weg}>📖 Lösungsweg</button>
          </div>
          {tipps > 0 && <ul className="text-sm flex flex-col gap-1 list-disc pl-5">{s.hinweise.slice(0, tipps).map((h, i) => <li key={i}>{h}</li>)}</ul>}
          {weg && (
            <ol className="text-sm flex flex-col gap-1">
              {s.loesung.map((x, i) => <li key={i} className="rounded-lg bg-surface-hover px-3 py-2 font-mono font-bold">{x}</li>)}
              <li className="text-muted">Ergebnis: {s.gesucht.map(g => `${g.label} ≈ ${z(g.wert, 2)} ${g.einheit}`).join(" · ")}</li>
            </ol>
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[calc(100vh-8rem)] rounded-xl border border-line" role="img" aria-label={s.titel}><Szene s={s} /></svg>
      </div>
    </div>
  );
}
