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
 * Nur der Auftrag selbst: Tipps und Zähler tragen `data-zusatz` und bleiben
 * stumm, Emojis auch — die Stimme läse sonst »Glühbirne« vor.
 */
export function vorlesbarerText(el: HTMLElement): string {
  const kopie = el.cloneNode(true) as HTMLElement;
  // Formeln (KaTeX): nur die MathML-Fassung behalten, sonst käme jede Formel doppelt
  kopie.querySelectorAll("[data-zusatz], .katex-html, annotation").forEach(z => z.remove());
  return (kopie.textContent ?? "")
    // Emojis samt Variations-Selektor (FE0F) und Verbinder (200D).
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Liest den Auftrag mit der Stimme des Browsers vor — für Kinder, die noch
 * langsam lesen oder gerade Deutsch lernen. Kein Server, keine Kosten.
 */
/**
 * Tragen Elemente im Ziel `data-vorlesen`, werden nur sie gelesen, mit Pause
 * dazwischen (z. B. Frage und Antwortknöpfe ohne »Prüfen«).
 */
export function Vorlesen({ ziel, titel = "Auftrag vorlesen" }: { ziel: RefObject<HTMLElement | null>; titel?: string }) {
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
    const teile = ziel.current ? [...ziel.current.querySelectorAll<HTMLElement>("[data-vorlesen]")] : [];
    const text = !ziel.current ? "" : teile.length
      ? teile.map(vorlesbarerText).filter(Boolean).map(t => /[.!?:]$/.test(t) ? t : `${t}.`).join(" ")
      : vorlesbarerText(ziel.current);
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
      title={spricht ? "Vorlesen stoppen" : titel}
      aria-label={spricht ? "Vorlesen stoppen" : titel}
      className="shrink-0 text-lg rounded-lg w-9 h-9 border border-line hover:border-accent"
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
          <span className="rounded-full bg-surface-hover px-3 py-1 text-sm font-black tabular-nums" data-testid="punkte">
            ⭐ {punkte}
          </span>
        )}
        {zeigeDemo && (
          <button
            onClick={onDemo}
            className="text-sm rounded-lg px-3 py-1.5 border border-line hover:border-accent"
          >
            ▶ Vorführen
          </button>
        )}
        <button
          onClick={onWeiter}
          className={
            "text-sm rounded-lg px-3 py-1.5 border font-bold " +
            (hervor
              ? "bg-accent border-accent text-page"
              : "border-line hover:border-accent")
          }
        >
          {knopfText}
        </button>
      </div>
      <div className="card flex items-center gap-4 px-4 py-3">
        {children}
        <div ref={auftragRef} className="flex-1 text-base leading-snug">{auftrag}</div>
        <Vorlesen ziel={auftragRef} />
      </div>
    </div>
  );
}
