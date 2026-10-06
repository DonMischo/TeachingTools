"use client";
/**
 * Stufe 1 und 2: Ein Wort aus 8 Zeichen wird zu ASCII-Codes und dann zu Bits —
 * von Hand, Zeichen für Zeichen.
 */
import { useState } from "react";
import type { Niveau } from "../Bausteine";
import Binaerrechner from "@/components/simulationen/Binaerrechner";

export const WORT_LAENGE = 8;
export const istAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);

const STELLEN = [128, 64, 32, 16, 8, 4, 2, 1];

function AsciiTabelle({ offen, hex }: { offen: boolean; hex: boolean }) {
  const zeichen = Array.from({ length: 95 }, (_, i) => i + 32);
  return (
    <details className="card p-3" open={offen}>
      <summary className="cursor-pointer font-semibold text-sm">📖 ASCII-Tabelle (32–126)</summary>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1 mt-2 font-mono text-xs">
        {zeichen.map(c => (
          <div key={c} className="rounded bg-surface-hover px-1.5 py-1 flex justify-between gap-1">
            <b>{c === 32 ? "␣" : String.fromCharCode(c)}</b><span className="text-muted">{hex ? c.toString(16).toUpperCase() : c}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

export function StufeAscii({ wort, niveau, fertig, fehler }: { wort: string; niveau: Niveau; fertig: () => void; fehler: () => void }) {
  const alsHex = niveau === "experte";
  const [codes, setCodes] = useState<string[]>(() => Array(WORT_LAENGE).fill(""));
  const [geprueft, setGeprueft] = useState(false);
  const richtig = (i: number) => codes[i].trim() !== "" && parseInt(codes[i], alsHex ? 16 : 10) === wort.charCodeAt(i);
  const alle = codes.every((_, i) => richtig(i));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm max-w-3xl">
        Ein Computer kennt keine Buchstaben, nur Zahlen. Im <b>ASCII-Code</b> hat jedes Zeichen eine Nummer: »A« ist 65, »a« ist 97, das Leerzeichen 32.
        {alsHex
          ? <> Als Experte schreibst du die Nummern gleich in <b>Hex</b>: »A« = 41, »a« = 61, Leerzeichen = 20.</>
          : <> Schlag für jedes Zeichen deines Wortes die Nummer in der Tabelle nach.</>}
        {" "}Das ist die Arbeit der <b>Darstellungsschicht (6)</b>.
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-w-3xl">
        {Array.from(wort).map((z, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-3xl font-black font-mono">{z === " " ? "␣" : z}</span>
            <input inputMode={alsHex ? "text" : "numeric"} value={codes[i]} aria-label={`Code für Zeichen ${i + 1}`}
              onChange={e => { const v = (alsHex ? e.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 2).toUpperCase() : e.target.value.replace(/\D/g, "").slice(0, 3)); setCodes(c => c.map((x, k) => (k === i ? v : x))); setGeprueft(false); }}
              className={`input w-full text-center font-mono ${geprueft ? (richtig(i) ? "border-ok" : "border-bad") : ""}`} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => { setGeprueft(true); if (alle) fertig(); else fehler(); }}>✓ Prüfen</button>
        {geprueft && !alle && <span className="text-sm text-bad self-center">{codes.filter((_, i) => !richtig(i)).length} noch falsch — rot umrandet.</span>}
      </div>
      <AsciiTabelle offen={niveau === "einsteiger"} hex={alsHex} />
    </div>
  );
}

/** Hinweis am Hilfsmittel: was es kostet */
export const HILFE_PREIS = "Hilfsmittel erlaubt — kostet 100 Punkte und den dritten Stern dieser Stufe.";

export function StufeBits({ wort, niveau, fertig, fehler, onHilfe }: { wort: string; niveau: Niveau; fertig: () => void; fehler: () => void; onHilfe?: () => void }) {
  const hilfe = niveau === "einsteiger";
  const [rechnerZeile, setRechnerZeile] = useState<number | null>(null);
  const [rechnerBits, setRechnerBits] = useState<number[]>(() => Array(8).fill(0));
  const oeffne = (i: number) => { setRechnerZeile(i); onHilfe?.(); };
  const [bits, setBits] = useState<number[][]>(() => Array.from({ length: WORT_LAENGE }, () => Array(8).fill(0)));
  const [geprueft, setGeprueft] = useState(false);
  const wert = (b: number[]) => b.reduce((s, v, k) => s + v * STELLEN[k], 0);
  const richtig = (i: number) => wert(bits[i]) === wort.charCodeAt(i);
  const alle = bits.every((_, i) => richtig(i));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm max-w-3xl">
        Auf der Leitung gibt es nur <b>0 und 1</b> (Schicht 1). Jede ASCII-Nummer passt in ein <b>Byte</b> aus 8 Bit. Klicke die Bits an, deren Stellenwerte zusammen die Nummer ergeben —
        für 65: 64 + 1 → <span className="font-mono">01000001</span>.
      </p>
      {hilfe && (
        <p className="text-sm rounded-lg bg-accent/10 p-3 max-w-3xl">
          💡 So geht's: Fang links an. Passt die 64 in deine Zahl? Dann Bit an und 64 abziehen. Passt die 32 in den Rest? … und so weiter bis zur 1.
          Beispiel 75: 64 passt (Rest 11) → 32 nein → 16 nein → 8 passt (Rest 3) → 4 nein → 2 passt (Rest 1) → 1 passt.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="text-sm font-mono">
          <thead>
            <tr className="text-xs text-muted"><th className="pr-3 text-left">Zeichen</th><th className="pr-3">Code</th>{STELLEN.map(s => <th key={s} className="w-9">{s}</th>)}<th /></tr>
          </thead>
          <tbody>
            {Array.from(wort).map((z, i) => (
              <tr key={i}>
                <td className="pr-3 text-xl font-black">{z === " " ? "␣" : z}</td>
                <td className="pr-3 text-muted">{wort.charCodeAt(i)}</td>
                {bits[i].map((b, k) => (
                  <td key={k} className="p-0.5">
                    <button aria-label={`Bit ${STELLEN[k]} von Zeichen ${i + 1}`}
                      onClick={() => { setBits(alt => alt.map((r, z) => (z === i ? r.map((v, s) => (s === k ? 1 - v : v)) : r))); setGeprueft(false); }}
                      className={`w-8 h-8 rounded-md font-bold transition-colors ${b ? "bg-cyan-500 text-white" : "bg-surface-hover text-muted"}`}>{b}</button>
                  </td>
                ))}
                <td className="pl-2 w-6">{geprueft ? (richtig(i) ? "✅" : "❌") : ""}</td>
                <td className="pl-1">
                  <button className={`chip text-xs ${rechnerZeile === i ? "chip-on" : ""}`} title={`Binär-Rechner für »${z}« öffnen. ${HILFE_PREIS}`}
                    aria-label={`Binär-Rechner für Zeichen ${i + 1}`} onClick={() => oeffne(i)}>🧮</button>
                </td>
                {hilfe && (
                  <td className="pl-3 text-xs text-muted whitespace-nowrap">
                    = <b className={wert(bits[i]) === wort.charCodeAt(i) ? "text-ok" : "text-fg"}>{wert(bits[i])}</b>
                    {wert(bits[i]) < wort.charCodeAt(i) && <> · fehlt noch {wort.charCodeAt(i) - wert(bits[i])}</>}
                    {wert(bits[i]) > wort.charCodeAt(i) && <> · {wert(bits[i]) - wort.charCodeAt(i)} zu viel</>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rechnerZeile !== null && (
        <div className="card p-3 flex flex-col gap-2 max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold">🧮 Binär-Rechner · Zeichen »{wort[rechnerZeile] === " " ? "␣" : wort[rechnerZeile]}«</h4>
            <button className="chip text-xs" onClick={() => setRechnerZeile(null)}>✕ schließen</button>
          </div>
          <p className="text-xs text-muted">Probiere hier aus, welche Bits zusammen {wort.charCodeAt(rechnerZeile)} ergeben — dann übertrage sie in die Tabelle. {HILFE_PREIS}</p>
          <Binaerrechner key={rechnerZeile} eingebettet ziel={wort.charCodeAt(rechnerZeile)} zielText={wort[rechnerZeile] === " " ? "Leerzeichen" : wort[rechnerZeile]} onBits={setRechnerBits} />
          {hilfe && (
            <button className="btn btn-secondary self-start" onClick={() => { const z = rechnerZeile; setBits(alt => alt.map((r, k) => (k === z ? [...rechnerBits] : r))); setGeprueft(false); }}>
              ⬇ In Zeile »{wort[rechnerZeile]}« übernehmen
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <button className="btn btn-primary" onClick={() => { setGeprueft(true); if (alle) fertig(); else fehler(); }}>✓ Prüfen</button>
        {geprueft && alle && <span className="text-sm">{WORT_LAENGE * 8} Bit — genau so viele Lichtblitze braucht dein Wort.</span>}
      </div>
    </div>
  );
}
