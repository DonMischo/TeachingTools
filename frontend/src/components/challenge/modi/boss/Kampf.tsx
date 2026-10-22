"use client";
/**
 * Klicker-Kampf gegen ein Mini-Monster: 5 Treffer. Das Monster schlägt im Takt zurück (Ankündigung ~0,4 s vorher;
 * ein Klick währenddessen pariert). Bei 0 KP wird der Held zurückgedrängt - ohne Folgen für die Wissenswertung.
 * Der Besiegte lässt seine Fakten fallen.
 */
import { useEffect, useRef, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { Sprite, type Frame } from "@/components/challenge/pixel/Sprite";
import { Inhalt } from "../teile";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { Szene, type Anim, type Zahl } from "./Szene";
import { LebensBalken } from "@/components/challenge/LebensBalken";
import { EP_SIEG, epBalken, levelVon } from "@/lib/challenge/bossKarte";

const LOG = "/challenge/pixel/gfx/log.png";
const IDLE: Frame[] = Array.from({ length: 4 }, (_, i) => ({ x: i * 32, y: 64, w: 32, h: 32 }));
const LAUF = { frames: IDLE, fps: 4 };
export const SCHLAEGE = 5;
export const HELD_KP = 30;
export const SCHADEN = 5;
const TAKT = 100;
/** Pause zwischen zwei Angriffen: später und bei zäheren Monstern schneller, nie unter 1,2 s. */
export const angriffsPause = (stufe: number, zaehe: number) => Math.max(1200, 2000 - 150 * (stufe - 1) - 150 * zaehe);

export default function Kampf({ theme, fakten, ep = 0, stufe = 1, zaehe = 0, onSieg, onEnde, onVerloren }: {
  theme: ThemeDef; fakten: ChallengeFakt[]; ep?: number; stufe?: number; zaehe?: number; onSieg(): void; onEnde(): void; onVerloren?(): void;
}) {
  const ep0 = useRef(ep);
  const [kp, setKp] = useState(HELD_KP);
  const [ansage, setAnsage] = useState(false);
  const [meldung, setMeldung] = useState("");
  const langsam = useRef(wenigerBewegung()).current;
  const uhr = useRef({ ms: langsam ? 0 : -1600, ansage: false }); // beim Kampfstart-Übergang läuft noch keine Uhr
  const pause = angriffsPause(stufe, zaehe) * (langsam ? 1.6 : 1);
  const ansageMs = langsam ? 700 : 400;
  const [hp, setHp] = useState(SCHLAEGE);
  const [n, setN] = useState(0);
  const [held, setHeld] = useState<Anim>(null);
  const [gegner, setGegner] = useState<Anim>(null);
  const [zahlen, setZahlen] = useState<Zahl[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nachher = (f: () => void, ms: number) => { timer.current.push(setTimeout(f, ms)); };
  useEffect(() => () => timer.current.forEach(clearTimeout), []);

  const sieg = hp <= 0;
  const verloren = kp <= 0 && !sieg;
  const aus = sieg || verloren;
  const ausRef = useRef(aus);
  ausRef.current = aus;

  // Angriffs-Uhr: zählt nur bei sichtbarem Tab; erst Ankündigung, dann Schlag
  useEffect(() => {
    const id = setInterval(() => {
      if (ausRef.current || (typeof document !== "undefined" && document.hidden)) return;
      const u = uhr.current;
      u.ms += TAKT;
      if (!u.ansage && u.ms >= pause) {
        u.ansage = true; u.ms = 0; setAnsage(true); setMeldung("Der Holzklotz holt aus!");
        if (!langsam) setGegner({ art: "wackel", n: Date.now() });
      } else if (u.ansage && u.ms >= ansageMs) {
        u.ansage = false; u.ms = 0; setAnsage(false);
        setHeld({ art: "treffer", n: Date.now() });
        setKp((k) => Math.max(0, k - SCHADEN));
        setMeldung(`Der Holzklotz trifft dich! −${SCHADEN} KP`);
      }
    }, TAKT);
    return () => clearInterval(id);
  }, [pause, ansageMs, langsam]);

  const angreifen = () => {
    if (aus) return;
    if (uhr.current.ansage) { uhr.current = { ms: 0, ansage: false }; setAnsage(false); setMeldung("Pariert!"); }
    const k = n + 1, rest = hp - 1;
    setN(k); setHp(rest);
    setHeld({ art: "lunge", n: k });
    setGegner({ art: rest <= 0 ? "weg" : "treffer", n: k });
    const z: Zahl = { id: k, wert: 3 + ((k * 7) % 5) };
    setZahlen((l) => [...l, z]);
    nachher(() => setZahlen((l) => l.filter((x) => x.id !== z.id)), 900);
    if (rest <= 0) onSieg();
    else if (k % 3 === 0) nachher(() => setGegner({ art: "lunge", n: 100 + k }), 450); // harmloser Konter
  };

  // Leertaste/Enter greifen auch an, wenn der Knopf den Fokus nicht hat
  const angriffRef = useRef(angreifen);
  angriffRef.current = angreifen;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.key !== " " && e.key !== "Enter") || (e.target as HTMLElement)?.closest?.("button,input,textarea,select,a")) return;
      e.preventDefault(); angriffRef.current();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const aufstieg = levelVon(ep0.current + EP_SIEG) > levelVon(ep0.current);
  const bal = epBalken(ep);
  const sp = theme.spieler;
  const rf = sp.laufen.rechts[0];
  const text = verloren ? "Du wurdest zurückgedrängt." : sieg ? "Der Holzklotz ist besiegt!" : n === 0 ? "Was tust du?" : `Du triffst den Holzklotz! Noch ${hp} von ${SCHLAEGE}.`;
  const himmel = theme.farben.himmel === "transparent" ? undefined : theme.farben.himmel;
  const boden = theme.farben.boden === "transparent" ? undefined : theme.farben.boden;

  return (
    <Szene introText="Ein wilder Holzklotz erscheint!" himmel={himmel} boden={boden}
      held={<Sprite src={sp.src} frame={rf} scale={rf.h >= 32 ? 4 : 7} label="Held" />}
      gegner={<Sprite src={LOG} frame={IDLE[0]} animation={LAUF} scale={3.5} label="Holzklotz" />}
      heldName={`Held Lv. ${bal.level}`} heldEp={{ wert: bal.wert, max: bal.max }} gegnerName="Holzklotz" hp={hp} hpMax={SCHLAEGE}
      heldAnim={held} gegnerAnim={gegner} zahlen={zahlen} onGegnerClick={angreifen}>
      <p className="font-bold">{text}</p>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold">KP</span>
        <LebensBalken wert={kp} max={HELD_KP} label="Lebenspunkte des Helden" className="h-3 w-40 rounded" />
        <span>{kp}/{HELD_KP}</span>
        {ansage && <span className="font-bold text-bad" role="status">{langsam ? "Achtung: Angriff! Klicke jetzt, um zu parieren." : "⚠️"}</span>}
      </div>
      {meldung && !aus && <p className="text-sm text-muted" aria-live="polite">{meldung}</p>}
      {verloren ? (
        <button className="btn-primary self-start" autoFocus onClick={onVerloren ?? onEnde}>Zurück zur Karte</button>
      ) : sieg ? (
        <>
          <p className="font-bold">Du erhältst {EP_SIEG} EP!</p>
          {aufstieg && <p className="font-bold text-good" role="status">♪ Ta-ta-ta-taaa! Der Held steigt auf Level {levelVon(ep0.current + EP_SIEG)} auf!</p>}
          <p className="text-good font-bold">Er lässt {fakten.length > 1 ? "Fakten" : "einen Fakt"} fallen!</p>
          {fakten.map((f) => (
            <div key={f.id}><Inhalt x={f} />{f.info && <p className="text-muted text-sm">{f.info.text}</p>}</div>
          ))}
          <button className="btn-secondary self-start" autoFocus onClick={onEnde}>Weiter</button>
        </>
      ) : (
        <button className="btn-primary self-start" autoFocus onClick={angreifen}>Angreifen</button>
      )}
    </Szene>
  );
}
