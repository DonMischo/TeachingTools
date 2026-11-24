"use client";
/**
 * Erweitern und Kürzen am Bild: Erweitern = jedes Stück noch einmal in k Stücke
 * schneiden (gestrichelt), Kürzen = Stücke zusammenlegen. Dazu »gleichnamig
 * machen« für zwei Brüche mit dem Hauptnenner.
 */
import { useState } from "react";
import { bt, erweitere, ggt, kgv, kuerzWeg } from "@/lib/brueche";
import { Chips } from "@/components/prozent/ui";
import { BruchBild, BruchSatz, FORMEN, Rechenzeile, type Form } from "./bild";

function Regler({ label, wert, setze, min, max }: { label: string; wert: number; setze: (n: number) => void; min: number; max: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">{label}: <b className="text-fg text-base">{wert}</b>
      <input type="range" min={min} max={max} value={wert} onChange={e => setze(Number(e.target.value))} aria-label={label} />
    </label>
  );
}

/** Bruch mit »· k«-Pfeilen an Zähler und Nenner */
function Malpfeile({ z, n, k, zeichen = "·" }: { z: number; n: number; k: number; zeichen?: string }) {
  return (
    <div className="flex items-center gap-2 text-2xl">
      <BruchSatz z={z} n={n} gross />
      <div className="flex flex-col items-center text-sm font-bold text-accent gap-6">
        <span>— {zeichen} {k} →</span><span>— {zeichen} {k} →</span>
      </div>
      <BruchSatz z={<span className="text-accent">{zeichen === "·" ? z * k : z / k}</span>} n={<span className="text-accent">{zeichen === "·" ? n * k : n / k}</span>} gross />
    </div>
  );
}

export default function Erweitern() {
  const [form, setForm] = useState<Form>("kuchen");
  const [z, setZ] = useState(2);
  const [n, setN] = useState(3);
  const [k, setK] = useState(2);

  const [kz, setKz] = useState(12);
  const [kn, setKn] = useState(18);
  const kw = kuerzWeg({ z: kz, n: kn });
  const t = ggt(kz, kn);

  const [a, setA] = useState({ z: 1, n: 4 });
  const [b, setB] = useState({ z: 1, n: 6 });
  const hn = kgv(a.n, b.n);

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">✂️ Erweitern — feiner schneiden</h3>
        <Chips wahl={form} setze={setForm} optionen={FORMEN} />
        <div className="flex flex-wrap gap-6">
          <Regler label="Nenner" wert={n} setze={v => { setN(v); setZ(Math.min(z, v)); }} min={1} max={8} />
          <Regler label="Zähler" wert={z} setze={setZ} min={0} max={n} />
          <Regler label="Erweitern mit k" wert={k} setze={setK} min={1} max={5} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 items-center">
          <div className="flex flex-col gap-2 items-center">
            <BruchBild form={form} n={n} z={z} breite="11rem" />
            <span className="text-sm text-muted">{n} Stücke, {z} davon gefärbt</span>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <BruchBild form={form} n={n} z={z} k={k} breite="11rem" />
            <span className="text-sm text-muted">jedes Stück in {k} geschnitten: {n * k} Stücke, {z * k} davon gefärbt</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Malpfeile z={z} n={n} k={k} />
          <p className="text-sm max-w-md">Erweitern heißt: <b>Zähler und Nenner mit derselben Zahl malnehmen.</b> Es gibt {k}-mal so viele Stücke, jedes ist {k}-mal so klein — die gefärbte Menge bleibt gleich: <Rechenzeile text={`${bt({ z, n })} = ${bt(erweitere({ z, n }, k))}`} />.</p>
        </div>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">🧩 Kürzen — Stücke zusammenlegen</h3>
        <div className="flex flex-wrap gap-6">
          <Regler label="Zähler" wert={kz} setze={v => setKz(Math.min(v, kn))} min={1} max={24} />
          <Regler label="Nenner" wert={kn} setze={v => { setKn(v); setKz(Math.min(kz, v)); }} min={2} max={24} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 items-center">
          <div className="flex flex-col gap-2 items-center">
            <BruchBild form="band" n={kn} z={kz} breite="12rem" />
            <span className="text-sm text-muted">{kz} von {kn} Stücken</span>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <BruchBild form="band" n={kn / t} z={kz / t} breite="12rem" />
            <span className="text-sm text-muted">je {t} Stücke zu einem zusammengelegt: {kz / t} von {kn / t}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {t > 1 ? <Malpfeile z={kz} n={kn} k={t} zeichen=":" /> : null}
          <ol className="text-sm list-decimal pl-5">{kw.schritte.map(s => <li key={s}><Rechenzeile text={s} /></li>)}</ol>
        </div>
      </section>

      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">🤝 Gleichnamig machen</h3>
        <p className="text-sm text-muted">Brüche lassen sich erst addieren oder vergleichen, wenn sie gleich große Stücke haben — denselben Nenner. Der kleinste gemeinsame ist der <b>Hauptnenner</b> (kgV der Nenner).</p>
        {[{ x: a, setze: setA, name: "Erster" }, { x: b, setze: setB, name: "Zweiter" }].map(({ x, setze, name }) => (
          <div key={name} className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1fr)] items-center">
            <div className="flex gap-4">
              <Regler label={`${name}: Zähler`} wert={x.z} setze={v => setze({ ...x, z: Math.min(v, x.n) })} min={1} max={11} />
              <Regler label="Nenner" wert={x.n} setze={v => setze({ z: Math.min(x.z, v), n: v })} min={2} max={12} />
            </div>
            <BruchBild form="band" n={x.n} z={x.z} breite="10rem" />
            <BruchBild form="band" n={x.n} z={x.z} k={hn / x.n} breite="10rem" />
          </div>
        ))}
        <p className="text-sm">Hauptnenner kgV({a.n}; {b.n}) = <b>{hn}</b>: <Rechenzeile text={`${bt(a)} = ${bt(erweitere(a, hn / a.n))} (mit ${hn / a.n}) und ${bt(b)} = ${bt(erweitere(b, hn / b.n))} (mit ${hn / b.n})`} /></p>
      </section>
    </div>
  );
}
