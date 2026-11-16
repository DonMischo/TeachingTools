/**
 * Flussdiagramm → D2-Code, für die D2-Ansicht im Flussdiagramm-Editor.
 *
 * Die Formen sind die vier Grundfiguren (Oval, Rechteck, Parallelogramm,
 * Raute), das Layout macht D2 selbst (dagre). Thema und Skizzenstil stehen in
 * `vars.d2-config`, so sieht der heruntergeladene Code anderswo genauso aus.
 * Ohne Bezug zu D2 selbst — testbar ohne Browser.
 */
import type { Diagramm, KnotenTyp } from "./fluss";

export interface D2Optionen { theme: number; skizze: boolean; quer: boolean; aktiv?: string; markiert?: string[] }

const FORM: Record<KnotenTyp, string> = {
  start: "oval", ende: "oval", aktion: "rectangle", io: "parallelogram", entscheidung: "diamond",
};

/** D2-Text in Anführungszeichen: Backslash und Anführungszeichen maskieren, Zeilenumbrüche als \n. */
export const d2Text = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;

/** Ids nur aus sicheren Zeichen — D2 kennt sonst Punkte (Verschachtelung) und Sonderzeichen. */
const id = (s: string) => `n_${s.replace(/[^A-Za-z0-9_]/g, "_")}`;

/** D2 bricht Beschriftungen nicht um — lange Texte würden sehr breite Kästen. */
function umbrechen(text: string, max = 22): string {
  const zeilen: string[] = [];
  let z = "";
  for (const w of text.split(/\s+/)) {
    if (z && (z + " " + w).length > max) { zeilen.push(z); z = w; } else z = (z + " " + w).trim();
  }
  if (z) zeilen.push(z);
  return zeilen.join("\n");
}

export function alsD2(d: Diagramm, o: D2Optionen): string {
  const z: string[] = [
    "vars: {",
    "  d2-config: {",
    `    theme-id: ${o.theme}`,
    `    sketch: ${o.skizze}`,
    "    layout-engine: dagre",
    "  }",
    "}",
    `direction: ${o.quer ? "right" : "down"}`,
    "",
  ];
  for (const k of d.knoten) {
    const text = umbrechen(k.text.trim()) || " ";
    const stil: string[] = [];
    if (k.id === o.aktiv) stil.push("stroke: \"#f59e0b\"", "stroke-width: 5");
    else if (o.markiert?.includes(k.id)) stil.push("stroke: \"#dc2626\"", "stroke-width: 4");
    if (k.text === "…") stil.push("stroke-dash: 4");
    z.push(`${id(k.id)}: ${d2Text(text)} {`);
    z.push(`  shape: ${FORM[k.typ]}`);
    if (k.erklaerung) z.push(`  tooltip: ${d2Text(k.erklaerung)}`);
    if (stil.length) z.push(`  style: { ${stil.join("; ")} }`);
    z.push("}");
  }
  const ids = new Set(d.knoten.map(k => k.id));
  for (const e of d.kanten) {
    if (!ids.has(e.von) || !ids.has(e.nach)) continue;
    const pfeil = `${id(e.von)} -> ${id(e.nach)}`;
    if (!e.marke) { z.push(pfeil); continue; }
    z.push(`${pfeil}: ${e.marke} { style.font-color: "${e.marke === "ja" ? "#15803d" : "#b91c1c"}" }`);
  }
  return z.join("\n") + "\n";
}
