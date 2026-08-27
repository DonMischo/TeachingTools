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
import { REIHEN, REIHENBREITE, FINGER_FARBEN, umschaltFuer, type Anschlag, type Taste } from "@/lib/tippen/layout";

type Props = {
  /** Die als nächstes fällige Taste — undefined, wenn die Übung fertig ist. */
  naechste?: Anschlag;
  /** Gerade physisch gedrückte Tasten (KeyboardEvent.code). */
  gedrueckt: ReadonlySet<string>;
  zeigeFinger: boolean;
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

function breite(reihe: Taste[]) {
  return reihe.reduce((s, t) => s + (t.width ?? 1), 0);
}

export function Tastatur({ naechste, gedrueckt, zeigeFinger }: Props) {
  return (
    <div aria-hidden className="flex flex-col gap-1 w-full max-w-2xl mx-auto">
      {REIHEN.map((reihe, i) => {
        const rest = REIHENBREITE - breite(reihe);
        return (
          <div key={i} className="flex gap-1">
            {reihe.map(taste => (
              <KeyCap
                key={taste.code}
                taste={taste}
                naechste={naechste}
                gedrueckt={gedrueckt}
                zeigeFinger={zeigeFinger}
              />
            ))}
            {rest > 0 && <div style={{ flexGrow: rest, flexBasis: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}
