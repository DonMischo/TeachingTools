"use client";
/**
 * Die besten hundert je Liste — auch Gäste stehen darin. Dünne Hülle um die
 * gemeinsame Bestenliste; 🤝 markiert Runden im Hilfsmodus.
 */
import type { MausZugang } from "@/lib/api";
import GemeinsameBestenliste from "@/components/Bestenliste";

const LISTEN = [
  { id: "gesamt", titel: "Gesamt", icon: "🏅" },
  { id: "klick", titel: "Klicken", icon: "👆" },
  { id: "doppelklick", titel: "Doppelklick", icon: "✌️" },
  { id: "ziehen", titel: "Ziehen", icon: "✋" },
];

export default function MausBestenliste({
  zugang, sitzungCode, klasse,
}: {
  zugang?: MausZugang;
  /** Code der Sitzung, auf die sich eingrenzen lässt (Beitritt oder Sitzung der Lehrkraft). */
  sitzungCode?: string | null;
  /** Klasse des angemeldeten Kindes. */
  klasse?: string | null;
}) {
  return (
    <GemeinsameBestenliste
      werkzeug="maus" modi={LISTEN} zugang={zugang} sitzungCode={sitzungCode} klasse={klasse}
      format={wert => `${Math.round(wert).toLocaleString("de-DE")} P.`}
      detail={e => (typeof e.extra.kontext === "string" ? e.extra.kontext : null)}
      marke={e => (e.extra.hilfe ? <span className="ml-2 text-xs" title="Im Hilfsmodus erspielt">🤝</span> : null)}
      leer="Noch kein Eintrag. Wer eine Stufe schafft, steht hier."
      fuss="Je Person zählt nur die beste Runde. Gäste über den QR-Code stehen mit ihrem eingegebenen Namen in der Liste."
    />
  );
}
