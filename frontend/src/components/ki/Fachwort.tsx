"use client";
/**
 * Fachwörter im Fließtext — mit Erklärung beim Berühren oder Antippen.
 *
 * Die Lesetexte nennen die Dinge beim Namen (Token, Perplexität, XOR,
 * Backpropagation). Ohne Erklärung bleibt so ein Satz eine Hülle: Die Begriffe
 * sind aus dem Vorwissen nicht bekannt. Deshalb ist jedes Fachwort hier
 * unterstrichen und gibt Auskunft — kurz, und wo es hilft mit einem Bild.
 *
 * Bedienung: Mit der Maus reicht Darüberfahren, auf dem Telefon Antippen. Der
 * Kasten schließt beim nächsten Tippen daneben oder mit Escape. Das Fachwort
 * ist ein echter Knopf, damit man auch mit der Tastatur hinkommt.
 *
 * Verknüpft wird automatisch (siehe `glossar.ts`) — kein Text muss von Hand
 * ausgezeichnet werden, und neue Lesetexte bekommen die Erklärungen geschenkt.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GLOSSAR, zerlegeMitFachworten, type GlossarBild } from "@/lib/ki/glossar";

/** Breite des Erklärkastens (17rem) plus Rahmen — muss zur Klasse unten passen. */
const KASTEN_BREITE = 276;
const RAND = 8;

/* ────────────────────────────────────────────────────────── Die Bildchen ── */
// Klein, einfarbig und ohne Beschriftung, wo es geht: Sie sollen den Satz
// stützen, nicht mit ihm konkurrieren.

function Bild({ art }: { art: GlossarBild }) {
  const strich = { stroke: "currentColor", fill: "none", strokeWidth: 2 } as const;
  const inhalt: Record<GlossarBild, ReactNode> = {
    // Vier Fälle über Kreuz: gleiche Farbe diagonal — mit einem Strich nicht zu trennen.
    xor: (
      <>
        <rect x={6} y={6} width={108} height={68} rx={8} stroke="currentColor" fill="none" strokeWidth={1} opacity={0.3} />
        <circle cx={34} cy={54} r={8} fill="currentColor" />
        <circle cx={86} cy={26} r={8} fill="currentColor" />
        <rect x={26} y={18} width={16} height={16} rx={3} stroke="currentColor" fill="none" strokeWidth={2} />
        <rect x={78} y={46} width={16} height={16} rx={3} stroke="currentColor" fill="none" strokeWidth={2} />
        <line x1={14} y1={70} x2={106} y2={12} {...strich} strokeDasharray="5 4" opacity={0.55} />
        <text x={60} y={68} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.7}>
          kein Strich trennt sie
        </text>
      </>
    ),
    // Die S-Kurve zwischen 0 und 1.
    sigmoid: (
      <>
        <line x1={10} y1={68} x2={110} y2={68} {...strich} strokeWidth={1} opacity={0.4} />
        <line x1={60} y1={8} x2={60} y2={72} {...strich} strokeWidth={1} opacity={0.4} />
        <path d="M 12 66 C 42 66, 46 14, 108 12" {...strich} />
        <text x={112} y={16} fontSize={9} fill="currentColor" opacity={0.7}>1</text>
        <text x={112} y={70} fontSize={9} fill="currentColor" opacity={0.7}>0</text>
      </>
    ),
    // Eine Kugel rollt ins Tal.
    tal: (
      <>
        <path d="M 8 16 C 34 74, 86 74, 112 16" {...strich} />
        <circle cx={30} cy={45} r={6} fill="currentColor" />
        <path d="M 40 52 l 10 7" {...strich} strokeWidth={1.5} opacity={0.6} />
        <path d="M 52 60 l 9 3" {...strich} strokeWidth={1.5} opacity={0.6} />
        <text x={60} y={20} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.7}>bergab</text>
      </>
    ),
    // Zwei Täler — die Kugel steckt im flacheren.
    lokal: (
      <>
        <path d="M 6 20 C 22 66, 40 66, 52 38 C 62 14, 80 20, 90 62 C 98 74, 108 60, 114 44" {...strich} />
        <circle cx={31} cy={56} r={6} fill="currentColor" />
        <text x={31} y={74} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.75}>steckt hier</text>
        <text x={90} y={74} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.45}>tiefer wäre da</text>
      </>
    ),
    // Zwei Häufchen, ein Strich dazwischen.
    gerade: (
      <>
        <circle cx={28} cy={26} r={6} fill="currentColor" />
        <circle cx={44} cy={18} r={6} fill="currentColor" />
        <circle cx={34} cy={42} r={6} fill="currentColor" />
        <rect x={74} y={44} width={12} height={12} rx={3} stroke="currentColor" fill="none" strokeWidth={2} />
        <rect x={90} y={30} width={12} height={12} rx={3} stroke="currentColor" fill="none" strokeWidth={2} />
        <rect x={80} y={60} width={12} height={12} rx={3} stroke="currentColor" fill="none" strokeWidth={2} />
        <line x1={20} y1={72} x2={104} y2={10} {...strich} strokeDasharray="6 4" />
      </>
    ),
    // Zwei Zustände, Pfeile dazwischen — der nächste hängt nur am jetzigen.
    kette: (
      <>
        <circle cx={28} cy={40} r={15} {...strich} />
        <circle cx={92} cy={40} r={15} {...strich} />
        <path d="M 45 34 q 20 -16 32 0" {...strich} strokeWidth={1.5} markerEnd="url(#pf)" />
        <path d="M 77 48 q -20 16 -32 0" {...strich} strokeWidth={1.5} markerEnd="url(#pf)" />
        <defs>
          <marker id="pf" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
          </marker>
        </defs>
      </>
    ),
    // Ein Ausschnitt gleitet über eine Wortreihe.
    fenster: (
      <>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <rect key={i} x={8 + i * 18} y={30} width={14} height={20} rx={3}
            stroke="currentColor" fill="none" strokeWidth={1} opacity={0.4} />
        ))}
        <rect x={42} y={24} width={52} height={32} rx={6} {...strich} />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 120 80" className="w-full max-w-[220px] h-auto text-[var(--accent)]" role="img" aria-hidden>
      {inhalt[art]}
    </svg>
  );
}

/* ───────────────────────────────────────────────────────── Das Fachwort ── */

export function Fachwort({ begriff, wort }: { begriff: string; wort: string }) {
  const eintrag = GLOSSAR[begriff];
  const [offen, setOffen] = useState(false);
  const [rechts, setRechts] = useState(false);
  const huelle = useRef<HTMLSpanElement>(null);

  // Antippen daneben schließt wieder — sonst bleibt auf dem Telefon ein
  // Kasten stehen, den niemand mehr loswird.
  useEffect(() => {
    if (!offen) return;
    const zu = (e: Event) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    document.addEventListener("pointerdown", zu);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", zu);
      document.removeEventListener("keydown", esc);
    };
  }, [offen]);

  function oeffne() {
    // Passt der Kasten rechts vom Wort noch ins Bild? Wenn nicht, klappt er
    // nach links auf. Gerechnet wird mit der echten Kastenbreite, nicht mit
    // »das Wort steht in der rechten Hälfte« — auf einem Telefon ragt er sonst
    // auch dann heraus, wenn das Wort noch links steht.
    const wort = huelle.current?.getBoundingClientRect();
    // Beim Messen misstrauisch bleiben: In einem verborgenen oder frisch
    // geladenen Fenster kommt 0 zurück, und dann klappte der Kasten immer nach
    // links. Ohne brauchbare Breite bleibt es bei der Grundstellung.
    const breite = document.documentElement.clientWidth || window.innerWidth;
    if (wort && breite > 0) setRechts(wort.left + KASTEN_BREITE > breite - RAND);
    setOffen(true);
  }

  if (!eintrag) return <>{wort}</>;

  return (
    <span
      ref={huelle}
      className="relative inline-block"
      onMouseEnter={oeffne}
      onMouseLeave={() => setOffen(false)}
    >
      <button
        type="button"
        onClick={() => (offen ? setOffen(false) : oeffne())}
        onFocus={oeffne}
        aria-expanded={offen}
        className="underline decoration-dotted decoration-from-font underline-offset-2
          font-semibold text-[var(--text)] hover:text-[var(--accent)] cursor-help"
      >
        {wort}
      </button>

      {offen && (
        <span
          role="tooltip"
          className={`absolute z-30 top-full mt-1 w-[17rem] max-w-[78vw] p-3 rounded-xl border
            border-[var(--accent)] bg-[var(--surface)] shadow-lg flex flex-col gap-1.5
            text-left normal-case ${rechts ? "right-0" : "left-0"}`}
        >
          <span className="font-black text-sm text-[var(--text)]">{eintrag.titel}</span>
          <span className="text-xs leading-relaxed text-[var(--text)]">{eintrag.kurz}</span>
          {eintrag.bild && (
            <span className="block py-1"><Bild art={eintrag.bild} /></span>
          )}
          {eintrag.lang && (
            <span className="text-xs leading-relaxed text-[var(--text-muted)]">{eintrag.lang}</span>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Ein Absatz, in dem die Fachwörter von selbst erklärt werden.
 *
 * Nimmt gewöhnlichen Text und gibt ihn unverändert aus — nur dass jedes
 * bekannte Fachwort zu einem `Fachwort` wird.
 */
export function MitFachworten({ text }: { text: string }) {
  return (
    <>
      {zerlegeMitFachworten(text).map((stueck, i) =>
        typeof stueck === "string"
          ? <span key={i}>{stueck}</span>
          : <Fachwort key={i} begriff={stueck.begriff} wort={stueck.wort} />,
      )}
    </>
  );
}
