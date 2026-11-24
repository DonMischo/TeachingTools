"use client";
/**
 * Bruch ↔ Dezimalzahl über die Stellenwerttafel (dieselbe Tafel wie in der
 * Simulation »Stellenwerttafeln«): Bruch auf Zehntel, Hundertstel oder
 * Tausendstel erweitern, in die Tafel schreiben, als Kommazahl ablesen — und
 * zurück: Ziffern in der Tafel → Zehnerbruch → kürzen. Brüche, die sich nicht
 * auf 10, 100, 1000 erweitern lassen, werden schriftlich geteilt (periodisch).
 */
import { useMemo, useState } from "react";
import { TafelAnsicht } from "@/components/stellenwert/teile";
import { ausDezimal, bt, dezimal, kuerze, leseBruch, zehnerbruch, type Bruch } from "@/lib/brueche";
import { BruchSatz, Rechenzeile } from "./bild";
import { Abspieler } from "@/components/schriftlich/Rechenblatt";
import { dividiere } from "@/lib/schriftlich";

/** Ziffern einer Kommazahl je Stellenwert (exp 0 = Einer, −1 = Zehntel …) */
export function ziffernJeStelle(ganz: number, nach: string): Record<number, number> {
  const w: Record<number, number> = {};
  String(ganz).split("").reverse().forEach((c, i) => { w[i] = Number(c); });
  nach.split("").forEach((c, i) => { w[-(i + 1)] = Number(c); });
  return w;
}

const NAME = { 10: "Zehntel", 100: "Hundertstel", 1000: "Tausendstel" } as const;

function Schritte({ schritt, setSchritt, anzahl }: { schritt: number; setSchritt: (n: number) => void; anzahl: number }) {
  return (
    <div className="flex gap-2">
      {schritt < anzahl && <button className="btn-primary" onClick={() => setSchritt(schritt + 1)}>Nächster Schritt →</button>}
      {schritt > 0 && <button className="btn-secondary" onClick={() => setSchritt(0)}>Von vorn</button>}
    </div>
  );
}

/** Zähler : Nenner schriftlich, mit angehängten Nullen — dieselbe Division wie in »Schriftliche Rechenverfahren« */
function DivisionsWeg({ b }: { b: Bruch }) {
  const [offen, setOffen] = useState(false);
  const ablauf = useMemo(() => dividiere(b.z, b.n, { nachkomma: 10 }), [b.z, b.n]);
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <button className="btn-secondary self-start" onClick={() => setOffen(o => !o)}>{offen ? "Division zuklappen" : `✍️ Anderer Weg: schriftlich ${b.z} : ${b.n} rechnen`}</button>
      {offen && <>
        <p className="text-sm text-muted">Ein Bruch ist eine Division: Zähler geteilt durch Nenner. Gehen die Ziffern aus, setzt man das Komma und hängt Nullen an — bis der Rest 0 ist oder sich ein Rest wiederholt (dann ist die Dezimalzahl periodisch).</p>
        <Abspieler ablauf={ablauf} />
      </>}
    </div>
  );
}

function BruchZuDezimal() {
  const [text, setText] = useState("3/8");
  const [schritt, setSchritt] = useState(0);
  const roh = leseBruch(text);
  const b: Bruch | null = roh && roh.z >= 0 && roh.z < 10000 * roh.n ? roh : null;
  const zb = b ? zehnerbruch(b) : null;
  const d = b ? dezimal(b) : null;
  const k = b ? kuerze(b) : null;
  const gekuerzt = b && k && k.n !== b.n;
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">Bruch → Dezimalzahl</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-28 text-lg font-bold" value={text} onChange={e => { setText(e.target.value); setSchritt(0); }} aria-label="Bruch" />
        {["1/2", "3/4", "3/8", "7/20", "13/25", "1/3", "5/6"].map(t => <button key={t} className="chip" onClick={() => { setText(t); setSchritt(0); }}>{t}</button>)}
      </div>
      {!b || !k || !d ? <p className="text-sm text-bad">Einen positiven Bruch eingeben, z. B. 3/8.</p> : zb ? (
        <>
          <ol className="list-decimal pl-5 flex flex-col gap-2">
            {gekuerzt && <li><Rechenzeile text={`Erst kürzen: ${bt(b)} = ${bt(k)}`} /></li>}
            {schritt >= 1 && <li>
              <span className="inline-flex flex-wrap items-center gap-2">Nenner {k.n} passt in {zb.nenner}: <b>mit {zb.faktor} erweitern</b>
                <BruchSatz z={k.z} n={k.n} /> = <BruchSatz z={`${k.z} · ${zb.faktor}`} n={`${k.n} · ${zb.faktor}`} /> = <BruchSatz z={<span className="text-accent">{zb.bruch.z}</span>} n={<span className="text-accent">{zb.nenner}</span>} />
                — also {zb.bruch.z} {NAME[zb.nenner]}.</span>
            </li>}
            {schritt >= 2 && <li className="flex flex-col gap-2">
              <span>{zb.bruch.z} {NAME[zb.nenner]} in die Stellenwerttafel: die letzte Ziffer steht bei den {NAME[zb.nenner]}.</span>
              <TafelAnsicht basis={10} maxExp={Math.max(0, String(d.ganz).length - 1)} minExp={-3} werte={ziffernJeStelle(d.ganz, d.vor)} />
            </li>}
            {schritt >= 3 && <li className="text-xl font-black">
              Ablesen: <Rechenzeile text={bt(b)} /> = {d.ganz},{d.vor || "0"}
            </li>}
          </ol>
          <Schritte schritt={schritt} setSchritt={setSchritt} anzahl={3} />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Der Nenner {k.n} enthält einen Primfaktor außer 2 und 5 — kein Vielfaches von {k.n} ist 10, 100 oder 1000. Also <b>schriftlich teilen</b>: {k.z} : {k.n}.</p>
          <p className="text-2xl font-black">
            <Rechenzeile text={bt(b)} /> = {d.ganz},{d.vor}<span style={{ textDecoration: "overline", textDecorationThickness: "3px" }}>{d.periode}</span>
          </p>
          <p className="text-sm text-muted">Der Rest wiederholt sich, also wiederholen sich auch die Ziffern: eine <b>periodische</b> Dezimalzahl (Periode {d.periode}).</p>
        </div>
      )}
      {b && k && <DivisionsWeg key={`${k.z}/${k.n}`} b={k} />}
    </section>
  );
}

function DezimalZuBruch() {
  const [text, setText] = useState("0,45");
  const [schritt, setSchritt] = useState(0);
  const weg = ausDezimal(text);
  const m = /^\s*(\d{1,6})(?:[,.](\d{1,3}))?\s*$/.exec(text);
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">Dezimalzahl → Bruch</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-28 text-lg font-bold" value={text} onChange={e => { setText(e.target.value); setSchritt(0); }} aria-label="Dezimalzahl" />
        {["0,5", "0,25", "0,45", "0,125", "1,6", "2,75"].map(t => <button key={t} className="chip" onClick={() => { setText(t); setSchritt(0); }}>{t}</button>)}
      </div>
      {!weg || !m ? <p className="text-sm text-bad">Eine Kommazahl mit höchstens drei Nachkommastellen eingeben, z. B. 0,45.</p> : (
        <>
          <ol className="list-decimal pl-5 flex flex-col gap-2">
            <li className="flex flex-col gap-2">
              <span>In die Stellenwerttafel schreiben:</span>
              <TafelAnsicht basis={10} maxExp={Math.max(0, m[1].replace(/^0+(?=\d)/, "").length - 1)} minExp={-3}
                werte={ziffernJeStelle(Number(m[1]), m[2] ?? "")} />
            </li>
            {weg.schritte.slice(0, schritt).map(s => <li key={s}><Rechenzeile text={s} /></li>)}
            {schritt >= weg.schritte.length && <li className="text-xl font-black list-none -ml-5">Ergebnis: {text.trim()} = <BruchSatz z={weg.ergebnis.z} n={weg.ergebnis.n} /></li>}
          </ol>
          <Schritte schritt={schritt} setSchritt={setSchritt} anzahl={weg.schritte.length} />
        </>
      )}
    </section>
  );
}

export default function Dezimal() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted max-w-3xl">Die Stellen rechts vom Komma sind Zehntel, Hundertstel und Tausendstel. Ein Bruch mit Nenner 10, 100 oder 1000 lässt sich deshalb direkt in die Tafel schreiben — und jede endliche Kommazahl direkt als solcher Bruch.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <BruchZuDezimal />
        <DezimalZuBruch />
      </div>
    </div>
  );
}
