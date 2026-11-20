/**
 * Main Character — Fragebogen: Alltagsszenen statt Selbsteinschätzung.
 *
 * Jede Antwort gibt Punkte für Klassen (welche Figur passt) und kleine
 * Zuschläge auf Talente (Wachstum je Wert, nicht für alle gleich). Manche
 * Antworten deuten auf eine Stärke oder Baustelle hin — das wird nur
 * vorgeschlagen, ausgesucht wird im Charakterbogen.
 *
 * Keine Antwort ist »falsch«; jede beschreibt einen Spielstil, keine Person.
 */
import {
  SPIELKLASSEN, type BaustelleId, type KlasseId, type StaerkeId, type Wert,
} from "@/lib/mainCharacter";

export interface Antwort {
  text: string;
  klassen: Partial<Record<KlasseId, number>>;
  talente?: Partial<Record<Wert, number>>;
  staerke?: StaerkeId;
  baustelle?: BaustelleId;
}
export interface Frage { id: string; frage: string; antworten: Antwort[] }

export const FRAGEN: Frage[] = [
  { id: "freitag", frage: "Freitagabend, nichts geplant. Du …", antworten: [
    { text: "zockst oder baust an einem Projekt, bis es klappt", klassen: { gamer: 2, nerd: 1 }, talente: { Z: .08 }, staerke: "hartnaeckig" },
    { text: "ziehst mit deiner Crew los", klassen: { hoodie: 2, checker: 1 }, talente: { M: .1 } },
    { text: "probierst Outfits aus und machst Fotos", klassen: { styler: 2, mitlaeufer: 1 }, talente: { S: .1 }, staerke: "kreativ" },
    { text: "gehst trainieren", klassen: { sportler: 2 }, talente: { E: .1 }, staerke: "sportlich" },
    { text: "liegst rum und scrollst", klassen: { bored: 2 }, talente: { E: .04 }, baustelle: "handy" },
  ] },
  { id: "thema", frage: "Neues Thema im Unterricht, keiner versteht es. Du …", antworten: [
    { text: "suchst so lange, bis du es kapierst", klassen: { nerd: 2 }, talente: { W: .1 }, staerke: "neugierig" },
    { text: "lernst mit anderen zusammen", klassen: { hoodie: 1, kuemmerer: 1 }, talente: { M: .05, W: .04 } },
    { text: "machst dir einen Plan, was bis wann sitzen muss", klassen: { checker: 2 }, talente: { Z: .08 }, staerke: "organisiert" },
    { text: "lernst sofort alles, auch was gar nicht drankommt", klassen: { streber: 2 }, talente: { W: .08, E: -.04 } },
    { text: "wartest erst mal ab, vielleicht wird es klarer", klassen: { bored: 1, mitlaeufer: 1 }, baustelle: "lernfrust" },
  ] },
  { id: "freund", frage: "Jemand aus deinem Freundeskreis hat Stress zu Hause. Du …", antworten: [
    { text: "bist sofort da, auch mitten in der Nacht", klassen: { kuemmerer: 2 }, talente: { M: .1 }, staerke: "empathisch" },
    { text: "hörst zu und lenkst ab", klassen: { hoodie: 2 }, talente: { M: .06 }, staerke: "humorvoll" },
    { text: "schickst was Aufmunterndes und hakst später nach", klassen: { checker: 1, sportler: 1 }, talente: { M: .04 } },
    { text: "willst helfen, weißt aber nicht genau wie", klassen: { nerd: 1, gamer: 1 }, talente: { M: .02 }, baustelle: "unsicher" },
  ] },
  { id: "morgen", frage: "Wie läuft dein Morgen?", antworten: [
    { text: "Wecker, Frühstück, los — läuft", klassen: { sportler: 2, checker: 1 }, talente: { E: .1 } },
    { text: "fünfmal Schlummern, irgendwie bin ich da", klassen: { bored: 2, gamer: 1 }, talente: { E: -.04 }, baustelle: "schlaf" },
    { text: "das Outfit steht seit gestern Abend", klassen: { styler: 2 }, talente: { S: .06 }, staerke: "organisiert" },
    { text: "erst mal checken, was die anderen so machen", klassen: { mitlaeufer: 2 }, talente: { S: .03, M: .03 } },
  ] },
  { id: "trend", frage: "An der Schule geht ein neuer Trend um. Du …", antworten: [
    { text: "warst schon dabei, bevor es ein Trend war", klassen: { styler: 2 }, talente: { S: .08 }, staerke: "kreativ" },
    { text: "machst mit, wenn alle mitmachen", klassen: { mitlaeufer: 2 }, talente: { M: .04 }, staerke: "flexibel" },
    { text: "machst nur mit, wenn er zu dir passt", klassen: { checker: 2 }, talente: { Z: .05 } },
    { text: "kriegst ihn gar nicht mit", klassen: { nerd: 1, gamer: 1, hoodie: 1 }, talente: { W: .03 }, staerke: "ruhig" },
  ] },
  { id: "ziel", frage: "Du hast ein großes Ziel (Instrument, Rang, Führerschein …). Du …", antworten: [
    { text: "übst jede Woche ein Stück", klassen: { sportler: 2, checker: 1 }, talente: { Z: .1 }, staerke: "hartnaeckig" },
    { text: "gibst alles, bis du umfällst", klassen: { streber: 2 }, talente: { Z: .06, E: -.06 } },
    { text: "fängst oft an und hörst wieder auf", klassen: { mitlaeufer: 1, bored: 1 }, baustelle: "aufschieben" },
    { text: "grindest es durch, wenn es ein Spiel ist", klassen: { gamer: 2 }, talente: { Z: .08 } },
  ] },
  { id: "gruppe", frage: "Gruppenarbeit. Deine Rolle:", antworten: [
    { text: "Am Ende mache ich lieber alles selbst.", klassen: { streber: 2 }, talente: { W: .05 } },
    { text: "Ich halte die Gruppe zusammen.", klassen: { kuemmerer: 1, hoodie: 1 }, talente: { M: .08 }, staerke: "empathisch" },
    { text: "Ich präsentiere.", klassen: { styler: 1, checker: 1 }, talente: { S: .06 }, staerke: "humorvoll" },
    { text: "Ich recherchiere.", klassen: { nerd: 2 }, talente: { W: .08 }, staerke: "neugierig" },
  ] },
  { id: "akku", frage: "Wie lädst du deinen Akku auf?", antworten: [
    { text: "allein, Kopfhörer auf", klassen: { hoodie: 1, gamer: 1, nerd: 1 }, talente: { E: .06 }, staerke: "ruhig" },
    { text: "mit vielen Leuten", klassen: { checker: 1, styler: 1, mitlaeufer: 1 }, talente: { M: .06 } },
    { text: "beim Sport", klassen: { sportler: 2 }, talente: { E: .1 }, staerke: "sportlich" },
    { text: "ehrlich gesagt kaum", klassen: { streber: 1, kuemmerer: 1 }, talente: { E: -.05 }, baustelle: "schlaf" },
  ] },
  { id: "handy", frage: "Deine Bildschirmzeit …", antworten: [
    { text: "ist hoch, aber ich merke es kaum", klassen: { bored: 2, mitlaeufer: 1 }, baustelle: "handy" },
    { text: "ist hoch, vor allem Games", klassen: { gamer: 2 }, talente: { Z: .03 } },
    { text: "nutze ich gezielt", klassen: { checker: 1, nerd: 1, sportler: 1 }, talente: { Z: .05 }, staerke: "organisiert" },
    { text: "geht für Content und Fotos drauf", klassen: { styler: 2 }, talente: { S: .06 }, staerke: "kreativ" },
  ] },
  { id: "mobbing", frage: "Jemand in der Klasse wird fertiggemacht. Du …", antworten: [
    { text: "gehst dazwischen", klassen: { checker: 1, kuemmerer: 2 }, talente: { M: .08 } },
    { text: "gehst danach zu der Person", klassen: { hoodie: 2 }, talente: { M: .06 }, staerke: "empathisch" },
    { text: "holst eine Lehrkraft", klassen: { nerd: 1, streber: 1 }, talente: { Z: .03, M: .03 } },
    { text: "weißt nicht, was du tun sollst", klassen: { mitlaeufer: 1, bored: 1 }, baustelle: "unsicher" },
  ] },
  { id: "nervt", frage: "Was nervt dich am meisten?", antworten: [
    { text: "wenn ich etwas nicht verstehe", klassen: { nerd: 2, streber: 1 }, talente: { W: .06 } },
    { text: "Langeweile", klassen: { gamer: 1, sportler: 1 }, talente: { E: .03, Z: .03 } },
    { text: "wenn es jemandem schlecht geht", klassen: { kuemmerer: 2 }, talente: { M: .06 } },
    { text: "wenn ich nicht gut aussehe", klassen: { styler: 2 }, talente: { S: .05 } },
    { text: "früh aufstehen", klassen: { bored: 2 }, staerke: "spaetzuender" },
  ] },
  { id: "zukunft", frage: "Nach dem Abschluss willst du …", antworten: [
    { text: "einen klaren Plan haben", klassen: { checker: 2, streber: 1 }, talente: { Z: .08 } },
    { text: "mit deinen Leuten zusammenbleiben", klassen: { hoodie: 2, kuemmerer: 1 }, talente: { M: .06 } },
    { text: "etwas machen, das dich begeistert", klassen: { sportler: 1, gamer: 1, nerd: 1 }, talente: { Z: .05 } },
    { text: "auffallen, mit eigenem Style", klassen: { styler: 2 }, talente: { S: .05 } },
    { text: "mal sehen, was kommt", klassen: { bored: 1, mitlaeufer: 2 }, staerke: "spaetzuender" },
  ] },
];

export interface Auswertung {
  klasse: KlasseId;
  /** Punkte je Klasse, für »passt auch zu …« */
  punkte: Record<KlasseId, number>;
  talente: Record<Wert, number>;
  /** vorgeschlagene Stärken (mindestens zwei Hinweise), stärkste zuerst */
  staerken: StaerkeId[];
  /** mögliche Baustellen (mindestens zwei Hinweise) — nur Vorschlag */
  baustellen: BaustelleId[];
}

const T_MIN = .7, T_MAX = 1.4;

/** `wahl[i]` = Index der Antwort auf Frage i (fehlende Fragen zählen nicht). */
export function auswerten(wahl: (number | undefined)[]): Auswertung {
  const punkte = Object.fromEntries(SPIELKLASSEN.map(k => [k, 0])) as Record<KlasseId, number>;
  const talente: Record<Wert, number> = { W: 1, Z: 1, S: 1, M: 1, E: 1 };
  const st: Partial<Record<StaerkeId, number>> = {};
  const bs: Partial<Record<BaustelleId, number>> = {};
  FRAGEN.forEach((f, i) => {
    const a = wahl[i] === undefined ? undefined : f.antworten[wahl[i]!];
    if (!a) return;
    for (const [k, v] of Object.entries(a.klassen)) punkte[k as KlasseId] += v!;
    for (const [w, v] of Object.entries(a.talente ?? {})) talente[w as Wert] += v!;
    if (a.staerke) st[a.staerke] = (st[a.staerke] ?? 0) + 1;
    if (a.baustelle) bs[a.baustelle] = (bs[a.baustelle] ?? 0) + 1;
  });
  for (const w of Object.keys(talente) as Wert[]) {
    talente[w] = Math.round(Math.max(T_MIN, Math.min(T_MAX, talente[w])) * 100) / 100;
  }
  // höchste Punktzahl gewinnt; bei Gleichstand die Klasse, die zuerst in der Liste steht
  const klasse = SPIELKLASSEN.reduce((a, b) => (punkte[b] > punkte[a] ? b : a));
  const oft = <T extends string>(m: Partial<Record<T, number>>) =>
    (Object.entries(m) as [T, number][]).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { klasse, punkte, talente, staerken: oft(st), baustellen: oft(bs) };
}
