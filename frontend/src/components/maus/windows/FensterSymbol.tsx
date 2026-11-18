"use client";
/**
 * Die Knöpfe in der Titelleiste jedes Fensters — selbst gezeichnet, damit
 * sie in der Titelleiste und im Aufgabentext gleich aussehen: Wer liest
 * »Klick auf ⧉«, soll genau dieses Bild im Fenster wiederfinden.
 *
 * Windows: oben rechts — Minimieren, Maximieren, Schließen (eckig).
 * Ubuntu: oben rechts — dieselben drei, aber rund und grau.
 * macOS: oben LINKS — die drei »Ampel«-Punkte: rot schließen, gelb
 * minimieren (ins Dock), grün maximieren. Erst beim Draufzeigen erscheinen
 * die Zeichen darin.
 *
 * »Wiederherstellen« sind bei Windows zwei versetzte Rechtecke; der Knopf
 * zeigt es nur, solange das Fenster maximiert ist — sonst steht dort
 * »Maximieren« (eins).
 */
import { useState, type Ref } from "react";
import type { Betriebssystem } from "@/lib/maus/system";
import { useWindows } from "./WindowsKontext";

export type FensterKnopf = "minimieren" | "maximieren" | "wiederherstellen" | "schliessen";

const NAMEN: Record<FensterKnopf, string> = {
  minimieren: "Minimieren", maximieren: "Maximieren", wiederherstellen: "Wiederherstellen", schliessen: "Schließen",
};

const AMPEL: Record<FensterKnopf, string> = {
  schliessen: "#ff5f57", minimieren: "#febc2e", maximieren: "#28c840", wiederherstellen: "#28c840",
};

/** Beim Mac heißen die Knöpfe nach ihrer Farbe — so finden Kinder sie. */
export function knopfName(art: FensterKnopf, system: Betriebssystem): string {
  if (system !== "macos") return NAMEN[art];
  return { schliessen: "roter Punkt", minimieren: "gelber Punkt", maximieren: "grüner Punkt", wiederherstellen: "grüner Punkt" }[art];
}

export function FensterSymbol({ art, groesse = "1em" }: { art: FensterKnopf; groesse?: number | string }) {
  return (
    <svg viewBox="0 0 12 12" width={groesse} height={groesse} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.1">
      {art === "minimieren" && <path d="M1.5 6.5h9" />}
      {art === "maximieren" && <rect x="1.5" y="1.5" width="9" height="9" rx="1" />}
      {art === "wiederherstellen" && (
        <>
          <path d="M3.5 3.5V2.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
          <rect x="1.5" y="3.5" width="7" height="7" rx="1" />
        </>
      )}
      {art === "schliessen" && <path d="M2 2l8 8M10 2l-8 8" />}
    </svg>
  );
}

/** Ein Ampelpunkt (macOS) — mit Zeichen, wenn `zeichen` gesetzt ist. */
function Ampel({ art, groesse, zeichen }: { art: FensterKnopf; groesse: number; zeichen: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{ width: groesse, height: groesse, background: AMPEL[art], color: "#00000099", border: "0.5px solid #0000002e" }}
    >
      {zeichen && (
        <svg viewBox="0 0 12 12" width={groesse * 0.62} height={groesse * 0.62} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          {art === "schliessen" && <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" />}
          {art === "minimieren" && <path d="M3 6h6" />}
          {(art === "maximieren" || art === "wiederherstellen") && <path d="M4 3.5v4.5h4.5M8 8.5V4H3.5" />}
        </svg>
      )}
    </span>
  );
}

/** Der Knopf als kleines Bild im Text — so, wie er im Fenster des gewählten Systems aussieht. */
export function KnopfImText({ art }: { art: FensterKnopf }) {
  const { system } = useWindows();
  if (system === "macos") {
    return (
      <span className="inline-flex items-center align-middle mx-0.5" role="img" aria-label={`Knopf »${knopfName(art, system)}«`}>
        <Ampel art={art} groesse={16} zeichen />
      </span>
    );
  }
  return (
    <span
      className={"inline-flex items-center justify-center align-middle border-2 mx-0.5 "
        + (system === "ubuntu" ? "rounded-full w-6 h-6 " : "rounded-sm w-7 h-6 ")
        + (art === "schliessen" ? "border-[#c42b1c] text-[#c42b1c]" : "border-accent text-fg")}
      role="img"
      aria-label={`Knopf »${NAMEN[art]}«`}
    >
      <FensterSymbol art={art} groesse={system === "ubuntu" ? 11 : 14} />
    </span>
  );
}

/**
 * Die drei Knöpfe einer Titelleiste im Stil des gewählten Systems. Fehlt ein
 * Handler, ist der Knopf nur Bild (blass). Die aria-labels bleiben auf allen
 * Systemen gleich (»Minimieren«, »Maximieren«/»Wiederherstellen«, »Schließen«),
 * damit Stufen und Tests sie finden. Der Aufrufer setzt die Gruppe beim Mac
 * links vor den Titel (`knoepfeLinks`), sonst rechts dahinter.
 */
export function FensterKnoepfe({
  maximiert = false, onMinimieren, onMaximieren, onSchliessen, groesse = 28, symbol = 12,
  minRef, maxRef, schliessenRef, schliessenLabel = "Schließen",
}: {
  maximiert?: boolean;
  onMinimieren?: () => void;
  onMaximieren?: () => void;
  onSchliessen?: () => void;
  /** Kantenlänge eines Knopfs (Windows/Ubuntu); die Ampelpunkte sind kleiner. */
  groesse?: number;
  symbol?: number;
  minRef?: Ref<HTMLButtonElement>;
  maxRef?: Ref<HTMLButtonElement>;
  schliessenRef?: Ref<HTMLButtonElement>;
  schliessenLabel?: string;
}) {
  const { system } = useWindows();
  const [zeigt, setZeigt] = useState(false);
  const maxArt: FensterKnopf = maximiert ? "wiederherstellen" : "maximieren";
  const knoepfe: { art: FensterKnopf; label: string; on?: () => void; ref?: Ref<HTMLButtonElement> }[] = [
    { art: "minimieren", label: "Minimieren", on: onMinimieren, ref: minRef },
    { art: maxArt, label: NAMEN[maxArt], on: onMaximieren, ref: maxRef },
    { art: "schliessen", label: schliessenLabel, on: onSchliessen, ref: schliessenRef },
  ];

  if (system === "macos") {
    const punkt = Math.max(12, Math.round(groesse * 0.46));
    // Reihenfolge beim Mac: rot, gelb, grün.
    const mac = [knoepfe[2], knoepfe[0], knoepfe[1]];
    return (
      <span className="flex items-center" style={{ gap: punkt * 0.6 }} onMouseEnter={() => setZeigt(true)} onMouseLeave={() => setZeigt(false)}>
        {mac.map(k => (
          <button
            key={k.art}
            ref={k.ref}
            type="button"
            onClick={k.on}
            disabled={!k.on}
            aria-label={k.label}
            title={knopfName(k.art, system)}
            className={"flex items-center justify-center " + (k.on ? "" : "opacity-50 cursor-default")}
            style={{ width: punkt + 4, height: groesse }}
          >
            <Ampel art={k.art} groesse={punkt} zeichen={zeigt} />
          </button>
        ))}
      </span>
    );
  }

  const rund = system === "ubuntu";
  return (
    <span className="flex items-center" style={{ gap: rund ? groesse * 0.3 : 0 }}>
      {knoepfe.map(k => (
        <button
          key={k.art}
          ref={k.ref}
          type="button"
          onClick={k.on}
          disabled={!k.on}
          aria-label={k.label}
          title={k.label}
          className={"flex items-center justify-center "
            + (rund ? "rounded-full bg-[#8080802e] hover:bg-[#80808059] " : "rounded-sm " + (k.art === "schliessen" ? "hover:bg-red-500 hover:text-white " : "hover:bg-[#80808026] "))
            + (k.on ? "" : "opacity-40 cursor-default")}
          style={rund ? { width: groesse * 0.8, height: groesse * 0.8 } : { width: groesse, height: groesse }}
        >
          <FensterSymbol art={k.art} groesse={rund ? symbol * 0.85 : symbol} />
        </button>
      ))}
    </span>
  );
}

/** Stehen die Fensterknöpfe links (macOS) oder rechts? */
export function useKnoepfeLinks(): boolean {
  return useWindows().system === "macos";
}
