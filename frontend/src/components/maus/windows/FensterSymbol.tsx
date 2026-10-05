"use client";
/**
 * Die Knöpfe oben rechts in jedem Windows-Fenster — selbst gezeichnet, damit
 * sie in der Titelleiste und im Aufgabentext gleich aussehen: Wer liest
 * »Klick auf ⧉«, soll genau dieses Bild im Fenster wiederfinden.
 *
 * »Wiederherstellen« sind zwei versetzte Rechtecke; der Knopf zeigt es nur,
 * solange das Fenster maximiert ist — sonst steht dort »Maximieren« (eins).
 */
export type FensterKnopf = "minimieren" | "maximieren" | "wiederherstellen" | "schliessen";

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

/** Der Knopf als kleines Bild im Text — so, wie er im Fenster aussieht. */
export function KnopfImText({ art }: { art: FensterKnopf }) {
  return (
    <span
      className={"inline-flex items-center justify-center align-middle rounded-sm border-2 mx-0.5 w-7 h-6 " + (art === "schliessen" ? "border-[#c42b1c] text-[#c42b1c]" : "border-accent text-fg")}
      role="img"
      aria-label={`Knopf »${{ minimieren: "Minimieren", maximieren: "Maximieren", wiederherstellen: "Wiederherstellen", schliessen: "Schließen" }[art]}«`}
    >
      <FensterSymbol art={art} groesse={14} />
    </span>
  );
}
