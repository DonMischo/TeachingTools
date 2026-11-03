"use client";
/**
 * Reiter »Lagebeziehungen« auf Kästchenpapier (1 Kästchen = 1 cm), alle
 * Punkte rasten auf Gitterpunkten ein:
 *   Linien     — A und B ziehen; Strecke, Strahl oder Gerade
 *   Zwei Geraden — g durch A, B und h durch C, D: parallel, senkrecht oder
 *                schneidend mit Schnittpunkt und Schnittwinkel
 *   Abstand    — Lot von P auf g, Fußpunkt F und Länge d
 */
import { useState, type ReactNode } from "react";
import { z } from "@/lib/prozent";
import { abstand, lage, lotfuss, schnittpunkt, schnittwinkel, type Pt } from "@/lib/grundbegriffe";
import { useZiehen } from "./ziehen";

const NX = 16, NY = 10, U = 38, RAND = 14;
const W = NX * U + 2 * RAND, H = NY * U + 2 * RAND;
const X = (p: Pt) => ({ x: RAND + p.x * U, y: RAND + p.y * U });

type Modus = "linien" | "geraden" | "abstand";
type Name = "A" | "B" | "C" | "D" | "P";
type Linie = "strecke" | "strahl" | "gerade";

/** Teil der Geraden durch a und b im Blatt, von t0 bis t1 (t = 0 bei a, 1 bei b). */
function imBlatt(a: Pt, b: Pt, t0 = -Infinity, t1 = Infinity): [Pt, Pt] | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  let lo = t0, hi = t1;
  for (const [d, p, max] of [[dx, a.x, NX], [dy, a.y, NY]] as const) {
    if (Math.abs(d) < 1e-12) { if (p < 0 || p > max) return null; continue; }
    const u = -p / d, v = (max - p) / d;
    lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v));
  }
  if (lo > hi) return null;
  return [{ x: a.x + lo * dx, y: a.y + lo * dy }, { x: a.x + hi * dx, y: a.y + hi * dy }];
}

function Linienzug({ a, b, art, farbe, breite = 3, gestrichelt }: { a: Pt; b: Pt; art: Linie; farbe: string; breite?: number; gestrichelt?: boolean }) {
  const t = imBlatt(a, b, art === "gerade" ? -Infinity : 0, art === "strecke" ? 1 : Infinity);
  if (!t) return null;
  const p = X(t[0]), q = X(t[1]);
  return <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} style={{ stroke: farbe }} strokeWidth={breite} strokeLinecap="round" strokeDasharray={gestrichelt ? "7 5" : undefined} />;
}

const START: Record<Name, Pt> = { A: { x: 3, y: 7 }, B: { x: 9, y: 4 }, C: { x: 4, y: 2 }, D: { x: 12, y: 6 }, P: { x: 11, y: 8 } };

export default function Lage() {
  const [modus, setModus] = useState<Modus>("linien");
  const [pk, setPk] = useState<Record<Name, Pt>>(START);
  const [linie, setLinie] = useState<Linie>("strecke");
  const { start, props } = useZiehen<Name>((n, p) => {
    const q = { x: Math.max(0, Math.min(NX, Math.round((p.x - RAND) / U))), y: Math.max(0, Math.min(NY, Math.round((p.y - RAND) / U))) };
    setPk(alt => {
      // Zwei Punkte einer Geraden dürfen nicht zusammenfallen.
      const partner: Partial<Record<Name, Name>> = { A: "B", B: "A", C: "D", D: "C" };
      const o = partner[n];
      if (o && alt[o].x === q.x && alt[o].y === q.y) return alt;
      return { ...alt, [n]: q };
    });
  });
  const { A, B, C, D, P } = pk;

  /** h durch C parallel bzw. senkrecht zu g legen (D passend setzen). */
  const richte = (senk: boolean) => {
    const d = senk ? { x: -(B.y - A.y), y: B.x - A.x } : { x: B.x - A.x, y: B.y - A.y };
    for (const f of [1, -1, 0.5, -0.5, 2, -2]) {
      const q = { x: C.x + d.x * f, y: C.y + d.y * f };
      if (Number.isInteger(q.x) && Number.isInteger(q.y) && q.x >= 0 && q.x <= NX && q.y >= 0 && q.y <= NY && (q.x !== C.x || q.y !== C.y)) {
        setPk({ ...pk, D: q }); return;
      }
    }
  };

  const griffe: Name[] = modus === "linien" ? ["A", "B"] : modus === "geraden" ? ["A", "B", "C", "D"] : ["A", "B", "P"];
  const raster: ReactNode[] = [];
  for (let i = 0; i <= NX; i++) raster.push(<line key={`x${i}`} x1={RAND + i * U} y1={RAND} x2={RAND + i * U} y2={H - RAND} />);
  for (let j = 0; j <= NY; j++) raster.push(<line key={`y${j}`} x1={RAND} y1={RAND + j * U} x2={W - RAND} y2={RAND + j * U} />);

  let info: ReactNode = null, extra: ReactNode = null;
  if (modus === "linien") {
    const l = abstand(A, B);
    info = {
      strecke: <>Die <strong>Strecke <span style={{ textDecoration: "overline" }}>AB</span></strong> hat zwei Endpunkte A und B. Sie ist {z(l)} cm lang: |<span style={{ textDecoration: "overline" }}>AB</span>| = {z(l)} cm.</>,
      strahl: <>Der <strong>Strahl AB</strong> beginnt in A, geht durch B und hört nie auf. Er hat keine Länge.</>,
      gerade: <>Die <strong>Gerade AB</strong> geht durch A und B und läuft in beide Richtungen unendlich weiter. Geraden heißen oft g, h, …</>,
    }[linie];
  } else if (modus === "geraden") {
    const lg = lage(A, B, C, D), S = schnittpunkt(A, B, C, D), w = schnittwinkel(A, B, C, D);
    info = {
      parallel: <><strong>g ∥ h</strong> — g und h sind parallel: Sie haben überall denselben Abstand und schneiden sich nie.</>,
      senkrecht: <><strong>g ⊥ h</strong> — g und h stehen senkrecht aufeinander: Sie schneiden sich im rechten Winkel (90°).</>,
      schneiden: <>g und h <strong>schneiden sich</strong>{S ? <> im Schnittpunkt S</> : null} unter {z(w, 1)}°. Sie sind weder parallel noch senkrecht.</>,
      gleich: <>g und h sind <strong>dieselbe Gerade</strong> — alle Punkte liegen aufeinander.</>,
    }[lg];
    if (S && lg !== "gleich" && S.x >= 0 && S.x <= NX && S.y >= 0 && S.y <= NY) {
      const s = X(S);
      extra = <g><circle cx={s.x} cy={s.y} r={6} style={{ fill: "#dc2626" }} /><text x={s.x + 10} y={s.y - 10} fontSize={16} fontWeight={800} style={{ fill: "#dc2626" }}>S</text></g>;
      if (lg === "senkrecht") {
        const u = (p: Pt) => { const l = abstand(S, p) || 1; return { x: (p.x - S.x) / l, y: (p.y - S.y) / l }; };
        const a = abstand(S, B) > 1e-9 ? u(B) : u(A), c = abstand(S, D) > 1e-9 ? u(D) : u(C), e = 0.45;
        const p1 = X({ x: S.x + a.x * e, y: S.y + a.y * e }), p2 = X({ x: S.x + (a.x + c.x) * e, y: S.y + (a.y + c.y) * e }), p3 = X({ x: S.x + c.x * e, y: S.y + c.y * e });
        extra = <>{extra}<path d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}`} fill="none" style={{ stroke: "#dc2626" }} strokeWidth={2} /></>;
      }
    }
  } else {
    const F = lotfuss(P, A, B), d = abstand(P, F);
    const f = X(F), p = X(P);
    const u = (q: Pt) => { const l = abstand(F, q) || 1; return { x: (q.x - F.x) / l, y: (q.y - F.y) / l }; };
    const ga = u(abstand(F, B) > 1e-9 ? B : A), pa = u(P), e = 0.4;
    const q1 = X({ x: F.x + ga.x * e, y: F.y + ga.y * e }), q2 = X({ x: F.x + (ga.x + pa.x) * e, y: F.y + (ga.y + pa.y) * e }), q3 = X({ x: F.x + pa.x * e, y: F.y + pa.y * e });
    extra = d > 1e-9 ? (
      <g>
        <line x1={p.x} y1={p.y} x2={f.x} y2={f.y} style={{ stroke: "#dc2626" }} strokeWidth={3} strokeDasharray="7 5" />
        <path d={`M ${q1.x} ${q1.y} L ${q2.x} ${q2.y} L ${q3.x} ${q3.y}`} fill="none" style={{ stroke: "#dc2626" }} strokeWidth={2} />
        <circle cx={f.x} cy={f.y} r={5} style={{ fill: "#dc2626" }} />
        <text x={f.x + 10} y={f.y + 20} fontSize={15} fontWeight={800} style={{ fill: "#dc2626" }}>F</text>
        <text x={(p.x + f.x) / 2 + 10} y={(p.y + f.y) / 2} fontSize={15} fontWeight={800} style={{ fill: "#dc2626" }}>d</text>
      </g>
    ) : null;
    info = d > 1e-9
      ? <>Der <strong>Abstand</strong> von P zur Geraden g ist die Länge des Lots: die kürzeste Strecke von P nach g, sie steht senkrecht auf g (PF ⊥ g). <strong>d = {z(d)} cm</strong>{Number.isInteger(d) ? "" : " (gerundet)"}.</>
      : <>P liegt auf g — der Abstand ist 0 cm.</>;
  }

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["linien", "geraden", "abstand"] as Modus[]).map(m => (
          <button key={m} className={`chip ${modus === m ? "chip-on" : ""}`} aria-pressed={modus === m} onClick={() => setModus(m)}>
            {{ linien: "• — Punkt, Strecke, Strahl, Gerade", geraden: "∥ ⊥ Zwei Geraden", abstand: "📏 Abstand Punkt–Gerade" }[m]}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[70vh] rounded-xl border border-line select-none" role="img" aria-label="Kästchenpapier mit Punkten zum Ziehen" {...props}>
          <rect width={W} height={H} style={{ fill: "var(--surface)" }} />
          <g style={{ stroke: "var(--border)" }} strokeWidth={1}>{raster}</g>
          <Linienzug a={A} b={B} art={modus === "linien" ? linie : "gerade"} farbe="var(--accent)" breite={modus === "linien" ? 4 : 3} />
          {modus === "geraden" && <Linienzug a={C} b={D} art="gerade" farbe="#16a34a" />}
          {modus !== "linien" && (() => { const t = imBlatt(A, B); if (!t) return null; const e = X(t[1]); return <text x={Math.min(W - 24, e.x + 4)} y={Math.max(24, Math.min(H - 8, e.y - 6))} fontSize={18} fontWeight={800} style={{ fill: "var(--accent)" }}>g</text>; })()}
          {modus === "geraden" && (() => { const t = imBlatt(C, D); if (!t) return null; const e = X(t[1]); return <text x={Math.min(W - 24, e.x + 4)} y={Math.max(24, Math.min(H - 8, e.y - 6))} fontSize={18} fontWeight={800} style={{ fill: "#16a34a" }}>h</text>; })()}
          {extra}
          {griffe.map(n => {
            const p = X(pk[n]);
            const farbe = n === "C" || n === "D" ? "#16a34a" : n === "P" ? "#dc2626" : "var(--accent)";
            return (
              <g key={n} onPointerDown={start(n)} style={{ cursor: "grab" }} aria-label={`Punkt ${n} ziehen`}>
                <circle cx={p.x} cy={p.y} r={16} style={{ fill: farbe }} fillOpacity={0.18} />
                <circle cx={p.x} cy={p.y} r={5.5} style={{ fill: farbe }} />
                <text x={p.x + 10} y={p.y - 10} fontSize={17} fontWeight={800} style={{ fill: farbe }}>{n}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-col gap-3 text-sm">
          {modus === "linien" && (
            <div className="flex flex-wrap gap-1.5">
              {(["strecke", "strahl", "gerade"] as Linie[]).map(l => (
                <button key={l} className={`chip ${linie === l ? "chip-on" : ""}`} aria-pressed={linie === l} onClick={() => setLinie(l)}>
                  {{ strecke: "Strecke", strahl: "Strahl", gerade: "Gerade" }[l]}
                </button>
              ))}
            </div>
          )}
          {modus === "geraden" && (
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => richte(false)}>h ∥ g machen</button>
              <button className="btn" onClick={() => richte(true)}>h ⊥ g machen</button>
            </div>
          )}
          <div className="rounded-xl border border-line p-3 leading-relaxed">{info}</div>
          <p className="text-muted">Ziehe die Punkte; sie rasten an den Gitterpunkten ein. 1 Kästchen ≙ 1 cm.</p>
          <ul className="text-muted flex flex-col gap-0.5">
            <li><strong>Punkt</strong>: ein Ort ohne Ausdehnung, Großbuchstabe (A, B, P …)</li>
            <li><strong>∥</strong> parallel · <strong>⊥</strong> senkrecht (orthogonal)</li>
            <li>Abstand = Länge des Lots, immer senkrecht messen</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
