"use client";
/**
 * Spiel »Zahlenregen«: Zahlen fallen, oben steht, welche man fangen soll
 * (z. B. »rational, aber nicht ganz«). Den Korb mit Maus, Finger oder ←/→
 * bewegen. Falsche gefangen = ein Herz weg. Alle 8 Treffer wechselt das Ziel
 * und es regnet schneller.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { begruendung, FANGZIELE, kleinsterBereich, FARBE, wuerfleZahl, type Bereich, type Fangziel, type Zahl } from "@/lib/zahlenbereiche";
import { ZahlAnzeige } from "./teile";

const BEST = "hp_zahlenbereiche_regen_best";
const KORB = 0.16; // Korbbreite als Anteil der Feldbreite
type Tropfen = { id: number; x: number; y: number; zahl: Zahl; passt: boolean };

/** Ziele in der Reihenfolge der Level */
const REIHE: Fangziel["id"][] = ["N", "ZohneN", "QohneZ", "RohneQ", "Z", "Q"];

/** Zahl würfeln, die (zu gut der Hälfte) zum Ziel passt */
function neueZahl(ziel: Fangziel, stufe: 1 | 2 | 3): Zahl {
  const bereiche: Bereich[] = ["N", "Z", "Q", "R"];
  for (let i = 0; i < 20; i++) {
    const z = wuerfleZahl(Math.random, stufe, bereiche[Math.floor(Math.random() * 4)]);
    if (ziel.passt(z) === Math.random() < 0.55) return z;
  }
  return wuerfleZahl(Math.random, stufe);
}

export default function Zahlenregen() {
  const [laeuft, setLaeuft] = useState(false);
  const [, setTakt] = useState(0);
  const [ende, setEnde] = useState<{ punkte: number; grund: string } | null>(null);
  const [best, setBest] = useState(0);
  const feld = useRef<HTMLDivElement>(null);
  const s = useRef({ korb: 0.5, tropfen: [] as Tropfen[], punkte: 0, herzen: 3, treffer: 0, level: 0, naechste: 0, id: 0, zuletzt: 0, links: false, rechts: false, meldung: "" });

  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch { /* egal */ } }, []);

  const ziel = FANGZIELE.find(f => f.id === REIHE[s.current.level % REIHE.length])!;

  const vorbei = useCallback((grund: string) => {
    const p = s.current.punkte;
    setLaeuft(false);
    setEnde({ punkte: p, grund });
    setBest(b => { if (p > b) { try { localStorage.setItem(BEST, String(p)); } catch { /* egal */ } return p; } return b; });
  }, []);

  useEffect(() => {
    if (!laeuft) return;
    let rahmen = 0;
    const schritt = (t: number) => {
      const z = s.current;
      const dt = z.zuletzt ? Math.min(0.05, (t - z.zuletzt) / 1000) : 0;
      z.zuletzt = t;
      const zielJetzt = FANGZIELE.find(f => f.id === REIHE[z.level % REIHE.length])!;
      const tempo = 0.16 + z.level * 0.035; // Feldhöhen pro Sekunde
      if (z.links) z.korb = Math.max(KORB / 2, z.korb - dt * 0.9);
      if (z.rechts) z.korb = Math.min(1 - KORB / 2, z.korb + dt * 0.9);
      z.naechste -= dt;
      if (z.naechste <= 0) {
        const zahl = neueZahl(zielJetzt, z.level >= 3 ? 3 : 2);
        z.tropfen.push({ id: ++z.id, x: 0.08 + Math.random() * 0.84, y: -0.08, zahl, passt: zielJetzt.passt(zahl) });
        z.naechste = Math.max(0.55, 1.4 - z.level * 0.12);
      }
      const bleiben: Tropfen[] = [];
      for (const d of z.tropfen) {
        d.y += dt * tempo;
        if (d.y >= 0.86 && d.y < 0.95 && Math.abs(d.x - z.korb) < KORB / 2 + 0.03) {
          if (d.passt) {
            z.punkte += 10 + z.level * 2; z.treffer++; z.meldung = "";
            if (z.treffer % 8 === 0) { z.level++; z.meldung = "⭐ Neues Ziel!"; z.tropfen = []; break; }
          } else {
            z.herzen--; z.meldung = `Autsch: ${begruendung(d.zahl)}`;
            if (z.herzen <= 0) { cancelAnimationFrame(rahmen); vorbei(z.meldung); return; }
          }
          continue;
        }
        if (d.y < 1.05) bleiben.push(d);
      }
      if (z.tropfen.length) z.tropfen = bleiben;
      setTakt(n => n + 1);
      rahmen = requestAnimationFrame(schritt);
    };
    rahmen = requestAnimationFrame(schritt);
    const unten = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { s.current.links = true; e.preventDefault(); }
      if (e.key === "ArrowRight") { s.current.rechts = true; e.preventDefault(); }
    };
    const oben = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") s.current.links = false;
      if (e.key === "ArrowRight") s.current.rechts = false;
    };
    window.addEventListener("keydown", unten);
    window.addEventListener("keyup", oben);
    return () => { cancelAnimationFrame(rahmen); window.removeEventListener("keydown", unten); window.removeEventListener("keyup", oben); };
  }, [laeuft, vorbei]);

  const start = () => {
    s.current = { korb: 0.5, tropfen: [], punkte: 0, herzen: 3, treffer: 0, level: 0, naechste: 0.3, id: 0, zuletzt: 0, links: false, rechts: false, meldung: "" };
    setEnde(null); setLaeuft(true);
  };
  const zeigen = (e: PointerEvent<HTMLDivElement>) => {
    const r = feld.current?.getBoundingClientRect();
    if (!r) return;
    s.current.korb = Math.min(1 - KORB / 2, Math.max(KORB / 2, (e.clientX - r.left) / r.width));
  };

  const z = s.current;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-sm font-bold">
        <span>🎯 Fange: <span className="text-accent">{ziel.text}</span></span>
        <span>{z.punkte} Punkte</span>
        <span aria-label={`${z.herzen} Herzen`}>{"❤️".repeat(Math.max(0, z.herzen))}</span>
        {best > 0 && <span className="text-muted font-normal">Rekord: {best}</span>}
      </div>
      <div ref={feld} className="relative w-full overflow-hidden rounded-2xl border-2 border-line touch-none select-none"
        style={{ height: "26rem", background: "linear-gradient(var(--color-page), var(--color-surface))" }}
        onPointerMove={zeigen} onPointerDown={zeigen}>
        {z.tropfen.map(d => (
          <div key={d.id} className="absolute -translate-x-1/2 rounded-xl bg-surface border-2 px-2 py-1 shadow"
            style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, borderColor: FARBE[kleinsterBereich(d.zahl)] + "88" }}>
            <ZahlAnzeige x={d.zahl} />
          </div>
        ))}
        <div className="absolute bottom-2 -translate-x-1/2 h-10 rounded-b-3xl rounded-t-md border-4 border-accent bg-accent/20 flex items-center justify-center text-2xl"
          style={{ left: `${z.korb * 100}%`, width: `${KORB * 100}%` }} aria-hidden>🧺</div>
        {z.meldung && laeuft && <p className="absolute top-2 inset-x-2 text-center text-sm font-bold bg-surface/90 rounded-lg p-1">{z.meldung}</p>}
        {!laeuft && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/80 p-4 text-center">
            <h3 className="font-black text-xl">🌧️ Zahlenregen</h3>
            {ende ? <p className="font-bold">{ende.punkte} Punkte. {ende.grund}</p>
              : <p className="text-sm max-w-md">Fange nur die Zahlen, die oben verlangt werden — mit Maus, Finger oder den Pfeiltasten. Eine falsche kostet ein Herz. Alle 8 Treffer kommt ein neues Ziel, und es regnet schneller.</p>}
            <button className="btn-primary" onClick={start}>{ende ? "Nochmal" : "▶ Los"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
