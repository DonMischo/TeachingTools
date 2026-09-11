"use client";
/**
 * Kopf jeder Stufe: Auftrag, Punkte, »Vorlesen«, »Vorführen« und »Weiter«.
 *
 * Im Prüfungsmodus fehlt »Vorführen«, und »Weiter« auf einer nicht
 * geschafften Stufe heißt ehrlich »Überspringen«.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useMausKontext } from "./MausKontext";

/**
 * Liest den Auftrag mit der Stimme des Browsers vor — für Kinder, die noch
 * langsam lesen oder gerade Deutsch lernen. Kein Server, keine Kosten.
 */
export function Vorlesen({ ziel }: { ziel: RefObject<HTMLElement | null> }) {
  const [moeglich, setMoeglich] = useState(false);
  const [spricht, setSpricht] = useState(false);

  useEffect(() => {
    setMoeglich(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  if (!moeglich) return null;

  function umschalten() {
    const synth = window.speechSynthesis;
    if (spricht) { synth.cancel(); setSpricht(false); return; }
    const text = ziel.current?.innerText.trim();
    if (!text) return;
    const satz = new SpeechSynthesisUtterance(text);
    satz.lang = "de-DE";
    satz.rate = 0.9;
    const stimme = synth.getVoices().find(v => v.lang.startsWith("de"));
    if (stimme) satz.voice = stimme;
    satz.onend = () => setSpricht(false);
    satz.onerror = () => setSpricht(false);
    synth.cancel();
    synth.speak(satz);
    setSpricht(true);
  }

  return (
    <button
      type="button"
      onClick={umschalten}
      aria-pressed={spricht}
      title={spricht ? "Vorlesen stoppen" : "Auftrag vorlesen"}
      className="shrink-0 text-lg rounded-lg w-9 h-9 border border-[var(--border)] hover:border-[var(--accent)]"
    >
      {spricht ? "⏹" : "🔊"}
    </button>
  );
}

export function Stufenkopf({
  titel,
  auftrag,
  punkte,
  onDemo,
  onWeiter,
  weiterText = "Weiter →",
  hervor = false,
  children,
}: {
  titel: string;
  auftrag: ReactNode;
  punkte?: number;
  onDemo?: () => void;
  onWeiter: () => void;
  weiterText?: string;
  /** Die Stufe ist geschafft: »Weiter« wird zum Hauptknopf. */
  hervor?: boolean;
  /** Das Ziel groß neben dem Auftrag, z. B. das gesuchte Tier. */
  children?: ReactNode;
}) {
  const { pruefung } = useMausKontext();
  const auftragRef = useRef<HTMLDivElement>(null);
  const zeigeDemo = onDemo && !pruefung;
  const knopfText = pruefung && !hervor ? "Überspringen" : weiterText;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-black">{titel}</h2>
        <div className="flex-1" />
        {punkte !== undefined && (
          <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-sm font-black tabular-nums" data-testid="punkte">
            ⭐ {punkte}
          </span>
        )}
        {zeigeDemo && (
          <button
            onClick={onDemo}
            className="text-sm rounded-lg px-3 py-1.5 border border-[var(--border)] hover:border-[var(--accent)]"
          >
            ▶ Vorführen
          </button>
        )}
        <button
          onClick={onWeiter}
          className={
            "text-sm rounded-lg px-3 py-1.5 border font-bold " +
            (hervor
              ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--bg)]"
              : "border-[var(--border)] hover:border-[var(--accent)]")
          }
        >
          {knopfText}
        </button>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        {children}
        <div ref={auftragRef} className="flex-1 text-base leading-snug">{auftrag}</div>
        <Vorlesen ziel={auftragRef} />
      </div>
    </div>
  );
}
