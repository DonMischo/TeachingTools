"use client";
/**
 * Üben: Themen an- und abwählen (wie bei der Stellenwerttafel), Stufe wählen,
 * Aufgabe lösen. Tipps einzeln, Lösungsweg mit Graph. Gezählt wird nur der
 * erste Versuch ohne Tipp und Lösungsweg.
 */
import { useEffect, useState } from "react";
import { UEB_ARTEN, erzeugeUebung, feldLoesung, feldStimmt, nfZuSpf, scheitel, schnitt, pqFormel, type Feld, type Stufe, type UebAufgabe, type UebArt } from "@/lib/quadratisch";
import { LEER, zaehle } from "@/components/prozent/ui";
import { AufgabenGraph, FARBE, Term } from "./teile";

const STUFEN = [{ id: 1, label: "⭐ leicht" }, { id: 2, label: "⭐⭐ mittel" }, { id: 3, label: "⭐⭐⭐ schwer" }] as const;
const GRUPPEN = [{ id: "grund", label: "Verstehen" }, { id: "rechnen", label: "Rechnen" }] as const;

/** Eingabefelder einer Aufgabe; auch von den Prüfungsaufgaben genutzt. */
export function Felder({ felder, ein, setze, urteil, pruefen }: {
  felder: Feld[]; ein: Record<string, string>; setze: (k: string, v: string) => void;
  urteil: Record<string, boolean> | null; pruefen: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {felder.map(f => {
        const u = urteil?.[f.key];
        const marke = urteil && <span className={u ? "text-ok" : "text-bad"}>{u ? "✔" : "✘"}</span>;
        if (f.art === "wahl") return (
          <div key={f.key} className="flex flex-wrap items-center gap-2">
            <span className="min-w-48 text-sm font-bold">{f.label}</span>
            {f.optionen.map((o, i) => (
              <button key={o} type="button" className={`chip ${ein[f.key] === String(i) ? "chip-on" : ""}`} aria-pressed={ein[f.key] === String(i)}
                onClick={() => setze(f.key, String(i))}>{o}</button>
            ))}
            {marke}
          </div>
        );
        return (
          <label key={f.key} className="flex flex-wrap items-center gap-2">
            <span className="min-w-48 text-sm font-bold">{f.label}</span>
            <input className={`input w-28 ${u === false ? "border-bad" : u ? "border-ok" : ""}`} inputMode="decimal" aria-label={f.label}
              value={ein[f.key] ?? ""} onChange={e => setze(f.key, e.target.value)} onKeyDown={e => { if (e.key === "Enter") pruefen(); }} />
            {marke}
          </label>
        );
      })}
    </div>
  );
}

/** Graph zur Lösung: Funktion(en) mit S, Nullstellen bzw. Schnittpunkten. */
function LoesungsGraph({ a }: { a: UebAufgabe }) {
  if (!a.f) return null;
  const S = a.f.a ? scheitel(nfZuSpf(a.f)) : null;
  const pkt = a.g ? schnitt(a.f, a.g).punkte.map((p, i) => ({ ...p, label: `S${i + 1}` }))
    : a.art === "nullstellen" ? pqFormel(a.f).xs.map(x => ({ x, y: 0, label: "N" })) : [];
  const alle = [...(S ? [S] : []), ...pkt];
  const xs = alle.map(p => p.x), ys = alle.map(p => p.y);
  const b = { x0: Math.floor(Math.min(-2, ...xs) - 3), x1: Math.ceil(Math.max(2, ...xs) + 3), y0: Math.floor(Math.min(-2, ...ys) - 3), y1: Math.ceil(Math.max(2, ...ys) + 3) };
  return <AufgabenGraph label="Graph zur Lösung" spec={{
    bereich: b, kurven: [{ f: a.f }, ...(a.g ? [{ f: a.g, farbe: FARBE.y }] : [])],
    punkte: [...(S && a.art !== "schnitt" ? [{ ...S, label: "S" }] : []), ...pkt],
  }} />;
}

export default function Ueben() {
  const [arten, setArten] = useState<UebArt[]>(["ablesen", "beschreiben", "form", "graph"]);
  const [stufe, setStufe] = useState<Stufe>(1);
  const [a, setA] = useState<UebAufgabe | null>(null);
  const [ein, setEin] = useState<Record<string, string>>({});
  const [urteil, setUrteil] = useState<Record<string, boolean> | null>(null);
  const [tipps, setTipps] = useState(0);
  const [weg, setWeg] = useState(false);
  const [gezaehlt, setGezaehlt] = useState(false);
  const [punkte, setPunkte] = useState(LEER);

  const neu = (aus = arten, st = stufe) => {
    setA(erzeugeUebung(aus[Math.floor(Math.random() * aus.length)], st));
    setEin({}); setUrteil(null); setTipps(0); setWeg(false); setGezaehlt(false);
  };
  // erst im Browser würfeln – sonst passt das Server-HTML nicht
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const umschalten = (id: UebArt) => {
    const nx = arten.includes(id) ? arten.filter(x => x !== id) : [...arten, id];
    if (!nx.length) return;
    setArten(nx); neu(nx, stufe);
  };
  const pruefen = () => {
    if (!a) return;
    const u: Record<string, boolean> = {};
    for (const f of a.felder) u[f.key] = feldStimmt(f, ein[f.key]);
    setUrteil(u);
    if (!gezaehlt && !tipps && !weg) { setPunkte(p => zaehle(p, Object.values(u).every(Boolean))); setGezaehlt(true); }
  };
  const alleRichtig = urteil && Object.values(urteil).every(Boolean);

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {GRUPPEN.map(g => (
          <div key={g.id} className="flex flex-wrap gap-1.5 items-center" role="group" aria-label={g.label}>
            <span className="text-xs text-muted w-20">{g.label}</span>
            {UEB_ARTEN.filter(x => x.gruppe === g.id).map(x => (
              <button key={x.id} className={`chip ${arten.includes(x.id) ? "chip-on" : ""}`} aria-pressed={arten.includes(x.id)} onClick={() => umschalten(x.id)}>{x.label}</button>
            ))}
          </div>
        ))}
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

      {a && (
        <div className={`grid gap-4 items-start ${a.graph || (weg && a.f) ? "lg:grid-cols-2" : ""}`}>
          <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-3">
            <p className="font-bold" data-testid="aufgabe">{a.frage}</p>
            {a.term && <div className="text-center"><Term st={a.term} gross /></div>}
            <Felder felder={a.felder} ein={ein} setze={(k, v) => { setEin({ ...ein, [k]: v }); setUrteil(null); }} urteil={urteil} pruefen={pruefen} />
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
                {a.weg.map((z, i) => <li key={i} className="rounded-lg bg-surface-hover px-3 py-1.5 font-serif text-base" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>{z.split("   | ")[0]}{z.includes("   | ") && <span className="text-xs text-muted font-sans"> — {z.split("   | ")[1]}</span>}</li>)}
                <li className="text-muted">Lösung: {a.felder.map(feldLoesung).join(" · ")}</li>
              </ol>
            )}
          </div>
          {(a.graph || (weg && a.f)) && (
            <div className="card p-3">
              {a.graph ? <AufgabenGraph spec={a.graph} label="Graph zur Aufgabe" /> : <LoesungsGraph a={a} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
