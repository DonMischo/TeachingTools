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
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GLOSSAR, zerlegeMitFachworten, type GlossarBild } from "@/lib/ki/glossar";

/** Maße des Erklärkastens: Breite, Abstand zum Fensterrand, Abstand zum Wort. */
const KASTEN_BREITE = 276;
const RAND = 8;
const LUFT = 6;

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

/** Wo der Kasten steht — in Fensterkoordinaten, nicht im Absatz. */
type Platz = { links: number; oben?: number; unten?: number; hoehe: number };

export function Fachwort({ begriff, wort }: { begriff: string; wort: string }) {
  const eintrag = GLOSSAR[begriff];
  const [platz, setPlatz] = useState<Platz | null>(null);
  const huelle = useRef<HTMLSpanElement>(null);
  const schliessgriff = useRef<number | null>(null);

  const zu = useCallback(() => setPlatz(null), []);

  /**
   * Den Kasten ans Wort setzen — in Fensterkoordinaten.
   *
   * Er hing vorher als `absolute` im Absatz und wurde damit von jedem
   * Vorfahren mit `overflow: hidden` oder einem Scrollbereich abgeschnitten
   * (der Lesekasten hat beides, die Spielbühne auch). Deshalb wird er jetzt
   * an den Seitenkörper gehängt und fest positioniert: So kann ihn niemand
   * mehr beschneiden.
   *
   * Unten oder oben entscheidet der Platz; nach oben wird über `unten`
   * verankert, dann braucht es die Höhe des Kastens gar nicht erst.
   */
  const oeffne = useCallback(() => {
    const kasten = huelle.current?.getBoundingClientRect();
    if (!kasten) return;
    const breiteFenster = document.documentElement.clientWidth || window.innerWidth || 0;
    const hoeheFenster = document.documentElement.clientHeight || window.innerHeight || 0;
    if (!breiteFenster || !hoeheFenster) {
      // Ohne brauchbare Maße (verborgenes Fenster) einfach unter das Wort.
      setPlatz({ links: kasten.left, oben: kasten.bottom + LUFT, hoehe: 260 });
      return;
    }
    const breite = Math.min(KASTEN_BREITE, breiteFenster - 2 * RAND);
    const links = Math.min(Math.max(RAND, kasten.left), breiteFenster - breite - RAND);
    const platzUnten = hoeheFenster - kasten.bottom - LUFT - RAND;
    const platzOben = kasten.top - LUFT - RAND;
    const nachOben = platzUnten < 180 && platzOben > platzUnten;
    setPlatz(nachOben
      ? { links, unten: hoeheFenster - kasten.top + LUFT, hoehe: platzOben }
      : { links, oben: kasten.bottom + LUFT, hoehe: platzUnten });
  }, []);

  const spaeterSchliessen = () => {
    // Kleine Nachlaufzeit, damit der Weg vom Wort in den Kasten nicht
    // dazwischen abreißt — der Kasten ist kein Kind des Wortes mehr.
    schliessgriff.current = window.setTimeout(zu, 140);
  };
  const nichtSchliessen = () => {
    if (schliessgriff.current) window.clearTimeout(schliessgriff.current);
    schliessgriff.current = null;
  };

  useEffect(() => {
    if (!platz) return;
    const daneben = (e: Event) => {
      if (!huelle.current?.contains(e.target as Node)) zu();
    };
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") zu(); };
    /**
     * Beim Scrollen mitwandern statt zumachen.
     *
     * Der Kasten hängt am Fenster, das Wort am Text — ohne Nachführen stünde
     * er nach dem ersten Wischen woanders. Zumachen wäre einfacher, ist aber
     * zickig: Schon ein Layoutsprung löst ein Scroll-Ereignis aus, und die
     * Erklärung verschwindet, kaum dass man sie geöffnet hat.
     */
    const nachfuehren = () => {
      const kasten = huelle.current?.getBoundingClientRect();
      // Ist das Wort aus dem Bild gewandert, hat der Kasten dort nichts mehr
      // verloren.
      const hoehe = document.documentElement.clientHeight || window.innerHeight || 0;
      if (!kasten || (hoehe && (kasten.bottom < 0 || kasten.top > hoehe))) { zu(); return; }
      oeffne();
    };
    // »true« ist wichtig, damit auch innere Scrollbereiche zählen.
    document.addEventListener("pointerdown", daneben);
    document.addEventListener("keydown", taste);
    window.addEventListener("scroll", nachfuehren, true);
    window.addEventListener("resize", nachfuehren);
    return () => {
      document.removeEventListener("pointerdown", daneben);
      document.removeEventListener("keydown", taste);
      window.removeEventListener("scroll", nachfuehren, true);
      window.removeEventListener("resize", nachfuehren);
    };
  }, [platz, zu, oeffne]);

  useEffect(() => () => { if (schliessgriff.current) window.clearTimeout(schliessgriff.current); }, []);

  if (!eintrag) return <>{wort}</>;

  const karte = platz && (
    <span
      role="tooltip"
      onMouseEnter={nichtSchliessen}
      onMouseLeave={spaeterSchliessen}
      style={{
        position: "fixed",
        left: platz.links,
        top: platz.oben,
        bottom: platz.unten,
        width: KASTEN_BREITE,
        maxWidth: `calc(100vw - ${2 * RAND}px)`,
        maxHeight: Math.max(140, platz.hoehe),
      }}
      className="z-50 overflow-y-auto p-3 rounded-xl border border-[var(--accent)]
        bg-[var(--surface)] shadow-xl flex flex-col gap-1.5 text-left normal-case"
    >
      <span className="font-black text-sm text-[var(--text)]">{eintrag.titel}</span>
      <span className="text-xs leading-relaxed text-[var(--text)]">{eintrag.kurz}</span>
      {eintrag.bild && <span className="block py-1"><Bild art={eintrag.bild} /></span>}
      {eintrag.lang && (
        <span className="text-xs leading-relaxed text-[var(--text-muted)]">{eintrag.lang}</span>
      )}
    </span>
  );

  return (
    <span
      ref={huelle}
      className="relative inline-block"
      onMouseEnter={() => { nichtSchliessen(); oeffne(); }}
      onMouseLeave={spaeterSchliessen}
    >
      <button
        type="button"
        onClick={() => (platz ? zu() : oeffne())}
        onFocus={oeffne}
        aria-expanded={!!platz}
        className="underline decoration-dotted decoration-from-font underline-offset-2
          font-semibold text-[var(--text)] hover:text-[var(--accent)] cursor-help text-left"
      >
        {wort}
      </button>
      {/* An den Seitenkörper gehängt: So schneidet kein Scrollbereich ihn ab. */}
      {karte && typeof document !== "undefined" && createPortal(karte, document.body)}
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
