"use client";
/**
 * Der Ablauf einer Rallye-Runde.
 *
 * Als Hook, weil zwei Teile daran hängen: die Antwort kommt aus dem Raster
 * (Klick auf ein Feld), angezeigt wird sie in der Seitenspalte.
 *
 * Der Stand wird erst geladen und danach bei jeder Änderung geschrieben.
 * Geladen wird genau einmal — ein Speichern vor dem Laden würde den alten
 * Stand löschen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ladeStand, LEERER_STAND, nachAntwort, nachRunde, neueErfolge, PUNKTE_JE_RUNDE,
  speichereStand, sterneFuer, type Erfolg, type Stand,
} from "@/lib/pse/erfolge";
import {
  istRichtig, naechsteAufgabe, punkteFuer, RUNDE, urteil, type Aufgabe, type Bereich,
} from "@/lib/pse/rallye";

export type Rueckmeldung = { z: number; richtig: boolean } | null;

export interface Rallye {
  aufgabe: Aufgabe | null;
  /** Nummer der laufenden Aufgabe, 1-basiert. */
  nummer: number;
  punkte: number;
  /** Fehlversuche bei der laufenden Aufgabe. */
  versuche: number;
  rueckmeldung: Rueckmeldung;
  /** Steht die Lösung schon fest? Dann wartet die Runde auf »weiter«. */
  geloest: boolean;
  /** Ergebnis am Rundenende. */
  ergebnis: { punkte: number; sterne: number; text: string; erfolge: Erfolg[] } | null;
  stand: Stand;
  bereich: Bereich;
  setBereich: (b: Bereich) => void;
  antworte: (z: number) => void;
  weiter: () => void;
  neueRunde: () => void;
  aufgeben: () => void;
}

export function useRallye(): Rallye {
  const [bereich, setBereichRoh] = useState<Bereich>("schule");
  const [stand, setStand] = useState<Stand>(LEERER_STAND);
  const [geladen, setGeladen] = useState(false);
  const [aufgabe, setAufgabe] = useState<Aufgabe | null>(null);
  const [nummer, setNummer] = useState(1);
  const [punkte, setPunkte] = useState(0);
  const [versuche, setVersuche] = useState(0);
  const [rueckmeldung, setRueckmeldung] = useState<Rueckmeldung>(null);
  const [geloest, setGeloest] = useState(false);
  const [ergebnis, setErgebnis] = useState<Rallye["ergebnis"]>(null);
  const letzteArt = useRef<Aufgabe["art"] | undefined>(undefined);

  useEffect(() => { setStand(ladeStand()); setGeladen(true); }, []);
  useEffect(() => { if (geladen) speichereStand(stand); }, [stand, geladen]);

  const stelle = useCallback((b: Bereich) => {
    const a = naechsteAufgabe(b, Math.random, letzteArt.current);
    letzteArt.current = a.art;
    setAufgabe(a);
    setVersuche(0);
    setRueckmeldung(null);
    setGeloest(false);
  }, []);

  const neueRunde = useCallback(() => {
    setNummer(1);
    setPunkte(0);
    setErgebnis(null);
    stelle(bereich);
  }, [bereich, stelle]);

  const setBereich = useCallback((b: Bereich) => {
    setBereichRoh(b);
    // Ein anderer Bereich heißt eine andere Runde — sonst zählten Aufgaben
    // aus zwei Schwierigkeiten in dieselbe Wertung.
    setNummer(1);
    setPunkte(0);
    setErgebnis(null);
    stelle(b);
  }, [stelle]);

  const antworte = useCallback((z: number) => {
    if (!aufgabe || geloest || ergebnis) return;
    if (!istRichtig(aufgabe, z)) {
      setVersuche(v => v + 1);
      setRueckmeldung({ z, richtig: false });
      return;
    }
    const gewonnen = punkteFuer(versuche + 1);
    setPunkte(p => p + gewonnen);
    setRueckmeldung({ z, richtig: true });
    setGeloest(true);
    setStand(s => nachAntwort(s, aufgabe.art, z, gewonnen, versuche === 0));
  }, [aufgabe, geloest, ergebnis, versuche]);

  const weiter = useCallback(() => {
    if (nummer >= RUNDE) {
      const sterne = sterneFuer(punkte, PUNKTE_JE_RUNDE);
      setStand(s => {
        const nach = nachRunde(s, bereich, sterne);
        const neu = neueErfolge(nach);
        setErgebnis({
          punkte, sterne, text: urteil(punkte, PUNKTE_JE_RUNDE), erfolge: neu,
        });
        return { ...nach, erfolge: [...nach.erfolge, ...neu.map(e => e.id)] };
      });
      setAufgabe(null);
      return;
    }
    setNummer(n => n + 1);
    stelle(bereich);
  }, [nummer, punkte, bereich, stelle]);

  /** Aufgeben zeigt die Lösung, bringt aber keinen Punkt. */
  const aufgeben = useCallback(() => {
    if (!aufgabe || geloest) return;
    setGeloest(true);
    setRueckmeldung(null);
    setVersuche(v => v + 1);
    setStand(s => ({ ...s, serieJetzt: 0 }));
  }, [aufgabe, geloest]);

  return {
    aufgabe, nummer, punkte, versuche, rueckmeldung, geloest, ergebnis,
    stand, bereich, setBereich, antworte, weiter, neueRunde, aufgeben,
  };
}
