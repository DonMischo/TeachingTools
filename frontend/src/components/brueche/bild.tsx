"use client";
/**
 * Bruchbilder: Pizza, runde Torte, Blechkuchen, Schokoladentafel und Band.
 * Ein Ganzes ist in `n` Teile geteilt; mit `k` > 1 wird jedes Teil noch einmal
 * in k Stücke zerlegt (gestrichelt) — so sieht man das Erweitern.
 * Mehr als ein Ganzes (unechte Brüche) → mehrere Bilder nebeneinander.
 */
import type { ReactNode } from "react";

export type Form = "pizza" | "torte" | "kuchen" | "tafel" | "band";
export const FORMEN: { id: Form; label: string }[] = [
  { id: "pizza", label: "🍕 Pizza" },
  { id: "torte", label: "🎂 Torte (rund)" },
  { id: "kuchen", label: "🍰 Blechkuchen (eckig)" },
  { id: "tafel", label: "🍫 Schokolade" },
  { id: "band", label: "📏 Band" },
];

const S = 200; // Kantenlänge eines Ganzen in SVG-Einheiten (Band: Breite 2·S)

/** Zeilen × Spalten für eine Tafel mit n Stücken, möglichst quadratisch */
export function raster(n: number): [number, number] {
  let best: [number, number] = [1, n];
  for (let r = 1; r * r <= n; r++) if (n % r === 0) best = [r, n / r];
  return best;
}

const sektor = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => `${cx + r * Math.sin(a)} ${cy - r * Math.cos(a)}`;
  if (a1 - a0 >= 2 * Math.PI - 1e-9) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  return `M ${cx} ${cy} L ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
};

type Farben = { voll: string; leer: string; rand: string };
const FARBEN: Record<Form, Farben> = {
  pizza: { voll: "#f4b942", leer: "#fdf1d6", rand: "#b45309" },
  torte: { voll: "#f9a8d4", leer: "#fdf2f8", rand: "#9d174d" },
  kuchen: { voll: "#d4a373", leer: "#faedcd", rand: "#7f5539" },
  tafel: { voll: "#7b3f00", leer: "#e9d8c7", rand: "#3e1f00" },
  band: { voll: "#3b82f6", leer: "#e0ecff", rand: "#1e3a8a" },
};

/**
 * Belag für jedes Stück: Pizza mit Salami, Olive und Basilikum, Torte mit
 * Sahnetupfer und Kirsche, Blechkuchen abwechselnd mit Erdbeere, Kirsche und
 * Blaubeeren. Auf leeren Stücken blass, damit man trotzdem jedes Stück sieht.
 */
function Deko({ form, x, y, g, i, voll }: { form: Form; x: number; y: number; g: number; i: number; voll: boolean }) {
  const o = voll ? 1 : 0.3;
  if (form === "pizza") return (
    <g opacity={o} pointerEvents="none">
      <circle cx={x - 5 * g} cy={y + 3 * g} r={7 * g} fill="#c0392b" />
      <circle cx={x - 7 * g} cy={y + 1 * g} r={1.4 * g} fill="#7f1d1d" /><circle cx={x - 3 * g} cy={y + 6 * g} r={1.4 * g} fill="#7f1d1d" />
      <circle cx={x + 7 * g} cy={y - 4 * g} r={3.6 * g} fill="none" stroke="#1f2937" strokeWidth={2.2 * g} />
      <ellipse cx={x + 5 * g} cy={y + 8 * g} rx={4.5 * g} ry={2.4 * g} fill="#16a34a" transform={`rotate(-35 ${x + 5 * g} ${y + 8 * g})`} />
    </g>
  );
  if (form === "torte") return (
    <g opacity={o} pointerEvents="none">
      <circle cx={x} cy={y} r={7 * g} fill="#fff" stroke="#f9a8d4" strokeWidth={1.5 * g} />
      <circle cx={x} cy={y} r={3.5 * g} fill="none" stroke="#f9a8d4" strokeWidth={1 * g} />
      <path d={`M ${x} ${y - 8 * g} q ${3 * g} ${-6 * g} ${7 * g} ${-7 * g}`} fill="none" stroke="#15803d" strokeWidth={1.5 * g} />
      <circle cx={x} cy={y - 8 * g} r={4.2 * g} fill="#dc2626" stroke="#7f1d1d" strokeWidth={0.8 * g} />
    </g>
  );
  if (form === "kuchen") {
    const art = i % 3;
    return (
      <g opacity={o} pointerEvents="none">
        {art === 0 && <>
          <path d={`M ${x} ${y + 8 * g} C ${x - 9 * g} ${y}, ${x - 6 * g} ${y - 7 * g}, ${x} ${y - 5 * g} C ${x + 6 * g} ${y - 7 * g}, ${x + 9 * g} ${y}, ${x} ${y + 8 * g} Z`} fill="#e11d48" />
          {[[-2.5, -1], [2.5, -1], [0, 2.5], [-3, 3], [3, 3]].map(([dx, dy], k) => <circle key={k} cx={x + dx * g} cy={y + dy * g} r={0.8 * g} fill="#fde68a" />)}
          <path d={`M ${x - 4 * g} ${y - 6 * g} l ${4 * g} ${2 * g} l ${4 * g} ${-2 * g}`} fill="#16a34a" />
        </>}
        {art === 1 && <>
          <path d={`M ${x} ${y - 2 * g} q ${2 * g} ${-7 * g} ${7 * g} ${-8 * g}`} fill="none" stroke="#15803d" strokeWidth={1.4 * g} />
          <circle cx={x} cy={y} r={5 * g} fill="#b91c1c" /><circle cx={x - 1.5 * g} cy={y - 1.5 * g} r={1.4 * g} fill="#fca5a5" />
        </>}
        {art === 2 && [[-4, 2], [3, 3], [0, -3], [4, -4]].map(([dx, dy], k) => (
          <g key={k}><circle cx={x + dx * g} cy={y + dy * g} r={3.2 * g} fill="#3730a3" /><circle cx={x + dx * g} cy={y + dy * g - 1.5 * g} r={0.9 * g} fill="#a5b4fc" /></g>
        ))}
      </g>
    );
  }
  return null;
}

/** Ein Ganzes. `voll[i]` = Teil i ist gefärbt (i < n). */
function Ganzes({ form, n, k, voll, onTeil, nr }: { form: Form; n: number; k: number; voll: boolean[]; onTeil?: (i: number) => void; nr: number }) {
  const f = FARBEN[form];
  const teile: ReactNode[] = [];
  const linien: ReactNode[] = [];
  const klick = (i: number) => (onTeil ? { onClick: () => onTeil(i), style: { cursor: "pointer" }, role: "button", "aria-label": `Teil ${i + 1}`, "aria-pressed": voll[i] } : {});
  const breite = form === "band" ? 2 * S : S, hoehe = form === "band" ? S / 3 : S;

  if (form === "pizza" || form === "torte") {
    const c = S / 2, r = S / 2 - 8;
    teile.push(<circle key="grund" cx={c} cy={c} r={r + 6} fill={form === "pizza" ? "#d97706" : "#fbcfe8"} />);
    for (let i = 0; i < n; i++) {
      const a0 = (2 * Math.PI * i) / n, a1 = (2 * Math.PI * (i + 1)) / n;
      teile.push(<path key={i} d={sektor(c, c, r, a0, a1)} fill={voll[i] ? f.voll : f.leer} stroke={f.rand} strokeWidth={2.5} {...klick(i)} />);
      {
        // Belag in jedem Stück, kleiner, je mehr Stücke es sind
        const am = (a0 + a1) / 2, rr = n === 1 ? 0 : r * (form === "torte" ? 0.72 : 0.6);
        teile.push(<Deko key={`d${i}`} form={form} x={c + rr * Math.sin(am)} y={c - rr * Math.cos(am)} g={Math.max(0.6, Math.min(2.4, 7.5 / n))} i={i} voll={voll[i]} />);
      }
      for (let j = 1; j < k; j++) {
        const a = a0 + ((a1 - a0) * j) / k;
        linien.push(<line key={`k${i}-${j}`} x1={c} y1={c} x2={c + r * Math.sin(a)} y2={c - r * Math.cos(a)} stroke={f.rand} strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />);
      }
    }
  } else {
    // eckig: Kuchen und Band in senkrechte Streifen, Tafel als Raster; k teilt waagerecht
    const [zeilen, spalten] = form === "tafel" ? raster(n) : [1, n];
    const w = breite / spalten, h = hoehe / zeilen;
    for (let i = 0; i < n; i++) {
      const x = (i % spalten) * w, y = Math.floor(i / spalten) * h;
      teile.push(<rect key={i} x={x + (form === "tafel" ? 2 : 0)} y={y + (form === "tafel" ? 2 : 0)} width={w - (form === "tafel" ? 4 : 0)} height={h - (form === "tafel" ? 4 : 0)}
        rx={form === "tafel" ? 4 : 0} fill={voll[i] ? f.voll : f.leer} stroke={f.rand} strokeWidth={form === "tafel" ? 1.5 : 2.5} {...klick(i)} />);
      if (form === "kuchen") teile.push(<Deko key={`d${i}`} form={form} x={x + w / 2} y={y + h * 0.45} g={Math.max(0.5, Math.min(2.2, w / 15, h / 22))} i={i} voll={voll[i]} />);
      if (form === "tafel") teile.push(<rect key={`p${i}`} x={x + 7} y={y + 7} width={Math.max(0, w - 14)} height={Math.max(0, h - 14)} rx={3} fill="none"
        stroke={voll[i] ? "#a0522d" : "#d6c3b0"} strokeWidth={1.5} pointerEvents="none" />);
    }
    for (let j = 1; j < k; j++) linien.push(<line key={`k${j}`} x1={0} y1={(hoehe * j) / k} x2={breite} y2={(hoehe * j) / k} stroke={f.rand} strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />);
    teile.push(<rect key="rahmen" x={0} y={0} width={breite} height={hoehe} fill="none" stroke={f.rand} strokeWidth={4} pointerEvents="none" />);
  }
  return (
    <svg viewBox={`-4 -4 ${breite + 8} ${hoehe + 8}`} className="w-full h-auto" role="group" aria-label={`Ganzes ${nr}`}>
      {teile}{linien}
    </svg>
  );
}

/**
 * Bruchbild mit `z` gefärbten Teilen (von vorne), oder genau den Teilen in
 * `auswahl` (Index über alle Ganzen). `ganze` erzwingt eine Mindestzahl Ganzer.
 */
export function BruchBild({ form, n, z, k = 1, auswahl, onTeil, ganze = 1, breite = "12rem" }: {
  form: Form; n: number; z?: number; k?: number; auswahl?: Set<number>; onTeil?: (i: number) => void; ganze?: number; breite?: string;
}) {
  const anzahl = Math.max(ganze, Math.ceil((z ?? 0) / n), auswahl ? Math.ceil((Math.max(-1, ...auswahl) + 1) / n) : 1, 1);
  const istVoll = (i: number) => (auswahl ? auswahl.has(i) : i < (z ?? 0));
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {Array.from({ length: anzahl }, (_, g) => (
        <div key={g} style={{ width: form === "band" ? `calc(${breite} * 2)` : breite, maxWidth: "100%" }}>
          <Ganzes form={form} n={n} k={k} nr={g + 1} voll={Array.from({ length: n }, (_, i) => istVoll(g * n + i))}
            onTeil={onTeil ? i => onTeil(g * n + i) : undefined} />
        </div>
      ))}
    </div>
  );
}

/** Ein Bruch gestapelt; `farbe` für Zähler/Nenner getrennt möglich. */
export function BruchSatz({ z, n, gross = false, zFarbe, nFarbe }: { z: ReactNode; n: ReactNode; gross?: boolean; zFarbe?: string; nFarbe?: string }) {
  return (
    <span className={`inline-flex flex-col items-center leading-none font-black tabular-nums align-middle mx-0.5 ${gross ? "text-4xl" : ""}`}>
      <span className="px-1" style={{ color: zFarbe }}>{z}</span>
      <span className="block w-full border-t-2 border-current my-0.5" />
      <span className="px-1" style={{ color: nFarbe }}>{n}</span>
    </span>
  );
}

/** Text mit »a/b« darin: die Brüche werden gestapelt gesetzt. */
export function Rechenzeile({ text }: { text: string }) {
  const teile = text.split(/((?:−)?\d+\/\d+)/g);
  return (
    <span className="leading-loose">
      {teile.map((t, i) => {
        const m = /^(−?)(\d+)\/(\d+)$/.exec(t);
        if (!m) return <span key={i}>{t}</span>;
        return <span key={i} className="whitespace-nowrap">{m[1]}<BruchSatz z={m[2]} n={m[3]} /></span>;
      })}
    </span>
  );
}
