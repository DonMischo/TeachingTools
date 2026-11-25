"use client";
/**
 * Die besten hundert je Modus — drei Listen, weil die drei Modi drei verschiedene
 * Dinge messen; bei der Tastenjagd gewinnt die kleinste Zahl. Dünne Hülle um die
 * gemeinsame Bestenliste.
 */
import GemeinsameBestenliste from "@/components/Bestenliste";

const LISTEN = [
  { id: "lektionen", titel: "Lektionen", icon: "📚", hinweis: "Punkte = Anschläge pro Minute, durch die Fehlerquote gedämpft — schnell und sauber gewinnt" },
  { id: "wortregen", titel: "Wortregen", icon: "🌧️", hinweis: "Punkte einer Runde — mehr ist besser" },
  { id: "tastenjagd", titel: "Tastenjagd", icon: "🎯", hinweis: "Reaktion je Taste — weniger ist besser" },
];
const EINHEIT: Record<string, string> = { lektionen: "P", wortregen: "Punkte", tastenjagd: "ms" };

export default function Bestenliste() {
  return (
    <GemeinsameBestenliste
      werkzeug="tippen" modi={LISTEN}
      format={(wert, _extra, modus) => `${Math.round(wert)} ${EINHEIT[modus] ?? ""}`}
      detail={e => {
        const fehler = Number(e.extra.fehler ?? 0);
        const teile = [typeof e.extra.kontext === "string" ? e.extra.kontext : "", fehler > 0 ? `${fehler}✗` : "fehlerfrei"];
        if (e.extra.roh != null && e.extra.anschlaege != null) teile.push(`${Math.round(Number(e.extra.roh))} A/min`);
        return teile.filter(Boolean).join(" · ");
      }}
      leer="Noch kein Eintrag. Wer die erste Runde zu Ende bringt, steht hier."
      fuss="Eingetragen wird nur mit eigenem Zugang und nur die jeweils beste Runde — Gäste über den QR-Code spielen mit, stehen aber nicht in der Liste."
    />
  );
}
