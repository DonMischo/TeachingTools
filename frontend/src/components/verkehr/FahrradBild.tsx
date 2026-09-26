"use client";
/**
 * Das Fahrrad von der Seite, selbst gezeichnet aus der Rahmengeometrie der
 * fünf Modelle (Laufradgröße, Rahmenform). Jedes Teil ist ein eigenes,
 * anklickbares Element und zeigt seinen Zustand: in Ordnung, kaputt/schlapp
 * (orange) oder fehlt (gestrichelt, dort gehört es hin). Im Werkstatt-Spiel
 * (»geprueft«) sieht man den Zustand erst, wenn man das Teil geprüft hat:
 * Fehlendes ist dann einfach nicht da, Kaputtes sieht heil aus.
 */
import type { ReactNode } from "react";
import type { Fahrrad, Modell, TeilId, Zustand } from "@/lib/verkehr/fahrrad";
import { hexFarbe } from "@/lib/verkehr/aussehen";

type P = [number, number];
type Geo = {
  r: number; hinten: P; vorn: P; tretlager: P;
  sattel: P; lenkkopfOben: P; lenkkopfUnten: P; lenker: P;
  rahmen: "diamant" | "schraeg" | "tief" | "klapp"; federgabel?: boolean; stollen?: boolean; gepaeck?: boolean;
};

/** Rahmengeometrie in einem 220 × 130-Bild (Laufräder am Boden bei y = 118). */
const GEO: Record<Modell, Geo> = {
  herrenrad: { r: 36, hinten: [48, 82], vorn: [168, 82], tretlager: [100, 86], sattel: [90, 32], lenkkopfOben: [150, 36], lenkkopfUnten: [156, 54], lenker: [140, 28], rahmen: "diamant", gepaeck: true },
  damenrad: { r: 36, hinten: [48, 82], vorn: [168, 82], tretlager: [100, 86], sattel: [88, 34], lenkkopfOben: [150, 34], lenkkopfUnten: [156, 54], lenker: [136, 24], rahmen: "tief", gepaeck: true },
  mountainbike: { r: 35, hinten: [48, 83], vorn: [170, 83], tretlager: [102, 84], sattel: [92, 32], lenkkopfOben: [150, 40], lenkkopfUnten: [155, 58], lenker: [146, 36], rahmen: "schraeg", federgabel: true, stollen: true },
  bmx: { r: 26, hinten: [58, 92], vorn: [156, 92], tretlager: [104, 88], sattel: [90, 58], lenkkopfOben: [140, 56], lenkkopfUnten: [144, 70], lenker: [136, 38], rahmen: "schraeg", stollen: true },
  klapprad: { r: 26, hinten: [56, 92], vorn: [160, 92], tretlager: [104, 92], sattel: [92, 34], lenkkopfOben: [148, 40], lenkkopfUnten: [152, 72], lenker: [144, 28], rahmen: "klapp", gepaeck: true },
};

const FARBE: Record<Zustand, string> = { ok: "#111827", kaputt: "#f97316", fehlt: "#ef4444" };
const mix = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Von a aus d Einheiten in Richtung b. */
const hin = (a: P, b: P, d: number): P => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [a[0] + ((b[0] - a[0]) / l) * d, a[1] + ((b[1] - a[1]) / l) * d]; };
/** Bogen um c mit Radius r von Winkel a nach b (Grad, im Uhrzeigersinn). */
const bogen = (c: P, r: number, a: number, b: number) => {
  const p = (w: number) => `${c[0] + Math.cos((w * Math.PI) / 180) * r} ${c[1] + Math.sin((w * Math.PI) / 180) * r}`;
  return `M${p(a)} A${r} ${r} 0 0 1 ${p(b)}`;
};

export function FahrradBild({ rad, auswahl, onTeil, breite = 280, geprueft }: {
  rad: Fahrrad; auswahl?: TeilId | null; onTeil?: (t: TeilId) => void;
  /** Pixelbreite, oder "voll" für die ganze Breite des Behälters. */
  breite?: number | "voll";
  /** Werkstatt-Spiel: nur diese Teile zeigen ihren echten Zustand. */
  geprueft?: TeilId[];
}) {
  const g = GEO[rad.modell];
  const rahmen = hexFarbe(rad.farbe);
  const verdeckt = (t: TeilId) => !!geprueft && !geprueft.includes(t);
  // Was man sieht: ungeprüft sieht Kaputtes heil aus
  const z = (t: TeilId): Zustand => (verdeckt(t) && rad.teile[t] === "kaputt" ? "ok" : rad.teile[t]);
  const [bx, by] = g.tretlager, [sx, sy] = g.sattel, [ox, oy] = g.lenkkopfOben, [ux, uy] = g.lenkkopfUnten;
  const B = g.tretlager, H = g.hinten, V = g.vorn, U = g.lenkkopfUnten, O = g.lenkkopfOben;
  const S: P = [sx + 2, sy + 8]; // Sitzrohr oben
  const kr = Math.round(g.r * 0.26); // Kettenblatt

  /** Ein Teil: anklickbar (große unsichtbare Trefferflächen), mit Zustand und Auswahlring. */
  const teil = (t: TeilId, titel: string, kinder: ReactNode, treffer: [number, number, number][]) => {
    const weg = z(t) === "fehlt" && verdeckt(t);
    return (
      <g key={t} onClick={onTeil ? () => onTeil(t) : undefined} style={{ cursor: onTeil ? "pointer" : undefined }}>
        <title>{titel}{verdeckt(t) ? "" : z(t) === "fehlt" ? " — fehlt" : z(t) === "kaputt" ? " — kaputt" : ""}</title>
        <g opacity={weg ? 0 : z(t) === "fehlt" ? 0.6 : 1} strokeDasharray={z(t) === "fehlt" && !weg ? "3 2" : undefined}>{kinder}</g>
        {treffer.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="transparent" />)}
        {auswahl === t && <circle cx={treffer[0][0]} cy={treffer[0][1]} r={treffer[0][2] + 2} fill="none" stroke="#0ea5e9" strokeWidth={2} />}
      </g>
    );
  };
  const laufrad = (c: P, t: TeilId) => {
    // Die Form verrät einen schlappen oder platten Reifen immer, die Farbe erst nach dem Prüfen
    const echt = rad.teile[t], zu = z(t);
    const dellen = echt === "kaputt" ? 2 : echt === "fehlt" ? 4 : 0;
    const farbe = zu === "fehlt" ? FARBE.fehlt : zu === "kaputt" ? FARBE.kaputt : "#1f2937";
    return teil(t, t === "reifenVorn" ? "Reifen vorn" : "Reifen hinten", (
      <g strokeDasharray="none">
        {Array.from({ length: 16 }, (_, i) => {
          const w = (i / 16) * Math.PI * 2;
          return <line key={i} x1={c[0] + Math.cos(w) * 2} y1={c[1] + Math.sin(w) * 2} x2={c[0] + Math.cos(w + 0.35) * (g.r - 4)} y2={c[1] + Math.sin(w + 0.35) * (g.r - 4)} stroke="#9ca3af" strokeWidth={0.5} />;
        })}
        <circle cx={c[0]} cy={c[1]} r={g.r - 3.5} fill="none" stroke="#9ca3af" strokeWidth={2.2} />
        <ellipse cx={c[0]} cy={c[1] + dellen / 2} rx={g.r + dellen / 3} ry={g.r - dellen / 2} fill="none"
          stroke={farbe} strokeWidth={g.stollen ? 5 : 4} strokeDasharray={g.stollen ? "2 1.4" : undefined} />
        <circle cx={c[0]} cy={c[1]} r={2.5} fill="#4b5563" />
      </g>
    ), [[c[0], c[1], g.r + 2]]);
  };

  // Bremsklötze sitzen dort, wo Sitzstrebe und Gabel die Felge kreuzen
  const bremsH = hin(H, S, g.r - 3), bremsV = hin(V, U, g.r - 3);
  // Rücklicht und Rückstrahler: am Gepäckträger, sonst an der Sattelstütze bzw. der Sitzstrebe
  const traeger: P = [H[0] - 3, sy + 12];
  const rl: P = g.gepaeck ? [H[0] - 6, sy + 8.5] : [sx - 4, sy + 5];
  const rs: P = g.gepaeck ? [H[0] - 3, sy + 20] : mix(S, H, 0.3);
  const lampe: P = [ux + 9, uy - 4];
  const kurbel: P = [bx + 11, by + 10];
  const spStrahler: P[] = [H, V].flatMap((c) => [0.6, 0.6 + Math.PI].map((w): P => [c[0] + Math.cos(w) * g.r * 0.55, c[1] + Math.sin(w) * g.r * 0.55]));
  const gelb = (t: TeilId) => (z(t) === "ok" ? "#facc15" : "none");

  const rohre = (() => {
    switch (g.rahmen) {
      case "diamant": return <><line x1={S[0]} y1={S[1] + 2} x2={ox} y2={oy + 4} /><line x1={ux} y1={uy} x2={bx} y2={by} /></>;
      case "schraeg": { const j = mix(B, S, 0.72); return <><line x1={j[0]} y1={j[1]} x2={ox} y2={oy + 4} /><line x1={ux} y1={uy} x2={bx} y2={by} /></>; }
      case "tief": {
        // Damenrad: ein geschwungenes Rohr vom Lenkkopf tief ans Sitzrohr, darunter das Unterrohr
        const j = mix(B, S, 0.28);
        return <><path d={`M${ox} ${oy + 5} Q ${j[0] + 22} ${oy + 18} ${j[0]} ${j[1]}`} /><line x1={ux} y1={uy} x2={bx} y2={by} /></>;
      }
      case "klapp": {
        // Klapprad: ein dickes Hauptrohr mit Gelenk, keine Oberrohre
        const a = mix(O, U, 0.75), e = mix(B, S, 0.2);
        return <path d={`M${a[0]} ${a[1]} Q ${(a[0] + e[0]) / 2} ${e[1] + 2} ${e[0]} ${e[1]}`} strokeWidth={6} />;
      }
    }
  })();

  return (
    <svg viewBox="0 0 220 130" width={breite === "voll" ? "100%" : breite} height={breite === "voll" ? undefined : (breite * 130) / 220}
      style={breite === "voll" ? { height: "auto", display: "block" } : undefined} role="img" aria-label={`Fahrrad: ${rad.modell}`}>
      <line x1={0} y1={118.5} x2={220} y2={118.5} stroke="#d1d5db" strokeWidth={1} />
      {laufrad(H, "reifenHinten")}
      {laufrad(V, "reifenVorn")}
      {/* Schutzbleche beim Stadtrad */}
      {g.gepaeck && <g stroke="#9ca3af" strokeWidth={2} fill="none" strokeLinecap="round">
        <path d={bogen(H, g.r + 4, 160, 350)} />
        <path d={bogen(V, g.r + 4, 205, 20)} />
      </g>}
      {teil("speichenstrahler", "Speichenreflektoren", <g>
        {spStrahler.map((p, i) => (
          <rect key={i} x={p[0] - 3} y={p[1] - 1.5} width={6} height={3} rx={1} fill={gelb("speichenstrahler")} stroke={FARBE[z("speichenstrahler")]} strokeWidth={0.7} />
        ))}
      </g>, spStrahler.map((p): [number, number, number] => [p[0], p[1], 5]))}
      {/* Rahmen */}
      <g stroke={rahmen} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1={bx} y1={by} x2={S[0]} y2={S[1]} />
        <line x1={bx} y1={by} x2={H[0]} y2={H[1]} />
        <line x1={S[0]} y1={S[1]} x2={H[0]} y2={H[1]} strokeWidth={3.5} />
        {rohre}
        <line x1={ox} y1={oy} x2={ux} y2={uy} strokeWidth={5.5} />
      </g>
      {g.rahmen === "klapp" && (() => { const p = mix(mix(O, U, 0.75), mix(B, S, 0.2), 0.5); return <circle cx={p[0]} cy={p[1] + 2} r={4} fill="#e5e7eb" stroke="#374151" strokeWidth={1.2} />; })()}
      {/* Gabel (Federgabel beim MTB) */}
      {g.federgabel
        ? <><line x1={ux} y1={uy} x2={mix(U, V, 0.5)[0]} y2={mix(U, V, 0.5)[1]} stroke="#111827" strokeWidth={6} strokeLinecap="round" />
            <line x1={mix(U, V, 0.45)[0]} y1={mix(U, V, 0.45)[1]} x2={V[0]} y2={V[1]} stroke="#9ca3af" strokeWidth={3.5} strokeLinecap="round" /></>
        : <line x1={ux} y1={uy} x2={V[0]} y2={V[1]} stroke={rahmen} strokeWidth={3.5} strokeLinecap="round" />}
      {/* Gepäckträger */}
      {g.gepaeck && <g stroke="#6b7280" strokeWidth={2} fill="none" strokeLinecap="round">
        <line x1={S[0] - 1} y1={sy + 12} x2={traeger[0]} y2={traeger[1]} />
        <line x1={traeger[0]} y1={traeger[1]} x2={H[0]} y2={H[1]} />
        <line x1={mix([S[0], sy + 12], traeger, 0.5)[0]} y1={sy + 12} x2={mix(S, H, 0.55)[0]} y2={mix(S, H, 0.55)[1]} strokeWidth={1.2} />
      </g>}
      {/* Sattel, Lenker */}
      <line x1={S[0]} y1={S[1]} x2={sx} y2={sy} stroke="#9ca3af" strokeWidth={2.5} />
      <path d={`M${sx - 12} ${sy - 2} Q ${sx} ${sy - 5} ${sx + 10} ${sy - 3} L${sx + 6} ${sy + 2} L${sx - 10} ${sy + 2} Z`} fill="#1f2937" />
      <line x1={ox} y1={oy} x2={g.lenker[0] + 4} y2={g.lenker[1] + 4} stroke="#9ca3af" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={g.lenker[0] - 6} y1={g.lenker[1] + 2} x2={g.lenker[0] + 8} y2={g.lenker[1] + 6} stroke="#111827" strokeWidth={3.2} strokeLinecap="round" />
      {/* Kette, Kettenblatt und Ritzel (vorn im Bild, auf der Antriebsseite) */}
      {teil("kette", "Kette", <g fill="none">
        <line x1={bx} y1={by - kr} x2={H[0]} y2={H[1] - 4} stroke={FARBE[z("kette")]} strokeWidth={1.4} />
        <line x1={bx} y1={by + kr} x2={H[0]} y2={H[1] + 4} stroke={FARBE[z("kette")]} strokeWidth={1.4} />
        <circle cx={H[0]} cy={H[1]} r={4} stroke="#4b5563" strokeWidth={1.4} />
        <circle cx={bx} cy={by} r={kr} stroke="#374151" strokeWidth={2} strokeDasharray="1.6 1" />
      </g>, [[(bx + H[0]) / 2, (by + H[1]) / 2, 8], [bx, by, kr + 2]])}
      {/* Vordere Kurbel und Pedal mit gelben Rückstrahlern */}
      <line x1={bx} y1={by} x2={kurbel[0]} y2={kurbel[1]} stroke="#4b5563" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={bx} cy={by} r={2} fill="#4b5563" />
      {teil("pedalstrahler", "Pedalrückstrahler (gelb)", <g>
        <rect x={kurbel[0] - 6} y={kurbel[1] - 1} width={12} height={4} rx={1} fill="#374151" />
        <rect x={kurbel[0] - 5} y={kurbel[1] - 0.5} width={3} height={3} fill={gelb("pedalstrahler")} stroke={FARBE[z("pedalstrahler")]} strokeWidth={0.6} />
        <rect x={kurbel[0] + 2} y={kurbel[1] - 0.5} width={3} height={3} fill={gelb("pedalstrahler")} stroke={FARBE[z("pedalstrahler")]} strokeWidth={0.6} />
      </g>, [[kurbel[0], kurbel[1] + 1, 7]])}
      {/* Bremsen: Klötze an der Felge, vorn mit Zug zum Lenker */}
      {teil("bremseHinten", "Bremse hinten", <g>
        <rect x={bremsH[0] - 3} y={bremsH[1] - 4} width={6} height={8} rx={1} fill={z("bremseHinten") === "ok" ? "#111827" : "none"} stroke={FARBE[z("bremseHinten")]} strokeWidth={1.2} />
      </g>, [[bremsH[0], bremsH[1], 7]])}
      {teil("bremseVorn", "Bremse vorn", <g>
        <path d={`M${bremsV[0]} ${bremsV[1]} Q ${ox + 8} ${oy} ${g.lenker[0] + 6} ${g.lenker[1] + 5}`} fill="none" stroke="#9ca3af" strokeWidth={0.6} opacity={0.7} />
        <rect x={bremsV[0] - 3} y={bremsV[1] - 4} width={6} height={8} rx={1} fill={z("bremseVorn") === "ok" ? "#111827" : "none"} stroke={FARBE[z("bremseVorn")]} strokeWidth={1.2} />
      </g>, [[bremsV[0], bremsV[1], 7]])}
      {teil("klingel", "Klingel", <g>
        <circle cx={g.lenker[0] + 1} cy={g.lenker[1] - 1} r={3.5} fill={z("klingel") === "ok" ? "#d4d4d8" : "none"} stroke={FARBE[z("klingel")] === FARBE.ok ? "#6b7280" : FARBE[z("klingel")]} strokeWidth={1} />
      </g>, [[g.lenker[0] + 1, g.lenker[1] - 1, 6]])}
      {/* Scheinwerfer: Halter am Lenkkopf, Gehäuse, Glas nach vorn */}
      {teil("licht", "Scheinwerfer (weiß)", <g>
        <line x1={ux} y1={uy - 4} x2={lampe[0] - 4} y2={lampe[1]} stroke="#6b7280" strokeWidth={1.2} />
        <rect x={lampe[0] - 4} y={lampe[1] - 3.5} width={9} height={7} rx={2.5} fill={z("licht") === "ok" ? "#374151" : "none"} stroke={FARBE[z("licht")]} strokeWidth={1} />
        <rect x={lampe[0] + 3.5} y={lampe[1] - 3} width={2.2} height={6} rx={1} fill={z("licht") === "ok" ? "#fef3c7" : "none"} stroke={z("licht") === "ok" ? "#fcd34d" : FARBE[z("licht")]} strokeWidth={0.6} />
        {z("licht") === "ok" && <path d={`M${lampe[0] + 7} ${lampe[1] - 2} l9 -3 M${lampe[0] + 7} ${lampe[1]} l10 0 M${lampe[0] + 7} ${lampe[1] + 2} l9 3`} stroke="#fcd34d" strokeWidth={0.8} />}
      </g>, [[lampe[0], lampe[1], 7]])}
      {teil("frontstrahler", "Frontstrahler (weiß)", <g>
        <circle cx={ux + 4} cy={uy + 5} r={2.4} fill={z("frontstrahler") === "ok" ? "#f8fafc" : "none"} stroke={z("frontstrahler") === "ok" ? "#9ca3af" : FARBE[z("frontstrahler")]} strokeWidth={0.8} />
      </g>, [[ux + 4, uy + 5, 5]])}
      {teil("ruecklicht", "Rücklicht (rot)", <g>
        {!g.gepaeck && <line x1={rl[0] + 3} y1={rl[1]} x2={sx + 1} y2={rl[1]} stroke="#6b7280" strokeWidth={1.2} />}
        <rect x={rl[0] - 3.5} y={rl[1] - 2.5} width={7} height={5} rx={1.5} fill={z("ruecklicht") === "ok" ? "#ef4444" : "none"} stroke={z("ruecklicht") === "ok" ? "#7f1d1d" : FARBE[z("ruecklicht")]} strokeWidth={0.8} />
      </g>, [[rl[0], rl[1], 6]])}
      {teil("rueckstrahler", "Rückstrahler (rot, Kategorie Z)", <g>
        <rect x={rs[0] - 3.5} y={rs[1] - 3.5} width={7} height={7} rx={1} fill={z("rueckstrahler") === "ok" ? "#b91c1c" : "none"} stroke={z("rueckstrahler") === "ok" ? "#450a0a" : FARBE[z("rueckstrahler")]} strokeWidth={0.8} />
        {z("rueckstrahler") === "ok" && <text x={rs[0]} y={rs[1] + 2} fontSize={5} fontWeight={700} fill="#fecaca" textAnchor="middle">Z</text>}
      </g>, [[rs[0], rs[1], 6]])}
    </svg>
  );
}
