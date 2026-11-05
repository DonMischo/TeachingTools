"use client";
/** Wie schnell wurde die Nachricht? Logarithmische Balken für 1000 km, dazu zwei Medien im Profil-Vergleich. */
import { useState } from "react";
import { MEDIEN, PROFIL_ACHSEN, epoche, jahrKurz } from "@/lib/medien/medien";

export function dauerText(s: number): string {
  if (s >= 86400) return `${Math.round(s / 86400)} Tage`;
  if (s >= 3600) return `${Math.round(s / 3600)} Std.`;
  if (s >= 60) return `${Math.round(s / 60)} Min.`;
  if (s >= 1) return `${Math.round(s)} s`;
  return `${Math.round(s * 1000)} ms`;
}

export default function Vergleich() {
  const mitDauer = MEDIEN.filter(m => m.dauer1000km !== undefined);
  const max = Math.log10(Math.max(...mitDauer.map(m => m.dauer1000km!)));
  const min = Math.log10(Math.min(...mitDauer.map(m => m.dauer1000km!)));
  const breite = (s: number) => 4 + ((Math.log10(s) - min) / (max - min)) * 96;
  const [a, setA] = useState("buchdruck");
  const [b, setB] = useState("smartphone");
  const ma = MEDIEN.find(m => m.id === a)!, mb = MEDIEN.find(m => m.id === b)!;

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-4 flex flex-col gap-3">
        <div>
          <h3 className="font-black text-lg">⏱️ Wie lange braucht eine Nachricht für 1000 km?</h3>
          <p className="text-sm text-muted">Ungefähr Erfurt → Rom. Längerer Balken = langsamer. Achtung, die Skala ist logarithmisch: Jedes gleich lange Stück steht für »zehnmal so lange«. Von Tagen zu Millisekunden — das ist ein Faktor von etwa 100 Millionen.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {mitDauer.map(m => (
            <div key={m.id} className="grid grid-cols-[9rem_1fr] sm:grid-cols-[13rem_1fr] items-center gap-2 text-sm">
              <span className="truncate"><span aria-hidden>{m.icon}</span> {m.name} <span className="text-muted text-xs">{jahrKurz(m.jahr)}</span></span>
              <div className="flex items-center gap-2">
                <div className="h-5 rounded-r-md" style={{ width: `${breite(m.dauer1000km!)}%`, background: epoche(m.epoche).farbe }} />
                <span className="text-xs font-bold whitespace-nowrap">{dauerText(m.dauer1000km!)}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">Die Werte sind gerundete Schätzungen für eine kurze Nachricht, inklusive Bedienung (Telegrafist, Vermittlung). Feuer und Fax übertragen sehr wenig auf einmal, die Brieftaube fliegt nur heim.</p>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black text-lg">⚖️ Zwei Medien im Duell</h3>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <select className="input w-auto" value={a} onChange={e => setA(e.target.value)} aria-label="Erstes Medium">
            {MEDIEN.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
          </select>
          <span className="font-black">gegen</span>
          <select className="input w-auto" value={b} onChange={e => setB(e.target.value)} aria-label="Zweites Medium">
            {MEDIEN.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          {PROFIL_ACHSEN.map(x => {
            const wa = ma.profil[x.id], wb = mb.profil[x.id];
            return (
              <div key={x.id} className="grid grid-cols-[1fr_7rem_1fr] items-center gap-2 text-sm" title={x.frage}>
                <div className="flex justify-end"><div className="h-4 rounded-l" style={{ width: `${wa * 20}%`, background: epoche(ma.epoche).farbe, opacity: wa >= wb ? 1 : 0.45 }} /></div>
                <span className="text-center font-bold">{x.icon} {x.name}</span>
                <div className="h-4 rounded-r" style={{ width: `${wb * 20}%`, background: epoche(mb.epoche).farbe, opacity: wb >= wa ? 1 : 0.45 }} />
              </div>
            );
          })}
        </div>
        <p className="text-sm">
          <b>{ma.name}</b> ({ma.jahrText}) gegen <b>{mb.name}</b> ({mb.jahrText}): {summe(mb) > summe(ma) ? `${mb.name} punktet in ${besserIn(mb, ma)} von 5 Bereichen.` : summe(mb) < summe(ma) ? `${ma.name} punktet in ${besserIn(ma, mb)} von 5 Bereichen.` : "Unentschieden — jedes hat seine Stärken."}
          {" "}{haltbarer(ma, mb)}
        </p>
      </section>
    </div>
  );
}

const summe = (m: (typeof MEDIEN)[number]) => Object.values(m.profil).reduce((s, v) => s + v, 0);
const besserIn = (x: (typeof MEDIEN)[number], y: (typeof MEDIEN)[number]) => PROFIL_ACHSEN.filter(a => x.profil[a.id] > y.profil[a.id]).length;
function haltbarer(x: (typeof MEDIEN)[number], y: (typeof MEDIEN)[number]) {
  if (x.profil.haltbar > y.profil.haltbar) return `Aber: ${x.name} hält länger — Fortschritt heißt nicht, dass alles besser wird.`;
  if (y.profil.haltbar > x.profil.haltbar) return `Aber: ${y.name} hält länger — Fortschritt heißt nicht, dass alles besser wird.`;
  return "";
}
