"use client";
/**
 * Vorführung am Beamer: alle Klassen ohne eigenen Charakter, wie die
 * HTML-Fassung. Tasten 1–5 wählen Figuren (nochmal = andere Klasse),
 * 6 = NPC, Leertaste = Los/Pause, R = neu.
 */
import { useEffect, useState } from "react";
import type { KlasseId } from "@/lib/mainCharacter";
import { Buehne } from "./Buehne";
import { Steuerung, figurKlasse, mottoFuer } from "./Steuerung";
import { useLauf } from "./useLauf";

export function Demo() {
  const [klasse, setKlasse] = useState<KlasseId>("checker");
  const lauf = useLauf({ klasse });
  const { umschalten, neu } = lauf;

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && ["INPUT", "SELECT", "TEXTAREA"].includes(ziel.tagName)) return;
      const i = "12345".indexOf(e.key);
      if (i >= 0) setKlasse(k => figurKlasse(i, k));
      else if (e.key === "6") setKlasse("npc");
      else if (e.key === " ") { e.preventDefault(); umschalten(); }
      else if (e.key === "r" || e.key === "R") neu();
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [umschalten, neu]);

  return (
    <div className="flex flex-col gap-2">
      <Buehne klasse={klasse} stand={lauf.stand} motto={mottoFuer(klasse, lauf.ich)}
        onFigur={i => setKlasse(k => figurKlasse(i, k))}
        steuerung={<Steuerung klasse={klasse} onKlasse={setKlasse} laeuft={lauf.laeuft} onLos={umschalten} onNeu={neu} ich={lauf.ich} />} />
      <p className="text-xs text-muted">
        Tasten: 1–5 Figur (nochmal drücken = zweite Klasse), 6 NPC, Leertaste Los/Pause, R neu.
        Wechsel während des Laufs behalten die Werte — nur die Zeit wird anders verteilt.
      </p>
    </div>
  );
}
