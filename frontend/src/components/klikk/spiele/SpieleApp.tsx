"use client";
/**
 * »Klikk Games« auf dem Handy: Klicker und Doppelklicker aus dem
 * Maus-Führerschein (gleiche Bestenliste), dazu Blockregen, Würfelsprung und
 * Lichtschalter mit eigener Bestenliste. Jede Runde kostet Spielzeit.
 */
import { useCallback, useEffect, useState } from "react";
import Klickspiel from "@/components/maus/Klickspiel";
import { GRENZEN } from "@/lib/maus/ergebnis";
import { api, type KlikkSpiel, type MausZugang } from "@/lib/api";
import { merkeOrt, spielRunde } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";
import Bloecke from "./Bloecke";
import Sprung from "./Sprung";
import Logik from "./Logik";
import TeilenKnopf from "../Teilen";

type Setze = (f: (s: Stand) => Stand) => void;
export type Online = { zugang?: MausZugang; konto: boolean };

type SpielId = "klick" | "doppelklick" | KlikkSpiel;
const SPIELE: { id: SpielId; name: string; emoji: string; text: string; einheit: string }[] = [
  { id: "klick", name: "Klicker", emoji: "🎯", text: "Ziele so schnell wie möglich anklicken", einheit: "Punkte" },
  { id: "doppelklick", name: "Doppelklicker", emoji: "✌️", text: "Nur Doppelklicks zählen", einheit: "Punkte" },
  { id: "bloecke", name: "Blockregen", emoji: "🧱", text: "Fallende Blöcke wegklicken", einheit: "Punkte" },
  { id: "sprung", name: "Würfelsprung", emoji: "🟨", text: "Springen, nicht in die Stacheln", einheit: "m" },
  { id: "logik", name: "Lichtschalter", emoji: "💡", text: "Alle Lichter ausschalten", einheit: "Punkte" },
];

type Zeile = { platz: number; name: string; wert: number; selbst: boolean; gast: boolean };

function Bestenliste({ spiel, online, neu }: { spiel: SpielId; online: Online; neu: number }) {
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [fehler, setFehler] = useState(false);
  const [nurSitzung, setNurSitzung] = useState(!!online.zugang);
  useEffect(() => {
    let aus = false;
    const laden = spiel === "klick" || spiel === "doppelklick"
      ? api.mausBestenliste.liste(spiel, online.zugang, nurSitzung && online.zugang ? { sitzung: online.zugang.code } : {})
      : api.klikkSpiele.liste(spiel, online.zugang, nurSitzung);
    laden.then(z => { if (!aus) { setZeilen(z.slice(0, 10)); setFehler(false); } }).catch(() => { if (!aus) setFehler(true); });
    return () => { aus = true; };
  }, [spiel, online.zugang, nurSitzung, neu]);

  if (fehler) return <p className="text-xs text-muted">Bestenliste nur mit Konto oder Beitrittscode.</p>;
  return (
    <div className="text-xs">
      <div className="flex justify-between items-center mb-1">
        <b>🏆 Bestenliste</b>
        {online.zugang && (
          <button className="underline text-muted" onClick={() => setNurSitzung(v => !v)}>{nurSitzung ? "diese Sitzung" : "alle"}</button>
        )}
      </div>
      {!zeilen ? <p className="text-muted">Lade …</p> : zeilen.length === 0 ? <p className="text-muted">Noch niemand. Sei die/der Erste!</p> : (
        <ol>
          {zeilen.map(z => (
            <li key={`${z.platz}-${z.name}`} className={`flex justify-between py-0.5 ${z.selbst ? "font-bold text-accent" : ""}`}>
              <span>{z.platz}. {z.name}{z.gast ? " (Gast)" : ""}</span><span className="tabular-nums">{z.wert}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function SpieleApp({ s, setze, online }: { s: Stand; setze: Setze; online?: Online }) {
  // Zuletzt geöffnetes Spiel: beim Wiederöffnen der App geht es dort weiter
  const spiel = (s.appOrt?.spiele ?? null) as SpielId | null;
  const setSpiel = (id: SpielId | null) => setze(st => merkeOrt(st, "spiele", id));
  const [letztes, setLetztes] = useState<{ spiel: SpielId; punkte: number; nr: number } | null>(null);
  const [neu, setNeu] = useState(0);
  const darfMelden = !!online && (online.konto || !!online.zugang);

  const melden = useCallback((id: SpielId, wert: number, dauerMs = 0, kontext = "") => {
    setze(st => spielRunde(st, id, wert));
    setLetztes(l => ({ spiel: id, punkte: wert, nr: (l?.nr ?? 0) + 1 }));
    if (!darfMelden || wert <= 0) return;
    const fertig = () => setNeu(n => n + 1);
    if (id === "klick" || id === "doppelklick") {
      api.mausBestenliste.eintragen({ modus: id, wert: Math.min(wert, GRENZEN[id]), dauer_ms: dauerMs, kontext: `Klikk · ${kontext}`, hilfe: false }, online?.zugang)
        .then(fertig).catch(() => {});
    } else {
      api.klikkSpiele.eintragen(id, wert, online?.zugang).then(fertig).catch(() => {});
    }
  }, [setze, darfMelden, online?.zugang]);

  const info = SPIELE.find(x => x.id === spiel);
  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {spiel && <button onClick={() => setSpiel(null)} aria-label="Zurück">‹</button>}
        <span className="font-black text-lg">🎮 {info ? info.name : "Klikk Games"}</span>
      </div>
      {!spiel ? (
        <div className="grid grid-cols-2 gap-2">
          {SPIELE.map(x => (
            <button key={x.id} onClick={() => setSpiel(x.id)} className="card p-3 text-left hover:bg-surface-hover">
              <div className="text-3xl">{x.emoji}</div>
              <div className="font-bold text-sm">{x.name}</div>
              <div className="text-[10px] text-muted">{x.text}</div>
            </button>
          ))}
        </div>
      ) : (
        <>
          {(spiel === "klick" || spiel === "doppelklick") && (
            <div className="klikk-klickspiel text-sm">
              <Klickspiel key={`${spiel}-${neu}`} art={spiel} kompakt onWeiter={() => setNeu(n => n + 1)}
                onFertig={e => melden(spiel, e.punkte, e.dauerMs, e.details[0] ?? "")} />
            </div>
          )}
          {spiel === "bloecke" && <Bloecke onEnde={p => melden("bloecke", p)} />}
          {spiel === "sprung" && <Sprung onEnde={p => melden("sprung", p)} />}
          {spiel === "logik" && <Logik onEnde={p => melden("logik", p)} />}
          {letztes && letztes.spiel === spiel && letztes.punkte > 0 && (
            <TeilenKnopf key={letztes.nr} s={s} setze={setze} online={online} spiel={spiel} punkte={letztes.punkte} />
          )}
          <Bestenliste spiel={spiel} online={online ?? { konto: false }} neu={neu} />
        </>
      )}
    </div>
  );
}
