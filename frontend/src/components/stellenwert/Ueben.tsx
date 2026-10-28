"use client";
/**
 * Üben: Aufgaben nach Art und Stufe würfeln, Antwort eintippen, prüfen,
 * Lösungsweg aufklappen. Gezählt wird je Aufgabe nur der erste Versuch,
 * und nur, solange der Lösungsweg zu ist.
 */
import { useEffect, useState } from "react";
import {
  INDEX, UEB_ARTEN, erzeugeAufgabe, loesungText, nachkommaVon, pruefe, ziffernVon, type Aufgabe, type Stufe, type UebArt,
} from "@/lib/stellenwert";
import { LEER, zaehle } from "@/components/prozent/ui";
import { TafelAnsicht } from "./teile";

const STUFEN = [
  { id: 1, label: "⭐ leicht" },
  { id: 2, label: "⭐⭐ mittel" },
  { id: 3, label: "⭐⭐⭐ schwer" },
] as const;

const GRUPPEN = [
  { id: "dez", label: "🔟 Zehnersystem" },
  { id: "bin", label: "💡🔣 Binär & Hex" },
] as const;

/** Die Lösung als Tafel in der Basis der Antwort; Binärzahlen auf ganze Vierer-Päckchen. */
export function loesungsTafel(a: Aufgabe) {
  const nk = a.basis === 10 ? nachkommaVon(a.loesung) : 0;
  const z = ziffernVon(Math.round(a.loesung * 10 ** nk), a.basis, nk + 1);
  const stellen = a.basis === 2 ? Math.ceil(z.length / 4) * 4 : z.length;
  const werte: Record<number, number> = {};
  z.forEach((d, i) => { werte[z.length - 1 - i - nk] = d; });
  return { basis: a.basis, maxExp: stellen - 1 - nk, minExp: -nk, werte };
}

const wuerfle = (arten: UebArt[], stufe: Stufe) => erzeugeAufgabe(arten[Math.floor(Math.random() * arten.length)], stufe);

export default function Ueben() {
  const [arten, setArten] = useState<UebArt[]>(["ablesen", "stellenwert", "binZuDez", "dezZuBin"]);
  const [stufe, setStufe] = useState<Stufe>(1);
  // erst nach dem Laden würfeln — sonst passt das Server-HTML nicht zum Browser
  const [aufgabe, setAufgabe] = useState<Aufgabe | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [urteil, setUrteil] = useState<boolean | null>(null);
  const [unlesbar, setUnlesbar] = useState(false);
  const [gezaehlt, setGezaehlt] = useState(false);
  const [weg, setWeg] = useState(false);
  const [punkte, setPunkte] = useState(LEER);

  const neu = (a = arten, s = stufe) => {
    setAufgabe(wuerfle(a, s)); setEingabe(""); setUrteil(null); setUnlesbar(false); setGezaehlt(false); setWeg(false);
  };
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const umschalten = (id: UebArt) => {
    const naechste = arten.includes(id) ? arten.filter(a => a !== id) : [...arten, id];
    if (!naechste.length) return;
    setArten(naechste); neu(naechste, stufe);
  };

  const pruefen = () => {
    if (!aufgabe) return;
    const r = pruefe(aufgabe, eingabe);
    setUnlesbar(r === null);
    if (r === null) { setUrteil(null); return; }
    setUrteil(r);
    if (!gezaehlt && !weg) { setPunkte(p => zaehle(p, r)); setGezaehlt(true); }
  };

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {GRUPPEN.map(g => (
          <div key={g.id} className="flex flex-wrap gap-1.5 items-center" role="group" aria-label={g.label}>
            <span className="text-xs text-muted w-28">{g.label}</span>
            {UEB_ARTEN.filter(a => a.gruppe === g.id).map(a => (
              <button key={a.id} className={`chip ${arten.includes(a.id) ? "chip-on" : ""}`} aria-pressed={arten.includes(a.id)}
                onClick={() => umschalten(a.id)}>{a.label}</button>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap gap-1.5 items-center">
          {STUFEN.map(s => (
            <button key={s.id} className={`chip ${stufe === s.id ? "chip-on" : ""}`} aria-pressed={stufe === s.id}
              onClick={() => { setStufe(s.id); neu(arten, s.id); }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {punkte.gesamt ? (
          <>
            <span aria-label="Punktestand" className="font-black">✔ {punkte.richtig} von {punkte.gesamt} richtig</span>
            <span className="text-muted">· Serie {punkte.serie}{punkte.beste > punkte.serie && ` (beste ${punkte.beste})`}</span>
            <button className="btn text-xs" onClick={() => setPunkte(LEER)}>↺ Zähler</button>
          </>
        ) : <span className="text-muted text-xs">Erst selbst rechnen, dann prüfen — der erste Versuch zählt.</span>}
      </div>

      {aufgabe && (
        <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-3">
          <p className="text-lg font-bold font-mono" data-testid="aufgabe">{aufgabe.frage}</p>
          {aufgabe.tafel && (
            <TafelAnsicht basis={aufgabe.tafel.basis} maxExp={aufgabe.tafel.maxExp} minExp={aufgabe.tafel.minExp}
              werte={aufgabe.tafel.ziffern} luecken />
          )}
          <form className="flex flex-wrap gap-2 items-center" onSubmit={e => { e.preventDefault(); pruefen(); }}>
            <input className="input w-48 font-mono" aria-label="Deine Antwort" value={eingabe} autoComplete="off"
              inputMode={aufgabe.basis === 16 ? "text" : "decimal"}
              onChange={e => { setEingabe(e.target.value); setUrteil(null); setUnlesbar(false); }} placeholder="Antwort" />
            <span className="text-muted">{INDEX[aufgabe.basis]}</span>
            <button type="submit" className="btn-primary">Prüfen</button>
            <button type="button" className="btn" onClick={() => setWeg(w => !w)}>{weg ? "Lösungsweg zu" : "💡 Lösungsweg"}</button>
            <button type="button" className="btn" onClick={() => neu()}>🎲 Nächste</button>
          </form>
          {urteil === true && <p className="text-ok font-black">✔ Richtig!</p>}
          {urteil === false && <p className="text-bad font-black">✘ Noch nicht. Prüf Spalte für Spalte — oder öffne den Lösungsweg.</p>}
          {unlesbar && (
            <p className="text-sm text-bad">
              Das kann ich nicht lesen. {aufgabe.basis === 2 ? "Nur 0 und 1 erlaubt." : aufgabe.basis === 16 ? "Erlaubt sind 0–9 und A–F." : "Nur Ziffern, Komma für Kommazahlen."}
            </p>
          )}
          {weg && (
            <div className="flex flex-col gap-1">
              <ol className="list-decimal pl-6 text-sm flex flex-col gap-0.5 font-mono">
                {aufgabe.weg.map((w, i) => <li key={i}>{w}</li>)}
              </ol>
              <p className="text-sm">Lösung: <b className="font-mono">{loesungText(aufgabe)}</b></p>
              <div aria-label="Lösung in der Stellenwerttafel"><TafelAnsicht {...loesungsTafel(aufgabe)} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
