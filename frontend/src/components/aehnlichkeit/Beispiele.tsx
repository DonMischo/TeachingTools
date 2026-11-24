"use client";
/**
 * Ein passendes Beispielbild je Maßstab — vom Mikroskop (100 : 1) bis zum Atlas
 * (1 : 3 000 000). Jedes Bild ist in Bild-Zentimetern gezeichnet; man tippt eine
 * Strecke an (oder zwei Orte), liest die Bildlänge ab und rechnet in die
 * Wirklichkeit um. Die Bildlängen sind so gewählt, dass die echten Maße stimmen
 * (Zimmer, 100-m-Bahn, ICE-Wagen, Ameise, Zwiebelzelle, Städteabstände).
 */
import { useState, type ReactNode } from "react";
import { inWirklichkeit, laengeText, massstabText, type Massstab } from "@/lib/aehnlichkeit";

type P = [number, number];
export type Strecke = { name: string; von: P; nach: P };
export type Beispiel = {
  id: string; titel: string; m: Massstab; breite: number; hoehe: number; hintergrund: string;
  /** Zeichnung in Bild-cm (Faktor k = Pixel je cm) */
  bild: (k: number) => ReactNode;
  strecken: Strecke[];
  /** Orte zum freien Messen (zwei antippen) */
  orte?: { name: string; p: P }[];
};

const dunkel = "#1f2937";

/** Städte auf einer Atlaskarte 1 : 3 000 000 (1 cm = 30 km), grob aus Länge/Breite */
const STADT = (lon: number, lat: number): P => [((lon - 5.8) * Math.cos((51 * Math.PI) / 180) * 111.3) / 30, ((55.1 - lat) * 111.3) / 30];

export const BEISPIELE: Beispiel[] = [
  {
    id: "wanderkarte", titel: "Wanderkarte", m: { bild: 1, echt: 25000 }, breite: 16, hoehe: 10, hintergrund: "#ecfccb",
    bild: k => <>
      <path d={`M ${2 * k} ${8 * k} C ${4 * k} ${6 * k}, ${6 * k} ${7 * k}, ${8 * k} ${4 * k} S ${12 * k} ${3 * k}, ${14 * k} ${2 * k}`} fill="none" stroke="#b45309" strokeWidth={3} strokeDasharray="7 5" />
      <ellipse cx={11 * k} cy={7.5 * k} rx={2 * k} ry={1.2 * k} fill="#93c5fd" />
      {[[8, 4], [8.6, 3.4], [7.4, 3.6]].map(([x, y], i) => <path key={i} d={`M ${x * k} ${(y - 1.2) * k} l ${0.9 * k} ${1.6 * k} l ${-1.8 * k} 0 Z`} fill="#a16207" opacity={0.7} />)}
      {[[3, 3], [4, 2.4], [3.5, 4], [12.5, 5.2], [13.4, 4.6]].map(([x, y], i) => <circle key={i} cx={x * k} cy={y * k} r={0.45 * k} fill="#16a34a" />)}
    </>,
    orte: [{ name: "Parkplatz", p: [2, 8] }, { name: "Gipfel", p: [8, 3.1] }, { name: "Hütte", p: [14, 2] }, { name: "Badesee", p: [11, 7.5] }, { name: "Aussichtsturm", p: [4.5, 2.6] }],
    strecken: [{ name: "Wanderweg Parkplatz → Gipfel (Luftlinie)", von: [2, 8], nach: [8, 3.1] }],
  },
  {
    id: "strassenkarte", titel: "Straßenkarte", m: { bild: 1, echt: 200000 }, breite: 16, hoehe: 10, hintergrund: "#fefce8",
    bild: k => <>
      <path d={`M ${1.5 * k} ${7 * k} L ${8 * k} ${5 * k} L ${14.5 * k} ${2 * k}`} fill="none" stroke="#2563eb" strokeWidth={6} />
      <path d={`M ${8 * k} ${5 * k} L ${10 * k} ${9 * k}`} fill="none" stroke="#f59e0b" strokeWidth={4} />
      <text x={5 * k} y={5.6 * k} fontSize={12} fontWeight={800} fill="#2563eb">A 4</text>
    </>,
    orte: [{ name: "Westheim", p: [1.5, 7] }, { name: "Mittelstadt", p: [8, 5] }, { name: "Osterburg", p: [14.5, 2] }, { name: "Südwalde", p: [10, 9] }],
    strecken: [{ name: "Westheim → Osterburg (Luftlinie)", von: [1.5, 7], nach: [14.5, 2] }],
  },
  {
    id: "atlas", titel: "Atlaskarte Deutschland", m: { bild: 1, echt: 3000000 }, breite: 22, hoehe: 27, hintergrund: "#e0f2fe",
    bild: k => <path d={[[8.6, 54.9], [10.9, 54.4], [14.2, 54], [14.7, 52.6], [15, 51.1], [12.1, 50.3], [13.8, 48.8], [13, 47.5], [10.2, 47.3], [7.6, 47.6], [6.1, 49.5], [6.2, 51.8], [7, 53.4], [8.6, 54.9]].map(([lo, la], i) => { const [x, y] = STADT(lo, la); return `${i ? "L" : "M"} ${x * k} ${y * k}`; }).join(" ") + " Z"}
      fill="#fef3c7" stroke="#a16207" strokeWidth={2} />,
    orte: [
      { name: "Hamburg", p: STADT(10.0, 53.55) }, { name: "Berlin", p: STADT(13.4, 52.52) }, { name: "Köln", p: STADT(6.96, 50.94) },
      { name: "Erfurt", p: STADT(11.03, 50.98) }, { name: "Frankfurt", p: STADT(8.68, 50.11) }, { name: "München", p: STADT(11.58, 48.14) },
    ],
    strecken: [{ name: "Berlin → München (Luftlinie)", von: STADT(13.4, 52.52), nach: STADT(11.58, 48.14) }],
  },
  {
    id: "modellbahn", titel: "Modelleisenbahn H0", m: { bild: 1, echt: 87 }, breite: 36, hoehe: 9, hintergrund: "#f1f5f9",
    bild: k => <>
      <line x1={0} y1={7.6 * k} x2={36 * k} y2={7.6 * k} stroke="#78716c" strokeWidth={4} />
      <rect x={1 * k} y={3 * k} width={20 * k} height={4 * k} rx={0.6 * k} fill="#dc2626" />
      <rect x={1.6 * k} y={3.6 * k} width={2.5 * k} height={1.4 * k} fill="#bae6fd" />
      <rect x={21.5 * k} y={3 * k} width={14 * k} height={4 * k} rx={0.4 * k} fill="#e5e7eb" stroke="#9ca3af" />
      {[3, 8, 14, 19, 23, 33].map(x => <circle key={x} cx={x * k} cy={7.3 * k} r={0.7 * k} fill={dunkel} />)}
      <circle cx={5 * k} cy={0.9 * k} r={0.25 * k} fill={dunkel} /><line x1={5 * k} y1={1.15 * k} x2={5 * k} y2={2.6 * k} stroke={dunkel} strokeWidth={2} />
    </>,
    strecken: [
      { name: "Lok (Länge)", von: [1, 2.6], nach: [21, 2.6] },
      { name: "Figur am Bahnsteig (Größe)", von: [5.6, 0.6], nach: [5.6, 2.6] },
      { name: "Wagen (Teilstück)", von: [21.5, 2.6], nach: [35.5, 2.6] },
    ],
  },
  {
    id: "bauplan", titel: "Bauplan eines Hauses", m: { bild: 1, echt: 100 }, breite: 12, hoehe: 9, hintergrund: "#ffffff",
    bild: k => <>
      <rect x={0.5 * k} y={0.5 * k} width={11 * k} height={8 * k} fill="none" stroke={dunkel} strokeWidth={5} />
      <line x1={6.5 * k} y1={0.5 * k} x2={6.5 * k} y2={8.5 * k} stroke={dunkel} strokeWidth={3} />
      <line x1={6.5 * k} y1={4.5 * k} x2={11.5 * k} y2={4.5 * k} stroke={dunkel} strokeWidth={3} />
      <rect x={6.4 * k} y={2 * k} width={0.2 * k} height={0.9 * k} fill="#fff" />
      <path d={`M ${6.5 * k} ${2 * k} A ${0.9 * k} ${0.9 * k} 0 0 1 ${5.6 * k} ${2.9 * k}`} fill="none" stroke="#64748b" />
      <text x={3.5 * k} y={4.5 * k} textAnchor="middle" fontSize={13} fontWeight={700} fill="#475569">Wohnzimmer</text>
      <text x={9 * k} y={2.6 * k} textAnchor="middle" fontSize={13} fontWeight={700} fill="#475569">Küche</text>
      <text x={9 * k} y={6.6 * k} textAnchor="middle" fontSize={13} fontWeight={700} fill="#475569">Kinderzimmer</text>
    </>,
    strecken: [
      { name: "Wohnzimmer (Länge)", von: [0.5, 8.5], nach: [6.5, 8.5] },
      { name: "Wohnzimmer (Breite)", von: [0.5, 0.5], nach: [0.5, 8.5] },
      { name: "Küche (Breite)", von: [6.5, 0.5], nach: [11.5, 0.5] },
      { name: "Kinderzimmer (Tiefe)", von: [11.5, 4.5], nach: [11.5, 8.5] },
      { name: "Tür", von: [6.5, 2], nach: [6.5, 2.9] },
    ],
  },
  {
    id: "lageplan", titel: "Lageplan Schulgelände", m: { bild: 1, echt: 1000 }, breite: 16, hoehe: 10, hintergrund: "#f0fdf4",
    bild: k => <>
      <rect x={1 * k} y={1 * k} width={6 * k} height={2.5 * k} fill="#cbd5e1" stroke={dunkel} />
      <text x={4 * k} y={2.4 * k} textAnchor="middle" fontSize={13} fontWeight={800}>Schule</text>
      <rect x={1 * k} y={4.5 * k} width={4 * k} height={4 * k} fill="#e7e5e4" stroke="#a8a29e" />
      <text x={3 * k} y={6.6 * k} textAnchor="middle" fontSize={12} fontWeight={700}>Schulhof</text>
      <rect x={5.5 * k} y={5 * k} width={10 * k} height={3 * k} rx={1.5 * k} fill="#fca5a5" />
      <rect x={6.5 * k} y={5.8 * k} width={8 * k} height={1.4 * k} rx={0.7 * k} fill="#86efac" />
    </>,
    strecken: [
      { name: "Laufbahn, gerades Stück", von: [5.5, 8.3], nach: [15.5, 8.3] },
      { name: "Schulgebäude (Länge)", von: [1, 0.7], nach: [7, 0.7] },
      { name: "Schulhof (Seite)", von: [0.7, 4.5], nach: [0.7, 8.5] },
    ],
  },
  {
    id: "lupe", titel: "Insekt unter der Lupe", m: { bild: 10, echt: 1 }, breite: 14, hoehe: 7, hintergrund: "#fff7ed",
    bild: k => <>
      {[3.5, 6, 9].map((x, i) => <ellipse key={i} cx={x * k} cy={3.5 * k} rx={(i === 1 ? 1 : 1.5) * k} ry={(i === 1 ? 0.8 : 1.2) * k} fill="#44403c" />)}
      {[-1, 1].flatMap(s => [4.5, 6, 7.5].map(x => <path key={`${s}${x}`} d={`M ${6 * k} ${3.5 * k} L ${x * k} ${(3.5 + s * 2.2) * k} L ${(x + (x - 6) * 0.4 + 0.6) * k} ${(3.5 + s * 3) * k}`} fill="none" stroke="#44403c" strokeWidth={2} />))}
      <path d={`M ${2.2 * k} ${3 * k} q ${-1 * k} ${-1.5 * k} ${-1.8 * k} ${-1.2 * k} M ${2.2 * k} ${4 * k} q ${-1 * k} ${1.5 * k} ${-1.8 * k} ${1.2 * k}`} fill="none" stroke="#44403c" strokeWidth={2} />
    </>,
    strecken: [{ name: "Ameise (Länge ohne Fühler)", von: [2, 6.3], nach: [10.5, 6.3] }],
  },
  {
    id: "mikroskop", titel: "Zwiebelzellen im Mikroskop", m: { bild: 100, echt: 1 }, breite: 14, hoehe: 8, hintergrund: "#fdf4ff",
    bild: k => <>
      {[0, 1, 2].flatMap(r => [0, 1, 2, 3].map(c => <rect key={`${r}${c}`} x={(0.5 + c * 3.2 + (r % 2) * 1.2) * k} y={(0.5 + r * 2.4) * k} width={3 * k} height={2.2 * k} rx={0.3 * k} fill="#f5d0fe" stroke="#a21caf" strokeWidth={2} />))}
      {[0, 1, 2].flatMap(r => [0, 1, 2, 3].map(c => <circle key={`k${r}${c}`} cx={(1.5 + c * 3.2 + (r % 2) * 1.2) * k} cy={(1.6 + r * 2.4) * k} r={0.12 * k} fill="#7e22ce" />))}
    </>,
    strecken: [{ name: "eine Zelle (Länge)", von: [0.5, 2.85], nach: [3.5, 2.85] }, { name: "Zellkern (Durchmesser)", von: [1.38, 1.6], nach: [1.62, 1.6] }],
  },
];

/** Das Beispiel zu einem Maßstab (sonst das erste) */
export const beispielFuer = (m: Massstab) => BEISPIELE.find(b => b.m.bild === m.bild && b.m.echt === m.echt) ?? null;

const de = (x: number, s = 1) => x.toLocaleString("de-DE", { maximumFractionDigits: s });

export function BeispielBild({ b }: { b: Beispiel }) {
  const k = Math.min(720 / b.breite, 460 / b.hoehe); // Pixel je cm in der Zeichnung
  const [strecke, setStrecke] = useState<Strecke | null>(b.strecken[0] ?? null);
  const [wahl, setWahl] = useState<number[]>([]);
  const tippe = (i: number) => {
    const neu = wahl.length >= 2 ? [i] : wahl.includes(i) ? wahl : [...wahl, i];
    setWahl(neu);
    if (neu.length === 2 && b.orte) setStrecke({ name: `${b.orte[neu[0]].name} → ${b.orte[neu[1]].name} (Luftlinie)`, von: b.orte[neu[0]].p, nach: b.orte[neu[1]].p });
  };
  const cm = strecke ? Math.hypot(strecke.nach[0] - strecke.von[0], strecke.nach[1] - strecke.von[1]) : null;
  const leiste = b.m.bild > b.m.echt ? 1 : 2; // Maßstabsleiste: 1 cm bzw. 2 cm
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`-6 -6 ${b.breite * k + 12} ${b.hoehe * k + 34}`} className="w-full h-auto rounded-xl" style={{ background: b.hintergrund, maxHeight: "min(58vh, 32rem)" }}
        role="img" aria-label={`${b.titel} im Maßstab ${massstabText(b.m)}`}>
        {b.bild(k)}
        {strecke && <line x1={strecke.von[0] * k} y1={strecke.von[1] * k} x2={strecke.nach[0] * k} y2={strecke.nach[1] * k} stroke="#dc2626" strokeWidth={3} strokeDasharray="8 5" />}
        {b.orte?.map((o, i) => (
          <g key={o.name} onClick={() => tippe(i)} style={{ cursor: "pointer" }} role="button" aria-label={o.name}>
            <circle cx={o.p[0] * k} cy={o.p[1] * k} r={8} fill={wahl.includes(i) ? "#dc2626" : dunkel} stroke="white" strokeWidth={2} />
            <text x={o.p[0] * k + 11} y={o.p[1] * k - 7} fontSize={14} fontWeight={800} fill={dunkel}>{o.name}</text>
          </g>
        ))}
        <g transform={`translate(${b.breite * k - leiste * k - 4} ${b.hoehe * k + 14})`}>
          {Array.from({ length: leiste }, (_, i) => <rect key={i} x={i * k} y={0} width={k} height={7} fill={i % 2 ? "white" : dunkel} stroke={dunkel} />)}
          <text x={0} y={-3} fontSize={11}>0</text>
          <text x={leiste * k} y={-3} fontSize={11} textAnchor="end">{laengeText(inWirklichkeit(leiste, b.m))}</text>
        </g>
      </svg>
      <div className="flex flex-wrap gap-1.5">
        {b.strecken.map(s => <button key={s.name} className={`chip ${strecke?.name === s.name ? "chip-on" : ""}`} onClick={() => { setStrecke(s); setWahl([]); }}>📏 {s.name}</button>)}
      </div>
      {strecke && cm !== null && (
        <p className="text-sm">
          <b>{strecke.name}:</b> im Bild <b>{de(cm)} cm</b>. Bei {massstabText(b.m)}: {de(cm)} cm {b.m.bild > b.m.echt ? `: ${de(b.m.bild / b.m.echt, 0)}` : `· ${de(b.m.echt / b.m.bild, 0)}`} = <b>{laengeText(inWirklichkeit(cm, b.m))}</b> in Wirklichkeit.
        </p>
      )}
      {b.orte && <p className="text-xs text-muted">Oder zwei Orte antippen und deren Entfernung messen.</p>}
    </div>
  );
}
