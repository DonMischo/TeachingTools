"use client";
/**
 * Übungspapier: dieselbe Aufgabe wie im Rechenblatt, aber zum Selberrechnen.
 * Gegeben sind die Zahlen der Aufgabe; jede andere Ziffer kommt in ihr eigenes
 * Kästchen (Eingabefeld, Fokus springt nach links weiter — man rechnet ja von
 * rechts). In den Übertragszeilen merkt man sich Überträge mit +#-Kreisen
 * (antippen: +1, +2, … leer). Geprüft werden alle Ziffern; Überträge sind eine
 * Merkhilfe und werden nicht bewertet.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { farbe } from "@/lib/stellenwert";
import type { Ablauf, Zelle } from "@/lib/schriftlich";
import { ZELLE } from "./Rechenblatt";

const schl = (r: number, c: number) => `${r}:${c}`;

export function Rechenpapier({ ablauf, onErgebnis }: { ablauf: Ablauf; onErgebnis?: (ok: boolean) => void }) {
  const ende = ablauf.schritte[ablauf.schritte.length - 1];
  const gegeben = useMemo(() => new Set(ablauf.schritte[0].zellen.map(z => schl(z.r, z.c))), [ablauf]);
  const zeichen = ende.zellen.filter(z => z.art === "zeichen");
  /** Felder zum Ausfüllen: alles, was nicht in der Aufgabe stand (außer Rechenzeichen und Überträgen) */
  const felder = useMemo(() => {
    const m = new Map<string, Zelle>();
    for (const z of ende.zellen) if (!gegeben.has(schl(z.r, z.c)) && z.art !== "zeichen" && z.art !== "uebertrag" && z.art !== "hilfe") m.set(schl(z.r, z.c), z);
    return m;
  }, [ende, gegeben]);
  const ueZeilen = ablauf.uebertragZeilen ?? [];
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [kreise, setKreise] = useState<Record<string, number>>({});
  const [geprueft, setGeprueft] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const soll = (z: Zelle) => z.t;
  const richtig = (k: string) => (werte[k] ?? "").trim() === soll(felder.get(k)!);
  const weiterNachLinks = (r: number, c: number) => {
    for (let x = c - 1; x >= 0; x--) { const k = schl(r, x); if (felder.has(k)) { refs.current[k]?.focus(); return; } }
  };
  const taste = (r: number, c: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); weiterNachLinks(r, c); }
    if (e.key === "ArrowRight") { e.preventDefault(); for (let x = c + 1; x < ablauf.breite; x++) { const k = schl(r, x); if (felder.has(k)) { refs.current[k]?.focus(); return; } } }
  };
  const pruefen = () => {
    setGeprueft(true);
    const ergebnisFelder = [...felder.entries()].filter(([, z]) => z.art === "ergebnis").map(([k]) => k);
    onErgebnis?.(ergebnisFelder.every(richtig));
  };
  const loesung = () => { setWerte(Object.fromEntries([...felder.entries()].map(([k, z]) => [k, soll(z)]))); setGeprueft(true); };
  const leeren = () => { setWerte({}); setKreise({}); setGeprueft(false); };
  const einer = ablauf.einer;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-1">
        <div className="relative rounded-lg border border-line bg-surface" style={{
          width: `${ablauf.breite * ZELLE}rem`, height: `${ablauf.hoehe * ZELLE}rem`,
          backgroundImage: "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
          backgroundSize: `${ZELLE}rem ${ZELLE}rem`,
        }} role="group" aria-label="Rechenpapier">
          {ende.striche.map((x, k) => <div key={`s${k}`} className="absolute bg-fg" style={{ left: `${x.c0 * ZELLE}rem`, width: `${(x.c1 - x.c0 + 1) * ZELLE}rem`, top: `${(x.r + 1) * ZELLE - 0.1}rem`, height: "3px" }} />)}
          {/* Aufgabe und Rechenzeichen */}
          {[...ablauf.schritte[0].zellen, ...zeichen].map((z, k) => (
            <span key={`g${k}`} className="absolute flex items-center justify-center font-mono font-black text-[1.7rem]"
              style={{ left: `${z.c * ZELLE}rem`, top: `${z.r * ZELLE}rem`, width: `${ZELLE}rem`, height: `${ZELLE}rem`,
                color: z.art !== "zeichen" && einer !== undefined && z.c <= einer ? farbe(10, einer - z.c) : undefined }}>{z.t}</span>
          ))}
          {/* Übertragskreise */}
          {ueZeilen.flatMap(r => Array.from({ length: ablauf.breite - 1 }, (_, i) => i + 1).map(c => {
            const k = schl(r, c), n = kreise[k] ?? 0;
            return (
              <button key={`u${k}`} type="button" className="absolute flex items-center justify-center" aria-label={`Übertrag Spalte ${c}: ${n ? `+${n}` : "leer"}`}
                style={{ left: `${c * ZELLE}rem`, top: `${r * ZELLE}rem`, width: `${ZELLE}rem`, height: `${ZELLE}rem` }}
                onClick={() => setKreise(x => ({ ...x, [k]: (n + 1) % 4 }))}>
                <span className={`flex items-center justify-center rounded-full border-2 size-7 text-sm font-black ${n ? "border-bad text-bad bg-bad/10" : "border-dashed border-line text-transparent hover:border-bad/50"}`}>+{n || 1}</span>
              </button>
            );
          }))}
          {/* Eingabefelder */}
          {[...felder.entries()].map(([k, z]) => {
            const zustand = geprueft && (werte[k] ?? "") !== "" ? (richtig(k) ? "border-ok bg-ok/10" : "border-bad bg-bad/10") : geprueft ? "border-bad/60" : "border-accent/40";
            return (
              <span key={`e${k}`} className="absolute flex items-center justify-center gap-0.5" style={{ left: `${z.c * ZELLE}rem`, top: `${z.r * ZELLE}rem`, width: `${ZELLE}rem`, height: `${ZELLE}rem` }}>
                <input ref={el => { refs.current[k] = el; }} inputMode="numeric" maxLength={1}
                  value={werte[k] ?? ""} aria-label={z.art === "ergebnis" ? `Ergebnis Spalte ${z.c}` : `Zwischenschritt Zeile ${z.r} Spalte ${z.c}`}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "");
                    setWerte(x => ({ ...x, [k]: v })); setGeprueft(false);
                    if (v) weiterNachLinks(z.r, z.c);
                  }}
                  onKeyDown={e => taste(z.r, z.c, e)}
                  className={`text-center font-mono font-black text-[1.5rem] bg-transparent rounded-md border-2 outline-none focus:border-accent ${zustand}`}
                  style={{ width: `${ZELLE - 0.4}rem`, height: `${ZELLE - 0.4}rem` }} />
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={pruefen}>Prüfen</button>
        <button className="btn-secondary" onClick={leeren}>Leeren</button>
        <button className="btn-secondary" onClick={loesung}>Lösung eintragen</button>
      </div>
      <p className="text-xs text-muted">Ziffer tippen springt ins Kästchen links daneben (← → wechseln). Die gestrichelten Kreise sind für Überträge: antippen schreibt +1, nochmal +2 … — eine Merkhilfe, sie wird nicht bewertet.</p>
    </div>
  );
}
