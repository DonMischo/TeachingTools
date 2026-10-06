"use client";
/**
 * Stufe 1 und 2: Ein Wort aus 8 Zeichen wird zu ASCII-Codes und dann zu Bits —
 * von Hand, Zeichen für Zeichen.
 */
import { useState } from "react";

export const WORT_LAENGE = 8;
export const istAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);

const STELLEN = [128, 64, 32, 16, 8, 4, 2, 1];

function AsciiTabelle() {
  const zeichen = Array.from({ length: 95 }, (_, i) => i + 32);
  return (
    <details className="card p-3">
      <summary className="cursor-pointer font-semibold text-sm">📖 ASCII-Tabelle (32–126)</summary>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1 mt-2 font-mono text-xs">
        {zeichen.map(c => (
          <div key={c} className="rounded bg-surface-hover px-1.5 py-1 flex justify-between gap-1">
            <b>{c === 32 ? "␣" : String.fromCharCode(c)}</b><span className="text-muted">{c}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

export function StufeAscii({ wort, fertig, fehler }: { wort: string; fertig: () => void; fehler: () => void }) {
  const [codes, setCodes] = useState<string[]>(() => Array(WORT_LAENGE).fill(""));
  const [geprueft, setGeprueft] = useState(false);
  const richtig = (i: number) => +codes[i] === wort.charCodeAt(i) && codes[i].trim() !== "";
  const alle = codes.every((_, i) => richtig(i));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm max-w-3xl">
        Ein Computer kennt keine Buchstaben, nur Zahlen. Im <b>ASCII-Code</b> hat jedes Zeichen eine Nummer: »A« ist 65, »a« ist 97, das Leerzeichen 32.
        Schlag für jedes Zeichen deines Wortes die Nummer nach. Das ist die Arbeit der <b>Darstellungsschicht (6)</b>.
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-w-3xl">
        {Array.from(wort).map((z, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-3xl font-black font-mono">{z === " " ? "␣" : z}</span>
            <input inputMode="numeric" value={codes[i]} aria-label={`Code für Zeichen ${i + 1}`}
              onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); setCodes(c => c.map((x, k) => (k === i ? v : x))); setGeprueft(false); }}
              className={`input w-full text-center font-mono ${geprueft ? (richtig(i) ? "border-ok" : "border-bad") : ""}`} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => { setGeprueft(true); if (alle) fertig(); else fehler(); }}>✓ Prüfen</button>
        {geprueft && !alle && <span className="text-sm text-bad self-center">{codes.filter((_, i) => !richtig(i)).length} noch falsch — rot umrandet.</span>}
      </div>
      <AsciiTabelle />
    </div>
  );
}

export function StufeBits({ wort, fertig, fehler }: { wort: string; fertig: () => void; fehler: () => void }) {
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-center">
        <button className="btn btn-primary" onClick={() => { setGeprueft(true); if (alle) fertig(); else fehler(); }}>✓ Prüfen</button>
        {geprueft && alle && <span className="text-sm">{WORT_LAENGE * 8} Bit — genau so viele Lichtblitze braucht dein Wort.</span>}
      </div>
    </div>
  );
}
