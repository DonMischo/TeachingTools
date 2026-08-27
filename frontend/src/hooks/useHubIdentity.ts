"use client";
import { useEffect, useRef } from "react";
import { readPlayIdentity, clearPlayIdentity, type PlayIdentity } from "@/lib/playIdentity";

/**
 * Verbraucht die im Playhub gewählte Identität — genau einmal.
 *
 * Wer über /play kommt, hat Name und Avatar schon angegeben; die Werkzeugseite
 * tritt damit still bei, statt dieselben Fragen noch einmal zu stellen. Wer den
 * QR direkt scannt, hat keinen Eintrag — dann passiert hier nichts und das
 * Werkzeug zeigt sein eigenes Formular.
 *
 * Der Eintrag wird vor dem Beitritt gelöscht: schlägt der fehl, landet der
 * Spieler im normalen Formular statt in einer Schleife.
 */
export function useHubIdentity(code: string, ready: boolean, join: (identity: PlayIdentity) => void) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    const identity = readPlayIdentity(code);
    if (!identity) return;
    done.current = true;
    clearPlayIdentity(code);
    join(identity);
  }, [code, ready, join]);
}
