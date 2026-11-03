"use client";
/**
 * Blatt »Besondere Linien«: Höhen, Seitenhalbierende, Mittelsenkrechte (mit
 * Umkreis), Winkelhalbierende (mit Inkreis) und Schwerpunkt, einzeln
 * zuschaltbar. Die Ecken bleiben ziehbar; der Kasten daneben sagt, wo die
 * besonderen Punkte gerade liegen und warum.
 */
import { useState } from "react";
import { z } from "@/lib/prozent";
import {
  abstand, hoehenschnitt, inkreis, lotfuss, mitte, nachSeiten, nachWinkeln, schwerpunktD, umkreis, winkelhalbierendeFuss,
  einrasten, type Dreieck,
} from "@/lib/dreiecke";
import Zeichenblatt, { FARBE, Gerade, K, Linie, Punkt, RechterWinkel, T } from "./Zeichenblatt";

type Art = "hoehen" | "seitenh" | "mittels" | "winkelh" | "schwer";
const ARTEN: { id: Art; label: string; farbe: string }[] = [
  { id: "hoehen", label: "Höhen", farbe: FARBE.rot },
  { id: "seitenh", label: "Seitenhalbierende", farbe: FARBE.beta },
  { id: "mittels", label: "Mittelsenkrechte + Umkreis", farbe: FARBE.alpha },
  { id: "winkelh", label: "Winkelhalbierende + Inkreis", farbe: FARBE.lila },
  { id: "schwer", label: "Schwerpunkt", farbe: FARBE.gamma },
];

export default function Linien({ d, setD }: { d: Dreieck; setD: (d: Dreieck) => void }) {
  const [an, setAn] = useState<Set<Art>>(new Set(["hoehen"]));
  const umschalten = (a: Art) => setAn(s => { const n = new Set(s); if (n.has(a)) n.delete(a); else n.add(a); return n; });
  const H = hoehenschnitt(d), U = umkreis(d), I = inkreis(d), S = schwerpunktD(d);
  const nw = nachWinkeln(d), ns = nachSeiten(d);
  const f = (a: Art) => ARTEN.find(x => x.id === a)!.farbe;
  const kinder: React.ReactNode[] = [];

  if (an.has("mittels") && U) {
    const c = T(U.m);
    kinder.push(<circle key="uk" cx={c.x} cy={c.y} r={U.r * K} fill="none" stroke={f("mittels")} strokeWidth={2} />);
    for (let i = 0; i < 3; i++) {
      const p = d[i], q = d[(i + 1) % 3], m = mitte(p, q);
      kinder.push(<Gerade key={`ms${i}`} a={m} b={{ x: m.x - (q.y - p.y), y: m.y + (q.x - p.x) }} farbe={f("mittels")} gestrichelt />);
      kinder.push(<RechterWinkel key={`msr${i}`} p={m} q={q} r={{ x: m.x - (q.y - p.y), y: m.y + (q.x - p.x) }} farbe={f("mittels")} />);
    }
    kinder.push(<Punkt key="U" p={U.m} text="U" farbe={f("mittels")} />);
  }
  if (an.has("winkelh")) {
    const c = T(I.m);
    kinder.push(<circle key="ik" cx={c.x} cy={c.y} r={I.r * K} fill="none" stroke={f("winkelh")} strokeWidth={2} />);
    for (let i = 0; i < 3; i++) kinder.push(<Linie key={`wh${i}`} a={d[i]} b={winkelhalbierendeFuss(d, i)} farbe={f("winkelh")} />);
    kinder.push(<Punkt key="I" p={I.m} text="I" farbe={f("winkelh")} />);
  }
  if (an.has("hoehen")) {
    for (let i = 0; i < 3; i++) {
      const p = d[i], q = d[(i + 1) % 3], r = d[(i + 2) % 3], F = lotfuss(p, q, r);
      // Fußpunkt außerhalb: Seite gestrichelt verlängern
      const t = ((F.x - q.x) * (r.x - q.x) + (F.y - q.y) * (r.y - q.y)) / (abstand(q, r) ** 2 || 1);
      if (t < 0) kinder.push(<Linie key={`hv${i}`} a={q} b={F} gestrichelt />);
      if (t > 1) kinder.push(<Linie key={`hv${i}`} a={r} b={F} gestrichelt />);
      kinder.push(<Linie key={`h${i}`} a={p} b={F} farbe={f("hoehen")} breite={2.5} />);
      if (abstand(p, F) > 0.05) kinder.push(<RechterWinkel key={`hr${i}`} p={F} q={p} r={abstand(F, q) > abstand(F, r) ? q : r} farbe={f("hoehen")} />);
      // Bis zum Schnittpunkt verlängern, wenn er außen liegt
      if (H && nw === "stumpfwinklig") kinder.push(<Linie key={`hx${i}`} a={F} b={H} farbe={f("hoehen")} gestrichelt breite={1.5} />);
    }
    if (H) kinder.push(<Punkt key="H" p={H} text="H" farbe={f("hoehen")} />);
  }
  if (an.has("seitenh")) {
    for (let i = 0; i < 3; i++) kinder.push(<Linie key={`sh${i}`} a={d[i]} b={mitte(d[(i + 1) % 3], d[(i + 2) % 3])} farbe={f("seitenh")} breite={2.5} />);
  }
  if (an.has("seitenh") || an.has("schwer")) kinder.push(<Punkt key="S" p={S} text="S" farbe={f("schwer")} />);

  const imDreieck = (p: { x: number; y: number }) => {
    const [A, B, C] = d;
    const k = (a: typeof A, b: typeof A) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const s = [k(A, B), k(B, C), k(C, A)];
    return s.every(x => x > 1e-6) || s.every(x => x < -1e-6);
  };
  const lageU = !U ? "" : nw === "rechtwinklig" ? "auf der Mitte der Hypotenuse (Thaleskreis!)" : imDreieck(U.m) ? "innerhalb des Dreiecks" : "außerhalb des Dreiecks";
  const lageH = !H ? "" : nw === "rechtwinklig" ? "in der Ecke mit dem rechten Winkel" : imDreieck(H) ? "innerhalb des Dreiecks" : "außerhalb des Dreiecks";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Linien">
          {ARTEN.map(a => (
            <button key={a.id} className={`chip ${an.has(a.id) ? "chip-on" : ""}`} aria-pressed={an.has(a.id)} onClick={() => umschalten(a.id)}>
              <span style={{ color: a.farbe }}>●</span> {a.label}
            </button>
          ))}
        </div>
        <Zeichenblatt d={d} setD={setD} fang={(i, p, dd) => einrasten(dd, i, p, 0.2)} label="Dreieck mit besonderen Linien" kinder={<>{kinder}</>} />
      </div>
      <div className="card p-4 flex flex-col gap-3 text-sm">
        {an.has("hoehen") && <p><strong style={{ color: f("hoehen") }}>Höhen</strong> gehen von einer Ecke senkrecht auf die Gegenseite (oder ihre Verlängerung). Sie schneiden sich im Höhenschnittpunkt H — gerade {lageH}.</p>}
        {an.has("seitenh") && <p><strong style={{ color: f("seitenh") }}>Seitenhalbierende</strong> verbinden eine Ecke mit der Mitte der Gegenseite. Sie schneiden sich im Schwerpunkt S und teilen sich dort im Verhältnis 2 : 1.</p>}
        {an.has("mittels") && U && <p><strong style={{ color: f("mittels") }}>Mittelsenkrechte</strong> stehen in der Seitenmitte senkrecht. Jeder Punkt darauf ist von zwei Ecken gleich weit weg — der Schnittpunkt U von allen dreien: Er ist der Mittelpunkt des Umkreises (r = {z(U.r, 1)} cm) und liegt {lageU}.</p>}
        {an.has("winkelh") && <p><strong style={{ color: f("winkelh") }}>Winkelhalbierende</strong> teilen die Innenwinkel in zwei gleiche Hälften. Ihr Schnittpunkt I ist von allen drei Seiten gleich weit weg — der Mittelpunkt des Inkreises (r = {z(I.r, 1)} cm). Er liegt immer innen.</p>}
        {an.has("schwer") && <p><strong style={{ color: f("schwer") }}>Schwerpunkt</strong> S: Schneidet man das Dreieck aus Pappe aus, lässt es sich genau dort auf einer Stiftspitze balancieren.</p>}
        {ns === "gleichseitig" && <p className="font-bold">Im gleichseitigen Dreieck fallen alle vier Punkte H, S, U und I zusammen.</p>}
        {an.size === 0 && <p className="text-muted">Schalte oben Linien zu.</p>}
        <p className="text-muted">Tipp: Mach das Dreieck stumpfwinklig — dann wandern H und U nach außen.</p>
      </div>
    </div>
  );
}
