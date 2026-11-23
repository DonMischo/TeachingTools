"use client";
/**
 * Brüche verstehen: ein Ganzes (Pizza, Torte, Blechkuchen, Schokolade, Band) in
 * n gleich große Teile schneiden und Teile antippen. Dazu der Bruch, sein Name,
 * die Art (Stammbruch, echt, unecht) und — darunter — zwei Brüche vergleichen.
 */
import { useState } from "react";
import { art, gemischtText, wert, wort } from "@/lib/brueche";
import { Chips } from "@/components/prozent/ui";
import { BruchBild, BruchSatz, FORMEN, type Form } from "./bild";

const ART_TEXT = {
  stamm: "Stammbruch — genau ein Teil (Zähler 1).",
  echt: "echter Bruch — weniger als ein Ganzes.",
  unecht: "unechter Bruch — mehr als ein Ganzes; als gemischte Zahl schreibbar.",
  scheinbruch: "Scheinbruch — in Wahrheit eine ganze Zahl.",
};

function Zahlwahl({ label, wert: w, setze, min, max }: { label: string; wert: number; setze: (n: number) => void; min: number; max: number }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-20 text-muted">{label}</span>
      <button className="btn-secondary px-2 py-1" onClick={() => setze(Math.max(min, w - 1))} aria-label={`${label} kleiner`}>−</button>
      <span className="w-6 text-center font-black text-lg">{w}</span>
      <button className="btn-secondary px-2 py-1" onClick={() => setze(Math.min(max, w + 1))} aria-label={`${label} größer`}>+</button>
    </label>
  );
}

export default function Verstehen() {
  const [form, setForm] = useState<Form>("pizza");
  const [n, setN] = useState(4);
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set([0, 1, 2]));
  const [ganze, setGanze] = useState(1);
  const z = auswahl.size;
  const neuN = (m: number) => { setN(m); setAuswahl(new Set()); };
  const tippe = (i: number) => setAuswahl(a => { const s = new Set(a); if (s.has(i)) s.delete(i); else s.add(i); return s; });

  const [a, setA] = useState({ z: 2, n: 3 });
  const [b, setB] = useState({ z: 3, n: 5 });
  const vergleich = a.z * b.n - b.z * a.n;

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 flex flex-col gap-3">
        <Chips wahl={form} setze={setForm} optionen={FORMEN} />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Zahlwahl label="Teile (Nenner)" wert={n} setze={neuN} min={1} max={form === "tafel" ? 24 : 12} />
          <Zahlwahl label="Ganze" wert={ganze} setze={g => { setGanze(g); setAuswahl(s => new Set([...s].filter(i => i < g * n))); }} min={1} max={3} />
          <button className="btn-secondary" onClick={() => setAuswahl(new Set())}>alle leer</button>
          <button className="btn-secondary" onClick={() => setAuswahl(new Set(Array.from({ length: n * ganze }, (_, i) => i)))}>alle voll</button>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem] items-center">
          <BruchBild form={form} n={n} auswahl={auswahl} onTeil={tippe} ganze={ganze} />
          <div className="flex flex-col gap-2 items-start">
            <div className="flex items-center gap-3">
              <BruchSatz z={<span className="text-accent">{z}</span>} n={n} gross />
              {art({ z, n }) === "unecht" && <span className="text-2xl font-black">= {gemischtText({ z, n })}</span>}
            </div>
            <p className="text-lg font-bold">{wort({ z, n })}</p>
            <p className="text-sm"><b>Zähler {z}:</b> so viele Teile sind gefärbt. <b>Nenner {n}:</b> in so viele gleich große Teile ist ein Ganzes geteilt.</p>
            {z > 0 && <p className="text-sm text-muted">{ART_TEXT[art({ z, n })]}</p>}
          </div>
        </div>
        <p className="text-xs text-muted">Teile antippen färbt sie. Egal welche Teile gefärbt sind — es zählt nur, wie viele.</p>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">⚖️ Welcher Bruch ist größer?</h3>
        {[{ b: a, setze: setA, name: "Erster" }, { b: b, setze: setB, name: "Zweiter" }].map(({ b: x, setze, name }) => (
          <div key={name} className="grid gap-3 md:grid-cols-[18rem_minmax(0,1fr)] items-center">
            <div className="flex flex-wrap gap-2 items-center">
              <BruchSatz z={x.z} n={x.n} gross />
              <div className="flex flex-col gap-1">
                <Zahlwahl label="Zähler" wert={x.z} setze={v => setze({ ...x, z: v })} min={0} max={x.n} />
                <Zahlwahl label="Nenner" wert={x.n} setze={v => setze({ z: Math.min(x.z, v), n: v })} min={1} max={12} />
              </div>
            </div>
            <BruchBild form="band" n={x.n} z={x.z} breite="14rem" />
          </div>
        ))}
        <p className="font-bold">
          {vergleich === 0 ? "Beide Brüche sind gleich groß" : vergleich > 0 ? "Der erste Bruch ist größer" : "Der zweite Bruch ist größer"}
          {" "}({wert(a).toLocaleString("de-DE", { maximumFractionDigits: 3 })} {vergleich === 0 ? "=" : vergleich > 0 ? ">" : "<"} {wert(b).toLocaleString("de-DE", { maximumFractionDigits: 3 })}).
          <span className="font-normal text-sm text-muted"> Über Kreuz: {a.z} · {b.n} = {a.z * b.n} und {b.z} · {a.n} = {b.z * a.n}.</span>
        </p>
      </section>
    </div>
  );
}
