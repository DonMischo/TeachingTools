"use client";
/**
 * Das Rechenblatt: Karopapier mit den Ziffern eines Schritts, die aktuelle
 * Spalte hervorgehoben, Ziffern in den Farben der Stellenwerttafel. Darunter
 * die Walzen (wie im Zählwerk der Stellenwerttafeln): die Walze des Schritts
 * dreht Ziffer für Ziffer — läuft sie über die 9, fliegt der Übertrag in die
 * nächste Spalte; beim Entbündeln fliegt der Zehner herüber.
 */
import { useEffect, useState } from "react";
import { farbe } from "@/lib/stellenwert";
import { Walze } from "@/components/stellenwert/DrehZaehlwerk";
import type { Ablauf, Ort, Schritt } from "@/lib/schriftlich";

const ZELLE = 2.4; // rem
const TICK = 200; // ms je Walzenschritt (eine Walzendrehung dauert 220 ms)

function Flug({ von, nach, t, verzug }: { von: Ort; nach: Ort; t: string; verzug: number }) {
  const [da, setDa] = useState(false);
  useEffect(() => { const u = setTimeout(() => setDa(true), verzug + 30); return () => clearTimeout(u); }, [verzug]);
  const p = da ? nach : von;
  return (
    <span className="absolute flex items-center justify-center rounded-full bg-bad text-white font-black text-sm shadow-lg pointer-events-none z-10"
      style={{ left: `${p.c * ZELLE + 0.3}rem`, top: `${p.r * ZELLE + 0.2}rem`, width: `${ZELLE - 0.6}rem`, height: `${ZELLE - 0.6}rem`,
        transition: "left 700ms ease-in-out, top 700ms ease-in-out, opacity 300ms", opacity: da ? 0.9 : 1 }} aria-hidden>{t}</span>
  );
}

/** Walzenreihe unter dem Blatt; die aktive Walze tickt von `von` nach `bis` */
function Walzen({ s, breite, einer }: { s: Schritt; breite: number; einer?: number }) {
  const [dreh, setDreh] = useState<number | null>(s.walze ? s.walze.von : null);
  useEffect(() => {
    if (!s.walze) { setDreh(null); return; }
    const { von, bis } = s.walze;
    setDreh(von);
    let x = von;
    const u = setInterval(() => {
      if (x === bis) { clearInterval(u); return; }
      x += bis > x ? 1 : -1;
      setDreh(x);
    }, TICK);
    return () => clearInterval(u);
  }, [s]);
  const spalten = Object.keys(s.stand).map(Number);
  if (s.walze && !spalten.includes(s.walze.c)) spalten.push(s.walze.c);
  if (!spalten.length) return null;
  const runden = s.walze && dreh !== null ? Math.floor(dreh / 10) - Math.floor(s.walze.von / 10) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative" style={{ height: "3.4rem", width: `${breite * ZELLE}rem` }}>
        {Array.from({ length: breite }, (_, c) => c).filter(c => spalten.includes(c)).map(c => {
          const aktiv = s.walze?.c === c && dreh !== null;
          const wert = aktiv ? dreh! : s.stand[c] ?? 0;
          const f = einer !== undefined ? farbe(10, einer - c) : "#475569";
          return (
            <div key={c} className={`absolute top-0 rounded-md ${aktiv ? "ring-4 ring-accent" : ""}`} style={{ left: `${c * ZELLE + 0.15}rem` }}>
              <Walze dreh={wert} basis={10} farbe={f} h={ZELLE * 1.2} />
            </div>
          );
        })}
      </div>
      {s.walze && runden > 0 && <span className="text-xs font-bold text-bad">Die Walze ist {runden}-mal über die 9 gelaufen → {runden} Übertrag</span>}
      {s.walze && runden < 0 && <span className="text-xs font-bold text-bad">Unter 0 gedreht → entbündeln</span>}
    </div>
  );
}

export function Rechenblatt({ ablauf, i }: { ablauf: Ablauf; i: number }) {
  const s = ablauf.schritte[Math.min(i, ablauf.schritte.length - 1)];
  const { breite, hoehe, einer } = ablauf;
  const tickDauer = s.walze ? Math.abs(s.walze.bis - s.walze.von) * TICK : 0;
  return (
    <div className="flex flex-col gap-3 overflow-x-auto pb-1">
      <div className="relative rounded-lg" style={{
        width: `${breite * ZELLE}rem`, height: `${hoehe * ZELLE}rem`,
        backgroundImage: "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
        backgroundSize: `${ZELLE / 2}rem ${ZELLE / 2}rem`,
      }} role="img" aria-label="Rechenblatt">
        {s.spalten.map(c => <div key={`h${c}`} className="absolute top-0 bottom-0 bg-accent/15 rounded" style={{ left: `${c * ZELLE}rem`, width: `${ZELLE}rem` }} />)}
        {s.striche.map((x, k) => <div key={`s${k}`} className="absolute bg-fg" style={{ left: `${x.c0 * ZELLE}rem`, width: `${(x.c1 - x.c0 + 1) * ZELLE}rem`, top: `${(x.r + 1) * ZELLE - 0.12}rem`, height: "3px" }} />)}
        {s.zellen.map((z, k) => {
          const klein = z.art === "uebertrag" || z.art === "hilfe";
          const f = (z.art === "zahl" || z.art === "ergebnis") && einer !== undefined && z.c <= einer ? farbe(10, einer - z.c) : undefined;
          return (
            <span key={k} className={`absolute flex justify-center font-mono font-black transition-all duration-500 ${klein ? "text-sm items-start text-bad" : "text-2xl items-center"} ${z.neu ? "animate-pulse" : ""} ${z.art === "ergebnis" ? "underline decoration-2" : ""}`}
              style={{
                left: `${z.c * ZELLE}rem`, top: `${z.r * ZELLE}rem`, width: `${ZELLE}rem`, height: `${ZELLE}rem`, color: klein ? undefined : f,
                textDecorationLine: z.durch ? "line-through" : undefined, opacity: z.durch ? 0.45 : 1,
              }}>{z.t}</span>
          );
        })}
        {s.flug && <Flug key={i} von={s.flug.von} nach={s.flug.nach} t={s.flug.t} verzug={tickDauer} />}
      </div>
      <Walzen s={s} breite={breite} einer={einer} />
    </div>
  );
}

/** Abspieler: Schritt für Schritt, zurück, alle, automatisch */
export function Abspieler({ ablauf }: { ablauf: Ablauf }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  useEffect(() => { setI(0); setAuto(false); }, [ablauf]);
  const n = ablauf.schritte.length;
  useEffect(() => {
    if (!auto) return;
    if (i >= n - 1) { setAuto(false); return; }
    const s = ablauf.schritte[i];
    const dauer = (s.walze ? Math.abs(s.walze.bis - s.walze.von) * TICK : 0) + (s.flug ? 900 : 0) + 1400;
    const u = setTimeout(() => setI(x => x + 1), dauer);
    return () => clearTimeout(u);
  }, [auto, i, n, ablauf]);
  const s = ablauf.schritte[i];
  return (
    <div className="flex flex-col gap-3">
      <Rechenblatt ablauf={ablauf} i={i} />
      <p className="text-base min-h-12 max-w-3xl">{s.text}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={i === 0} onClick={() => setI(i - 1)}>◀ Zurück</button>
        <button className="btn-primary" disabled={i >= n - 1} onClick={() => setI(i + 1)}>Nächster Schritt ▶</button>
        <button className="btn-secondary" onClick={() => setAuto(a => !a)}>{auto ? "⏸ Anhalten" : "⏯ Abspielen"}</button>
        <button className="btn-secondary" onClick={() => setI(n - 1)}>Alle Schritte</button>
        <span className="text-sm text-muted self-center">Schritt {i + 1} / {n}</span>
      </div>
    </div>
  );
}
