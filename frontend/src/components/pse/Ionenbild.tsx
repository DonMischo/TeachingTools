"use client";
/**
 * Dieselbe Verbindung als Elektronenübertragung: der unedlere Partner hat
 * seine Außenelektronen abgegeben, der andere sie aufgenommen. Übrig bleiben
 * Ionen mit Ladung, jedes mit voller Außenschale.
 *
 * Die übertragenen Elektronen behalten die Farbe des Atoms, von dem sie
 * kommen. Man sieht also beim Bortrifluorid drei gelbe Elektronen des Bors auf
 * den Schalen der drei Fluoride sitzen — und beim Bor selbst ist die
 * Außenschale weg.
 *
 * Hier überlappen sich die Schalen nicht: Ionen teilen nichts, sie ziehen
 * einander nur an.
 */
import { formatCharge } from "@/lib/chemie";
import { atomfarbe, type Ion } from "@/lib/pse/bindung";

/** Radius der äußersten Schale, der innersten, und der Abstand der Kerne. */
const R = 46;
const INNEN = 19;
const L = 124;

/** Das Zeichen der Ladung, hochgestellt: B³⁺, F⁻. */
export const ladungsZeichen = (ladung: number): string => formatCharge(ladung);

/** Ein Ion mit seinen Schalen; die aufgenommenen Elektronen in fremder Farbe. */
function IonBild({ ion, nummer, cx, cy }: { ion: Ion; nummer: number; cx: number; cy: number }) {
  const n = ion.schalen.length;
  // Die Elektronen der Außenschale: erst die geschenkten, dann die eigenen.
  const fremd = ion.bekommt.flatMap(b => Array.from({ length: b.zahl }, () => atomfarbe(b.von)));
  return (
    <g>
      {ion.schalen.map((zahl, i) => {
        // Die innerste Schale bleibt vom Kern weg; nach außen gleichmäßig
        // verteilt. (Einfach R·(i+1)/n legt die K-Schale fast auf den Kern.)
        const r = n === 1 ? R : INNEN + ((R - INNEN) * i) / (n - 1);
        const aussen = i === n - 1;
        const farben = aussen
          ? Array.from({ length: zahl }, (_, k) => fremd[k] ?? atomfarbe(nummer))
          : Array.from({ length: zahl }, () => atomfarbe(nummer));
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)"
              strokeWidth={aussen ? 1.3 : 0.8} opacity={aussen ? 0.6 : 0.4} />
            {farben.map((f, k) => {
              const w = (k / zahl) * 2 * Math.PI - Math.PI / 2;
              return <circle key={k} cx={cx + Math.cos(w) * r} cy={cy + Math.sin(w) * r} r={4}
                fill={f} stroke="var(--surface)" strokeWidth={1.2} />;
            })}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={11} fill="var(--surface)" stroke="#f87171" strokeWidth={1.2} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        className="font-black" fontSize={13} fill="var(--text)">{ion.e.symbol}</text>
      {/* Die Ladung steht am Ion, wie in der Formel */}
      <text x={cx + R + 4} y={cy - R + 6} textAnchor="middle" fontSize={15}
        className="font-black" fill={ion.ladung > 0 ? "#ef4444" : "#3b82f6"}>
        {ladungsZeichen(ion.ladung)}
      </text>
      <text x={cx} y={cy + R + 16} textAnchor="middle" fontSize={11}
        className="font-bold tabular-nums" fill={ion.voll ? "var(--green)" : "var(--red)"}>
        {ion.aussen}e⁻{ion.voll ? " ✓" : ""}
      </text>
    </g>
  );
}

export default function Ionenbild({ ionen }: { ionen: Ion[] }) {
  if (ionen.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted px-6 text-center">
        Hier wird nichts übertragen — zwischen gleichen Partnern zieht keiner stärker.
      </div>
    );
  }
  const orte = ionen.map(i => ({ x: i.x * L, y: i.y * L }));
  const rand = R + 34;
  const xs = orte.map(o => o.x), ys = orte.map(o => o.y);
  const x0 = Math.min(...xs) - rand, y0 = Math.min(...ys) - rand;
  const breite = Math.max(...xs) + rand - x0, hoehe = Math.max(...ys) + rand - y0;

  return (
    <svg viewBox={`${x0} ${y0} ${breite} ${hoehe}`}
      className="w-full h-auto block max-w-[460px] mx-auto"
      role="img" aria-label={`${ionen.map(i => i.e.symbol + ladungsZeichen(i.ladung)).join(" ")} — Elektronen übertragen`}>
      <defs>
        <marker id="io-spitze" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" fill="var(--text-muted)" />
        </marker>
      </defs>
      {/* Pfeile: wer hat wem etwas gegeben */}
      {ionen.map((ion, j) => ion.bekommt.map(b => {
        const p = orte[b.von], q = orte[j];
        const laenge = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const ux = (q.x - p.x) / laenge, uy = (q.y - p.y) / laenge;
        return (
          <g key={`${b.von}-${j}`}>
            <line x1={p.x + ux * (R + 6)} y1={p.y + uy * (R + 6)}
              x2={q.x - ux * (R + 10)} y2={q.y - uy * (R + 10)}
              stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="3 3"
              markerEnd="url(#io-spitze)" opacity={0.7} />
            <text x={(p.x + q.x) / 2 + uy * 9} y={(p.y + q.y) / 2 - ux * 9}
              textAnchor="middle" fontSize={10} fill="var(--text-muted)">
              {b.zahl}e⁻
            </text>
          </g>
        );
      }))}
      {ionen.map((ion, i) => (
        <IonBild key={i} ion={ion} nummer={i} cx={orte[i].x} cy={orte[i].y} />
      ))}
    </svg>
  );
}

/**
 * Die Ionen in der Schreibweise des Hefts: das Symbol in eckigen Klammern,
 * die volle Außenschale als vier Striche, die Ladung oben rechts.
 */
export function IonenFormel({ ionen }: { ionen: Ion[] }) {
  if (ionen.length === 0) return null;
  const breite = 92;
  const hoehe = 92;
  const reihe = ionen.length;
  return (
    <svg viewBox={`0 0 ${reihe * breite} ${hoehe}`}
      className="w-full h-auto block max-w-[360px] mx-auto"
      role="img" aria-label={`Ionenschreibweise von ${ionen.map(i => i.e.symbol).join(" ")}`}>
      {ionen.map((ion, i) => {
        const cx = i * breite + breite / 2, cy = hoehe / 2;
        // Striche bekommt nur, wer Elektronen aufgenommen hat. Ein Kation hat
        // seine Außenschale abgegeben und steht blank in der Klammer — die
        // Schale darunter zeichnet man in dieser Schreibweise nicht mit.
        const paare = ion.ladung > 0 ? 0 : Math.floor(ion.aussen / 2);
        return (
          <g key={i}>
            {Array.from({ length: paare }, (_, k) => {
              const w = (k / Math.max(paare, 1)) * 2 * Math.PI - Math.PI / 2;
              const px = cx + Math.cos(w) * 17, py = cy + Math.sin(w) * 17;
              return (
                <line key={k}
                  x1={px - Math.sin(w) * 6} y1={py + Math.cos(w) * 6}
                  x2={px + Math.sin(w) * 6} y2={py - Math.cos(w) * 6}
                  stroke="var(--text)" strokeWidth={1.6} strokeLinecap="round" />
              );
            })}
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
              className="font-bold" fontSize={18} fill="var(--text)">{ion.e.symbol}</text>
            {/* Eckige Klammern, wie man Ionen schreibt */}
            {[-1, 1].map(seite => (
              <path key={seite} fill="none" stroke="var(--text)" strokeWidth={1.4}
                d={`M ${cx + seite * 26} ${cy - 30} L ${cx + seite * 31} ${cy - 30}`
                  + ` L ${cx + seite * 31} ${cy + 30} L ${cx + seite * 26} ${cy + 30}`}
 />
            ))}
            <text x={cx + 36} y={cy - 22} textAnchor="middle" fontSize={15}
              className="font-black" fill={ion.ladung > 0 ? "#ef4444" : "#3b82f6"}>
              {ladungsZeichen(ion.ladung)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
