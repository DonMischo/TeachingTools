"use client";
/**
 * Portfolio: alle Reflexionen auf einen Blick, dazu die Messpunkte der
 * Selbsteinschätzung und eine Vorlage für die KI-Nutzungserklärung. Export als .docx.
 */
import { BEREICHE, erreichteStufe, type Einschaetzung } from "@/lib/kikompass/raster";
import { MODUL_REIHENFOLGE, stationFertig, stationenVon, type StationStand } from "@/lib/kikompass/stationen";
import { baueDocx, herunterladen, type DocxBlock } from "@/lib/docx";
import { datumDe } from "./Raster";

export const NUTZUNGSERKLAERUNG = [
  "KI-Nutzungserklärung",
  "Für diese Arbeit habe ich folgendes KI-Werkzeug benutzt: ______________",
  "Wofür: ☐ Ideen sammeln ☐ Text überarbeiten ☐ Erklärungen ☐ Abfragen/Üben ☐ Sonstiges: ________",
  "Meine wichtigsten Prompts: ______________",
  "Was ich selbst gemacht habe: ______________",
  "Wie ich die Ergebnisse geprüft habe: ______________",
];

export function Portfolio({ name, stande, einschaetzungen }: {
  name: string;
  stande: Record<string, StationStand>;
  einschaetzungen: Einschaetzung[];
}) {
  const eintraege = MODUL_REIHENFOLGE.flatMap(stationenVon).filter(s => stande[s.id]?.reflexion?.some(t => t.trim()));

  async function exportieren() {
    const bloecke: DocxBlock[] = [
      { art: "titel", text: `KI-Portfolio${name ? ` von ${name}` : ""}` },
      { art: "ueberschrift", text: "Meine Selbsteinschätzungen" },
      ...einschaetzungen.map(e => ({
        art: "text" as const,
        text: `${datumDe(e.datum)}: ` + BEREICHE.map(b => `${b.name} ${erreichteStufe(b.id, e.haken)?.name ?? "–"}`).join(" · "),
      })),
      ...eintraege.flatMap(s => [
        { art: "ueberschrift" as const, text: `${s.titel} (${BEREICHE.find(b => b.id === s.modul)!.name}, Stufe ${s.stufe})` },
        ...s.reflexion.flatMap((frage, i) => [
          { art: "text" as const, text: frage, fett: true },
          { art: "text" as const, text: stande[s.id].reflexion[i] || "–" },
        ]),
      ]),
      { art: "umbruch" },
      { art: "ueberschrift", text: NUTZUNGSERKLAERUNG[0] },
      ...NUTZUNGSERKLAERUNG.slice(1).map(t => ({ art: "text" as const, text: t })),
      { art: "text", text: "Kompetenzbereiche nach Alles, Falck, Flick & Schulz (2025), CC BY-SA 4.0.", klein: true, grau: true },
    ];
    herunterladen(await baueDocx(bloecke), "KI-Portfolio.docx");
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted flex-1">
          Hier sammeln sich deine Reflexionen aus dem KI-Führerschein. Dein Portfolio zeigt, wie du lernst, nicht nur, was am Ende herauskommt.
        </p>
        <button className="btn-primary" onClick={exportieren}>⬇️ Als Word-Datei</button>
      </div>
      {eintraege.length === 0 && <p className="card p-4 text-sm">Noch keine Einträge. Fang mit einer Station im KI-Führerschein an.</p>}
      {eintraege.map(s => (
        <article key={s.id} className="card p-4 flex flex-col gap-2">
          <h3 className="font-semibold">{s.icon} {s.titel} {stationFertig(s, stande[s.id]) && "✅"}
            {stande[s.id].erledigt_am && <span className="text-xs text-muted font-normal"> · {datumDe(stande[s.id].erledigt_am!)}</span>}
          </h3>
          {s.reflexion.map((frage, i) => (
            <div key={i}>
              <p className="text-sm font-medium">{frage}</p>
              <p className="text-sm whitespace-pre-wrap">{stande[s.id].reflexion[i] || "–"}</p>
            </div>
          ))}
        </article>
      ))}
      <section className="card p-4 flex flex-col gap-1">
        <h3 className="font-semibold">🧾 Vorlage: {NUTZUNGSERKLAERUNG[0]}</h3>
        <p className="text-xs text-muted">Leg sie jeder Abgabe bei, für die du KI benutzt hast. Sie ist auch in der Word-Datei.</p>
        {NUTZUNGSERKLAERUNG.slice(1).map(t => <p key={t} className="text-sm">{t}</p>)}
      </section>
    </div>
  );
}
