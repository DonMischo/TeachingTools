"use client";
/**
 * Reiter »Beispiele«: fertige Programme zum Anschauen und Verändern —
 * Labyrinth, Blumen und Höhle aus MarkovJunior, dazu Platine, Verlies und
 * Game of Life. Die Vorschaubilder werden nacheinander gerechnet, damit die
 * Seite beim Öffnen nicht hängt.
 */
import { useEffect, useRef, useState } from "react";
import { laufeDurch, programm, starte, type Raster } from "@/lib/regeln/maschine";
import { BEISPIELE } from "@/lib/regeln/beispiele";
import { MJ_BEISPIELE, MJ_QUELLE } from "@/lib/regeln/mj-beispiele";
import { zeichneRaster } from "./zeichnen";
import Werkbank from "./Werkbank";

function Vorschau({ raster }: { raster: Raster | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = raster ? Math.max(1, Math.floor(120 / Math.max(raster.b, raster.h))) : 1;
  useEffect(() => {
    if (raster && ref.current) zeichneRaster(ref.current.getContext("2d")!, raster, px);
  }, [raster, px]);
  if (!raster) return <div className="w-[120px] h-[120px] rounded-lg bg-page animate-pulse" />;
  return <canvas ref={ref} width={raster.b * px} height={raster.h * px}
    className="w-[120px] h-[120px] rounded-lg [image-rendering:pixelated]" />;
}

export default function Beispiele() {
  const [nr, setNr] = useState(0);
  /** gewähltes Beispiel aus der Liste von MarkovJunior (statt einer Karte) */
  const [mj, setMj] = useState<string | null>(null);
  const [bilder, setBilder] = useState<(Raster | null)[]>(() => BEISPIELE.map(() => null));

  useEffect(() => {
    let aus = false;
    let i = 0;
    const naechstes = () => {
      if (aus || i >= BEISPIELE.length) return;
      const b = BEISPIELE[i];
      const p = programm(b.programm);
      const r = laufeDurch(p, starte(p, b.start, 1)).raster;
      const k = i++;
      setBilder(alt => alt.map((x, j) => (j === k ? r : x)));
      setTimeout(naechstes, 0);
    };
    const t = setTimeout(naechstes, 0);
    return () => { aus = true; clearTimeout(t); };
  }, []);

  const b = BEISPIELE[nr];
  const mjb = mj ? MJ_BEISPIELE.find(x => x.id === mj) ?? null : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {BEISPIELE.map((x, i) => (
          <button key={x.id} onClick={() => { setNr(i); setMj(null); }} data-beispiel={x.id}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 bg-surface ${
              i === nr && !mj ? "border-accent" : "border-line hover:border-accent"}`}>
            <Vorschau raster={bilder[i]} />
            <span className="text-sm font-bold">{x.icon} {x.titel}</span>
            <span className="text-[10px] text-muted">{x.herkunft === "MarkovJunior" ? "aus MarkovJunior" : "eigenes Beispiel"}</span>
          </button>
        ))}
      </div>
      <label className="card flex flex-wrap items-center gap-2 text-sm p-3">
        <span className="font-bold">📚 Mehr aus MarkovJunior ({MJ_BEISPIELE.length}):</span>
        <select value={mj ?? ""} onChange={e => setMj(e.target.value || null)} data-mj-auswahl
          className="rounded-lg border border-line bg-page px-2 py-1 min-w-56">
          <option value="">— auswählen —</option>
          {MJ_BEISPIELE.map(x => <option key={x.id} value={x.id}>{x.id}</option>)}
        </select>
        <span className="text-xs text-muted">
          automatisch übertragen aus <a className="underline" href={MJ_QUELLE} target="_blank" rel="noreferrer">github.com/mxgmn/MarkovJunior</a>
        </span>
      </label>
      {mjb ? (
        <>
          <section className="card p-4 text-sm leading-relaxed flex flex-col gap-2">
            <h2 className="font-black text-lg">📚 {mjb.id}</h2>
            <p>
              Ein Beispiel aus MarkovJunior von Maxim Gumin (MIT-Lizenz), unverändert übertragen — nur größere Felder sind auf
              {" "}{mjb.start.b}×{mjb.start.h} verkleinert. Das Original:{" "}
              <a className="underline" href={`${MJ_QUELLE}/blob/main/models/${mjb.id}.xml`} target="_blank" rel="noreferrer">models/{mjb.id}.xml</a>.
            </p>
          </section>
          <Werkbank key={`mj-${mjb.id}`} vorlage={mjb.programm} start={mjb.start} />
        </>
      ) : (<>
      <section className="card p-4 text-sm leading-relaxed flex flex-col gap-2">
        <h2 className="font-black text-lg">{b.icon} {b.titel}</h2>
        {b.text.map((t, i) => <p key={i}>{t}</p>)}
        <p className="text-xs text-muted">
          {b.herkunft === "MarkovJunior"
            ? <>Übertragen aus <a className="underline" href="https://github.com/mxgmn/MarkovJunior" target="_blank" rel="noreferrer">MarkovJunior</a> von Maxim Gumin (MIT-Lizenz).</>
            : <>Eigenes Programm nach der Idee von <a className="underline" href="https://github.com/mxgmn/MarkovJunior" target="_blank" rel="noreferrer">MarkovJunior</a>.</>}
          {" "}Das Programm rechts lässt sich verändern — »↺ neu« rechnet mit denselben Regeln neu.
        </p>
      </section>
      <Werkbank key={b.id} vorlage={b.programm} start={b.start} />
      </>)}
    </div>
  );
}
