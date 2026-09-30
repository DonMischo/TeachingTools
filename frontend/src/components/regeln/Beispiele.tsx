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
import { zeichneRaster } from "./zeichnen";
import Werkbank from "./Werkbank";

function Vorschau({ raster }: { raster: Raster | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = raster ? Math.max(1, Math.floor(120 / Math.max(raster.b, raster.h))) : 1;
  useEffect(() => {
    if (raster && ref.current) zeichneRaster(ref.current.getContext("2d")!, raster, px);
  }, [raster, px]);
  if (!raster) return <div className="w-[120px] h-[120px] rounded-lg bg-[var(--bg)] animate-pulse" />;
  return <canvas ref={ref} width={raster.b * px} height={raster.h * px}
    className="w-[120px] h-[120px] rounded-lg [image-rendering:pixelated]" />;
}

export default function Beispiele() {
  const [nr, setNr] = useState(0);
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
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
        {BEISPIELE.map((x, i) => (
          <button key={x.id} onClick={() => setNr(i)} data-beispiel={x.id}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 bg-[var(--surface)] ${
              i === nr ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
            <Vorschau raster={bilder[i]} />
            <span className="text-sm font-bold">{x.icon} {x.titel}</span>
            <span className="text-[10px] text-[var(--text-muted)]">{x.herkunft === "MarkovJunior" ? "aus MarkovJunior" : "eigenes Beispiel"}</span>
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed flex flex-col gap-2">
        <h2 className="font-black text-lg">{b.icon} {b.titel}</h2>
        {b.text.map((t, i) => <p key={i}>{t}</p>)}
        <p className="text-xs text-[var(--text-muted)]">
          {b.herkunft === "MarkovJunior"
            ? <>Übertragen aus <a className="underline" href="https://github.com/mxgmn/MarkovJunior" target="_blank" rel="noreferrer">MarkovJunior</a> von Maxim Gumin (MIT-Lizenz).</>
            : <>Eigenes Programm nach der Idee von <a className="underline" href="https://github.com/mxgmn/MarkovJunior" target="_blank" rel="noreferrer">MarkovJunior</a>.</>}
          {" "}Das Programm rechts lässt sich verändern — »↺ neu« rechnet mit denselben Regeln neu.
        </p>
      </section>
      <Werkbank key={b.id} vorlage={b.programm} start={b.start} />
    </div>
  );
}
