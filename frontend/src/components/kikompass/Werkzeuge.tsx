"use client";
/**
 * KI-Werkzeuge im Netz — sortierte Liste mit Alter, Konto, Datenschutz-Ampel
 * und Ideen für den Unterricht. Wer was sieht, regelt lib/kikompass/werkzeuge.ts.
 */
import { useMemo, useState } from "react";
import { KATEGORIEN, STAND, WERKZEUGE, sichtbar, sortiert, type Kategorie, type KiWerkzeug, type Sicht } from "@/lib/kikompass/werkzeuge";

const AMPEL = {
  gruen: { farbe: "var(--green)", text: "für Schulen gemacht" },
  gelb: { farbe: "#ca8a04", text: "mit Vorsicht: keine Namen, keine privaten Daten" },
  rot: { farbe: "var(--red)", text: "Daten außerhalb der EU, nur zum Vergleichen" },
} as const;
const KONTO = { keins: "ohne Konto", lehrkraft: "Zugang über die Lehrkraft", schulkonto: "Schulkonto", eigenes: "eigenes Konto" } as const;
const FUER = { lehrkraft: "👩‍🏫 Lehrkräfte", schueler: "🎒 Schüler·innen", beide: "👩‍🏫🎒 beide" } as const;

export function Werkzeuge({ sicht: start }: { sicht: Sicht }) {
  const [sicht, setSicht] = useState<Sicht>(start);
  const [kat, setKat] = useState<Kategorie | "alle">("alle");
  const [suche, setSuche] = useState("");
  const [ohneKonto, setOhneKonto] = useState(false);

  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return sortiert(WERKZEUGE.filter(w => sichtbar(w, sicht)
      && (kat === "alle" || w.kategorie === kat)
      && (!ohneKonto || w.konto !== "eigenes")
      && (!q || `${w.name} ${w.was} ${w.ideen.join(" ")}`.toLowerCase().includes(q))));
  }, [sicht, kat, suche, ohneKonto]);
  const kategorien = (Object.keys(KATEGORIEN) as Kategorie[]).filter(k => WERKZEUGE.some(w => w.kategorie === k && sichtbar(w, sicht)));

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-2 text-sm">
        <h2 className="text-lg font-black">🧰 KI-Werkzeuge im Netz</h2>
        <p>
          {sicht === "lehrkraft"
            ? "Bekannte KI-Seiten, sortiert nach Einsatz. Altersgrenzen laut Nutzungsbedingungen der Anbieter — ob etwas im Unterricht erlaubt ist, entscheiden Land und Schulleitung."
            : sicht === "gast"
              ? "Diese KI-Seiten kannst du ohne eigenes Konto ausprobieren oder bekommst den Zugang von deiner Lehrkraft."
              : "KI-Seiten, die für Schüler·innen gedacht sind. Gib nie deinen Namen, deine Adresse oder Fotos von dir ein."}
        </p>
        <p className="text-xs text-muted">Stand {STAND} — Bedingungen ändern sich oft, vor dem Einsatz beim Anbieter nachsehen.</p>
        {start === "lehrkraft" && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted">Ansicht:</span>
            {(["lehrkraft", "schueler", "gast"] as Sicht[]).map(s => (
              <button key={s} type="button" className={sicht === s ? "chip chip-on" : "chip"} onClick={() => setSicht(s)}>
                {s === "lehrkraft" ? "alles" : s === "schueler" ? "wie Schüler·innen" : "wie Gäste"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className={kat === "alle" ? "chip chip-on" : "chip"} onClick={() => setKat("alle")}>Alle</button>
        {kategorien.map(k => (
          <button key={k} type="button" className={kat === k ? "chip chip-on" : "chip"} onClick={() => setKat(k)}>
            {KATEGORIEN[k].icon} {KATEGORIEN[k].name}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-sm ml-auto">
          <input type="checkbox" checked={ohneKonto} onChange={e => setOhneKonto(e.target.checked)} /> ohne eigenes Konto
        </label>
        <input className="input w-48" placeholder="Suchen …" value={suche} onChange={e => setSuche(e.target.value)} aria-label="Werkzeuge durchsuchen" />
      </div>

      {liste.length === 0 && <p className="text-sm text-muted">Nichts gefunden.</p>}
      {kategorien.filter(k => liste.some(w => w.kategorie === k)).map(k => (
        <section key={k} className="flex flex-col gap-2">
          <h3 className="font-black">{KATEGORIEN[k].icon} {KATEGORIEN[k].name}</h3>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))]">
            {liste.filter(w => w.kategorie === k).map(w => <Karte key={w.id} w={w} lehrkraft={sicht === "lehrkraft"} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function Karte({ w, lehrkraft }: { w: KiWerkzeug; lehrkraft: boolean }) {
  const a = AMPEL[w.daten];
  return (
    <article className="card p-3 flex flex-col gap-2 text-sm" data-werkzeug={w.id}>
      <div className="flex items-start gap-2">
        <a href={w.url} target="_blank" rel="noreferrer noopener" className="font-bold text-base underline flex-1">{w.name}</a>
        <span className="rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap"
          style={{ background: w.alter && w.alter >= 18 ? "var(--red)" : w.alter ? "#ca8a04" : "var(--green)", color: "white" }}
          title={w.alterText}>
          {w.alter ? `ab ${w.alter}` : "frei"}
        </span>
      </div>
      <p>{w.was}</p>
      <ul className="list-disc pl-5 text-muted">
        {w.ideen.map(i => <li key={i}>{i}</li>)}
      </ul>
      <div className="flex flex-wrap gap-1.5 text-xs mt-auto">
        <span className="rounded-full bg-surface-hover px-2 py-0.5">{KONTO[w.konto]}</span>
        <span className="rounded-full bg-surface-hover px-2 py-0.5">{w.kosten}</span>
        {lehrkraft && <span className="rounded-full bg-surface-hover px-2 py-0.5">{FUER[w.fuer]}</span>}
        <span className="rounded-full px-2 py-0.5 flex items-center gap-1" title={a.text}>
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: a.farbe }} /> Datenschutz
        </span>
      </div>
      <p className="text-xs text-muted">Alter: {w.alterText}</p>
    </article>
  );
}
