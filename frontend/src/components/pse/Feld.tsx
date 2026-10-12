"use client";
/**
 * Das Feld eines Elements, wie es im Tafelwerk aussieht: oben links die
 * Ordnungszahl, oben rechts die relative Atommasse, in der Mitte das Symbol,
 * darunter der Name, unten links die Elektronegativität, unten rechts die
 * Dichte.
 *
 * Steht hier und nicht im Periodensystem, weil drei Stellen dasselbe Feld
 * zeichnen: das Raster, die Legende darunter und der Kopf des Steckbriefs.
 * Ein Feld ist immer quadratisch — davon hängt ab, wie groß die Schrift darin
 * wird.
 */
import { dichteKachel, radioaktiv, type PseElement } from "@/lib/pse/elemente";

/** Zahl fürs Feld: deutsche Schreibweise, ohne überflüssige Nullen. */
const zahl = (n: number, stellen: number): string =>
  n.toLocaleString("de-DE", { maximumFractionDigits: stellen });

/**
 * Die Farbe des Symbols sagt den Aggregatzustand bei Zimmertemperatur —
 * wie im Tafelwerk: fest schwarz, flüssig blau, gasförmig rot.
 */
export const ZUSTAND_FARBE: Record<string, string> = {
  fest: "var(--text)",
  "flüssig": "#2563eb",
  "gasförmig": "#dc2626",
};

/**
 * Der Inhalt eines Feldes. Die Schrift wächst mit der Kantenlänge, sonst
 * stimmt beim Zoomen das Verhältnis nicht. Den Rahmen und die Farbe setzt,
 * wer das Feld einbaut — im Raster ist es ein Knopf, sonst nur ein Kasten.
 */
export function Feldinhalt({ e, feld }: { e: PseElement; feld: number }) {
  const d = dichteKachel(e);
  const ecke = Math.max(5, Math.min(11, feld * 0.145));
  const symbol = Math.max(10, feld * 0.34);
  // Unter dieser Größe wird der Name zu Matsch — dann lieber weglassen.
  // Der Name steht ohnehin im Steckbrief und im Tooltip.
  const zeigeName = feld >= 56;
  return (
    <>
      {/* Kopfzeile: Ordnungszahl links, relative Atommasse rechts */}
      <div className="flex justify-between items-start text-muted tabular-nums w-full"
        style={{ fontSize: ecke }}>
        <span>{e.z}</span>
        <span>{e.masse === null ? "" : zahl(e.masse, e.masse < 10 ? 3 : 2)}</span>
      </div>
      {/* Symbol, farbig nach Aggregatzustand; ein Stern markiert die radioaktiven */}
      <div className="font-black text-center flex-1 flex items-center justify-center"
        style={{ fontSize: symbol, color: ZUSTAND_FARBE[e.zustand ?? ""] ?? "var(--text-muted)" }}>
        {e.symbol}
        {radioaktiv(e) && <span style={{ fontSize: symbol * 0.6 }} aria-hidden>*</span>}
      </div>
      {zeigeName && (
        <div className="text-muted text-center truncate w-full" style={{ fontSize: feld * 0.12 }}>
          {e.name}
        </div>
      )}
      {/* Fußzeile: Elektronegativität links, Dichte rechts */}
      <div className="flex justify-between items-end text-muted tabular-nums w-full"
        style={{ fontSize: ecke }}>
        <span>{e.en === null ? "—" : zahl(e.en, 2)}</span>
        <span className={d?.gas ? "text-[#dc2626]" : ""}>{d ? zahl(d.wert, d.wert < 10 ? 2 : 1) : "?"}</span>
      </div>
    </>
  );
}
