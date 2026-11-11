"use client";
/**
 * Prüfungsaufgaben wie in Klassenarbeit und Abschlussprüfung: eine Sachlage,
 * dazu Teilaufgaben a), b), c) mit Bewertungseinheiten (BE). Jede Teilaufgabe
 * lässt sich einzeln prüfen und ihre Lösung aufdecken. »Arbeitsblatt« baut
 * ein Word-Dokument mit Graph, Antwortlinien und Lösungen hinten.
 */
import { useEffect, useState } from "react";
import { PRUEF_ARTEN, erzeugePruefung, feldLoesung, feldStimmt, type Pruefung, type PruefArt } from "@/lib/quadratisch";
import { baueDocx, herunterladen, svgZuPng, type DocxBlock } from "@/lib/docx";
import { AufgabenGraph, graphSvgText } from "./teile";
import { Felder } from "./Ueben";

const BUCHSTABE = "abcdefgh";

export async function pruefungsblatt(aufgaben: Pruefung[], mitGraph: boolean, mitLoesung: boolean): Promise<Blob> {
  const be = aufgaben.reduce((s, p) => s + p.teile.reduce((t, x) => t + x.be, 0), 0);
  const b: DocxBlock[] = [
    { art: "titel", text: "Quadratische Funktionen – Prüfungsaufgaben" },
    { art: "text", text: "Name: ______________________   Klasse: ________   Datum: ____________", grau: true },
    { art: "text", text: `Hilfsmittel: Taschenrechner, Tafelwerk.   Gesamt: ${be} BE`, grau: true, klein: true },
  ];
  for (const [i, p] of aufgaben.entries()) {
    b.push({ art: "ueberschrift", text: `Aufgabe ${i + 1}: ${p.titel}` }, { art: "text", text: p.kontext });
    if (mitGraph && p.graph) b.push({ art: "bild", png: await svgZuPng(graphSvgText(p.graph), 560, 380), breite: 560, hoehe: 380 });
    for (const [j, t] of p.teile.entries()) {
      b.push({ art: "text", text: `${BUCHSTABE[j]})  ${t.frage}   (${t.be} BE)`, fett: true });
      for (let k = 0; k < Math.max(2, t.be); k++) b.push({ art: "linie", text: "" });
    }
  }
  if (mitLoesung) {
    b.push({ art: "umbruch" }, { art: "titel", text: "Lösungen" });
    for (const [i, p] of aufgaben.entries()) {
      b.push({ art: "ueberschrift", text: `Aufgabe ${i + 1}: ${p.titel}` });
      for (const [j, t] of p.teile.entries()) {
        b.push({ art: "text", text: `${BUCHSTABE[j]})`, fett: true });
        for (const z of t.loesung) b.push({ art: "text", text: z.replace("   | ", "    "), mono: true });
        b.push({ art: "text", text: "Ergebnis: " + t.felder.map(feldLoesung).join(" · "), fett: true });
      }
    }
  }
  return baueDocx(b);
}

function Export({ gewaehlt }: { gewaehlt: PruefArt[] }) {
  const [anzahl, setAnzahl] = useState(3);
  const [mitGraph, setMitGraph] = useState(true);
  const [mitLoesung, setMitLoesung] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const los = async () => {
    setStatus("Arbeitsblatt wird gebaut …");
    try {
      const reihe = [...gewaehlt].sort(() => Math.random() - 0.5);
      const aufgaben = Array.from({ length: anzahl }, (_, i) => erzeugePruefung(reihe[i % reihe.length]));
      herunterladen(await pruefungsblatt(aufgaben, mitGraph, mitLoesung), "quadratische-funktionen-pruefung.docx");
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
          {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
        </select> Aufgaben
      </label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={mitGraph} onChange={e => setMitGraph(e.target.checked)} /> mit Graph</label>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={mitLoesung} onChange={e => setMitLoesung(e.target.checked)} /> Lösungen anhängen</label>
      <button className="btn btn-primary" onClick={los} disabled={status !== null && !status.startsWith("Export")}>⬇ .docx herunterladen</button>
      {status && <span className={status.startsWith("Export") ? "text-bad" : "text-muted"}>{status}</span>}
    </div>
  );
}

function TeilKarte({ p, j }: { p: Pruefung; j: number }) {
  const t = p.teile[j];
  const [ein, setEin] = useState<Record<string, string>>({});
  const [urteil, setUrteil] = useState<Record<string, boolean> | null>(null);
  const [offen, setOffen] = useState(false);
  const pruefen = () => {
    const u: Record<string, boolean> = {};
    for (const f of t.felder) u[f.key] = feldStimmt(f, ein[f.key]);
    setUrteil(u);
  };
  const ok = urteil && Object.values(urteil).every(Boolean);
  return (
    <div className="rounded-xl border border-line p-3 bg-page flex flex-col gap-2">
      <div className="flex justify-between gap-2">
        <p><b>{BUCHSTABE[j]})</b> {t.frage}</p>
        <span className="text-xs text-muted whitespace-nowrap">{t.be} BE</span>
      </div>
      <Felder felder={t.felder} ein={ein} setze={(k, v) => { setEin({ ...ein, [k]: v }); setUrteil(null); }} urteil={urteil} pruefen={pruefen} />
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn btn-primary" onClick={pruefen}>✔ Prüfen</button>
        <button className="btn" onClick={() => setOffen(o => !o)}>{offen ? "Lösung zu" : "📖 Lösung"}</button>
        {ok && <span className="text-ok font-black">✔ {t.be} BE</span>}
      </div>
      {offen && (
        <ol className="text-sm flex flex-col gap-1">
          {t.loesung.map((z, i) => <li key={i} className="rounded-lg bg-surface-hover px-3 py-1.5" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>{z.split("   | ")[0]}</li>)}
          <li className="text-muted">Ergebnis: {t.felder.map(feldLoesung).join(" · ")}</li>
        </ol>
      )}
    </div>
  );
}

export default function PruefungsBlatt() {
  const [gewaehlt, setGewaehlt] = useState<PruefArt[]>(PRUEF_ARTEN.map(a => a.id));
  const [p, setP] = useState<Pruefung | null>(null);
  const [nr, setNr] = useState(0);
  const [graph, setGraph] = useState(true);
  const [export_, setExport] = useState(false);
  const neu = (aus = gewaehlt) => { setP(erzeugePruefung(aus[Math.floor(Math.random() * aus.length)])); setNr(n => n + 1); };
  useEffect(() => { neu(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  const be = p.teile.reduce((s, t) => s + t.be, 0);
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 items-center" role="group" aria-label="Aufgabenarten">
        {PRUEF_ARTEN.map(a => {
          const an = gewaehlt.includes(a.id);
          return (
            <button key={a.id} className={`chip ${an ? "chip-on" : ""}`} aria-pressed={an} onClick={() => {
              const nx = an ? gewaehlt.filter(x => x !== a.id) : [...gewaehlt, a.id];
              if (!nx.length) return;
              setGewaehlt(nx);
              if (!nx.includes(p.art)) neu(nx);
            }}>{a.icon} {a.label}</button>
          );
        })}
        <span className="flex-1" />
        <button className={`btn ${export_ ? "btn-primary" : ""}`} onClick={() => setExport(x => !x)}>📄 Arbeitsblatt (.docx)</button>
        <button className="btn" onClick={() => neu()}>🎲 Neue Aufgabe</button>
      </div>
      {export_ && <Export gewaehlt={gewaehlt} />}
      <div className={`grid gap-4 items-start ${graph && p.graph ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : ""}`}>
        <div className="flex flex-col gap-3" key={nr}>
          <div className="flex justify-between gap-2 items-baseline">
            <h3 className="text-lg font-black">{PRUEF_ARTEN.find(a => a.id === p.art)!.icon} {p.titel}</h3>
            <span className="text-sm text-muted">{be} BE</span>
          </div>
          <p>{p.kontext}</p>
          {p.graph && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={graph} onChange={e => setGraph(e.target.checked)} /> Graph anzeigen (aus: selbst skizzieren)</label>}
          {p.teile.map((_, j) => <TeilKarte key={j} p={p} j={j} />)}
        </div>
        {graph && p.graph && <div className="card p-3 lg:sticky lg:top-4"><AufgabenGraph spec={p.graph} label={p.titel} /></div>}
      </div>
    </div>
  );
}
