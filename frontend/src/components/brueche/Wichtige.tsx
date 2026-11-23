"use client";
/**
 * Wichtige Brüche zum Auswendigkönnen (Bruch – Dezimalzahl – Prozent, mit Bild)
 * und das Spiel »Bruch-Memory«: Bruch-Bild und Dezimalzahl bzw. Prozent finden.
 */
import { useEffect, useState } from "react";
import { WICHTIGE, wort } from "@/lib/brueche";
import { BruchBild, BruchSatz } from "./bild";

const BEST = "hp_brueche_memory_best";
type Karte = { id: number; paar: number; seite: "bruch" | "zahl"; text: string; bild: boolean };

export function mische<T>(xs: T[], r: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 8 Paare: Bruch (als Zahl oder Bild) ↔ Dezimalzahl oder Prozent */
export function legeKarten(r: () => number = Math.random): Karte[] {
  const paare = mische(WICHTIGE.filter(w => w.b.z <= w.b.n), r).slice(0, 8);
  const karten: Karte[] = [];
  paare.forEach((w, i) => {
    karten.push({ id: 2 * i, paar: i, seite: "bruch", text: `${w.b.z}/${w.b.n}`, bild: r() < 0.5 });
    karten.push({ id: 2 * i + 1, paar: i, seite: "zahl", text: r() < 0.5 ? w.dez.replace(" periodisch", "…").replace(/ \(.*\)/, "") : w.prozent, bild: false });
  });
  return mische(karten, r);
}

function Memory() {
  const [karten, setKarten] = useState<Karte[]>([]);
  const [offen, setOffen] = useState<number[]>([]);
  const [gefunden, setGefunden] = useState<Set<number>>(new Set());
  const [zuege, setZuege] = useState(0);
  const [best, setBest] = useState(0);
  useEffect(() => { setKarten(legeKarten()); try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch { /* egal */ } }, []);
  const fertig = karten.length > 0 && gefunden.size === karten.length / 2;
  useEffect(() => {
    if (!fertig) return;
    if (!best || zuege < best) { setBest(zuege); try { localStorage.setItem(BEST, String(zuege)); } catch { /* egal */ } }
  }, [fertig]); // eslint-disable-line react-hooks/exhaustive-deps

  const tippe = (k: Karte) => {
    if (offen.length >= 2 || offen.includes(k.id) || gefunden.has(k.paar)) return;
    const neu = [...offen, k.id];
    setOffen(neu);
    if (neu.length === 2) {
      setZuege(z => z + 1);
      const [a, b] = neu.map(id => karten.find(x => x.id === id)!);
      if (a.paar === b.paar) { setGefunden(g => new Set(g).add(a.paar)); setOffen([]); }
      else setTimeout(() => setOffen([]), 1100);
    }
  };
  const neu = () => { setKarten(legeKarten()); setOffen([]); setGefunden(new Set()); setZuege(0); };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-sm font-bold">
        <span>{zuege} Züge</span><span>{gefunden.size} / {karten.length / 2} Paare</span>
        {best > 0 && <span className="text-muted font-normal">Bester Lauf: {best} Züge</span>}
        <button className="btn-secondary" onClick={neu}>Neu mischen</button>
      </div>
      {fertig && <p className="font-bold text-ok">Alle Paare gefunden in {zuege} Zügen! {zuege <= best ? "🏆" : ""}</p>}
      <div className="grid grid-cols-4 gap-2 max-w-xl">
        {karten.map(k => {
          const sicht = offen.includes(k.id) || gefunden.has(k.paar);
          const [z, n] = k.text.split("/").map(Number);
          return (
            <button key={k.id} type="button" onClick={() => tippe(k)} aria-label={sicht ? k.text : "verdeckte Karte"}
              className={`aspect-square rounded-xl border-2 flex items-center justify-center p-1 transition-colors ${sicht ? (gefunden.has(k.paar) ? "border-ok bg-surface" : "border-accent bg-surface") : "border-line bg-accent/20 hover:bg-accent/30"}`}>
              {!sicht ? <span className="text-3xl">🍕</span>
                : k.seite === "bruch" ? (k.bild ? <div className="w-full"><BruchBild form="pizza" n={n} z={z} breite="100%" /></div> : <BruchSatz z={z} n={n} gross />)
                : <span className="text-xl font-black">{k.text}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Wichtige() {
  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">⭐ Wichtige Brüche — einmal lernen, immer wieder brauchen</h3>
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
          {WICHTIGE.map(w => (
            <div key={`${w.b.z}/${w.b.n}`} className="rounded-xl border border-line p-2 flex flex-col items-center gap-1">
              <div className="w-20"><BruchBild form="pizza" n={w.b.n} z={w.b.z} breite="5rem" /></div>
              <div className="flex items-center gap-2"><BruchSatz z={w.b.z} n={w.b.n} /><span className="font-bold">= {w.dez.replace(/ \(.*\)/, "")}</span></div>
              <span className="text-sm font-bold text-accent">{w.prozent}</span>
              <span className="text-xs text-muted">{wort(w.b)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card p-4 flex flex-col gap-3">
        <h3 className="font-black">🧠 Bruch-Memory</h3>
        <p className="text-sm text-muted">Finde zu jedem Bruch (Zahl oder Pizza) die passende Dezimalzahl oder den Prozentsatz. Je weniger Züge, desto besser.</p>
        <Memory />
      </section>
    </div>
  );
}
