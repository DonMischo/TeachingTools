/**
 * »Was kann TT?« — Feature-Liste aus features.yml (über /api/funktionen),
 * Suche und Markdown für eine externe KI.
 */

export type Eintrag = {
  id: string; name: string; typ: string | null; kann: string[];
  faehigkeiten: Record<string, [boolean, boolean]>;
};
export type Bereich = { id: string; name: string; eintraege: Eintrag[] };
export type Funktionen = { name: string; beschreibung: string; bereiche: Bereich[] };

const norm = (s: string) => s.toLocaleLowerCase("de").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Bereiche mit den Einträgen, die zu allen Suchwörtern passen (Name, Typ, Punkte). */
export function filtern(bereiche: Bereich[], suche: string, bereich = ""): Bereich[] {
  const woerter = norm(suche).split(/\s+/).filter(Boolean);
  return bereiche
    .filter(b => !bereich || b.id === bereich)
    .map(b => ({
      ...b,
      eintraege: b.eintraege.filter(e => {
        const text = norm([e.name, e.typ ?? "", b.name, ...e.kann].join(" "));
        return woerter.every(w => text.includes(w));
      }),
    }))
    .filter(b => b.eintraege.length > 0);
}

export const KI_VORSPANN =
  "Hier ist die Funktionsliste von TT - Teaching Tools, einer selbst gehosteten Lernplattform für Schulen. " +
  "Beantworte meine Fragen nur anhand dieser Liste und sag, wenn etwas darin nicht vorkommt.";

const FAEHIGKEIT: Record<string, string> = { use: "öffnen", host: "hosten", create: "erstellen", upload: "hochladen" };

function eintragMd(e: Eintrag): string {
  const kopf = `### ${e.name}${e.typ ? ` (${e.typ})` : ""}`;
  const f = Object.entries(e.faehigkeiten)
    .map(([k, [l, s]]) => `${FAEHIGKEIT[k] ?? k}: ${[l && "Lehrkräfte", s && "Schüler·innen"].filter(Boolean).join(" und ") || "nur mit Freigabe"}`);
  return [kopf, ...(f.length ? [`Standard: ${f.join("; ")}`] : []), ...e.kann.map(k => `- ${k}`)].join("\n");
}

/** Markdown der (gefilterten) Liste; mit Vorspann zum Einfügen in einen Chat. */
export function alsMarkdown(d: Pick<Funktionen, "name" | "beschreibung">, bereiche: Bereich[], vorspann = true): string {
  const teile = [
    ...(vorspann ? [KI_VORSPANN, ""] : []),
    `# ${d.name}`, d.beschreibung,
    ...bereiche.map(b => `\n## ${b.name}\n\n${b.eintraege.map(eintragMd).join("\n\n")}`),
  ];
  return teile.join("\n").trim() + "\n";
}

export function eintragAlsMarkdown(b: Bereich, e: Eintrag): string {
  return `${KI_VORSPANN}\n\n## ${b.name}\n\n${eintragMd(e)}\n`;
}
