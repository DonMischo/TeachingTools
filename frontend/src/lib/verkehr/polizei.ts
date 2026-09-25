/**
 * Gespräch mit der Polizei: nach Schimpfen, bei Rot oder über die Gleise.
 * Vier Beamte — nett oder grummelig, Frau oder Mann. Jede Antwort ist gut,
 * so lala oder frech; frech treibt die Stufe hoch. Stufe 3 ist das Ende der
 * Leiter: mit auf die Wache, die Eltern werden angerufen, Bußgeld (zahlen
 * die Eltern). Höher geht es nicht.
 */

export type Anlass = "beleidigung" | "rot" | "gleis";
export type Laune = "nett" | "grummelig";

export type Beamter = { name: string; frau: boolean; laune: Laune; bild: string };

export const BEAMTE: Beamter[] = [
  { name: "Polizeihauptmeisterin Schulz", frau: true, laune: "nett", bild: "👮‍♀️" },
  { name: "Polizeimeister Becker", frau: false, laune: "nett", bild: "👮‍♂️" },
  { name: "Polizeikommissarin Yılmaz", frau: true, laune: "grummelig", bild: "👮‍♀️" },
  { name: "Polizeiobermeister Krause", frau: false, laune: "grummelig", bild: "👮‍♂️" },
];

/** Stufen: 0 Gespräch, 1 Ermahnung, 2 Verwarnung (wird notiert), 3 Gewahrsam + Eltern + Bußgeld. */
export const STUFEN = [
  { name: "Gespräch", icon: "💬" },
  { name: "Ermahnung", icon: "☝️" },
  { name: "Verwarnung", icon: "📝" },
  { name: "Wache, Eltern, Bußgeld", icon: "🚓" },
] as const;
export const MAX_STUFE = 3;

export type Antwort = { text: string; wirkung: -1 | 0 | 1; };
type Schritt = { nett: string; grummelig: string; antworten: Antwort[] };

const EROEFFNUNG: Record<Anlass, { nett: string; grummelig: string }> = {
  beleidigung: {
    nett: "Hallo! Ich hab gerade gesehen, wie du jemanden beschimpft hast. Magst du mir erzählen, was da los war?",
    grummelig: "Na, das war ja eine Ansage. Beschimpfen im Straßenverkehr? Stehen bleiben, wir müssen reden.",
  },
  rot: {
    nett: "Hallo! Du bist eben bei Rot über die Ampel gegangen. Weißt du, warum das gefährlich ist?",
    grummelig: "Bei Rot über die Straße. Ich hab's genau gesehen. Was sollte das?",
  },
  gleis: {
    nett: "Hey, du bist gerade über die Gleise gelaufen — nicht am Übergang. Das hat mich ganz schön erschreckt!",
    grummelig: "Über die Gleise? Eine Bahn braucht hunderte Meter zum Bremsen. Erklär mir das mal.",
  },
};

/** Drei Runden Gespräch; je Runde drei Antworten (gemischt angezeigt). */
const RUNDEN: Record<Anlass, Schritt[]> = {
  beleidigung: [
    { nett: "", grummelig: "", antworten: [
      { text: "Das war nicht okay. Ich hab mich geärgert, aber das ist keine Entschuldigung.", wirkung: -1 },
      { text: "Der hat doch angefangen!", wirkung: 0 },
      { text: "Na und? Das geht Sie gar nichts an.", wirkung: 1 },
    ] },
    { nett: "Wie könntest du es beim nächsten Mal anders machen?", grummelig: "Und was machst du beim nächsten Mal?", antworten: [
      { text: "Tief durchatmen, weitergehen — und wenn nötig einen Erwachsenen holen.", wirkung: -1 },
      { text: "Weiß nicht … einfach nichts sagen?", wirkung: 0 },
      { text: "Noch lauter schimpfen, dann hört er's wenigstens.", wirkung: 1 },
    ] },
    { nett: "Möchtest du dich entschuldigen?", grummelig: "Eine Entschuldigung wäre angebracht.", antworten: [
      { text: "Ja. Es tut mir leid.", wirkung: -1 },
      { text: "Hm, meinetwegen.", wirkung: 0 },
      { text: "Nö. Schreiben Sie's doch auf.", wirkung: 1 },
    ] },
  ],
  rot: [
    { nett: "", grummelig: "", antworten: [
      { text: "Weil Autos kommen können und mich vielleicht nicht sehen. Das war falsch.", wirkung: -1 },
      { text: "Es kam doch gar kein Auto.", wirkung: 0 },
      { text: "Rot ist doch nur eine Empfehlung.", wirkung: 1 },
    ] },
    { nett: "Und wenn kleine Kinder zugeschaut haben?", grummelig: "Da standen Kinder an der Ampel. Und jetzt?", antworten: [
      { text: "Die machen das nach. Ich will ein Vorbild sein.", wirkung: -1 },
      { text: "Hab ich nicht drauf geachtet.", wirkung: 0 },
      { text: "Die sollen halt selber aufpassen.", wirkung: 1 },
    ] },
    { nett: "Was machst du ab jetzt an der Ampel?", grummelig: "Also, was gilt ab jetzt?", antworten: [
      { text: "Warten, bis es grün ist — und dann trotzdem schauen.", wirkung: -1 },
      { text: "Meistens warten.", wirkung: 0 },
      { text: "Rennen, dann bin ich schneller drüben.", wirkung: 1 },
    ] },
  ],
  gleis: [
    { nett: "", grummelig: "", antworten: [
      { text: "Das war gefährlich. Ich nehme den Übergang.", wirkung: -1 },
      { text: "Ich hab doch geschaut.", wirkung: 0 },
      { text: "Die Bahn kann ja bremsen.", wirkung: 1 },
    ] },
    { nett: "Weißt du, wie lange eine Straßenbahn zum Bremsen braucht?", grummelig: "Und der Bremsweg einer Bahn?", antworten: [
      { text: "Viel länger als ein Auto — sie kann nicht ausweichen.", wirkung: -1 },
      { text: "Ein paar Meter?", wirkung: 0 },
      { text: "Mir doch egal.", wirkung: 1 },
    ] },
    { nett: "Versprichst du, nur noch am Übergang zu gehen?", grummelig: "Nur noch am Übergang. Verstanden?", antworten: [
      { text: "Ja, versprochen.", wirkung: -1 },
      { text: "Wenn's nicht zu weit ist.", wirkung: 0 },
      { text: "Mal sehen.", wirkung: 1 },
    ] },
  ],
};

/** Was die Polizei am Ende sagt, je Stufe. */
const ENDE: Record<number, { nett: string; grummelig: string; punkte: number }> = {
  0: { nett: "Gut, dass wir geredet haben. Pass auf dich auf — und schönen Tag noch!", grummelig: "Na also. Geht doch. Weitergehen.", punkte: 5 },
  1: { nett: "Das war eine Ermahnung. Ich glaube, du hast es verstanden.", grummelig: "Ermahnung. Beim nächsten Mal wird's ernst.", punkte: -5 },
  2: { nett: "Ich muss dich verwarnen und schreibe das auf. Das muss nicht wieder vorkommen.", grummelig: "Verwarnung. Das kommt in den Bericht.", punkte: -15 },
  3: { nett: "So geht es nicht weiter. Du kommst mit auf die Wache, wir rufen deine Eltern an. Es gibt ein Bußgeld — das zahlen deine Eltern.",
    grummelig: "Schluss jetzt. Mitkommen auf die Wache. Deine Eltern werden angerufen, und es gibt ein Bußgeld.", punkte: -30 },
};

export type Gespraech = {
  anlass: Anlass; beamter: Beamter;
  runde: number; stufe: number;
  /** Was der Beamte gerade sagt. */
  sagt: string;
  antworten: Antwort[];
  /** Ende: Ergebnis mit Punkten. */
  ende: { stufe: number; text: string; punkte: number } | null;
};

/** Gespräch beginnen: Beamter per Zufall, grummelige fangen bei Schimpfen gleich mit Stufe 1 an. */
export function beginne(anlass: Anlass, rnd: () => number = Math.random): Gespraech {
  const beamter = BEAMTE[Math.floor(rnd() * BEAMTE.length)];
  const stufe = anlass === "beleidigung" && beamter.laune === "grummelig" ? 1 : 0;
  return { anlass, beamter, runde: 0, stufe, sagt: EROEFFNUNG[anlass][beamter.laune], antworten: mische(RUNDEN[anlass][0].antworten, rnd), ende: null };
}

function mische<T>(l: T[], rnd: () => number): T[] {
  const a = [...l];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Eine Antwort wählen: Stufe rauf (frech) oder runter (einsichtig); bei Stufe 3 ist sofort Schluss. */
export function antworte(g: Gespraech, a: Antwort, rnd: () => number = Math.random): Gespraech {
  if (g.ende) return g;
  // Grummelige lassen weniger durchgehen: »so lala« zählt bei ihnen halb als frech
  const halb = a.wirkung === 0 && g.beamter.laune === "grummelig" && rnd() < 0.5 ? 1 : 0;
  const stufe = Math.max(0, Math.min(MAX_STUFE, g.stufe + a.wirkung + halb));
  const runde = g.runde + 1;
  const schluss = stufe >= MAX_STUFE || runde >= RUNDEN[g.anlass].length;
  if (schluss) {
    const e = ENDE[stufe];
    return { ...g, runde, stufe, antworten: [], sagt: e[g.beamter.laune], ende: { stufe, text: e[g.beamter.laune], punkte: e.punkte } };
  }
  const r = RUNDEN[g.anlass][runde];
  // Die Reaktion hängt an der Antwort: einsichtig = freundlicher Ton
  const vorweg = a.wirkung < 0 ? (g.beamter.laune === "nett" ? "Das finde ich gut. " : "Hm. Immerhin. ")
    : a.wirkung > 0 ? (g.beamter.laune === "nett" ? "Moment mal, so redest du nicht mit mir. " : "Pass auf deinen Ton auf! ") : "";
  return { ...g, runde, stufe, sagt: vorweg + r[g.beamter.laune], antworten: mische(r.antworten, rnd) };
}
