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
import {
  REIHEN, REIHENBREITE, NAVIGATION, NAVIGATIONSBREITE, ZIFFERNBLOCK, ZIFFERNBLOCKBREITE,
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

function KeyCap({ taste, naechste, gedrueckt, zeigeFinger }: Props & { taste: Taste }) {
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
        flexGrow: taste.width ?? 1,
        flexBasis: 0,
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
        "relative flex flex-col items-center justify-center rounded-md border h-9 sm:h-11 " +
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

function breite(reihe: Reihe) {
  return reihe.reduce((s, t) => s + (t?.width ?? 1), 0);
}

/** Ein Tastenblock: Reihen untereinander, jede auf `volleBreite` aufgefüllt. */
function Block({ reihen, volleBreite, ...rest }: Props & { reihen: Reihe[]; volleBreite: number }) {
  return (
    <div className="flex flex-col gap-1 basis-0" style={{ flexGrow: volleBreite }}>
      {reihen.map((reihe, i) => {
        const luecke = volleBreite - breite(reihe);
        return (
          <div key={i} className="flex gap-1">
            {reihe.map((taste, j) => (taste
              ? <KeyCap key={taste.code} taste={taste} {...rest} />
              // Leerstelle im Block — hält die Spalten darunter an ihrem Platz.
              : <div key={`luecke-${j}`} className="h-9 sm:h-11" style={{ flexGrow: 1, flexBasis: 0 }} />
            ))}
            {luecke > 0 && <div style={{ flexGrow: luecke, flexBasis: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

export function Tastatur({ bloecke = false, ...rest }: Props) {
  return (
    <div aria-hidden className={"flex gap-2 sm:gap-3 w-full mx-auto " + (bloecke ? "max-w-5xl" : "max-w-2xl")}>
      <Block reihen={REIHEN} volleBreite={REIHENBREITE} {...rest} />
      {bloecke && (
        <>
          <Block reihen={NAVIGATION} volleBreite={NAVIGATIONSBREITE} {...rest} />
          <Block reihen={ZIFFERNBLOCK} volleBreite={ZIFFERNBLOCKBREITE} {...rest} />
        </>
      )}
    </div>
  );
}
