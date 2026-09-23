"use client";
/**
 * Bildschirmtastatur (deutsch, QWERTZ).
 *
 * Sie zeigt drei Dinge gleichzeitig:
 *   • welcher Finger für welche Taste zuständig ist (Farbe),
 *   • welche Taste als nächste dran ist (Ring) — bei Großbuchstaben zusätzlich
 *     die Umschalttaste der *anderen* Hand,
 *   • welche Taste gerade wirklich gedrückt wird (heller Aufschlag).
 *
 * Die Zuordnung läuft über `KeyboardEvent.code`, also über die physische
 * Taste. Deshalb leuchtet auch dann die richtige Stelle, wenn das System eine
 * andere Belegung meldet als auf den Tasten steht.
 */
import type { CSSProperties } from "react";
import {
  REIHEN, REIHENBREITE, NAVIGATION, NAVIGATION_OBEN, NAVIGATIONSBREITE,
  ZIFFERNBLOCK, ZIFFERNBLOCKBREITE, FUNKTIONSREIHE, BLOCKABSTAND,
  FINGER_FARBEN, umschaltFuer, type Anschlag, type Reihe, type Taste,
} from "@/lib/tippen/layout";

type Props = {
  /** Die als nächstes fällige Taste — undefined, wenn die Übung fertig ist. */
  naechste?: Anschlag;
  /** Gerade physisch gedrückte Tasten (KeyboardEvent.code). */
  gedrueckt: ReadonlySet<string>;
  zeigeFinger: boolean;
  /**
   * Auch Navigationsblock und Ziffernblock zeigen. Aus, wo es nur ums Tippen
   * geht — der Hauptblock hat dann die ganze Breite. An, wo eine Aufgabe von
   * Pos1, Ende oder Entf spricht: eine Taste, die nicht abgebildet ist, kann
   * das Kind auch nicht suchen.
   */
  bloecke?: boolean;
};

function KeyCap({ taste, platz, naechste, gedrueckt, zeigeFinger }: Props & { taste: Taste; platz: CSSProperties }) {
  const farbe = FINGER_FARBEN[taste.finger];
  const istNaechste = naechste?.code === taste.code;
  const istUmschalt = !!naechste?.shift && taste.code === umschaltFuer(naechste.finger);
  const hervor = istNaechste || istUmschalt;
  const istGedrueckt = gedrueckt.has(taste.code);

  return (
    <div
      data-code={taste.code}
      data-naechste={hervor || undefined}
      data-gedrueckt={istGedrueckt || undefined}
      style={{
        ...platz,
        background: istGedrueckt
          ? "var(--accent)"
          : zeigeFinger && !taste.mod
            ? `${farbe}${hervor ? "66" : "22"}`
            : hervor
              ? "var(--surface-hover)"
              : "var(--surface)",
        borderColor: hervor ? "var(--accent)" : zeigeFinger && !taste.mod ? `${farbe}55` : "var(--border)",
        color: istGedrueckt ? "var(--bg)" : "var(--text)",
        boxShadow: hervor ? "0 0 0 2px var(--accent)" : undefined,
      }}
      className={
        "relative m-[1.5px] flex flex-col items-center justify-center overflow-hidden rounded-md border " +
        "text-[10px] sm:text-xs leading-none select-none transition-colors duration-75 " +
        (taste.mod ? "text-[var(--text-muted)]" : "font-bold")
      }
    >
      {taste.shift && <span className="opacity-50 text-[9px]">{taste.shift}</span>}
      <span className={taste.shift ? "mt-0.5" : ""}>{taste.label}</span>
      {taste.home && (
        <span
          aria-hidden
          className="absolute bottom-1 w-3 h-[2px] rounded-full"
          style={{ background: istGedrueckt ? "var(--bg)" : "var(--text-muted)" }}
        />
      )}
    </div>
  );
}

/** Viertel-Einheiten je Taste — die schmalste Breite im Bauplan ist 0,25. */
const EINHEIT = 4;

type Platz = { taste: Taste; spalte: number; spalten: number; reihe: number; reihen: number };

/**
 * Reihen eines Blocks auf Rasterplätze umrechnen.
 *
 * Die Plätze stehen ausdrücklich da, statt sie das Raster selbst verteilen zu
 * lassen: sobald eine Taste zwei Reihen hoch ist (Plus und Eingabe im
 * Ziffernblock), schiebt die automatische Verteilung alles danach um eine
 * Zelle weiter.
 */
function platziere(reihen: Reihe[], spaltenVersatz: number, reihenVersatz: number): Platz[] {
  const plaetze: Platz[] = [];
  reihen.forEach((reihe, r) => {
    let x = 0;
    for (const eintrag of reihe) {
      // Eine Zahl ist eine Lücke — überspringen, nichts zeichnen.
      if (typeof eintrag === "number") { x += eintrag; continue; }
      const breite = eintrag.width ?? 1;
      plaetze.push({
        taste: eintrag,
        spalte: Math.round((spaltenVersatz + x) * EINHEIT) + 1,
        spalten: Math.round(breite * EINHEIT),
        reihe: reihenVersatz + r + 1,
        reihen: eintrag.rows ?? 1,
      });
      x += breite;
    }
  });
  return plaetze;
}

export function Tastatur({ bloecke = false, ...rest }: Props) {
  const navVersatz = REIHENBREITE + BLOCKABSTAND;
  const zifferVersatz = navVersatz + NAVIGATIONSBREITE + BLOCKABSTAND;
  const spalten = bloecke ? zifferVersatz + ZIFFERNBLOCKBREITE : REIHENBREITE;
  const reihen = bloecke ? 6 : 5;  // mit Funktionsreihe obendrauf

  const plaetze = bloecke
    ? [
        ...platziere([FUNKTIONSREIHE], 0, 0),
        ...platziere(REIHEN, 0, 1),
        ...platziere([NAVIGATION_OBEN], navVersatz, 0),
        ...platziere(NAVIGATION, navVersatz, 1),
        ...platziere(ZIFFERNBLOCK, zifferVersatz, 1),
      ]
    : platziere(REIHEN, 0, 0);

  return (
    <div
      aria-hidden
      className={"grid w-full mx-auto " + (bloecke ? "max-w-6xl" : "max-w-2xl")}
      style={{
        gridTemplateColumns: `repeat(${spalten * EINHEIT}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${reihen}, minmax(0, 1fr))`,
        // Quadratische Tasten ohne Rechnerei: ist der Kasten so viel breiter
        // als hoch, wie er Einheiten hat, ist jede Zelle ein Quadrat — und
        // zwar in jedem Block dasselbe, weil alle in einem Raster liegen.
        aspectRatio: `${spalten} / ${reihen}`,
      }}
    >
      {plaetze.map(({ taste, spalte, spalten: s, reihe, reihen: r }) => (
        <KeyCap
          key={taste.code}
          taste={taste}
          platz={{ gridColumn: `${spalte} / span ${s}`, gridRow: `${reihe} / span ${r}` }}
          {...rest}
        />
      ))}
    </div>
  );
}
