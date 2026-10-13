"use client";
/**
 * Turmverteidigung (nach Kingdom Rush / Bloons): Der Pfad ist der längste Weg eines Markov-Labyrinths.
 * Türme auf Bauplätzen schießen Schwärme ab (Gold); die gepanzerten Anführer (offene Challenges)
 * bricht nur Wissen: anklicken, Fakten legen, »Feuer!« = antworte.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { ChallengeAntwort, ChallengeAufgabe } from "@/lib/api";
import type { ModusProps } from "./typen";
import { PixelMatrix } from "../pixel/Matrix";
import Bestenliste from "../Bestenliste";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import { bauplaetze, laengsterPfad, markovKarte } from "@/lib/challenge/markovKarte";
import {
  ausbauPreis, anfuehrerFaellt, kaufe, MAX_STUFE, neuerZustand, punkt, schritt, SPIELWERT_MAX, spielpunkte,
  startWelle, TURM_DATEN, verbessere, wellePossible, type TurmArt,
} from "@/lib/challenge/turmSpiel";

const SCHWARM = ["..mmmm..", ".mmmmmm.", ".mwmmwm.", ".mkmmkm.", ".mmmmmm.", ".m.mm.m."];
const SCHWARM_F = { m: "#8e44ad", w: "#ffffff", k: "#222222" };
const ANFUEHRER = ["..sssss..", ".sSSSSSs.", "sSgggggSs", "sSgwggwSs", "sSggkkgSs", "sSgggggSs", ".sSSSSSs.", "..sSsSs.."];
const ANFUEHRER_F = { s: "#5d6d7e", S: "#aab7b8", g: "#c0392b", w: "#ffffff", k: "#222222" };
const ART: TurmArt[] = ["pfeil", "kanone", "magie"];
const WAND = "#2f5d34", BODEN = "#6aa84f", PFAD = "#d9b96b";

export default function Turm({ brett, lauf, zurKarte }: ModusProps) {
  const seed = brett.etappe * 97 + brett.fakten.length * 13 + 5;
  const karte = useMemo(() => markovKarte(seed, 6, "labyrinth"), [seed]);
  const pfad = useMemo(() => laengsterPfad(karte), [karte]);
  const plaetze = useMemo(() => bauplaetze(karte, pfad, 6), [karte, pfad]);
  const R = karte.R;

  const z = useRef(neuerZustand());
  const gestartet = useRef(new Set<string>());
  const [, setTakt] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState<1 | 2>(1);
  const [platz, setPlatz] = useState<number | null>(null);
  const [aktiv, setAktiv] = useState<ChallengeAufgabe | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [gefallen, setGefallen] = useState<string[]>([]);
  const [liste, setListe] = useState(false);

  const offene = brett.challenges.filter((c) => !c.erledigt && !gefallen.includes(c.id));
  const offeneRef = useRef(offene);
  offeneRef.current = offene;
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const pausiert = !!aktiv;

  // Spielschleife (pausiert beim Öffnen eines Anführers und bei verdecktem Tab)
  useEffect(() => {
    if (pausiert) return;
    let id = 0, letzte = performance.now();
    const lauf_ = (t: number) => {
      const dt = Math.min(0.05, (t - letzte) / 1000);
      letzte = t;
      if (!document.hidden) { schritt(z.current, pfad, plaetze, dt * tempo); setTakt((n) => n + 1); }
      id = requestAnimationFrame(lauf_);
    };
    id = requestAnimationFrame(lauf_);
    return () => cancelAnimationFrame(id);
  }, [pausiert, tempo, pfad, plaetze]);

  // Spielpunkte melden (gedrosselt, beim Unmount zuletzt)
  const letzterWert = useRef(0);
  const gesendet = useRef(0);
  const meldeRef = useRef<() => void>(() => {});
  meldeRef.current = () => {
    if (letzterWert.current === gesendet.current) return;
    gesendet.current = letzterWert.current;
    void lauf.spielwert?.("turm", brett.etappe, letzterWert.current, SPIELWERT_MAX);
  };
  letzterWert.current = spielpunkte(z.current);
  useEffect(() => {
    const t = setInterval(() => meldeRef.current(), 5000);
    return () => { clearInterval(t); meldeRef.current(); };
  }, []);

  const welle = () => {
    if (!wellePossible(z.current)) return;
    const neu = offeneRef.current.filter((c) => !gestartet.current.has(c.id)).slice(0, 1).map((c) => c.id);
    neu.forEach((id) => gestartet.current.add(id));
    startWelle(z.current, neu);
    setLaeuft(true);
    setTakt((n) => n + 1);
  };

  const waehle = (c: ChallengeAufgabe) => { setAktiv(c); setAblage([]); setTipp(false); setErgebnis(null); lauf.waehle(c.id); };
  const schliesse = () => { setAktiv(null); setAblage([]); setTipp(false); setErgebnis(null); };
  const lege = (id: string) => {
    if (ablage.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const feuer = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    try {
      const r = await lauf.antworte(aktiv.id, ablage, tipp);
      setErgebnis(r);
      if (r.komplett) { anfuehrerFaellt(z.current, aktiv.id); setGefallen((g) => [...g, aktiv.id]); }
    } catch { schliesse(); }
    finally { setSende(false); }
  };

  const feld = useMemo(() => {
    const auf = new Set(pfad.map(([x, y]) => y * R + x));
    const k: ReactElement[] = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      k.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02}
        fill={auf.has(y * R + x) ? PFAD : karte.begehbar([x, y]) ? BODEN : WAND} />);
    }
    return k;
  }, [karte, pfad, R]);

  const s = z.current;
  const pos = (p: [number, number]) => ({ left: `${(p[0] / R) * 100}%`, top: `${(p[1] / R) * 100}%` });
  const burg = pfad[pfad.length - 1];
  const turmAuf = platz !== null ? s.tuerme.find((t) => t.platz === platz) : undefined;

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Herzen leben={brett.leben} />
        <span className="font-bold" aria-label="Gold">🪙 {s.gold}</span>
        <span aria-label="Burg">🏰 {"❤".repeat(s.burg)}<span className="opacity-30">{"❤".repeat(s.burgMax - s.burg)}</span></span>
        <span>Welle {s.welle}</span>
        <div className="flex gap-2">
          {lauf.hatBestenliste && <button className="btn-secondary" aria-expanded={liste} onClick={() => setListe(!liste)}>🏆 Bestenliste</button>}
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
      </div>
      {liste && <div className="card p-3" role="dialog" aria-label="Bestenliste"><Bestenliste laden={lauf.bestenliste} spiel="turm" /></div>}

      <div className="relative mx-auto w-full max-w-[640px] aspect-square rounded-lg overflow-hidden" role="group" aria-label="Schlachtfeld">
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${R} ${R}`} aria-hidden>
          {feld}
          {s.schuesse.map((sh, i) => (
            <line key={i} x1={sh.von[0]} y1={sh.von[1]} x2={sh.nach[0]} y2={sh.nach[1]} stroke={TURM_DATEN[sh.art].farbe} strokeWidth={sh.art === "kanone" ? 0.25 : 0.12} />
          ))}
        </svg>
        <span className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl" style={pos([burg[0] + 0.5, burg[1] + 0.5])} aria-hidden>🏰</span>
        {plaetze.map((p, i) => {
          const t = s.tuerme.find((x) => x.platz === i);
          return (
            <button key={i} aria-label={t ? `${TURM_DATEN[t.art].name}, Stufe ${t.stufe}` : `Bauplatz ${i + 1}`} aria-pressed={platz === i}
              onClick={() => setPlatz(platz === i ? null : i)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-7 h-7 flex items-center justify-center text-base focus-visible:outline-2 focus-visible:outline-accent ${platz === i ? "ring-2 ring-white" : ""} ${t ? "bg-black/50" : "border-2 border-dashed border-white/80"}`}
              style={pos([p[0] + 0.5, p[1] + 0.5])}>
              {t ? <span aria-hidden>{TURM_DATEN[t.art].emoji}<sup className="text-[9px] text-white">{t.stufe}</sup></span> : <span aria-hidden className="text-white/80 text-xs">＋</span>}
            </button>
          );
        })}
        {s.gegner.map((g) => {
          const p = punkt(pfad, g.t);
          if (!g.anfuehrer) {
            return (
              <span key={g.id} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={pos(p)} aria-hidden>
                <PixelMatrix bild={SCHWARM} palette={SCHWARM_F} scale={2} />
                <span className="block h-[3px] bg-red-600 mt-px" style={{ width: `${Math.max(0, (g.hp / g.max) * 100)}%` }} />
              </span>
            );
          }
          const c = brett.challenges.find((x) => x.id === g.anfuehrer);
          if (!c) return null;
          return (
            <button key={g.id} onClick={() => waehle(c)} aria-label={`Anführer: ${c.text}`} aria-pressed={c.id === aktiv?.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center focus-visible:outline-2 focus-visible:outline-accent rounded" style={pos(p)}>
              <PixelMatrix bild={ANFUEHRER} palette={ANFUEHRER_F} scale={3} />
              <span className="bg-surface text-fg rounded px-1 text-[11px] leading-tight max-w-[110px] line-clamp-2">🛡 {c.text}</span>
            </button>
          );
        })}
        {!laeuft && <p className="absolute inset-x-0 bottom-2 text-center text-white text-sm drop-shadow">Baue Türme auf den Bauplätzen und starte die erste Welle.</p>}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn-primary" disabled={!wellePossible(s) || !!aktiv} onClick={welle}>{s.welle === 0 ? "Welle starten" : "Nächste Welle"}</button>
        <button className="btn-secondary" aria-pressed={tempo === 2} onClick={() => setTempo(tempo === 1 ? 2 : 1)}>{tempo === 1 ? "1×" : "2×"}</button>
        {offene.length === 0 && <span className="text-good font-bold">Alle Anführer sind gefallen!</span>}
        {offene.length > 0 && !aktiv && <span className="text-muted">Anführer (🛡) bricht nur Wissen: anklicken!</span>}
      </div>

      {platz !== null && !aktiv && (
        <div className="card p-3 flex flex-wrap gap-2 items-center" aria-label="Baumenü">
          {turmAuf ? (
            <>
              <strong>{TURM_DATEN[turmAuf.art].name} (Stufe {turmAuf.stufe})</strong>
              {turmAuf.stufe < MAX_STUFE
                ? <button className="btn-primary" disabled={s.gold < ausbauPreis(turmAuf)} onClick={() => { verbessere(s, platz); setTakt((n) => n + 1); }}>Verbessern ({ausbauPreis(turmAuf)} 🪙)</button>
                : <span className="text-muted">Höchste Stufe</span>}
            </>
          ) : ART.map((a) => (
            <button key={a} className="btn-secondary" disabled={s.gold < TURM_DATEN[a].preis} onClick={() => { kaufe(s, platz, a); setTakt((n) => n + 1); }}>
              {TURM_DATEN[a].emoji} {TURM_DATEN[a].name} ({TURM_DATEN[a].preis} 🪙)
            </button>
          ))}
        </div>
      )}

      {aktiv && (
        <div className="card p-3 flex flex-col gap-2" aria-label="Wissensfeld">
          <div className={`flex items-start gap-3 ${ergebnis?.komplett ? "motion-safe:animate-pulse" : ""}`}>
            <PixelMatrix bild={ANFUEHRER} palette={ANFUEHRER_F} scale={4} />
            <div className="font-bold"><Inhalt x={aktiv} /></div>
          </div>
          {ergebnis ? (
            <>
              <Treffermeldung antwort={ergebnis} />
              {ergebnis.komplett && <p className="text-good font-bold">Die Panzerung bricht – der Anführer fällt! +40 🪙</p>}
              <button className="btn-primary self-start" onClick={schliesse}>Weiter</button>
            </>
          ) : (
            <>
              <Ablage karten={ablage.map((id) => fakten.get(id)!)} leer="Lege Fakten als Geschosse bereit."
                onLege={lege} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={feuer}>Feuer!</button>
                {aktiv.tip && (tipp ? <span className="text-muted self-center">💡 {aktiv.tip}</span>
                  : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
                <button className="btn-secondary" onClick={schliesse}>Abbrechen</button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
                {brett.fakten.filter((f) => !ablage.includes(f.id)).map((f) => <FaktKarte key={f.id} fakt={f} onClick={() => lege(f.id)} />)}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
