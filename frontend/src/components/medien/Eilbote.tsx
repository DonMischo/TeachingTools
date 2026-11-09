"use client";
/** Spiel »Eilbote«: Für jeden Auftrag aus der Geschichte das passende Medium wählen. */
import { useState } from "react";
import { epoche, jahrKurz, medium } from "@/lib/medien/medien";
import { AUFTRAEGE, punkteFuer } from "@/lib/medien/spiele";
import type { Aenderung } from "@/lib/medien/fortschritt";

export default function Eilbote({ rekord, aendere }: { rekord: number; aendere: (a: Aenderung) => void }) {
  const [nr, setNr] = useState(0);
  const [falsch, setFalsch] = useState<string[]>([]);
  const [geloest, setGeloest] = useState(false);
  const [punkte, setPunkte] = useState(0);
  const [fertig, setFertig] = useState(false);
  const max = AUFTRAEGE.length * 100;

  if (fertig) {
    const sterne = punkte >= max * 0.9 ? 3 : punkte >= max * 0.6 ? 2 : punkte >= max * 0.3 ? 1 : 0;
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-5xl">{"⭐".repeat(sterne) || "🐌"}</div>
        <h3 className="text-2xl font-black">{punkte} von {max} Punkten</h3>
        <p className="text-muted">{sterne === 3 ? "Meisterkurier! Du wählst immer den schnellsten Weg." : sterne === 2 ? "Guter Bote — ein paar Tauben sind falsch abgebogen." : "Hm. Deine Nachrichten kamen … irgendwann an."}</p>
        <p className="text-sm">Bestwert: <b>{Math.max(rekord, punkte)}</b></p>
        <button className="btn-primary" onClick={() => { setNr(0); setFalsch([]); setGeloest(false); setPunkte(0); setFertig(false); }}>Noch einmal</button>
      </div>
    );
  }

  const a = AUFTRAEGE[nr];
  const waehle = (id: string) => {
    if (geloest || falsch.includes(id)) return;
    if (id === a.richtig) {
      setGeloest(true);
      setPunkte(p => p + punkteFuer(falsch.length + 1));
    } else setFalsch(f => [...f, id]);
  };
  const weiter = () => {
    if (nr + 1 >= AUFTRAEGE.length) {
      setFertig(true);
      aendere(f => ({ ...f, eilbote: Math.max(f.eilbote, punkte) }));
    } else { setNr(nr + 1); setFalsch([]); setGeloest(false); }
  };
  const zuletzt = falsch[falsch.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Auftrag {nr + 1} von {AUFTRAEGE.length}</span>
        <span className="font-black">🏅 {punkte} Punkte {rekord > 0 && <span className="text-muted font-normal">· Bestwert {rekord}</span>}</span>
      </div>
      <div className="rounded-2xl p-5 text-white shadow-md" style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-4xl font-black">{jahrKurz(a.jahr)}</span>
          <span className="text-white/70">📍 {a.ort}</span>
        </div>
        <p className="mt-2 text-lg">{a.text}</p>
        <p className="mt-1 text-sm text-white/70">Welches Medium bringt die Nachricht am besten ans Ziel?</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {a.wahl.map(id => {
          const m = medium(id)!;
          const ok = geloest && id === a.richtig, nein = falsch.includes(id);
          return (
            <button key={id} onClick={() => waehle(id)} disabled={geloest || nein}
              className={`rounded-2xl border-2 p-4 flex flex-col items-center gap-1 transition-all ${ok ? "border-ok bg-ok/15 scale-105" : nein ? "border-bad bg-bad/10 opacity-60" : "border-line bg-surface hover:border-accent hover:-translate-y-0.5"}`}>
              <span className="text-5xl" aria-hidden>{m.icon}</span>
              <span className="font-black">{m.name}</span>
              <span className="text-xs" style={{ color: epoche(m.epoche).farbe }}>seit {jahrKurz(m.jahr)}</span>
            </button>
          );
        })}
      </div>
      {zuletzt && !geloest && <p className="card p-3 text-sm">😬 {a.daneben[zuletzt]}</p>}
      {geloest && (
        <div className="card p-4 flex flex-col gap-2">
          <p className="text-sm"><b className="text-ok">{falsch.length === 0 ? "Perfekt! +100" : falsch.length === 1 ? "Im zweiten Anlauf: +40" : "Geschafft, aber ohne Punkte."}</b> {a.warum}</p>
          <button className="btn-primary self-start" onClick={weiter}>{nr + 1 >= AUFTRAEGE.length ? "Auswertung" : "Nächster Auftrag ›"}</button>
        </div>
      )}
    </div>
  );
}
