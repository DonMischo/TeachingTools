"use client";
/**
 * Bauteile für die Gleichungssysteme: Gleichung gesetzt (Brüche gestapelt),
 * Term-Kacheln für eine Zeile a·x + b·y = c und der »Umformer«: Schritt für
 * Schritt auf beiden Seiten dasselbe tun, mit Protokoll wie in der Gleichungswaage.
 */
import { useEffect, useRef, useState } from "react";
import { Rechenzeile } from "@/components/brueche/bild";
import {
  forme, gleichungText, istFreigestellt, leseUmformung, opText, qt, vorschlag, type Gleichung, type Normal, type Q, type Umformung, type Var,
} from "@/lib/lgs";

export const VFARBE: Record<Var | "k", string> = { x: "#2563eb", y: "#ea580c", k: "#64748b" };

export function GleichungSatz({ g, text, gross = false }: { g?: Gleichung; text?: string; gross?: boolean }) {
  return <span className={`font-mono font-bold ${gross ? "text-2xl" : "text-lg"}`}><Rechenzeile text={text ?? gleichungText(g!)} /></span>;
}

/** Eine Kachel: Koeffizient mit Variable, farbig; Null blass */
export function Kachel({ c, v, erstes = false }: { c: Q; v: Var | "k"; erstes?: boolean }) {
  const null_ = c.z === 0;
  const betrag = { z: Math.abs(c.z), n: c.n };
  const zahl = v !== "k" && betrag.z === 1 && betrag.n === 1 ? "" : qt(betrag);
  const vorzeichen = c.z < 0 ? "−" : erstes ? "" : "+";
  return (
    <span className={`inline-flex items-center justify-center min-w-16 h-11 px-2 rounded-xl border-2 font-mono font-black text-lg transition-all duration-500 ${null_ ? "opacity-30 line-through" : ""}`}
      style={{ borderColor: VFARBE[v], background: VFARBE[v] + "1f", color: VFARBE[v] }}>
      {vorzeichen}<Rechenzeile text={zahl} />{v === "k" ? "" : v}
    </span>
  );
}

/** Zeile a·x + b·y = c als Kacheln in festen Spalten */
export function KachelZeile({ n, name, stil }: { n: Normal; name: string; stil?: React.CSSProperties }) {
  return (
    <div className="grid grid-cols-[3.5rem_5rem_5rem_1.5rem_5.5rem] items-center gap-2 transition-transform duration-700 ease-in-out" style={stil}>
      <span className="font-black text-muted text-right">{name}</span>
      <Kachel c={n.a} v="x" erstes />
      <Kachel c={n.b} v="y" />
      <span className="text-center font-black text-lg">=</span>
      <Kachel c={n.c} v="k" erstes />
    </div>
  );
}

/** Umformung als Eingabetext (»− 3« → »-3«) */
const alsEingabe = (o: Umformung) => opText(o).replace(/\s+/g, "").replace(/−/g, "-");

/**
 * Umformer: Gleichung so lange umformen, bis `ziel` allein links steht.
 * Jede Zeile zeigt rechts, was mit beiden Seiten passiert ist.
 */
export function Umformer({ start, ziel, onFertig, titel }: { start: Gleichung; ziel: Var; onFertig: (g: Gleichung) => void; titel?: string }) {
  const [zeilen, setZeilen] = useState<{ g: Gleichung; op: string | null }[]>([{ g: start, op: null }]);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState("");
  const gemeldet = useRef(false);
  const jetzt = zeilen[zeilen.length - 1].g;
  const fertig = istFreigestellt(jetzt, ziel);
  useEffect(() => { if (fertig && !gemeldet.current) { gemeldet.current = true; onFertig(jetzt); } }, [fertig]); // eslint-disable-line react-hooks/exhaustive-deps

  const anwenden = (o: Umformung | null) => {
    if (!o) { setFehler("Nicht verstanden — z. B. −3, +2x, :4, ·(−1)"); return; }
    if (o.art !== "+" && o.f.z === 0) { setFehler(o.art === ":" ? "Durch 0 teilt man nicht." : "Mal 0 macht alles kaputt — das ist keine Umformung."); return; }
    setFehler(""); setEingabe("");
    setZeilen(z => [...z, { g: forme(jetzt, o), op: opText(o) }]);
  };
  const tausche = () => setZeilen(z => [...z, { g: { l: jetzt.r, r: jetzt.l }, op: "Seiten tauschen" }]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      {titel && <span className="text-sm font-bold">{titel}</span>}
      <table className="w-fit">
        <tbody>
          {zeilen.map((z, i) => (
            <tr key={i} className={i === zeilen.length - 1 ? "" : "text-muted"}>
              <td className="pr-4 py-0.5"><GleichungSatz g={z.g} /></td>
              <td className="text-sm text-accent font-bold">{i < zeilen.length - 1 && zeilen[i + 1].op ? `| ${zeilen[i + 1].op}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fertig ? <p className="text-sm font-bold text-ok">✔ {ziel} steht allein.</p> : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Beide Seiten:</span>
          <input className="input w-28" value={eingabe} placeholder="z. B. −3" onChange={e => setEingabe(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") anwenden(leseUmformung(eingabe)); }} aria-label="Umformung" />
          <button className="btn-primary" onClick={() => anwenden(leseUmformung(eingabe))}>Anwenden</button>
          <button className="btn-secondary" onClick={() => { const v = vorschlag(jetzt, ziel); if (v) setEingabe(alsEingabe(v)); else tausche(); }}>💡 Tipp</button>
          <button className="btn-secondary" onClick={tausche}>⇄ Seiten</button>
          {zeilen.length > 1 && <button className="btn-secondary" onClick={() => setZeilen(z => z.slice(0, -1))}>↶</button>}
        </div>
      )}
      {fehler && <p className="text-sm text-bad">{fehler}</p>}
    </div>
  );
}
