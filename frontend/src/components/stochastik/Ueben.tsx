"use client";
/**
 * Üben: Lektionen an- und abwählen (vorgewählt nach Klassenstufe und
 * Niveau), Stufe wählen, Aufgabe lösen. Gezählt wird nur der erste Versuch
 * ohne Tipp und Lösungsweg – der geht in die Erfolge ein.
 */
import { useContext, useEffect, useState } from "react";
import { erzeuge, loesungText, stimmt, UEB_LEKTIONEN, type Aufgabe, type Stufe } from "@/lib/stochastik/aufgaben";
import { lektion, lage, type LektionId, type Stufe as KlStufe } from "@/lib/stochastik/lektionen";
import { LEER, zaehle } from "@/components/prozent/ui";
import { Felder } from "@/components/quadratisch/Ueben";
import { REIHE } from "@/lib/stochastik/zufall";
import { Diagramm, TafelAnsicht, Urne, Rad } from "./diagramme";
import { Navi, useMelden } from "./ui";

const STUFEN = [{ id: 1, label: "⭐ Grundlagen" }, { id: 2, label: "⭐⭐ Standard" }, { id: 3, label: "⭐⭐⭐ knifflig" }] as const;

function Bild({ a }: { a: Aufgabe }) {
  const b = a.bild;
  if (!b) return null;
  if (b.art === "urliste" || b.art === "zahlen") return (
    <div className="flex flex-wrap gap-1.5">{b.werte.map((w, i) => <span key={i} className="rounded-lg border border-line px-2 py-0.5 text-sm tabular-nums">{String(w).replace(".", ",")}</span>)}</div>
  );
  if (b.art === "saeulen") return <Diagramm art="saeulen" zeilen={b.zeilen} titel={b.titel} hoehe={220} farbig={false} />;
  if (b.art === "urne") return <Urne kugeln={b.kugeln} />;
  if (b.art === "rad") return <Rad felder={b.werte.map((w, i) => ({ label: `${w.x} €`, farbe: REIHE[i], anteil: w.anteil }))} groesse={170} />;
  return <TafelAnsicht tafel={b.tafel} a={b.a} b={b.b} zeigen={b.zeigen} />;
}

export default function Ueben({ stufe: klStufe }: { stufe: KlStufe | null }) {
  const { niveau } = useContext(Navi);
  const passend = UEB_LEKTIONEN.filter(l => lage(lektion(l), klStufe, niveau) === "dran");
  const [arten, setArten] = useState<LektionId[]>(passend.length ? passend : UEB_LEKTIONEN.slice(0, 4));
  const [stufe, setStufe] = useState<Stufe>(niveau === "H" ? 1 : 2);
  const [a, setA] = useState<Aufgabe | null>(null);
  const [ein, setEin] = useState<Record<string, string>>({});
  const [urteil, setUrteil] = useState<Record<string, boolean> | null>(null);
  const [tipps, setTipps] = useState(0);
  const [weg, setWeg] = useState(false);
  const [gezaehlt, setGezaehlt] = useState(false);
  const [punkte, setPunkte] = useState(LEER);
  const melden = useMelden();

  const neu = (aus = arten, st = stufe) => {
    setA(erzeuge(aus[Math.floor(Math.random() * aus.length)], st));
    setEin({}); setUrteil(null); setTipps(0); setWeg(false); setGezaehlt(false);
  };
  // erst im Browser würfeln – sonst passt das Server-HTML nicht
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const umschalten = (id: LektionId) => {
    const nx = arten.includes(id) ? arten.filter(x => x !== id) : [...arten, id];
    if (!nx.length) return;
    setArten(nx); neu(nx, stufe);
  };
  const pruefen = () => {
    if (!a) return;
    const u: Record<string, boolean> = {};
    for (const f of a.felder) u[f.key] = stimmt(f, ein[f.key]);
    setUrteil(u);
    if (!gezaehlt && !tipps && !weg) {
      const ok = Object.values(u).every(Boolean);
      const p = zaehle(punkte, ok);
      setPunkte(p); setGezaehlt(true);
      melden(s => ({
        ...s,
        geloest: ok ? { ...s.geloest, [a.lektion]: (s.geloest[a.lektion] ?? 0) + 1 } : s.geloest,
        serie: Math.max(s.serie, p.serie),
      }));
    }
  };
  const alleRichtig = urteil && Object.values(urteil).every(Boolean);
  const l = a ? lektion(a.lektion) : null;

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5 items-center" role="group" aria-label="Lektionen">
          <span className="text-xs text-muted w-20">Lektionen</span>
          {UEB_LEKTIONEN.map(id => {
            const x = lektion(id);
            const lg = lage(x, klStufe, niveau);
            return (
              <button key={id} className={`chip ${arten.includes(id) ? "chip-on" : ""} ${lg === "spaeter" || lg === "anderes" ? "opacity-50" : ""}`} aria-pressed={arten.includes(id)}
                title={`Kl. ${x.klasse} · ${x.niveaus.join("/")}`} onClick={() => umschalten(id)}>{x.icon} {x.label}</button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted w-20">Stufe</span>
          {STUFEN.map(s => (
            <button key={s.id} className={`chip ${stufe === s.id ? "chip-on" : ""}`} aria-pressed={stufe === s.id}
              onClick={() => { setStufe(s.id); neu(arten, s.id); }}>{s.label}</button>
          ))}
          <span className="flex-1" />
          {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt} · Serie {punkte.serie}{punkte.beste > punkte.serie ? ` (beste ${punkte.beste})` : ""}</span>}
        </div>
      </div>

      {a && l && (
        <div className={`grid gap-4 items-start ${a.bild && a.bild.art !== "urliste" && a.bild.art !== "zahlen" ? "lg:grid-cols-2" : ""}`}>
          <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-3">
            <span className="text-xs text-muted">{l.icon} {l.label} · Kl. {l.klasse}</span>
            <p className="font-bold" data-testid="aufgabe">{a.frage}</p>
            {a.bild && (a.bild.art === "urliste" || a.bild.art === "zahlen") && <Bild a={a} />}
            <Felder felder={a.felder} ein={ein} setze={(k, v) => { setEin({ ...ein, [k]: v }); setUrteil(null); }} urteil={urteil} pruefen={pruefen} />
            <p className="text-xs text-muted">Wahrscheinlichkeiten als Bruch (3/8), Dezimalzahl (0,375) oder Prozent (37,5 %).</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={pruefen}>✔ Prüfen</button>
              <button className="btn" onClick={() => setTipps(t => t + 1)} disabled={tipps >= a.tipps.length}>💡 Tipp {tipps ? `(${tipps}/${a.tipps.length})` : ""}</button>
              <button className="btn" onClick={() => setWeg(w => !w)}>{weg ? "Lösungsweg zu" : "📖 Lösungsweg"}</button>
              <button className="btn" onClick={() => neu()}>{alleRichtig ? "➡ Weiter" : "🎲 Neue Aufgabe"}</button>
            </div>
            {alleRichtig && <p className="text-ok font-black">✔ Richtig!</p>}
            {urteil && !alleRichtig && <p className="text-bad font-black">✘ Noch nicht alles. Die roten Felder prüfen – oder einen Tipp holen.</p>}
            {tipps > 0 && <ul className="text-sm flex flex-col gap-1 list-disc pl-5">{a.tipps.slice(0, tipps).map((t, i) => <li key={i}>{t}</li>)}</ul>}
            {(tipps > 0 || weg) && !gezaehlt && <p className="text-xs text-muted">Mit Tipp oder Lösungsweg zählt die Aufgabe nicht für den Punktestand.</p>}
            {weg && (
              <ol className="text-sm flex flex-col gap-1">
                {a.weg.map((z, i) => <li key={i} className="rounded-lg bg-surface-hover px-3 py-1.5">{z}</li>)}
                <li className="text-muted">Lösung: {a.felder.map(loesungText).join(" · ")}</li>
              </ol>
            )}
          </div>
          {a.bild && a.bild.art !== "urliste" && a.bild.art !== "zahlen" && <div className="card p-3 flex justify-center"><Bild a={a} /></div>}
        </div>
      )}
    </div>
  );
}
