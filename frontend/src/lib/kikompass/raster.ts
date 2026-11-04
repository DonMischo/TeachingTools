/**
 * KI-Kompass: das gemeinsame Kompetenzraster für Lehrkräfte und Lernende.
 *
 * Grundlage: Alles, Falck, Flick & Schulz (2025), »KI-Kompetenzen für Lehrende
 * und Lernende – Aus der Praxis für die Praxis – eine adaptierbare Basis«,
 * VK:KIWA, DOI 10.5281/zenodo.15047793, CC BY-SA 4.0. Die Niveaus I–III sind
 * dort beschrieben. Wir haben sie in »Ich kann …«-Sätze umformuliert und
 * Niveau I in zwei Schritte geteilt. Die Stufe 0 »Einstieg« ist neu und lehnt
 * sich an die Grundschul-Adaption von van der Meer & Knellsen (2025, CC BY 4.0) an.
 * Recherche und Lizenzen: docs/ki-kompass-recherche.md.
 */

export type BereichId = "verstehen" | "anwenden" | "reflektieren" | "mitgestalten";
export type StufeId = "0" | "Ia" | "Ib" | "II" | "III";

export type Bereich = { id: BereichId; name: string; kurz: string; untertitel: string; icon: string; farbe: string };
export type Stufe = { id: StufeId; name: string; hinweis: string };
export type KannSatz = { id: string; bereich: BereichId; stufe: StufeId; text: string };

export const BEREICHE: Bereich[] = [
  { id: "verstehen", name: "Verstehen", kurz: "V", untertitel: "Wie funktioniert KI?", icon: "🧠", farbe: "#2e9e44" },
  { id: "anwenden", name: "Anwenden", kurz: "A", untertitel: "KI sinnvoll nutzen", icon: "🛠️", farbe: "#1f6fb5" },
  { id: "reflektieren", name: "Reflektieren", kurz: "R", untertitel: "KI kritisch prüfen", icon: "🔍", farbe: "#e08a00" },
  { id: "mitgestalten", name: "Mitgestalten", kurz: "M", untertitel: "KI-Zukunft gestalten", icon: "🚀", farbe: "#9b2a8a" },
];

export const STUFEN: Stufe[] = [
  { id: "0", name: "Einstieg", hinweis: "Ausprobieren, erzählen, sortieren. Fachwörter sind noch nicht nötig." },
  { id: "Ia", name: "Basis 1", hinweis: "Benennen und erkennen" },
  { id: "Ib", name: "Basis 2", hinweis: "Beschreiben und beachten" },
  { id: "II", name: "Vertieft", hinweis: "Vergleichen, erklären, bewusst einsetzen" },
  { id: "III", name: "Expertise", hinweis: "Bewerten, entwickeln, gestalten (eher für Lehrkräfte)" },
];

const s = (bereich: BereichId, stufe: StufeId, texte: string[]): KannSatz[] =>
  texte.map((text, i) => ({ id: `${bereich[0]}-${stufe}-${i + 1}`, bereich, stufe, text }));

export const KANN_SAETZE: KannSatz[] = [
  // ── Verstehen ──
  ...s("verstehen", "0", [
    "Ich kann Geräte und Apps nennen, die ich benutze, und sagen, ob dort vielleicht KI drinsteckt.",
    "Ich kann erklären, dass ein Computer nur tut, was Programme und Daten ihm vorgeben.",
    "Ich kann eine genaue Schritt-für-Schritt-Anleitung schreiben, der jemand anderes folgen kann.",
  ]),
  ...s("verstehen", "Ia", [
    "Ich kann Beispiele für KI im Alltag benennen (z. B. Sprachassistent, Übersetzer, Bilderkennung).",
    "Ich kann die Begriffe Daten, Algorithmus und Prompt benennen und je ein Beispiel geben.",
    "Ich kann einfache Regeln für die Bedienung eines Chatbots benennen.",
  ]),
  ...s("verstehen", "Ib", [
    "Ich kann Unterschiede zwischen Mensch und KI beschreiben (»Ein Mensch denkt, eine KI berechnet«).",
    "Ich kann beschreiben, dass eine KI aus vielen Beispielen lernt (Training) und dabei ein Modell entsteht.",
    "Ich kann beschreiben, dass ein Sprachmodell das wahrscheinlich nächste Wort berechnet.",
    "Ich kann beschreiben, was Bias bedeutet.",
  ]),
  ...s("verstehen", "II", [
    "Ich kann verschiedene KI-Anwendungen (Chatbot, Bilderkennung, Sprachsteuerung) vergleichen.",
    "Ich kann Grenzen und Fehlerquellen von KI erklären (Bias, Halluzinationen).",
    "Ich kann Grundideen wie maschinelles Lernen oder neuronale Netze erläutern.",
    "Ich kann Bedientechniken unterscheiden, mit denen man die Ausgabe gezielt beeinflusst.",
  ]),
  ...s("verstehen", "III", [
    "Ich kann Aufbau und Training von KI-Modellen bewerten.",
    "Ich kann beurteilen, welches Modell in welchem Zusammenhang sinnvoll ist.",
    "Ich kann eigene Bedien-Strategien für schwierige Aufgaben entwickeln.",
  ]),
  // ── Anwenden ──
  ...s("anwenden", "0", [
    "Ich kann mit Hilfe ein Programm oder eine App öffnen, benutzen und wieder schließen.",
    "Ich kann eine klare Frage oder einen klaren Auftrag formulieren.",
    "Ich weiß, dass mein Name, meine Adresse und Fotos von mir privat sind.",
  ]),
  ...s("anwenden", "Ia", [
    "Ich kann einen KI-Chatbot (z. B. AIS.chat über den QR-Code meiner Lehrkraft) öffnen und bedienen.",
    "Ich kann einfache Prompts eingeben und die Antwort lesen.",
    "Ich kann benennen, welche Daten nie in eine KI gehören.",
  ]),
  ...s("anwenden", "Ib", [
    "Ich kann einen Prompt verbessern, indem ich Rolle, Aufgabe, Hintergrund und Form angebe.",
    "Ich kann KI zum Lernen nutzen (z. B. mich abfragen lassen), statt sie die Aufgabe lösen zu lassen.",
    "Ich beachte die Datenschutzregeln, wenn ich KI-Tools benutze.",
    "Ich kann angeben, wann und wofür ich KI benutzt habe (KI-Nutzungserklärung).",
  ]),
  ...s("anwenden", "II", [
    "Ich kann KI-Tools gezielt für bestimmte Aufgaben, Lernsituationen und kreative Prozesse einsetzen.",
    "Ich kann meine Prompts verbessern, um bessere Ergebnisse zu bekommen und Verzerrungen zu vermeiden.",
    "Ich berücksichtige rechtliche Regeln (z. B. Urheberrecht) und ethische Leitlinien.",
    "Ich kann bewusst mit KI zusammenarbeiten und behalte die Entscheidungen selbst.",
  ]),
  ...s("anwenden", "III", [
    "Ich kann effiziente Arbeitsabläufe mit KI entwerfen.",
    "Ich kann KI-Tools für bestimmte Anforderungen anpassen und erweitern (z. B. eigene Assistenten).",
    "Ich kann umfassendes Wissen über Datenschutz und Datensicherheit nachweisen und anwenden.",
  ]),
  // ── Reflektieren ──
  ...s("reflektieren", "0", [
    "Ich kann erzählen, was mir an einer App oder einem Video gefällt und was mich stört.",
    "Ich weiß, dass Bilder und Texte im Internet falsch oder verändert sein können.",
    "Ich frage nach, wenn mir etwas komisch vorkommt.",
  ]),
  ...s("reflektieren", "Ia", [
    "Ich kann erkennen, dass eine KI-Antwort falsch sein kann, auch wenn sie überzeugend klingt.",
    "Ich kann Hinweise nennen, an denen man KI-Bilder oder Deepfakes erkennen kann.",
    "Ich kann ein Beispiel für eine unfaire Entscheidung durch eine KI schildern.",
  ]),
  ...s("reflektieren", "Ib", [
    "Ich kann eine KI-Antwort mit einer zweiten Quelle überprüfen.",
    "Ich kann Risiken von KI beobachten und beschreiben (z. B. Diskriminierung, Falschinformation).",
    "Ich kann beschreiben, wie KI Schule, Freizeit und Berufe verändert.",
  ]),
  ...s("reflektieren", "II", [
    "Ich kann diskutieren, ob KI bei Entscheidungen helfen soll (z. B. bei Bewerbungen).",
    "Ich kann KI-Inhalte auf Qualität und Verzerrungen prüfen und nach Ursachen suchen.",
    "Ich kann Folgen von KI für Gesellschaft und Arbeitswelt deuten.",
  ]),
  ...s("reflektieren", "III", [
    "Ich kann KI-gestützte Abläufe hinterfragen und mit anderen Methoden vergleichen.",
    "Ich kann die Rolle von KI für meinen Beruf bewerten und meine Weiterentwicklung danach ausrichten.",
    "Ich kann Auswirkungen von KI auf Schule, Gesellschaft, Politik und Wirtschaft beurteilen.",
  ]),
  // ── Mitgestalten ──
  ...s("mitgestalten", "0", [
    "Ich kann eine Idee nennen, wie ein Computer uns im Alltag helfen könnte.",
    "Ich kann in einem Gespräch über Regeln meine Meinung sagen.",
  ]),
  ...s("mitgestalten", "Ia", [
    "Ich kann Ideen auflisten, wo KI in Schule oder Alltag helfen kann.",
    "Ich kann einfache Verbesserungen für eine KI-Anwendung vorschlagen.",
  ]),
  ...s("mitgestalten", "Ib", [
    "Ich kann anderen begründet empfehlen, wann KI hilft und wann nicht.",
    "Ich beteilige mich an Diskussionen über KI-Regeln in der Klasse oder Schule.",
  ]),
  ...s("mitgestalten", "II", [
    "Ich kann ein eigenes KI-Projekt vorstellen und mit anderen teilen.",
    "Ich arbeite aktiv an KI-Projekten in Schule oder Verein mit.",
    "Ich kann Verbesserungen an genutzten Tools benennen und an die richtige Stelle weitergeben.",
    "Ich kann konkrete Einsatzideen für KI entwickeln und umsetzen.",
  ]),
  ...s("mitgestalten", "III", [
    "Ich kann KI-Regeln und ethische Leitlinien mitgestalten und veröffentlichen.",
    "Ich kann öffentlich über KI sprechen und mich an der Diskussion beteiligen.",
    "Ich kann KI-Projekte anstoßen, leiten und planen.",
  ]),
];

/** Ein Messpunkt der Selbsteinschätzung: Datum + angekreuzte Sätze. */
export type Einschaetzung = { datum: string; haken: string[] };

/** Ab diesem Anteil der Sätze gilt eine Stufe als erreicht. */
export const SCHWELLE = 2 / 3;

export function saetze(bereich: BereichId, stufe: StufeId): KannSatz[] {
  return KANN_SAETZE.filter(k => k.bereich === bereich && k.stufe === stufe);
}

/**
 * Wert eines Bereichs auf der Spinne, von 0 bis 5. Jede erreichte Stufe zählt 1,
 * aber nur, wenn alle Stufen darunter auch erreicht sind. Die erste nicht
 * erreichte Stufe zählt anteilig. So wächst die Spinne mit jedem Häkchen, und
 * man überspringt keine Stufe.
 */
export function bereichsWert(bereich: BereichId, haken: Iterable<string>): number {
  const set = new Set(haken);
  let wert = 0;
  for (const stufe of STUFEN) {
    const liste = saetze(bereich, stufe.id);
    const anteil = liste.filter(k => set.has(k.id)).length / liste.length;
    if (anteil >= SCHWELLE) { wert += 1; continue; }
    return wert + anteil / SCHWELLE;
  }
  return wert;
}

/** Die höchste erreichte Stufe eines Bereichs oder null, wenn noch keine erreicht ist. */
export function erreichteStufe(bereich: BereichId, haken: Iterable<string>): Stufe | null {
  const ganz = Math.floor(bereichsWert(bereich, haken) + 1e-9);
  return ganz === 0 ? null : STUFEN[ganz - 1];
}

export function werte(haken: Iterable<string>): Record<BereichId, number> {
  const liste = [...haken];
  return Object.fromEntries(BEREICHE.map(b => [b.id, bereichsWert(b.id, liste)])) as Record<BereichId, number>;
}

/** Mittelwert mehrerer Spinnen, z. B. für die Klasse. */
export function mittelwerte(alle: Record<BereichId, number>[]): Record<BereichId, number> {
  return Object.fromEntries(BEREICHE.map(b => [
    b.id, alle.length ? alle.reduce((s, w) => s + w[b.id], 0) / alle.length : 0,
  ])) as Record<BereichId, number>;
}

export const GUELTIGE_SATZ_IDS = new Set(KANN_SAETZE.map(k => k.id));

export const NAMENSNENNUNG =
  "Kompetenzraster nach Alles, Falck, Flick & Schulz (2025): »KI-Kompetenzen für Lehrende und Lernende«, VK:KIWA, " +
  "DOI 10.5281/zenodo.15047793, CC BY-SA 4.0. Stufe 0 angelehnt an van der Meer & Knellsen (2025), CC BY 4.0. " +
  "Für TT in »Ich kann …«-Sätze umformuliert, Niveau I geteilt; diese Bearbeitung steht unter CC BY-SA 4.0.";
