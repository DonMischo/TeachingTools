"use client";
/** Projektkarten für Stufe II: ansehen und als Word-Projektblatt herunterladen. */
import { useState } from "react";
import { BEREICHE, KANN_SAETZE } from "@/lib/kikompass/raster";
import { PROJEKTE, type Projekt } from "@/lib/kikompass/projekte";
import { baueDocx, herunterladen, type DocxBlock } from "@/lib/docx";
import type { AisEinstellungen } from "@/lib/kikompass/ais";
import { AisZugang } from "./AisZugang";

async function blatt(p: Projekt) {
  const bloecke: DocxBlock[] = [
    { art: "titel", text: `Projekt: ${p.titel}` },
    { art: "text", text: `Dauer: ${p.dauer} · Produkt: ${p.produkt}`, grau: true },
    { art: "ueberschrift", text: "Ziele" },
    ...p.kann.map(id => ({ art: "text" as const, text: `🎯 ${KANN_SAETZE.find(k => k.id === id)?.text ?? id}` })),
    { art: "ueberschrift", text: "Ablauf" },
    ...p.ablauf.map((t, i) => ({ art: "text" as const, text: `${i + 1}. ${t}` })),
    ...(p.ais ? [{ art: "ueberschrift" as const, text: "Mit AIS.chat" }, { art: "text" as const, text: p.ais }] : []),
    { art: "text", text: "Keine persönlichen Daten in die KI. KI-Nutzung mit Nutzungserklärung angeben.", klein: true },
    { art: "ueberschrift", text: "Bewertung" },
    ...p.kriterien.map(k => ({ art: "linie" as const, text: `☐ ${k}` })),
    { art: "linie", text: "Gruppe:" },
  ];
  herunterladen(await baueDocx(bloecke), `Projekt_${p.id}.docx`);
}

export function Projekte({ ais }: { ais: AisEinstellungen }) {
  const [offen, setOffen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted max-w-3xl">
        Nach dem KI-Führerschein geht es weiter: Projekte auf Stufe II »Vertieft«, etwa für Klasse 9 und 10.
        Ihr setzt KI bewusst ein, prüft sie kritisch und gestaltet etwas für eure Schule.
      </p>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {PROJEKTE.map(p => (
          <article key={p.id} className="card p-4 flex flex-col gap-2">
            <h3 className="font-semibold text-lg">{p.icon} {p.titel}</h3>
            <p className="text-xs text-muted">
              {p.bereiche.map(id => BEREICHE.find(b => b.id === id)!).map(b => `${b.icon} ${b.name}`).join(" · ")} · {p.dauer}
            </p>
            <p className="text-sm"><strong>Produkt:</strong> {p.produkt}</p>
            {offen === p.id && (
              <>
                <ol className="list-decimal pl-5 text-sm flex flex-col gap-1">{p.ablauf.map(t => <li key={t}>{t}</li>)}</ol>
                {p.ais && <p className="text-sm">🤖 {p.ais}</p>}
                {p.ais && <AisZugang ais={ais} />}
                <p className="text-sm font-medium">Bewertet wird:</p>
                <ul className="list-disc pl-5 text-sm">{p.kriterien.map(k => <li key={k}>{k}</li>)}</ul>
              </>
            )}
            <div className="flex flex-wrap gap-2 mt-auto">
              <button className="btn-secondary" onClick={() => setOffen(offen === p.id ? null : p.id)}>
                {offen === p.id ? "Weniger" : "Ablauf zeigen"}
              </button>
              <button className="btn-secondary" onClick={() => blatt(p)}>⬇️ Projektblatt</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
