"use client";
/**
 * Die Wohnung von oben — Grundriss aus der Wohnungsgröße, Möbel als
 * maßstäbliche Kästen mit Emoji, die Figur steht da, wo sie gerade etwas tut.
 * Unordnung wird sichtbar, nachts wird es dunkel (außer es gibt Licht).
 */
import { useMemo } from "react";
import { effekt, MOEBEL_DEF } from "@/lib/leben/kern";
import type { Spielstand } from "@/lib/leben/typen";

export type Platz = "bett" | "kueche" | "bad" | "sofa" | "tisch" | "tuer" | "mitte";

type Raum = { id: string; name: string; x: number; y: number; b: number; t: number; boden: string };

function grundriss(s: Spielstand): Raum[] {
  const w = s.wohnung;
  if (w.form === "eltern") {
    return [
      { id: "schlafen", name: "Dein Zimmer", x: 0, y: 0, b: 420, t: 340, boden: "#caa472" },
      { id: "flur", name: "Flur (Eltern)", x: 420, y: 0, b: 140, t: 340, boden: "#9ca3af" },
      { id: "kueche", name: "Küche der Eltern", x: 560, y: 0, b: 300, t: 200, boden: "#e5e7eb" },
      { id: "bad", name: "Bad", x: 560, y: 200, b: 300, t: 140, boden: "#bae6fd" },
    ];
  }
  if (w.form === "wg" || w.form === "azubiwohnheim") {
    const zimmerB = Math.round(Math.sqrt(w.qm * 10000 * 1.2));
    const zimmerT = Math.round((w.qm * 10000) / zimmerB);
    return [
      { id: "schlafen", name: w.form === "wg" ? "Dein WG-Zimmer" : "Dein Wohnheimzimmer", x: 0, y: 0, b: zimmerB, t: zimmerT, boden: "#caa472" },
      { id: "flur", name: "Flur", x: zimmerB, y: 0, b: 130, t: zimmerT, boden: "#9ca3af" },
      { id: "kueche", name: w.form === "wg" ? "Gemeinschaftsküche" : "Etagenküche", x: zimmerB + 130, y: 0, b: 320, t: Math.round(zimmerT * 0.6), boden: "#e5e7eb" },
      { id: "bad", name: "Bad (geteilt)", x: zimmerB + 130, y: Math.round(zimmerT * 0.6), b: 320, t: zimmerT - Math.round(zimmerT * 0.6), boden: "#bae6fd" },
    ];
  }
  // Eigene Wohnung: Fläche auf Räume aufteilen
  const flaeche = w.qm * 10000;
  const tiefe = Math.round(Math.sqrt(flaeche / 1.5));
  const breite = Math.round(flaeche / tiefe);
  const kuecheB = Math.round(breite * 0.3);
  const badT = Math.round(tiefe * 0.42);
  if (w.zimmer >= 2) {
    const wohnB = Math.round((breite - kuecheB) * 0.55);
    return [
      { id: "wohnen", name: "Wohnzimmer", x: 0, y: 0, b: wohnB, t: tiefe, boden: "#caa472" },
      { id: "schlafen", name: "Schlafzimmer", x: wohnB, y: 0, b: breite - kuecheB - wohnB, t: Math.round(tiefe * 0.7), boden: "#d6b88a" },
      { id: "flur", name: "Flur", x: wohnB, y: Math.round(tiefe * 0.7), b: breite - kuecheB - wohnB, t: tiefe - Math.round(tiefe * 0.7), boden: "#9ca3af" },
      { id: "kueche", name: w.ebk ? "Küche (EBK)" : "Küche (leer!)", x: breite - kuecheB, y: 0, b: kuecheB, t: tiefe - badT, boden: "#e5e7eb" },
      { id: "bad", name: "Bad", x: breite - kuecheB, y: tiefe - badT, b: kuecheB, t: badT, boden: "#bae6fd" },
    ];
  }
  return [
    { id: "schlafen", name: "Wohn- und Schlafraum", x: 0, y: 0, b: breite - kuecheB, t: Math.round(tiefe * 0.78), boden: "#caa472" },
    { id: "flur", name: "Flur", x: 0, y: Math.round(tiefe * 0.78), b: breite - kuecheB, t: tiefe - Math.round(tiefe * 0.78), boden: "#9ca3af" },
    { id: "kueche", name: w.ebk ? "Küche (EBK)" : "Küche (leer!)", x: breite - kuecheB, y: 0, b: kuecheB, t: tiefe - badT, boden: "#e5e7eb" },
    { id: "bad", name: "Bad", x: breite - kuecheB, y: tiefe - badT, b: kuecheB, t: badT, boden: "#bae6fd" },
  ];
}

const RAUM_FUER: Record<string, string[]> = {
  schlafen: ["schlafen", "wohnen"],
  wohnen: ["wohnen", "schlafen"],
  kueche: ["kueche"],
  bad: ["bad"],
  flur: ["flur", "wohnen", "schlafen"],
  technik: ["wohnen", "schlafen"],
};

type Gestellt = { uid: number; id: string; x: number; y: number; b: number; t: number; icon: string; name: string; defekt: boolean };

/** Möbel reihum an den Wänden entlang in ihre Räume stellen (einfaches Regalpacken). */
function stellen(s: Spielstand, raeume: Raum[]): { gestellt: Gestellt[]; kisten: string[] } {
  const gestellt: Gestellt[] = [];
  const kisten: string[] = [];
  const cursor = new Map<string, { x: number; y: number; zeile: number }>();
  const liste = [...s.moebel].sort((a, b) => {
    const da = MOEBEL_DEF.get(a.id), db = MOEBEL_DEF.get(b.id);
    return (db?.masse.b ?? 0) * (db?.masse.t ?? 0) - (da?.masse.b ?? 0) * (da?.masse.t ?? 0);
  });
  for (const m of liste) {
    const d = MOEBEL_DEF.get(m.id);
    if (!d) continue;
    if (d.masse.b === 0 || d.masse.t === 0) { kisten.push(d.icon); continue; }
    const ziele = (RAUM_FUER[d.raum] ?? ["wohnen"]).map((id) => raeume.find((r) => r.id === id)).filter((r): r is Raum => !!r);
    let platziert = false;
    for (const r of ziele) {
      const c = cursor.get(r.id) ?? { x: 12, y: 12, zeile: 0 };
      let { x, y, zeile } = c;
      const b = Math.min(d.masse.b, r.b - 24), t = Math.min(d.masse.t, r.t - 24);
      if (x + b > r.b - 12) { x = 12; y += zeile + 12; zeile = 0; }
      if (y + t > r.t - 12) continue;
      gestellt.push({ uid: m.uid, id: m.id, x: r.x + x, y: r.y + y, b, t, icon: d.icon, name: d.name, defekt: m.defekt });
      cursor.set(r.id, { x: x + b + 12, y, zeile: Math.max(zeile, t) });
      platziert = true;
      break;
    }
    if (!platziert) kisten.push(d.icon);
  }
  return { gestellt, kisten };
}

const ELTERN_MOEBEL: Gestellt[] = [
  { uid: -1, id: "e-bett", x: 14, y: 14, b: 100, t: 200, icon: "🛏️", name: "Dein Bett", defekt: false },
  { uid: -2, id: "e-schrank", x: 130, y: 14, b: 120, t: 60, icon: "🚪", name: "Kleiderschrank", defekt: false },
  { uid: -3, id: "e-tisch", x: 280, y: 14, b: 120, t: 60, icon: "🖥️", name: "Schreibtisch", defekt: false },
  { uid: -4, id: "e-kueche", x: 580, y: 14, b: 260, t: 60, icon: "🍳", name: "Küchenzeile der Eltern", defekt: false },
  { uid: -5, id: "e-kuehl", x: 580, y: 90, b: 60, t: 60, icon: "🧊", name: "Kühlschrank", defekt: false },
  { uid: -6, id: "e-tisch2", x: 680, y: 100, b: 140, t: 80, icon: "🍽️", name: "Esstisch", defekt: false },
  { uid: -7, id: "e-dusche", x: 580, y: 214, b: 90, t: 90, icon: "🚿", name: "Dusche", defekt: false },
  { uid: -8, id: "e-wm", x: 760, y: 214, b: 60, t: 60, icon: "🫧", name: "Waschmaschine", defekt: false },
];

export function Wohnungsbild({ s, platz }: { s: Spielstand; platz: Platz }) {
  const raeume = useMemo(() => grundriss(s), [s.wohnung.id, s.wohnung.qm, s.wohnung.form, s.wohnung.zimmer, s.wohnung.ebk]); // eslint-disable-line react-hooks/exhaustive-deps
  const { gestellt, kisten } = useMemo(() => {
    const r = stellen(s, raeume);
    if (s.wohnung.form === "eltern") return { gestellt: [...ELTERN_MOEBEL, ...r.gestellt.filter((g) => g.id === "fahrrad-schloss")], kisten: r.kisten };
    return r;
  }, [s.moebel, raeume, s.wohnung.form]); // eslint-disable-line react-hooks/exhaustive-deps
  const breite = Math.max(...raeume.map((r) => r.x + r.b));
  const tiefe = Math.max(...raeume.map((r) => r.y + r.t));

  // Wo steht die Figur?
  const finde = (ids: string[]) => gestellt.find((g) => ids.some((i) => g.id.includes(i)));
  const raum = (id: string) => raeume.find((r) => r.id === id) ?? raeume[0];
  const ziel = (() => {
    const bett = finde(["bett", "matratze", "schlafsofa"]);
    switch (platz) {
      case "bett": return bett ? { x: bett.x + bett.b / 2, y: bett.y + bett.t / 2 } : { x: raum("schlafen").x + 80, y: raum("schlafen").y + raum("schlafen").t - 80 };
      case "kueche": return { x: raum("kueche").x + raum("kueche").b / 2, y: raum("kueche").y + raum("kueche").t / 2 };
      case "bad": return { x: raum("bad").x + raum("bad").b / 2, y: raum("bad").y + raum("bad").t / 2 };
      case "sofa": { const so = finde(["sofa", "stuhl", "burostuhl"]); return so ? { x: so.x + so.b / 2, y: so.y + so.t / 2 } : { x: raum("schlafen").x + raum("schlafen").b / 2, y: raum("schlafen").y + raum("schlafen").t / 2 }; }
      case "tisch": { const t = finde(["tisch", "schreibtisch"]); return t ? { x: t.x + t.b / 2, y: t.y + t.t + 30 } : { x: raum("schlafen").x + raum("schlafen").b / 2, y: raum("schlafen").y + raum("schlafen").t / 2 }; }
      case "tuer": return { x: raum("flur").x + raum("flur").b / 2, y: raum("flur").y + raum("flur").t - 40 };
      default: return { x: raum("schlafen").x + raum("schlafen").b / 2, y: raum("schlafen").y + raum("schlafen").t / 2 };
    }
  })();

  const nacht = s.stunde < 6 || s.stunde >= 21;
  const licht = effekt(s, "licht");
  const ordnung = s.beduerfnisse.ordnung;
  const muell = useMemo(() => {
    const n = ordnung < 15 ? 12 : ordnung < 30 ? 8 : ordnung < 50 ? 4 : 0;
    const zeichen = ["🧦", "📦", "🍕", "🥤", "👕", "🗞️", "🍌", "🧃"];
    const r = (i: number) => ((Math.sin(i * 12.9898 + s.wohnung.einzug) * 43758.5453) % 1 + 1) % 1;
    return Array.from({ length: n }, (_, i) => {
      const rm = raeume[Math.floor(r(i) * raeume.length)];
      return { x: rm.x + 30 + r(i + 7) * (rm.b - 60), y: rm.y + 30 + r(i + 13) * (rm.t - 60), z: zeichen[i % zeichen.length] };
    });
  }, [ordnung < 15, ordnung < 30, ordnung < 50, raeume, s.wohnung.einzug]); // eslint-disable-line react-hooks/exhaustive-deps

  const ohneBett = s.wohnung.form === "wohnung" && !finde(["bett", "matratze", "schlafsofa"]);

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`-40 -40 ${breite + 80} ${tiefe + 80}`} className="h-full w-full" role="img" aria-label={`Grundriss: ${s.wohnung.titel}`}>
        <defs>
          <pattern id="dielen" width="40" height="12" patternUnits="userSpaceOnUse">
            <rect width="40" height="12" fill="none" stroke="#0000001a" strokeWidth="1" />
          </pattern>
        </defs>
        {raeume.map((r) => (
          <g key={r.id}>
            <rect x={r.x} y={r.y} width={r.b} height={r.t} fill={r.boden} stroke="#1e293b" strokeWidth={10} />
            {(r.id === "schlafen" || r.id === "wohnen") && <rect x={r.x} y={r.y} width={r.b} height={r.t} fill="url(#dielen)" />}
            <text x={r.x + 10} y={r.y + r.t - 10} fontSize={22} fill="#1e293b" opacity={0.55} fontWeight={700}>{r.name}</text>
          </g>
        ))}
        {/* Einbauküche: Zeile an der oberen Wand */}
        {(s.wohnung.ebk && s.wohnung.form !== "eltern") && (() => {
          const k = raum("kueche");
          return (
            <g>
              <title>Einbauküche (Herd, Spüle, Kühlschrank)</title>
              <rect x={k.x + 10} y={k.y + 10} width={k.b - 20} height={62} rx={6} fill="#cbd5e1" stroke="#334155" strokeWidth={3} />
              <text x={k.x + 40} y={k.y + 55} fontSize={30}>🍳</text>
              <text x={k.x + k.b / 2} y={k.y + 55} fontSize={30} textAnchor="middle">🚰</text>
              <text x={k.x + k.b - 50} y={k.y + 55} fontSize={30}>🧊</text>
            </g>
          );
        })()}
        {/* Fenster */}
        <line x1={raeume[0].x + 60} y1={-2} x2={raeume[0].x + Math.min(raeume[0].b - 60, 220)} y2={-2} stroke="#7dd3fc" strokeWidth={12} />
        {gestellt.map((g) => (
          <g key={g.uid}>
            <title>{g.name}{g.defekt ? " (defekt)" : ""}</title>
            <rect x={g.x} y={g.y} width={g.b} height={g.t} rx={10} fill={g.defekt ? "#7f1d1d" : "#f8fafc"} stroke="#334155" strokeWidth={3} opacity={0.92} />
            <text x={g.x + g.b / 2} y={g.y + g.t / 2 + 14} fontSize={Math.min(44, Math.max(22, Math.min(g.b, g.t) * 0.55))} textAnchor="middle">{g.icon}</text>
            {g.defekt && <text x={g.x + g.b - 16} y={g.y + 24} fontSize={20}>⚠️</text>}
          </g>
        ))}
        {ohneBett && <text x={raeume[0].x + 60} y={raeume[0].y + raeume[0].t - 70} fontSize={48}>🛌</text>}
        {muell.map((m, i) => <text key={i} x={m.x} y={m.y} fontSize={26}>{m.z}</text>)}
        {ordnung < 15 && <text x={raeume[0].x + raeume[0].b / 2} y={raeume[0].y + 60} fontSize={30}>🪰</text>}
        {kisten.length > 0 && (
          <g>
            <title>Kleinkram: {kisten.join(" ")}</title>
            <text x={raum("kueche").x + 16} y={raum("kueche").y + raum("kueche").t - 40} fontSize={20}>{kisten.slice(0, 10).join("")}</text>
          </g>
        )}
        {/* Figur */}
        <g style={{ transition: "transform 0.6s ease" }} transform={`translate(${ziel.x}, ${ziel.y})`}>
          <circle r={34} fill={s.figur.farbe} opacity={0.35} />
          <text y={16} fontSize={46} textAnchor="middle">{platz === "bett" && nacht ? "😴" : s.figur.avatar}</text>
          {s.zustand.kater && s.zustand.kater >= s.tag && <text x={26} y={-22} fontSize={24}>🤕</text>}
          {s.zustand.krank && s.zustand.krank.bis >= s.tag && <text x={26} y={-22} fontSize={24}>🤒</text>}
        </g>
        {nacht && <rect x={-40} y={-40} width={breite + 80} height={tiefe + 80} fill="#020617" opacity={licht > 0 ? 0.35 : 0.65} pointerEvents="none" />}
      </svg>
      {s.wohnung.form === "wohnung" && !s.wohnung.ebk && !s.moebel.some((m) => ["standherd-backofen", "doppelkochplatte", "einbaukueche-kuchenzeile"].includes(m.id)) && (
        <div className="absolute bottom-2 left-2 rounded-lg bg-rose-600/90 px-2 py-1 text-xs font-bold text-white">Keine Küche: kochen unmöglich</div>
      )}
    </div>
  );
}
