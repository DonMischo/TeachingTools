"use client";
/**
 * Dreiecks-Aufgaben: gewürfelt nach Fall (rechtwinklig, SSS, SWS, WSW/WWS,
 * SsW), Tipps Schritt für Schritt, beim SsW erst »wie viele Dreiecke?«.
 * Gezählt wird nur der erste Versuch ohne Tipp.
 */
import { useEffect, useState } from "react";
import {
  AUFGABEN_ARTEN, FAELLE, GROESSEN, ZEICHEN, erzeugeAufgabe, istSeite, passt, wert, type AufgabenArt, type DreieckAufgabe,
} from "@/lib/trigonometrie";
import { leseZahl } from "@/lib/prozent";
import { LEER, zaehle } from "@/components/prozent/ui";
import { DreieckBild, Rechenweg } from "./Dreiecke";

export default function Aufgaben() {
  const [arten, setArten] = useState<AufgabenArt[]>(["rechtwinklig", "SSS", "SWS", "WSW", "SSW"]);
  const [a, setA] = useState<DreieckAufgabe | null>(null);
  const [anzahl, setAnzahl] = useState<number | null>(null);
  const [ein, setEin] = useState<Record<string, string>>({});
  const [urteil, setUrteil] = useState<Record<string, boolean> | null>(null);
  const [tipp, setTipp] = useState(0);
  const [gezaehlt, setGezaehlt] = useState(false);
  const [punkte, setPunkte] = useState(LEER);

  const neu = (xs = arten) => {
    setA(erzeugeAufgabe(xs[Math.floor(Math.random() * xs.length)]));
    setAnzahl(null); setEin({}); setUrteil(null); setTipp(0); setGezaehlt(false);
  };
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return null;

  const l = a.loesung, ssw = a.art === "SSW", n = l.dreiecke.length;
  const spalten = ssw ? (anzahl ?? 0) : 1;
  const maxSchritte = Math.max(0, ...l.schritte.map(x => x.length));
  const fertig = tipp > maxSchritte;

  const pruefen = () => {
    const u: Record<string, boolean> = {};
    let alles = true;
    if (ssw) {
      u.anzahl = anzahl === n;
      alles = u.anzahl;
      if (u.anzahl && n) {
        // Reihenfolge der beiden Lösungen egal
        const versuch = (perm: number[]) => {
          const v: Record<string, boolean> = {};
          perm.forEach((j, i) => a.gesucht.forEach(g => { const x = leseZahl(ein[`${i}:${g}`] ?? ""); v[`${i}:${g}`] = x !== null && passt(g, x, l.dreiecke[j][g]); }));
          return v;
        };
        const v1 = versuch(n === 2 ? [0, 1] : [0]), v2 = n === 2 ? versuch([1, 0]) : v1;
        const best = Object.values(v2).filter(Boolean).length > Object.values(v1).filter(Boolean).length ? v2 : v1;
        Object.assign(u, best);
        alles = Object.values(best).every(Boolean);
      }
    } else {
      for (const g of a.gesucht) {
        const x = leseZahl(ein[`0:${g}`] ?? "");
        u[`0:${g}`] = x !== null && passt(g, x, l.dreiecke[0][g]);
        alles &&= u[`0:${g}`];
      }
    }
    setUrteil(u);
    if (!gezaehlt && tipp === 0) { setPunkte(p => zaehle(p, alles)); setGezaehlt(true); }
  };
  const gegebenText = GROESSEN.filter(g => a.gegeben[g] !== undefined).map(g => `${ZEICHEN[g]} = ${wert(g, a.gegeben[g]!)}`).join(";  ");

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 items-center" role="group" aria-label="Aufgabenarten">
        {AUFGABEN_ARTEN.map(x => (
          <button key={x.id} className={`chip ${arten.includes(x.id) ? "chip-on" : ""}`} aria-pressed={arten.includes(x.id)}
            onClick={() => {
              const nx = arten.includes(x.id) ? arten.filter(y => y !== x.id) : [...arten, x.id];
              if (nx.length) { setArten(nx); neu(nx); }
            }}>{x.label}</button>
        ))}
        <span className="flex-1" />
        {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt} · Serie {punkte.serie}</span>}
        <button className="btn" onClick={() => neu()}>🎲 Neue Aufgabe</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-line p-3">
            <div className="text-xs text-muted">{a.art === "rechtwinklig" ? "Rechtwinkliges Dreieck, γ = 90°" : "Dreieck"} — gegeben:</div>
            <div className="text-lg font-black">{gegebenText}</div>
            <div className="text-sm text-muted mt-1">Berechne {a.gesucht.map(g => ZEICHEN[g]).join(", ")}. Seiten auf zwei, Winkel auf eine Nachkommastelle.</div>
          </div>
          {ssw && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">Wie viele Dreiecke passen?</span>
              {[0, 1, 2].map(k => (
                <button key={k} className={`chip ${anzahl === k ? "chip-on" : ""}`} onClick={() => { setAnzahl(k); setUrteil(null); }}>{k}</button>
              ))}
              {urteil && <span className={urteil.anzahl ? "text-ok font-bold" : "text-bad font-bold"}>{urteil.anzahl ? "✔" : "✘"}</span>}
            </div>
          )}
          {spalten > 0 && (
            <div className={`grid gap-3 ${spalten === 2 ? "sm:grid-cols-2" : ""}`}>
              {Array.from({ length: spalten }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  {spalten === 2 && <div className="text-xs font-black text-muted">Dreieck {i + 1}</div>}
                  {a.gesucht.map(g => {
                    const k = `${i}:${g}`, u = urteil?.[k];
                    return (
                      <label key={k} className="flex items-center gap-2">
                        <span className="w-8 font-black text-right">{ZEICHEN[g]} =</span>
                        <input className={`input w-28 ${u === false ? "border-bad" : u ? "border-ok" : ""}`} inputMode="decimal" value={ein[k] ?? ""}
                          aria-label={`${ZEICHEN[g]} ${i + 1}`}
                          onChange={e => { setEin({ ...ein, [k]: e.target.value }); setUrteil(null); }}
                          onKeyDown={e => { if (e.key === "Enter") pruefen(); }} />
                        <span className="text-muted">{istSeite(g) ? "" : "°"}</span>
                        {u !== undefined && <span className={u ? "text-ok" : "text-bad"}>{u ? "✔" : "✘"}</span>}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={pruefen} disabled={ssw && anzahl === null}>✔ Prüfen</button>
            <button className="btn" onClick={() => setTipp(t => t + 1)} disabled={fertig}>💡 {tipp === 0 ? "Tipp" : "Nächster Schritt"}</button>
            <button className="btn" onClick={() => setTipp(maxSchritte + 1)} disabled={fertig}>📖 Lösung</button>
          </div>
          {tipp > 0 && l.fall && (
            <div className="rounded-xl border border-line p-3 text-sm">
              <strong>{FAELLE[l.fall].name}</strong> → {FAELLE[l.fall].satz}.
              {fertig && l.hinweis && <p className="mt-1">{l.hinweis}</p>}
            </div>
          )}
          {tipp > 1 && <Rechenweg loesung={l} bis={tipp - 1} />}
          {tipp > 0 && !gezaehlt && <p className="text-xs text-muted">Mit Tipp zählt die Aufgabe nicht für den Punktestand.</p>}
        </div>
        <DreieckBild loesung={l} gegeben={a.gegeben} zeigen={fertig} />
      </div>
    </div>
  );
}
