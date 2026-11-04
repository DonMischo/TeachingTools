"use client";
/**
 * Selbsteinschätzung im Kompetenzraster: »Ich kann …«-Sätze ankreuzen, die
 * Spinne wächst sofort mit. »Messpunkt speichern« hält den Stand mit Datum
 * fest, damit man später sieht, wie man gewachsen ist.
 */
import { useMemo, useState } from "react";
import {
  BEREICHE, NAMENSNENNUNG, STUFEN, erreichteStufe, saetze, werte, type BereichId, type Einschaetzung,
} from "@/lib/kikompass/raster";
import { Spinne, type Reihe } from "./Spinne";

export function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function datumDe(iso: string): string {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

export function Raster({ einschaetzungen, onChange }: {
  einschaetzungen: Einschaetzung[];
  onChange: (neu: Einschaetzung[]) => void;
}) {
  const letzte = einschaetzungen.at(-1);
  // Entwurf = Häkchen seit dem letzten Messpunkt; startet mit dessen Häkchen.
  const [haken, setHaken] = useState<Set<string>>(() => new Set(letzte?.haken ?? []));
  const [offen, setOffen] = useState<BereichId>("verstehen");
  // Vergleich: standardmäßig der erste Messpunkt, so sieht man das ganze Wachstum.
  const [vergleich, setVergleich] = useState<number>(0);

  const gleich = (a: Iterable<string>, b: Iterable<string>) => [...a].sort().join() === [...b].sort().join();
  const jetzt = useMemo(() => werte(haken), [haken]);
  const reihen: Reihe[] = [{ name: "jetzt", werte: jetzt, farbe: "#1f6fb5" }];
  const frueher = einschaetzungen[vergleich];
  if (frueher && !gleich(frueher.haken, haken)) {
    reihen.unshift({ name: datumDe(frueher.datum), werte: werte(frueher.haken), farbe: "#888888", gestrichelt: true });
  }

  function umschalten(id: string) {
    setHaken(alt => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id); else neu.add(id);
      return neu;
    });
  }

  function speichern() {
    const eintrag = { datum: heute(), haken: [...haken].sort() };
    // Am selben Tag ersetzt ein neuer Messpunkt den alten.
    const ohneHeute = einschaetzungen.filter(e => e.datum !== eintrag.datum);
    onChange([...ohneHeute, eintrag].slice(-60));
  }

  const ungespeichert = !letzte || !gleich(haken, letzte.haken);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Kreuze an, was du schon kannst. Ehrlich ist besser als viel: Die Spinne soll zeigen, wo du gerade stehst.
          Alle fangen irgendwo an, auch Lehrkräfte. Eine Stufe gilt als erreicht, wenn du zwei Drittel ihrer Sätze ankreuzt.
        </p>
        <div className="flex flex-wrap gap-2" role="tablist">
          {BEREICHE.map(b => {
            const stufe = erreichteStufe(b.id, haken);
            return (
              <button key={b.id} role="tab" aria-selected={offen === b.id} onClick={() => setOffen(b.id)}
                className={offen === b.id ? "chip chip-on" : "chip"}>
                {b.icon} {b.name} <span className="text-xs opacity-75">· {stufe ? stufe.name : "–"}</span>
              </button>
            );
          })}
        </div>
        {BEREICHE.filter(b => b.id === offen).map(b => (
          <div key={b.id} className="flex flex-col gap-3">
            <p className="text-sm"><strong style={{ color: b.farbe }}>{b.name}</strong>: {b.untertitel}</p>
            {STUFEN.map(s => {
              const liste = saetze(b.id, s.id);
              const zahl = liste.filter(k => haken.has(k.id)).length;
              return (
                <details key={s.id} className="card p-3" open={s.id === "0" || s.id === "Ia" || s.id === "Ib"}>
                  <summary className="cursor-pointer font-medium">
                    Stufe {s.id}: {s.name} <span className="text-xs text-muted">({zahl}/{liste.length}) · {s.hinweis}</span>
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {liste.map(k => (
                      <li key={k.id}>
                        <label className="flex items-start gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="mt-1" checked={haken.has(k.id)} onChange={() => umschalten(k.id)} />
                          <span>{k.text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        ))}
        <p className="text-xs text-muted">{NAMENSNENNUNG}</p>
      </section>

      <aside className="flex flex-col gap-3 items-center">
        <Spinne reihen={reihen} />
        <button className="btn-primary w-full" onClick={speichern} disabled={!ungespeichert}>
          📌 Messpunkt speichern{ungespeichert ? "" : " ✓"}
        </button>
        {einschaetzungen.length > 0 && (
          <label className="text-sm w-full">
            Vergleichen mit
            <select className="input w-full mt-1" value={vergleich} onChange={e => setVergleich(Number(e.target.value))}>
              {einschaetzungen.map((e, i) => <option key={e.datum} value={i}>{datumDe(e.datum)}</option>)}
            </select>
          </label>
        )}
        <table className="text-sm w-full">
          <tbody>
            {BEREICHE.map(b => (
              <tr key={b.id}>
                <td>{b.icon} {b.name}</td>
                <td className="text-right font-medium">{erreichteStufe(b.id, haken)?.name ?? "noch keine Stufe"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted">
          Tipp: Mach alle paar Monate einen neuen Messpunkt, z. B. vor und nach dem KI-Führerschein.
        </p>
      </aside>
    </div>
  );
}
