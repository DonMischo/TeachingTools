"use client";
/**
 * Hex ↔ Dez: ein Farbcode #RRGGBB in drei Zahlen von 0 bis 255 und zurück,
 * je Kanal mit Rechenweg (Ziffer · 16 + Ziffer, bzw. geteilt durch 16 mit
 * Rest). Darunter ein freier Umrechner für beliebige ganze Zahlen.
 */
import { useEffect, useState } from "react";
import { divisionsWeg, lies, schreibe, ziffer, zuDezimalWeg } from "@/lib/stellenwert";
import { ausHex, hexFarbe, type Rgb } from "@/lib/farbmodelle";

const KANAELE = [
  { name: "Rot", farbe: "#ef4444" },
  { name: "Grün", farbe: "#22c55e" },
  { name: "Blau", farbe: "#3b82f6" },
] as const;

/** Textfeld, das von außen gesetzte Werte übernimmt, solange das Getippte nicht schon dasselbe meint. */
function useFeld<T>(wert: T, schreib: (w: T) => string, lese: (t: string) => T | null) {
  const [text, setText] = useState(schreib(wert));
  useEffect(() => {
    setText(t => (JSON.stringify(lese(t)) === JSON.stringify(wert) ? t : schreib(wert)));
  }, [JSON.stringify(wert)]); // eslint-disable-line react-hooks/exhaustive-deps
  return [text, setText] as const;
}

function Kanal({ i, wert, setze }: { i: number; wert: number; setze: (n: number) => void }) {
  const k = KANAELE[i];
  const [text, setText] = useFeld(wert, String, t => { const n = lies(t, 10); return n !== null && Number.isInteger(n) && n <= 255 ? n : null; });
  const ok = (() => { const n = lies(text, 10); return n !== null && Number.isInteger(n) && n <= 255; })();
  const hoch = Math.floor(wert / 16), tief = wert % 16;
  return (
    <div className="rounded-xl p-3 flex flex-col gap-2 flex-1 min-w-56" style={{ background: k.farbe + "14", border: `2px solid ${k.farbe}` }}>
      <div className="flex items-center gap-2">
        <b style={{ color: k.farbe }}>{k.name}</b>
        <span className="font-mono font-black text-2xl ml-auto" style={{ color: k.farbe }}>{ziffer(hoch)}{ziffer(tief)}</span>
        <span className="text-muted">=</span>
        <input className={`input w-20 text-right font-mono ${ok ? "" : "border-bad"}`} inputMode="numeric" value={text} aria-label={`${k.name} dezimal`}
          onChange={e => {
            setText(e.target.value);
            const n = lies(e.target.value, 10);
            if (n !== null && Number.isInteger(n) && n <= 255) setze(n);
          }} />
      </div>
      <div className="text-xs flex flex-col gap-1">
        <span><b>Hex → Dez:</b> <span className="font-mono">{ziffer(hoch)} · 16 + {ziffer(tief)} · 1 = {hoch} · 16 + {tief} = {hoch * 16} + {tief} = <b>{wert}</b></span></span>
        <span><b>Dez → Hex:</b> <span className="font-mono">{wert} : 16 = {hoch} Rest {tief}</span> → 16er-Stelle <b className="font-mono">{ziffer(hoch)}</b>, Einerstelle <b className="font-mono">{ziffer(tief)}</b></span>
      </div>
      <div className="h-2 rounded-full bg-page overflow-hidden"><div className="h-full" style={{ width: `${(wert / 255) * 100}%`, background: k.farbe }} /></div>
    </div>
  );
}

/** Freier Umrechner, beide Richtungen. Bis 12 Hex-Stellen bleibt alles exakt. */
function Zahl() {
  const MAX = 16 ** 12 - 1;
  const [n, setN] = useState(2026);
  const [hexText, setHexText] = useFeld(n, x => schreibe(x, 16), t => lies(t, 16));
  const [dezText, setDezText] = useFeld(n, String, t => lies(t, 10));
  const gut = (x: number | null): x is number => x !== null && Number.isInteger(x) && x <= MAX;
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3">
      <h3 className="font-black">🔁 Beliebige Zahl umrechnen</h3>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          <input className={`input w-40 font-mono ${gut(lies(hexText, 16)) ? "" : "border-bad"}`} value={hexText} aria-label="Zahl hexadezimal"
            onChange={e => { setHexText(e.target.value); const x = lies(e.target.value, 16); if (gut(x)) setN(x); }} />
          <span className="font-bold">₁₆</span>
        </label>
        <span className="text-xl">⇄</span>
        <label className="flex items-center gap-1">
          <input className={`input w-40 font-mono ${gut(lies(dezText, 10)) ? "" : "border-bad"}`} inputMode="numeric" value={dezText} aria-label="Zahl dezimal"
            onChange={e => { setDezText(e.target.value); const x = lies(e.target.value, 10); if (gut(x)) setN(x); }} />
          <span className="font-bold">₁₀</span>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <b>Hex → Dez: Ziffer mal Stellenwert</b>
          <ul className="font-mono mt-1">
            {zuDezimalWeg(n, 16).map((s, i) => (
              <li key={i}>{ziffer(s.ziffer)} · {schreibe(s.stellenwert, 10)} = {schreibe(s.produkt, 10)}</li>
            ))}
            <li className="border-t border-line mt-1 pt-1">Summe = <b>{schreibe(n, 10)}</b></li>
          </ul>
        </div>
        <div>
          <b>Dez → Hex: immer wieder durch 16 teilen</b>
          <ul className="font-mono mt-1">
            {divisionsWeg(n, 16).map((z, i) => (
              <li key={i}>{schreibe(z.zahl, 10)} : 16 = {schreibe(z.quotient, 10)} Rest {z.rest} → <b>{ziffer(z.rest)}</b></li>
            ))}
            <li className="border-t border-line mt-1 pt-1">Reste von unten nach oben: <b>{schreibe(n, 16)}</b></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function HexDez({ farbe, setFarbe }: { farbe: Rgb; setFarbe: (c: Rgb) => void }) {
  const hex = hexFarbe(farbe);
  const [text, setText] = useFeld(farbe, hexFarbe, ausHex);
  const ok = ausHex(text) !== null;
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-20 h-20 rounded-2xl shadow border-2 border-line" style={{ background: hex }} aria-label="Farbe" />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Farbcode (auch kurz: #F80)</span>
            <input className={`input w-36 font-mono text-xl ${ok ? "" : "border-bad"}`} value={text} aria-label="Farbcode"
              onChange={e => { setText(e.target.value); const c = ausHex(e.target.value); if (c) setFarbe(c); }} />
          </label>
          <p className="text-sm max-w-xl">
            Ein Farbcode sind drei Hex-Zahlen hintereinander: <b className="font-mono">#</b>
            {KANAELE.map((k, i) => <b key={k.name} className="font-mono" style={{ color: k.farbe }}>{hex.slice(1 + 2 * i, 3 + 2 * i)}</b>)}.
            Jedes Paar hat eine <b>16er-Stelle</b> und eine <b>Einerstelle</b> — zusammen 16 · 16 = 256 Werte, also 0 bis 255.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {KANAELE.map((_, i) => (
            <Kanal key={i} i={i} wert={farbe[i]} setze={n => setFarbe(farbe.map((k, j) => (j === i ? n : k)) as Rgb)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-xs" aria-label="Hex-Ziffern">
          {Array.from({ length: 16 }, (_, d) => (
            <span key={d} className={`rounded-md border px-1.5 py-0.5 text-center ${d > 9 ? "border-accent" : "border-line"}`}>
              <b className="font-mono">{ziffer(d)}</b> = {d}
            </span>
          ))}
        </div>
      </div>
      <Zahl />
    </div>
  );
}
