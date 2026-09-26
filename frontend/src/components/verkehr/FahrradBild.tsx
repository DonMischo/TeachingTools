"use client";
/**
 * Das Fahrrad von der Seite, selbst gezeichnet aus der Rahmengeometrie der
 * fünf Modelle (Laufradgröße, Rahmenform). Jedes Teil ist ein eigenes,
 * anklickbares Element und zeigt seinen Zustand: in Ordnung, kaputt/schlapp
 * (orange) oder fehlt (gestrichelt, dort gehört es hin).
 */
import type { ReactNode } from "react";
import type { Fahrrad, Modell, TeilId, Zustand } from "@/lib/verkehr/fahrrad";
import { hexFarbe } from "@/lib/verkehr/aussehen";

type Geo = {
  r: number; hinten: [number, number]; vorn: [number, number]; tretlager: [number, number];
  sattel: [number, number]; lenkkopfOben: [number, number]; lenkkopfUnten: [number, number]; lenker: [number, number];
  oberrohr: "gerade" | "schraeg" | "tief" | "keins"; federgabel?: boolean; stollen?: boolean; gelenk?: boolean; gepaeck?: boolean;
};

/** Rahmengeometrie in einem 220 × 130-Bild (Laufräder am Boden bei y = 118). */
const GEO: Record<Modell, Geo> = {
  herrenrad: { r: 36, hinten: [48, 82], vorn: [168, 82], tretlager: [100, 86], sattel: [90, 32], lenkkopfOben: [150, 36], lenkkopfUnten: [156, 54], lenker: [140, 28], oberrohr: "gerade", gepaeck: true },
  damenrad: { r: 36, hinten: [48, 82], vorn: [168, 82], tretlager: [100, 86], sattel: [88, 34], lenkkopfOben: [150, 34], lenkkopfUnten: [156, 54], lenker: [136, 24], oberrohr: "tief", gepaeck: true },
  mountainbike: { r: 35, hinten: [48, 83], vorn: [170, 83], tretlager: [102, 84], sattel: [92, 32], lenkkopfOben: [150, 40], lenkkopfUnten: [155, 58], lenker: [146, 36], oberrohr: "schraeg", federgabel: true, stollen: true },
  bmx: { r: 26, hinten: [58, 92], vorn: [156, 92], tretlager: [104, 88], sattel: [92, 58], lenkkopfOben: [140, 54], lenkkopfUnten: [144, 70], lenker: [132, 32], oberrohr: "schraeg", stollen: true },
  klapprad: { r: 26, hinten: [56, 92], vorn: [160, 92], tretlager: [104, 92], sattel: [92, 30], lenkkopfOben: [148, 40], lenkkopfUnten: [152, 72], lenker: [144, 26], oberrohr: "keins", gelenk: true, gepaeck: true },
};

const FARBE: Record<Zustand, string> = { ok: "#111827", kaputt: "#f97316", fehlt: "#ef4444" };

export function FahrradBild({ rad, auswahl, onTeil, breite = 280 }: {
  rad: Fahrrad; auswahl?: TeilId | null; onTeil?: (t: TeilId) => void; breite?: number;
}) {
  const g = GEO[rad.modell];
  const rahmen = hexFarbe(rad.farbe);
  const z = (t: TeilId) => rad.teile[t];
  // Ein Teil: anklickbar, mit Zustand; fehlt = gestrichelter Umriss
  const teil = (t: TeilId, kinder: ReactNode, titel: string) => (
    <g key={t} onClick={onTeil ? () => onTeil(t) : undefined} style={{ cursor: onTeil ? "pointer" : undefined }}
      opacity={z(t) === "fehlt" ? 0.55 : 1} strokeDasharray={z(t) === "fehlt" ? "3 2" : undefined}>
      <title>{titel}{z(t) === "fehlt" ? " — fehlt" : z(t) === "kaputt" ? " — kaputt" : ""}</title>
      {kinder}
    </g>
  );
  const rad_ = (c: [number, number], t: TeilId) => {
    const zu = z(t);
    const platt = zu === "fehlt", schlapp = zu === "kaputt";
    return teil(t, (
      <g>
        {/* Speichen */}
        {Array.from({ length: 12 }, (_, i) => {
          const w = (i / 12) * Math.PI * 2;
          return <line key={i} x1={c[0]} y1={c[1]} x2={c[0] + Math.cos(w) * (g.r - 4)} y2={c[1] + Math.sin(w) * (g.r - 4)} stroke="#9ca3af" strokeWidth={0.6} />;
        })}
        <circle cx={c[0]} cy={c[1]} r={g.r - 3} fill="none" stroke="#6b7280" strokeWidth={2} />
        {/* Reifen: schlapp = unten abgeflacht, platt = rot */}
        <ellipse cx={c[0]} cy={c[1] + (schlapp ? 2 : platt ? 4 : 0)} rx={g.r} ry={g.r - (schlapp ? 2 : platt ? 4 : 0)} fill="none"
          stroke={platt ? FARBE.fehlt : schlapp ? FARBE.kaputt : "#1f2937"} strokeWidth={g.stollen ? 5 : 4}
          strokeDasharray={g.stollen ? "2 1.5" : undefined} />
        <circle cx={c[0]} cy={c[1]} r={3} fill="#374151" />
        {auswahl === t && <circle cx={c[0]} cy={c[1]} r={g.r + 4} fill="none" stroke="#0ea5e9" strokeWidth={2} />}
      </g>
    ), t === "reifenVorn" ? "Reifen vorn" : "Reifen hinten");
  };
  const [bx, by] = g.tretlager, [sx, sy] = g.sattel, [ox, oy] = g.lenkkopfOben, [ux, uy] = g.lenkkopfUnten;
  const markiert = (t: TeilId, x: number, y: number, r = 7) => auswahl === t && <circle cx={x} cy={y} r={r} fill="none" stroke="#0ea5e9" strokeWidth={2} />;

  return (
    <svg viewBox="0 0 220 130" width={breite} height={(breite * 130) / 220} role="img" aria-label={`Fahrrad: ${rad.modell}`}>
      <line x1={0} y1={118.5} x2={220} y2={118.5} stroke="#d1d5db" strokeWidth={1} />
      {rad_(g.hinten, "reifenHinten")}
      {rad_(g.vorn, "reifenVorn")}
      {/* Speichenreflektoren: je zwei gelbe je Rad */}
      {teil("speichenstrahler", <g>
        {[g.hinten, g.vorn].flatMap((c, i) => [0, Math.PI].map((w, k) => (
          <rect key={`${i}${k}`} x={c[0] + Math.cos(w + 0.6) * (g.r * 0.55) - 3} y={c[1] + Math.sin(w + 0.6) * (g.r * 0.55) - 1.5} width={6} height={3} rx={1}
            fill={z("speichenstrahler") === "ok" ? "#facc15" : "none"} stroke={FARBE[z("speichenstrahler")]} strokeWidth={0.8} />
        )))}
        {markiert("speichenstrahler", g.vorn[0] + g.r * 0.45, g.vorn[1] + g.r * 0.3, 9)}
      </g>, "Speichenreflektoren")}
      {/* Kette */}
      {teil("kette", <g>
        <line x1={bx} y1={by - 5} x2={g.hinten[0]} y2={g.hinten[1] - 3} stroke={FARBE[z("kette")]} strokeWidth={1.5} />
        <line x1={bx} y1={by + 5} x2={g.hinten[0]} y2={g.hinten[1] + 3} stroke={FARBE[z("kette")]} strokeWidth={1.5} />
        <circle cx={bx} cy={by} r={7} fill="none" stroke="#374151" strokeWidth={1.5} />
        {markiert("kette", (bx + g.hinten[0]) / 2, (by + g.hinten[1]) / 2, 10)}
      </g>, "Kette")}
      {/* Rahmen */}
      <g stroke={rahmen} strokeWidth={4.5} strokeLinecap="round" fill="none">
        <line x1={bx} y1={by} x2={sx + 2} y2={sy + 8} />
        <line x1={bx} y1={by} x2={g.hinten[0]} y2={g.hinten[1]} />
        <line x1={sx + 2} y1={sy + 8} x2={g.hinten[0]} y2={g.hinten[1]} />
        {g.oberrohr === "tief"
          ? <path d={`M${ux} ${uy} Q ${bx + 10} ${by - 30} ${bx} ${by}`} />
          : <line x1={ux} y1={uy} x2={bx} y2={by} />}
        {g.oberrohr === "tief" && <path d={`M${ox} ${oy + 6} Q ${bx + 16} ${by - 36} ${bx + 4} ${by - 6}`} />}
        {g.oberrohr === "gerade" && <line x1={sx + 2} y1={sy + 10} x2={ox} y2={oy + 4} />}
        {g.oberrohr === "schraeg" && <line x1={sx + 3} y1={sy + 16} x2={ox} y2={oy + 4} />}
        {g.oberrohr === "keins" && <line x1={ux - 2} y1={uy - 2} x2={sx + 4} y2={by - 4} />}
        <line x1={ox} y1={oy} x2={ux} y2={uy} strokeWidth={5.5} />
      </g>
      {g.gelenk && <circle cx={(ux + sx) / 2 + 6} cy={(uy + by) / 2 - 2} r={4} fill="#e5e7eb" stroke="#374151" strokeWidth={1.2} />}
      {/* Gabel (Federgabel beim MTB) */}
      <line x1={ux} y1={uy} x2={g.vorn[0]} y2={g.vorn[1]} stroke={g.federgabel ? "#111827" : rahmen} strokeWidth={g.federgabel ? 6 : 3.5} strokeLinecap="round" />
      {/* Sattel, Lenker */}
      <line x1={sx + 2} y1={sy + 8} x2={sx} y2={sy} stroke="#4b5563" strokeWidth={2.5} />
      <path d={`M${sx - 12} ${sy - 2} L${sx + 10} ${sy - 3} L${sx + 6} ${sy + 2} L${sx - 10} ${sy + 2} Z`} fill="#1f2937" />
      <line x1={ox} y1={oy} x2={g.lenker[0] + 4} y2={g.lenker[1] + 4} stroke="#4b5563" strokeWidth={2.5} />
      <line x1={g.lenker[0] - 6} y1={g.lenker[1] + 2} x2={g.lenker[0] + 8} y2={g.lenker[1] + 6} stroke="#111827" strokeWidth={3} strokeLinecap="round" />
      {g.gepaeck && <path d={`M${sx + 2} ${sy + 12} L${g.hinten[0] - 4} ${sy + 12} L${g.hinten[0]} ${g.hinten[1]}`} fill="none" stroke="#6b7280" strokeWidth={2} />}
      {/* Pedal mit gelben Rückstrahlern */}
      {teil("pedalstrahler", <g>
        <line x1={bx} y1={by} x2={bx + 10} y2={by + 12} stroke="#6b7280" strokeWidth={2.5} />
        <rect x={bx + 5} y={by + 11} width={12} height={4} rx={1} fill="#374151" />
        <rect x={bx + 7} y={by + 11.5} width={3} height={3} fill={z("pedalstrahler") === "ok" ? "#facc15" : "none"} stroke={FARBE[z("pedalstrahler")]} strokeWidth={0.6} />
        <rect x={bx + 12} y={by + 11.5} width={3} height={3} fill={z("pedalstrahler") === "ok" ? "#facc15" : "none"} stroke={FARBE[z("pedalstrahler")]} strokeWidth={0.6} />
        {markiert("pedalstrahler", bx + 11, by + 13)}
      </g>, "Pedalrückstrahler (gelb)")}
      {/* Bremsen: Klötze an den Felgen */}
      {teil("bremseHinten", <g>
        <rect x={g.hinten[0] + g.r * 0.5} y={g.hinten[1] - g.r * 0.85} width={5} height={8} rx={1} fill={z("bremseHinten") === "ok" ? "#111827" : "none"} stroke={FARBE[z("bremseHinten")]} strokeWidth={1.2} />
        {markiert("bremseHinten", g.hinten[0] + g.r * 0.5 + 2, g.hinten[1] - g.r * 0.85 + 4)}
      </g>, "Bremse hinten")}
      {teil("bremseVorn", <g>
        <rect x={g.vorn[0] - g.r * 0.45 - 5} y={g.vorn[1] - g.r * 0.9} width={5} height={8} rx={1} fill={z("bremseVorn") === "ok" ? "#111827" : "none"} stroke={FARBE[z("bremseVorn")]} strokeWidth={1.2} />
        {markiert("bremseVorn", g.vorn[0] - g.r * 0.45 - 2, g.vorn[1] - g.r * 0.9 + 4)}
      </g>, "Bremse vorn")}
      {/* Klingel am Lenker */}
      {teil("klingel", <g>
        <circle cx={g.lenker[0] + 2} cy={g.lenker[1]} r={3.5} fill={z("klingel") === "ok" ? "#d4d4d8" : "none"} stroke={FARBE[z("klingel")]} strokeWidth={1} />
        {markiert("klingel", g.lenker[0] + 2, g.lenker[1])}
      </g>, "Klingel")}
      {/* Scheinwerfer und Frontstrahler */}
      {teil("licht", <g>
        <path d={`M${ux + 4} ${uy - 6} l8 -3 l0 9 l-8 -3 Z`} fill={z("licht") === "ok" ? "#fde68a" : "none"} stroke={FARBE[z("licht")]} strokeWidth={1} />
        {z("licht") === "ok" && <path d={`M${ux + 12} ${uy - 9} l10 -4 M${ux + 12} ${uy - 6} l11 0 M${ux + 12} ${uy - 3} l10 4`} stroke="#fcd34d" strokeWidth={0.8} />}
        {markiert("licht", ux + 8, uy - 6)}
      </g>, "Scheinwerfer (weiß)")}
      {teil("frontstrahler", <g>
        <circle cx={ux + 6} cy={uy + 3} r={2.5} fill={z("frontstrahler") === "ok" ? "#f8fafc" : "none"} stroke={z("frontstrahler") === "ok" ? "#9ca3af" : FARBE[z("frontstrahler")]} strokeWidth={0.8} />
        {markiert("frontstrahler", ux + 6, uy + 3, 5)}
      </g>, "Frontstrahler (weiß)")}
      {/* Rücklicht und Z-Rückstrahler am Gepäckträger bzw. an der Sattelstütze */}
      {teil("ruecklicht", <g>
        <rect x={g.hinten[0] - 12} y={sy + 8} width={7} height={5} rx={1} fill={z("ruecklicht") === "ok" ? "#ef4444" : "none"} stroke={FARBE[z("ruecklicht")] === FARBE.ok ? "#7f1d1d" : FARBE[z("ruecklicht")]} strokeWidth={0.8} />
        {markiert("ruecklicht", g.hinten[0] - 8, sy + 10)}
      </g>, "Rücklicht (rot)")}
      {teil("rueckstrahler", <g>
        <rect x={g.hinten[0] - 12} y={sy + 15} width={7} height={7} rx={1} fill={z("rueckstrahler") === "ok" ? "#b91c1c" : "none"} stroke={FARBE[z("rueckstrahler")] === FARBE.ok ? "#450a0a" : FARBE[z("rueckstrahler")]} strokeWidth={0.8} />
        {z("rueckstrahler") === "ok" && <text x={g.hinten[0] - 8.5} y={sy + 20.5} fontSize={5} fontWeight={700} fill="#fecaca" textAnchor="middle">Z</text>}
        {markiert("rueckstrahler", g.hinten[0] - 8, sy + 18)}
      </g>, "Rückstrahler (rot, Kategorie Z)")}
    </svg>
  );
}
