"use client";
/**
 * Ein Blatt mit gewürfelten Aufgaben für jede Geometrie-Sim: Arten an- und
 * abwählen, Aufgabe mit Skizze lösen, Tipps einzeln aufdecken, Lösungsweg
 * ansehen. »Arbeitsblatt« baut aus den gewählten Arten ein Word-Dokument mit
 * Skizzen, Antwortlinien und auf Wunsch den Lösungen hinten.
 */
import { useEffect, useState } from "react";
import { baueDocx, herunterladen, type DocxBlock } from "@/lib/docx";
import { ergebnis, mischeArten, stimmt, type Art, type Sachaufgabe } from "@/lib/geometrie/aufgabe";
import { LEER, zaehle } from "@/components/prozent/ui";
import { SkizzenBild, skizzeAlsPng } from "./Skizze";

type Props<A extends string> = {
  arten: readonly Art<A>[];
  erzeuge: (art: A) => Sachaufgabe<A>;
  /** Überschrift des Word-Arbeitsblatts, z. B. »Vierecke – Übungen« */
  titel: string;
  datei: string;
};

/** Arbeitsblatt: Aufgaben mit Skizze und Antwortlinien, Lösungen auf eigener Seite. */
export async function arbeitsblatt(titel: string, aufgaben: Sachaufgabe[], loesungen: boolean): Promise<Blob> {
  const b: DocxBlock[] = [
    { art: "titel", text: titel },
    { art: "text", text: "Name: ______________________   Klasse: ________   Datum: ____________", grau: true },
  ];
  for (const [i, s] of aufgaben.entries()) {
    b.push({ art: "ueberschrift", text: `Aufgabe ${i + 1}: ${s.titel}` }, { art: "text", text: s.text });
    if (s.skizze) b.push({ art: "bild", png: await skizzeAlsPng(s.skizze), breite: 560, hoehe: 320 });
    for (const g of s.gesucht) {
      b.push(g.optionen
        ? { art: "text", text: `${g.label}:   ${g.optionen.map(o => "☐ " + o).join("   ")}` }
        : { art: "linie", text: `${g.label}${g.einheit ? ` (${g.einheit})` : ""}:` });
    }
  }
  if (loesungen) {
    b.push({ art: "umbruch" }, { art: "titel", text: "Lösungen" });
    for (const [i, s] of aufgaben.entries()) {
      b.push({ art: "ueberschrift", text: `Aufgabe ${i + 1}: ${s.titel}` });
      for (const x of s.loesung) b.push({ art: "text", text: x, mono: true });
      b.push({ art: "text", text: "Ergebnis: " + s.gesucht.map(ergebnis).join(" · "), fett: true });
    }
  }
  return baueDocx(b);
}

function Export<A extends string>({ arten, gewaehlt, erzeuge, titel, datei }: Props<A> & { gewaehlt: A[] }) {
  const [anzahl, setAnzahl] = useState(6);
  const [mitLoesung, setMitLoesung] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const los = async () => {
    setStatus("Arbeitsblatt wird gebaut …");
    try {
      const aufgaben = mischeArten(gewaehlt, anzahl).map(a => erzeuge(a));
      herunterladen(await arbeitsblatt(titel, aufgaben, mitLoesung), datei);
      setStatus(null);
    } catch (e) {
      setStatus("Export fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)));
    }
  };
  return (
    <div className="rounded-xl border border-line p-3 flex flex-wrap items-center gap-3 text-sm">
      <strong>📄 Arbeitsblatt für Word</strong>
      <label className="flex items-center gap-1.5">
        <select className="input w-auto" value={anzahl} onChange={e => setAnzahl(Number(e.target.value))} aria-label="Anzahl Aufgaben">
          {[3, 4, 6, 8, 9, 12].map(n => <option key={n} value={n}>{n}</option>)}
        </select> Aufgaben
      </label>
      <span className="text-muted">aus {gewaehlt.length === arten.length ? "allen Arten" : gewaehlt.map(g => arten.find(a => a.id === g)!.label).join(", ")}</span>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={mitLoesung} onChange={e => setMitLoesung(e.target.checked)} /> Lösungen anhängen</label>
      <button className="btn btn-primary" onClick={los} disabled={status !== null && !status.startsWith("Export")}>⬇ .docx herunterladen</button>
      {status && <span className={status.startsWith("Export") ? "text-bad" : "text-muted"}>{status}</span>}
    </div>
  );
}

export default function Aufgabenblatt<A extends string>(props: Props<A>) {
  const { arten, erzeuge } = props;
  const [gewaehlt, setGewaehlt] = useState<A[]>(() => arten.map(a => a.id));
  const [s, setS] = useState<Sachaufgabe<A> | null>(null);
  const [ein, setEin] = useState<Record<string, string>>({});
  const [urteil, setUrteil] = useState<Record<string, boolean> | null>(null);
  const [tipps, setTipps] = useState(0);
  const [weg, setWeg] = useState(false);
  const [gezaehlt, setGezaehlt] = useState(false);
  const [punkte, setPunkte] = useState(LEER);
  const [export_, setExport] = useState(false);

  const neu = (aus = gewaehlt) => {
    setS(erzeuge(aus[Math.floor(Math.random() * aus.length)]));
    setEin({}); setUrteil(null); setTipps(0); setWeg(false); setGezaehlt(false);
  };
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;

  const pruefen = () => {
    const u: Record<string, boolean> = {};
    for (const g of s.gesucht) u[g.key] = stimmt(g, ein[g.key]);
    setUrteil(u);
    if (!gezaehlt && !tipps && !weg) { setPunkte(p => zaehle(p, Object.values(u).every(Boolean))); setGezaehlt(true); }
  };
  const setze = (k: string, v: string) => { setEin({ ...ein, [k]: v }); setUrteil(null); };

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 items-center" role="group" aria-label="Aufgabenarten">
        {arten.map(a => {
          const an = gewaehlt.includes(a.id);
          return (
            <button key={a.id} className={`chip ${an ? "chip-on" : ""}`} aria-pressed={an}
              onClick={() => {
                const nx = an ? gewaehlt.filter(x => x !== a.id) : [...gewaehlt, a.id];
                if (!nx.length) return;
                setGewaehlt(nx);
                if (!nx.includes(s.art)) neu(nx);
              }}>{a.icon} {a.label}</button>
          );
        })}
        <span className="flex-1" />
        {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt} · Serie {punkte.serie}</span>}
        <button className={`btn ${export_ ? "btn-primary" : ""}`} onClick={() => setExport(x => !x)}>📄 Arbeitsblatt (.docx)</button>
        <button className="btn" onClick={() => neu()}>🎲 Neue Aufgabe</button>
      </div>
      {export_ && <Export {...props} gewaehlt={gewaehlt} />}
      <div className={`grid gap-4 items-start ${s.skizze ? "lg:grid-cols-2" : ""}`}>
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-black">{s.titel}</h3>
          <p>{s.text}</p>
          {s.gesucht.map(g => {
            const u = urteil?.[g.key];
            const marke = urteil && <span className={u ? "text-ok" : "text-bad"}>{u ? "✔" : "✘"}</span>;
            if (g.optionen) return (
              <div key={g.key} className="flex flex-wrap items-center gap-2">
                <span className="min-w-44 text-sm font-bold">{g.label}</span>
                {g.optionen.map((o, i) => (
                  <button key={o} className={`chip ${ein[g.key] === String(i) ? "chip-on" : ""}`} aria-pressed={ein[g.key] === String(i)}
                    onClick={() => setze(g.key, String(i))}>{o}</button>
                ))}
                {marke}
              </div>
            );
            return (
              <label key={g.key} className="flex flex-wrap items-center gap-2">
                <span className="min-w-44 text-sm font-bold">{g.label}</span>
                <input className={`input w-28 ${u === false ? "border-bad" : u ? "border-ok" : ""}`} inputMode="decimal"
                  aria-label={g.label} value={ein[g.key] ?? ""} onChange={e => setze(g.key, e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") pruefen(); }} />
                <span className="text-muted">{g.einheit}</span>
                {marke}
              </label>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={pruefen}>✔ Prüfen</button>
            <button className="btn" onClick={() => setTipps(t => t + 1)} disabled={tipps >= s.hinweise.length}>💡 Tipp {tipps ? `(${tipps}/${s.hinweise.length})` : ""}</button>
            <button className="btn" onClick={() => setWeg(true)} disabled={weg}>📖 Lösungsweg</button>
            {urteil && Object.values(urteil).every(Boolean) && <button className="btn" onClick={() => neu()}>➡ Weiter</button>}
          </div>
          {tipps > 0 && <ul className="text-sm flex flex-col gap-1 list-disc pl-5">{s.hinweise.slice(0, tipps).map((h, i) => <li key={i}>{h}</li>)}</ul>}
          {(tipps > 0 || weg) && !gezaehlt && <p className="text-xs text-muted">Mit Tipp oder Lösungsweg zählt die Aufgabe nicht für den Punktestand.</p>}
          {weg && (
            <ol className="text-sm flex flex-col gap-1">
              {s.loesung.map((x, i) => <li key={i} className="rounded-lg bg-surface-hover px-3 py-2 font-mono font-bold">{x}</li>)}
              <li className="text-muted">Ergebnis: {s.gesucht.map(ergebnis).join(" · ")}</li>
            </ol>
          )}
        </div>
        {s.skizze && <SkizzenBild s={s.skizze} label={s.titel} />}
      </div>
    </div>
  );
}
