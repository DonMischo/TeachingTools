"use client";
/** Turmverteidigung: Gegner (offene Challenges) kreisen dekorativ; Fakten werden als Türme gebaut, »Feuer!« wertet. */
import { useEffect, useRef, useState } from "react";
import type { ChallengeAntwort, ChallengeAufgabe } from "@/lib/api";
import type { ModusProps } from "./typen";
import { PixelMatrix } from "../pixel/Matrix";
import { Ablage, FaktKarte, Herzen, Inhalt, Treffermeldung } from "./teile";
import Sammeln, { Buehne, ModusStil, wenigerBewegung, type Ort } from "./turm/Buehne";

const GEGNER = ["...mmmm...", "..mmmmmm..", ".mmmmmmmm.", ".mwwmmwwm.", ".mwkmmwkm.", ".mmmmmmmm.", ".mmkkkkmm.", ".mmmmmmmm.", ".m.m..m.m."];
const GEGNER_FARBEN = { m: "#8e44ad", w: "#ffffff", k: "#222222" };
const TURM = [".s.ss.s.", ".ssssss.", "..bbbb..", "..bwwb..", "..bbbb..", "..bwwb..", "..bbbb..", ".bbbbbb."];
const TURM_FARBEN = { s: "#c0392b", b: "#95a5a6", w: "#34495e" };
const ORTE: Ort[] = [{ emoji: "📦", name: "Truhe" }, { emoji: "🪵", name: "Baumstumpf" }, { emoji: "🌿", name: "Busch" }, { emoji: "🪨", name: "Felsen" }];

export default function Turm({ brett, theme, lauf, zurKarte }: ModusProps) {
  const [gefunden, setGefunden] = useState<string[]>([]);
  const [spiel, setSpiel] = useState(false);
  const [aktiv, setAktiv] = useState<ChallengeAufgabe | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<ChallengeAntwort | null>(null);
  const [sende, setSende] = useState(false);
  const [winkel, setWinkel] = useState(0);

  const pausiert = !spiel || !!aktiv;
  const letzte = useRef(0);
  useEffect(() => {
    if (pausiert || wenigerBewegung()) return;
    let id = 0;
    letzte.current = performance.now();
    const schritt = (t: number) => {
      if (!document.hidden) setWinkel((w) => w + (t - letzte.current) * 0.0003);
      letzte.current = t;
      id = requestAnimationFrame(schritt);
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, [pausiert]);

  const offene = brett.challenges.filter((c) => !c.erledigt);
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const inventar = brett.fakten.filter((f) => gefunden.includes(f.id) && !ablage.includes(f.id));

  const waehle = (c: ChallengeAufgabe) => { setAktiv(c); setAblage([]); setTipp(false); setErgebnis(null); lauf.waehle(c.id); };
  const schliesse = () => { setAktiv(null); setAblage([]); setTipp(false); setErgebnis(null); };
  const baue = (id: string) => {
    if (ablage.includes(id) || !gefunden.includes(id) || !fakten.has(id)) return;
    lauf.gelegt();
    setAblage([...ablage, id]);
  };
  const feuer = async () => {
    if (!aktiv || !ablage.length || sende) return;
    setSende(true);
    try { setErgebnis(await lauf.antworte(aktiv.id, ablage, tipp)); }
    catch { schliesse(); }
    finally { setSende(false); }
  };

  const kopf = (
    <div className="flex items-center justify-between">
      <Herzen leben={brett.leben} />
      <button className="btn-secondary" onClick={zurKarte}>Karte</button>
    </div>
  );

  if (!spiel) {
    return (
      <>
        {kopf}
        <ModusStil />
        <h2 className="font-bold">Baumaterial sammeln</h2>
        <Sammeln fakten={brett.fakten} gefunden={gefunden} orte={ORTE} verb="durchsuchen" bg={theme.hintergrund} farbe={theme.farben.boden}
          onFinde={(id) => setGefunden((g) => (g.includes(id) ? g : [...g, id]))}
          onAlle={() => setGefunden(brett.fakten.map((f) => f.id))} onWeiter={() => setSpiel(true)} />
      </>
    );
  }

  const klasse = ergebnis ? (ergebnis.komplett ? "ch-an ch-boom" : ergebnis.treffer ? "ch-an ch-taumel" : "") : "";
  const bruch = ergebnis && !ergebnis.treffer ? "ch-an ch-bruch" : "";
  return (
    <>
      {kopf}
      <ModusStil />
      <Buehne bg={theme.hintergrund} farbe={theme.farben.boden} label="Gegner">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <ellipse cx="50" cy="50" rx="38" ry="34" fill="none" stroke="#c9a66b" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        </svg>
        {offene.map((c, i) => {
          const w = winkel + (i * 2 * Math.PI) / offene.length;
          return (
            <button key={c.id} onClick={() => waehle(c)} aria-pressed={c.id === aktiv?.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center focus-visible:outline-2 focus-visible:outline-accent rounded"
              style={{ left: `${50 + 38 * Math.cos(w)}%`, top: `${50 + 34 * Math.sin(w)}%` }}>
              <PixelMatrix bild={GEGNER} palette={GEGNER_FARBEN} scale={3} />
              <span className="bg-surface text-fg rounded px-1 text-[11px] leading-tight max-w-[130px] line-clamp-2">{c.text}</span>
            </button>
          );
        })}
      </Buehne>
      {offene.length > 0 && !aktiv && <p className="text-muted">Tippe einen Gegner an, um Türme zu bauen.</p>}

      {aktiv && (
        <div className="card p-3 flex flex-col gap-2" aria-label="Bauplatz">
          <div className="flex items-start gap-3">
            <span className={klasse}><PixelMatrix bild={GEGNER} palette={GEGNER_FARBEN} scale={4} /></span>
            <div className="font-bold"><Inhalt x={aktiv} /></div>
          </div>
          <div className={`flex gap-1 min-h-8 ${bruch}`} aria-hidden>{ablage.map((id) => <PixelMatrix key={id} bild={TURM} palette={TURM_FARBEN} scale={3} />)}</div>
          {ergebnis ? (
            <>
              <Treffermeldung antwort={ergebnis} />
              <button className="btn-primary self-start" onClick={schliesse}>Weiter</button>
            </>
          ) : (
            <>
              <Ablage karten={ablage.map((id) => fakten.get(id)!)} leer="Lege Fakten als Türme auf den Bauplatz."
                onLege={baue} onNimm={(id) => setAblage(ablage.filter((x) => x !== id))} />
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={!ablage.length || sende} onClick={feuer}>Feuer!</button>
                {aktiv.tip && (tipp ? <span className="text-muted self-center">💡 {aktiv.tip}</span>
                  : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
                <button className="btn-secondary" onClick={schliesse}>Abbrechen</button>
              </div>
            </>
          )}
        </div>
      )}

      {aktiv && !ergebnis && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
          {inventar.map((f) => <FaktKarte key={f.id} fakt={f} onClick={() => baue(f.id)} />)}
        </div>
      )}
    </>
  );
}
