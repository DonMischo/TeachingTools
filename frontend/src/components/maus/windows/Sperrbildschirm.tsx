"use client";
/**
 * Der Windows-11-Sperrbildschirm: großes Bild, Uhrzeit, Datum und die eigene
 * Begrüßung. Ein Klick oder eine Taste schiebt ihn weg — dann kommt die
 * Anmeldung mit Profilbild und Namen.
 *
 * Bewusst ohne Passwortfeld: Kinder sollen hier kein echtes Passwort tippen.
 * Liegt in WindowsDesktop `overlay` und deckt alles ab.
 */
import { useEffect, useRef, useState } from "react";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { hintergrundCss, type Aussehen } from "@/lib/maus/windows";

export function Sperrbildschirm({
  aussehen, benutzer, onEntsperrt, hilfe = false,
}: { aussehen: Aussehen; benutzer: string; onEntsperrt: () => void; hilfe?: boolean }) {
  const [anmelden, setAnmelden] = useState(false);
  // Erst im Browser setzen: die Seite wird auch auf dem Server vorgerendert.
  const [jetzt, setJetzt] = useState<Date | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setJetzt(new Date());
    const uhr = setInterval(() => setJetzt(new Date()), 20000);
    return () => clearInterval(uhr);
  }, []);

  // Fokus auf den Sperrbildschirm, damit »irgendeine Taste« auch wirklich ankommt.
  useEffect(() => { flaeche.current?.focus(); }, []);

  const groesse = hilfe ? 1.25 : 1;

  return (
    <div
      ref={flaeche}
      tabIndex={-1}
      data-testid="sperrbildschirm"
      onClick={() => setAnmelden(true)}
      onKeyDown={() => setAnmelden(true)}
      className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center text-white outline-none select-none"
      style={{ background: hintergrundCss(aussehen.sperrBild), cursor: "default" }}
    >
      {!anmelden ? (
        <div className="flex flex-col items-center" style={{ marginTop: "9%", textShadow: "0 2px 8px #00000080" }}>
          <span className="font-semibold tabular-nums leading-none" style={{ fontSize: `${6.5 * groesse}cqw` }}>
            {jetzt ? jetzt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </span>
          <span className="font-semibold mt-2" style={{ fontSize: `${1.9 * groesse}cqw` }}>
            {jetzt ? jetzt.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) : ""}
          </span>
          {aussehen.begruessung && (
            <span className="mt-6 rounded-xl px-4 py-2 font-bold bg-[#00000040]" style={{ fontSize: `${2.2 * groesse}cqw` }}>
              {aussehen.begruessung}
            </span>
          )}
          <span className="mt-8 opacity-90" style={{ fontSize: `${1.4 * groesse}cqw` }}>
            Klicke oder drücke eine Taste
          </span>
        </div>
      ) : (
        <div className="flex-1 w-full flex flex-col items-center justify-center gap-3 backdrop-blur-xl bg-[#00000033]">
          <div className="rounded-full overflow-hidden flex items-center justify-center bg-[#ffffff33]" style={{ width: `${12 * groesse}cqw`, height: `${12 * groesse}cqw` }}>
            {aussehen.profilTier
              ? <AvatarDisplay avatarId={aussehen.profilTier} size="lg" />
              : <span style={{ fontSize: `${6 * groesse}cqw` }}>🙂</span>}
          </div>
          <span className="font-bold" style={{ fontSize: `${2.4 * groesse}cqw` }}>{benutzer}</span>
          <button
            type="button"
            data-testid="anmelden"
            onClick={e => { e.stopPropagation(); onEntsperrt(); }}
            className="rounded-md font-semibold bg-[#ffffff33] hover:bg-[#ffffff4d] border border-[#ffffff66]"
            style={{ fontSize: `${1.6 * groesse}cqw`, paddingInline: "2.5cqw", paddingBlock: "0.8cqw" }}
          >
            Anmelden
          </button>
          <span className="max-w-[70%] text-center opacity-90" style={{ fontSize: `${1.3 * groesse}cqw` }}>
            In der Schule tippst du hier dein Passwort ein — hier reicht ein Klick.
          </span>
        </div>
      )}
    </div>
  );
}
