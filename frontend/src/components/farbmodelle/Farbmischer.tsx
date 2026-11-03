"use client";
/**
 * Hex-Farbmischer: eine Zielfarbe nachmischen. Jede Farbe im Web ist #RRGGBB —
 * je Kanal eine kleine Stellenwerttafel mit 16er- und Einerstelle. Man dreht
 * die Hex-Ziffern, sieht die eigene Farbe wachsen und deckt am Ende auf.
 * Fünf Farben je Runde, bis zu drei Sterne je Farbe; ein Tipp kostet einen.
 */
import { useEffect, useState } from "react";
import { ziffer } from "@/lib/stellenwert";
import { farbAbstand, farbSterne, hexFarbe, zielFarbe, type Rgb } from "@/lib/farbmodelle";
import { Chips } from "@/components/prozent/ui";

const RUNDEN = 5;
const KANAELE = [
  { name: "Rot", farbe: "#ef4444" },
  { name: "Grün", farbe: "#22c55e" },
  { name: "Blau", farbe: "#3b82f6" },
] as const;
const STUFEN = [
  { id: "1", label: "⭐ nur 00, 80, FF" },
  { id: "2", label: "⭐⭐ Einerstelle 0" },
  { id: "3", label: "⭐⭐⭐ alles" },
] as const;

/** sechs Hex-Ziffern → drei Kanäle */
const alsRgb = (d: number[]): Rgb => [d[0] * 16 + d[1], d[2] * 16 + d[3], d[4] * 16 + d[5]];

export default function Farbmischer() {
  const [stufe, setStufe] = useState<"1" | "2" | "3">("1");
  const [ziel, setZiel] = useState<Rgb | null>(null);
  const [ziffern, setZiffern] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [tipp, setTipp] = useState(false);
  const [runde, setRunde] = useState(1);
  const [sterne, setSterne] = useState<number[]>([]);

  const mix = alsRgb(ziffern);
  const einerFest = stufe === "2";

  const neueFarbe = (s = stufe) => {
    setZiel(zielFarbe(Number(s) as 1 | 2 | 3)); setZiffern([0, 0, 0, 0, 0, 0]); setAufgedeckt(false); setTipp(false);
  };
  // erst im Browser würfeln (sonst Hydration-Mismatch)
  useEffect(() => { neueFarbe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const neuesSpiel = (s = stufe) => { setRunde(1); setSterne([]); neueFarbe(s); };

  const drehe = (i: number, d: number) => {
    if (aufgedeckt) return;
    setZiffern(z => z.map((x, k) => (k === i ? (x + d + 16) % 16 : x)));
  };

  const fertig = () => {
    if (!ziel || aufgedeckt) return;
    const s = Math.max(0, farbSterne(farbAbstand(ziel, mix)) - (tipp ? 1 : 0));
    setSterne(xs => [...xs, s]); setAufgedeckt(true);
  };

  const ende = sterne.length >= RUNDEN && aufgedeckt;
  if (!ziel) return null;
  const letzte = sterne.at(-1) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h2 className="text-xl font-black">🎨 Hex-Farbmischer</h2>
        <Chips wahl={stufe} setze={s => { setStufe(s); neuesSpiel(s); }} optionen={STUFEN} />
      </div>
      <p className="text-sm max-w-3xl">
        Jede Farbe auf dem Bildschirm mischt sich aus <b style={{ color: KANAELE[0].farbe }}>Rot</b>,{" "}
        <b style={{ color: KANAELE[1].farbe }}>Grün</b> und <b style={{ color: KANAELE[2].farbe }}>Blau</b> — je 0 bis 255,
        als zwei Hex-Ziffern geschrieben: 00 = aus, FF = voll. Dreh die Ziffern, bis deine Farbe aussieht wie das Ziel.
        Die linke Ziffer zählt 16-mal so viel wie die rechte!
      </p>

      <div className="flex flex-wrap gap-4 items-stretch">
        <div className="flex flex-col items-center gap-1">
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl shadow-lg border-2 border-line" style={{ background: hexFarbe(ziel) }} aria-label="Zielfarbe" />
          <span className="text-sm font-bold">🎯 Ziel {aufgedeckt && <span className="font-mono">{hexFarbe(ziel)}</span>}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl shadow-lg border-2 border-line" style={{ background: hexFarbe(mix) }} aria-label="Deine Farbe" />
          <span className="text-sm font-bold">🖌️ Deine <span className="font-mono">{hexFarbe(mix)}</span></span>
        </div>
        <div className="flex flex-col gap-1 justify-center text-sm">
          <span>Farbe {Math.min(runde, RUNDEN)} von {RUNDEN}</span>
          <span>{"⭐".repeat(sterne.reduce((a, b) => a + b, 0)) || "—"}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {KANAELE.map((k, c) => {
          const wert = mix[c];
          const abw = ziel[c] - wert;
          return (
            <div key={k.name} className="rounded-xl p-2 flex flex-col gap-1.5" style={{ background: k.farbe + "1a", border: `2px solid ${k.farbe}` }}>
              <b style={{ color: k.farbe }}>{k.name}</b>
              <div className="flex gap-1">
                {[0, 1].map(p => {
                  const i = c * 2 + p;
                  const fest = p === 1 && einerFest;
                  return (
                    <div key={p} className="flex flex-col items-center w-14 rounded-lg overflow-hidden border border-line bg-surface">
                      <span className="text-[10px] w-full text-center text-white font-bold" style={{ background: k.farbe }}>{p ? "Einer" : "16er"}</span>
                      <button className="w-full hover:bg-surface-hover disabled:opacity-30" disabled={fest || aufgedeckt} onClick={() => drehe(i, 1)} aria-label={`${k.name} ${p ? "Einer" : "16er"} hoch`}>▲</button>
                      <span className="font-mono font-black text-2xl">{ziffer(ziffern[i])}</span>
                      <button className="w-full hover:bg-surface-hover disabled:opacity-30" disabled={fest || aufgedeckt} onClick={() => drehe(i, -1)} aria-label={`${k.name} ${p ? "Einer" : "16er"} runter`}>▼</button>
                    </div>
                  );
                })}
              </div>
              <span className="text-xs font-mono">{ziffern[c * 2]}·16 + {ziffern[c * 2 + 1]} = <b>{wert}</b></span>
              <div className="h-2 rounded-full bg-page overflow-hidden"><div className="h-full" style={{ width: `${(wert / 255) * 100}%`, background: k.farbe }} /></div>
              {(tipp || aufgedeckt) && (
                <span className="text-xs font-bold">
                  {aufgedeckt ? <>Ziel: {ziel[c]} = <span className="font-mono">{hexFarbe(ziel).slice(1 + c * 2, 3 + c * 2)}</span></>
                    : Math.abs(abw) <= 8 ? "✔ passt fast" : abw > 0 ? "▲ mehr" : "▼ weniger"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {!aufgedeckt && (
          <>
            <button className="btn-primary" onClick={fertig}>✅ Fertig gemischt</button>
            <button className="btn" onClick={() => setTipp(true)} disabled={tipp}>💡 Tipp (kostet 1 ⭐)</button>
          </>
        )}
        {aufgedeckt && !ende && (
          <button className="btn-primary" onClick={() => { setRunde(r => r + 1); neueFarbe(); }}>Nächste Farbe ➡</button>
        )}
        {ende && <button className="btn-primary" onClick={() => neuesSpiel()}>🔁 Neues Spiel</button>}
      </div>
      {aufgedeckt && (
        <p className="font-black" role="status">
          {"⭐".repeat(letzte) || "Diesmal kein Stern"} — {letzte === 3 ? "perfekt gemischt!" : letzte ? "schon nah dran." : "schau, welcher Kanal am weitesten weg war."}
          {ende && ` Gesamt: ${sterne.reduce((a, b) => a + b, 0)} von ${RUNDEN * 3} Sternen.`}
        </p>
      )}
    </div>
  );
}
