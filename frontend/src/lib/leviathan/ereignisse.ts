/**
 * Schocks und Ereignisse.
 *
 * `p` ist die Grundwahrscheinlichkeit je Runde, `wenn` ein Faktor aus dem
 * Zustand des Landes (0 = kann gerade nicht passieren). Die meisten Schocks
 * werden so wahrscheinlicher, wenn das Land sie »vorbereitet« hat — echter
 * Zufall bleibt bei Natur und Ausland. `abfederung` dämpft schädliche
 * Wirkungen um bis zu 60 %.
 */
import { BEREICH } from "./bereiche";
import { TYP } from "./laender";
import { altAnteil, klemme, zufall } from "./hilfen";
import { HOCH_SCHLECHT, type Groesse, type Hebel, type Meldung, type Werte, type Zustand } from "./typen";

export type Gruppe = "politik" | "information" | "wirtschaft" | "klima" | "gesundheit" | "demografie" | "sicherheit" | "positiv";

export const GRUPPEN: Record<Gruppe, string> = {
  politik: "Politik & Macht",
  information: "Informationsraum",
  wirtschaft: "Wirtschaft & Finanzen",
  klima: "Klima & Umwelt",
  gesundheit: "Gesundheit & Soziales",
  demografie: "Demografie & Migration",
  sicherheit: "Sicherheit & Technik",
  positiv: "Gute Nachrichten",
};

export interface Ereignis {
  id: string;
  titel: string;
  icon: string;
  gruppe: Gruppe;
  text: string;
  p: number;
  wenn?: (z: Zustand) => number;
  /** Frühestens ab dieser Runde. */
  ab?: number;
  positiv?: boolean;
  /** Belastendes Thema; die Lehrkraft kann es abschalten. */
  heikel?: boolean;
  /** Kommt nur über Wahl oder Drehbuch, nie per Zufall. */
  nurDrehbuch?: boolean;
  /** Nur einmal je Spiel. */
  einmalig?: boolean;
  wirkung?: Partial<Werte>;
  ap?: number;
  abfederung?: Groesse;
  laufend?: { runden: number; wirkung: Partial<Werte> };
  sperre?: { hebel: Hebel; runden: number };
  krise?: "finanz" | "wirtschaft" | "katastrophe";
  quelle?: string;
  /** Besondere Wirkung; gibt einen Satz für die Meldung zurück. */
  sonder?: (z: Zustand, wurf: () => number) => string | void;
}

const kf = (z: Zustand) => (z.w.klima / 50) ** 2;
const typ = (z: Zustand) => TYP[z.typ];

/** Ein Autokrat übernimmt die Macht — über die Wahl oder das Drehbuch. */
export function machtuebernahme(z: Zustand): string {
  z.regierung = { ...z.regierung, autokrat: true, seit: z.runde };
  z.w.demokratie = klemme(z.w.demokratie - 12);
  z.w.desinformation = klemme(z.w.desinformation + 8);
  z.w.korruption = klemme(z.w.korruption + 5);
  z.gesperrt.rechtsstaat = Math.max(z.gesperrt.rechtsstaat ?? 0, 3);
  return "Die Pressefreiheit wird sofort eingeschränkt, »Rechtsstaat & Transparenz« ist 3 Runden gesperrt.";
}

export const EREIGNISSE: Ereignis[] = [
  // ── Politik & Macht ──────────────────────────────────────────────
  { id: "autokrat", titel: "Autoritärer Präsident gewählt", icon: "👑", gruppe: "politik", p: 0, nurDrehbuch: true,
    text: "Ein Kandidat, der »aufräumen« will und Gerichte wie Presse als Feinde des Volkes bezeichnet, gewinnt die Wahl.",
    quelle: "funke2023", sonder: machtuebernahme },
  { id: "amtszeit", titel: "Amtszeit per Verfassungsänderung verlängert", icon: "📜", gruppe: "politik", p: 0.15,
    wenn: (z) => (z.regierung.autokrat ? 1 : 0), abfederung: "zusammenhalt", quelle: "vdem2026",
    text: "Mit knapper Mehrheit wird die Verfassung geändert: Die Regierung darf länger im Amt bleiben.",
    wirkung: { demokratie: -10, vertrauen: -3 } },
  { id: "gerichte", titel: "Gerichte werden neu besetzt", icon: "🧑‍⚖️", gruppe: "politik", p: 0.12,
    wenn: (z) => (z.regierung.autokrat ? 2 : z.w.demokratie < 40 ? 1 : 0), quelle: "vdem2026",
    text: "Richterinnen und Richter werden in den Ruhestand geschickt und durch Vertraute der Regierung ersetzt.",
    wirkung: { rechtsstaat: -10, korruption: 8 }, sperre: { hebel: "rechtsstaat", runden: 2 } },
  { id: "medienkauf", titel: "Medien werden aufgekauft", icon: "📰", gruppe: "politik", p: 0.1,
    wenn: (z) => (z.w.demokratie < 50 ? (z.regierung.autokrat ? 2 : 1) : 0), abfederung: "bildung", quelle: "vdem2026",
    text: "Regierungsnahe Unternehmer kaufen die großen Zeitungen und Sender. Die Nachrichten klingen plötzlich freundlicher.",
    wirkung: { desinformation: 12, vertrauen: 5, demokratie: -5 } },
  { id: "skandal", titel: "Korruptionsskandal", icon: "💰", gruppe: "politik", p: 0.08,
    wenn: (z) => z.w.korruption / 40, abfederung: "rechtsstaat", quelle: "cpi2025",
    text: "Aufträge gingen an Firmen von Freunden der Regierung. Ein Teil des Haushalts ist einfach verschwunden.",
    sonder: (z) => {
      const weg = Math.max(1, Math.round(2 + z.w.korruption / 30));
      z.apKorrektur -= weg;
      if (z.w.demokratie > 40) {
        z.w.vertrauen = klemme(z.w.vertrauen - 6);
        return `Nächste Runde fehlen ${weg} Aktionspunkte. Die Presse berichtet – das Vertrauen sinkt.`;
      }
      z.w.korruption = klemme(z.w.korruption + 5);
      return `Nächste Runde fehlen ${weg} Aktionspunkte. Ohne freie Presse erfährt kaum jemand davon – die Korruption wächst weiter.`;
    } },
  { id: "whistleblower", titel: "Whistleblowerin packt aus", icon: "🔦", gruppe: "politik", p: 0.07, positiv: true,
    wenn: (z) => (z.w.korruption > 45 && z.w.demokratie > 35 ? 1 : 0), quelle: "rothstein2005",
    text: "Eine Beamtin legt interne Unterlagen offen. Kurzfristig ein Schock – langfristig wird aufgeräumt.",
    wirkung: { vertrauen: -4, korruption: -12 } },
  { id: "lobby", titel: "Lobbygesetz durchgewunken", icon: "🏢", gruppe: "politik", p: 0.06,
    wenn: (z) => (z.w.gleichheit < 45 ? 2 : 1), abfederung: "rechtsstaat", quelle: "rothstein2005",
    text: "Ein Gesetz, das fast wörtlich von einem Branchenverband stammt, senkt Abgaben für große Vermögen.",
    wirkung: { gleichheit: -6, wirtschaft: 2 } },
  { id: "koalitionsbruch", titel: "Regierungskrise", icon: "💥", gruppe: "politik", p: 0.07,
    wenn: (z) => (z.w.demokratie > 45 ? (z.w.desinformation > 50 ? 2 : 1) : 0), abfederung: "vertrauen",
    text: "Die Koalition zerbricht im Streit. Monatelang wird nur verwaltet, nicht regiert.",
    wirkung: { vertrauen: -3 }, ap: -3 },
  { id: "putsch", titel: "Putschversuch", icon: "🪖", gruppe: "politik", p: 0.05, heikel: true,
    wenn: (z) => (z.w.demokratie >= 20 && z.w.demokratie <= 65 && z.w.wirtschaft < 40 ? 1 : z.w.staatskapazitaet < 25 ? 1 : 0),
    abfederung: "zusammenhalt", quelle: "korridor",
    text: "Offiziere besetzen den Sender und das Parlament.",
    sonder: (z, wurf) => {
      const erfolg = 0.5 - z.w.zusammenhalt / 200 - z.w.demokratie / 200;
      z.gesperrt.rechtsstaat = Math.max(z.gesperrt.rechtsstaat ?? 0, 2);
      if (wurf() < erfolg) {
        z.regierung = { autokrat: true, seit: z.runde, geschlossen: true };
        z.w.demokratie = klemme(z.w.demokratie - 25);
        return "Der Putsch gelingt. Das Militär regiert, Wahlen gibt es erst wieder ab Demokratie 40.";
      }
      z.w.vertrauen = klemme(z.w.vertrauen - 5);
      z.w.zusammenhalt = klemme(z.w.zusammenhalt + 5);
      return "Tausende gehen auf die Straße, der Putsch scheitert. Das Land rückt zusammen.";
    } },
  { id: "gewalt", titel: "Politisch motivierte Gewalt", icon: "⚠️", gruppe: "politik", p: 0.05, heikel: true,
    wenn: (z) => (z.w.desinformation > 55 ? 1 : 0) * (z.w.vertrauen < 40 ? 2 : 1), abfederung: "zusammenhalt", quelle: "wef2025",
    text: "Nach monatelanger Hetze im Netz wird eine Kommunalpolitikerin angegriffen.",
    wirkung: { vertrauen: -5, zusammenhalt: -8 } },
  { id: "proteste", titel: "Massenproteste", icon: "📣", gruppe: "politik", p: 0.07,
    wenn: (z) => (z.w.vertrauen < 40 || z.regierung.autokrat ? 1 : 0),
    text: "Hunderttausende demonstrieren wochenlang in der Hauptstadt.",
    sonder: (z) => {
      if (z.regierung.autokrat && z.w.zusammenhalt > 50) {
        z.w.demokratie = klemme(z.w.demokratie + 8);
        return "Die Regierung muss nachgeben: Demokratie +8.";
      }
      if (z.regierung.autokrat) {
        z.w.demokratie = klemme(z.w.demokratie - 5);
        z.w.zusammenhalt = klemme(z.w.zusammenhalt - 3);
        return "Die Proteste werden niedergeschlagen: Demokratie −5, Zusammenhalt −3.";
      }
      z.w.vertrauen = klemme(z.w.vertrauen - 3);
      z.w.demokratie = klemme(z.w.demokratie + 2);
      return "Die Regierung gerät unter Druck (Vertrauen −3), die Beteiligung wächst (Demokratie +2).";
    } },
  { id: "generalstreik", titel: "Generalstreik", icon: "✊", gruppe: "politik", p: 0.05,
    wenn: (z) => (z.w.gleichheit < 40 ? 1 : 0), abfederung: "soziales",
    text: "Gewerkschaften legen das Land eine Woche lang lahm. Am Ende gibt es höhere Mindestlöhne.",
    wirkung: { wirtschaft: -5, gleichheit: 4 } },

  // ── Informationsraum ─────────────────────────────────────────────
  { id: "fakenews", titel: "Fake-News-Kampagne", icon: "🤥", gruppe: "information", p: 0.1,
    wenn: (z) => (1 + (50 - z.w.bildung) / 50) * (z.w.vertrauen < 45 ? 1.5 : 1), abfederung: "bildung", quelle: "vosoughi2018",
    text: "Erfundene Geschichten über »geheime Pläne« der Regierung werden millionenfach geteilt – schneller als jede Richtigstellung.",
    wirkung: { desinformation: 10, vertrauen: -5 }, laufend: { runden: 2, wirkung: { desinformation: 3 } } },
  { id: "deepfake", titel: "Deepfake kurz vor der Wahl", icon: "🎭", gruppe: "information", p: 0.08, ab: 3,
    wenn: (z) => ((z.runde + 1) % 2 === 0 && z.w.demokratie >= 30 ? 1 + z.runde / 12 : 0), abfederung: "bildung", quelle: "wef2025",
    text: "Ein täuschend echtes KI-Video zeigt die Regierungschefin bei einem angeblichen Bestechungsgespräch.",
    wirkung: { desinformation: 5 },
    sonder: (z) => { z.deepfake = true; return "Das kann die nächste Wahl kippen – außer die Menschen erkennen die Fälschung."; } },
  { id: "bots", titel: "Ausländisches Bot-Netz", icon: "🤖", gruppe: "information", p: 0.06,
    wenn: (z) => (z.w.desinformation > 45 ? 1.5 : 1), abfederung: "rechtsstaat", quelle: "wef2025",
    text: "Tausende Fake-Konten heizen jeden Streit an – mal von links, mal von rechts.",
    wirkung: { desinformation: 8, zusammenhalt: -4 } },
  { id: "algorithmus", titel: "Plattform belohnt Empörung", icon: "📱", gruppe: "information", p: 0.05, quelle: "sozialeMedien",
    text: "Eine große Plattform stellt ihren Algorithmus um: Was wütend macht, wird weiter oben angezeigt. Wie stark das wirkt, ist in der Forschung umstritten.",
    laufend: { runden: 3, wirkung: { desinformation: 2 } } },
  { id: "verschwoerung", titel: "Verschwörungsmythos geht viral", icon: "🌀", gruppe: "information", p: 0.03,
    wenn: (z) => (z.runde - z.letzteKatastrophe <= 2 ? 4 : 1), abfederung: "bildung", quelle: "vosoughi2018",
    text: "Nach der letzten Katastrophe glauben viele, sie sei »geplant« gewesen.",
    wirkung: { vertrauen: -6, soziales: -3 } },

  // ── Wirtschaft & Finanzen ────────────────────────────────────────
  { id: "bankenkrise", titel: "Bankenkrise", icon: "🏦", gruppe: "wirtschaft", p: 0.04,
    wenn: (z) => (z.w.wirtschaft > 70 ? 2 : 1), abfederung: "rechtsstaat", krise: "finanz", quelle: "funke2016",
    text: "Nach Jahren billiger Kredite platzt die Blase: Zwei große Banken müssen gerettet werden. Anders als bei einer normalen Rezession stärkt das oft die politischen Ränder.",
    wirkung: { wirtschaft: -14, gleichheit: -4, vertrauen: -6 } },
  { id: "rezession", titel: "Rezession", icon: "📉", gruppe: "wirtschaft", p: 0.07, abfederung: "soziales", krise: "wirtschaft", quelle: "algan2017",
    text: "Die Weltwirtschaft schwächelt, Aufträge bleiben aus, die Arbeitslosigkeit steigt.",
    wirkung: { wirtschaft: -7, vertrauen: -2 } },
  { id: "schuldenkrise", titel: "Staatsschuldenkrise", icon: "💸", gruppe: "wirtschaft", p: 0.25, krise: "finanz",
    wenn: (z) => (z.schulden > 18 ? 1 : 0), quelle: "annahme",
    text: "Niemand will dem Staat mehr zu normalen Zinsen Geld leihen. Es muss gespart werden.",
    wirkung: { vertrauen: -5 }, ap: -3, laufend: { runden: 2, wirkung: { wirtschaft: -2 } } },
  { id: "inflation", titel: "Inflationsschock", icon: "🛒", gruppe: "wirtschaft", p: 0.05, abfederung: "soziales",
    text: "Lebensmittel und Mieten werden in einem Jahr um ein Zehntel teurer. Wer wenig hat, trifft es am härtesten.",
    wirkung: { gleichheit: -5, vertrauen: -4 } },
  { id: "energiepreis", titel: "Energiepreisschock", icon: "⛽", gruppe: "wirtschaft", p: 0.07,
    wenn: (z) => (1 - z.w.energie / 100) * 1.5, abfederung: "energie", quelle: "way2022",
    text: "Gas und Öl werden auf dem Weltmarkt knapp. Wer noch viel importiert, zahlt doppelt.",
    wirkung: { wirtschaft: -6, gleichheit: -3 } },
  { id: "handelskrieg", titel: "Handelskrieg", icon: "🚢", gruppe: "wirtschaft", p: 0.05, abfederung: "staatskapazitaet",
    text: "Zwei Großmächte überziehen sich mit Zöllen. Die Exporte brechen ein.",
    wirkung: { wirtschaft: -5 } },
  { id: "lieferkette", titel: "Lieferkette reißt", icon: "🔗", gruppe: "wirtschaft", p: 0.05, abfederung: "staatskapazitaet",
    text: "Chips und seltene Erden sind monatelang nicht zu bekommen. Auch Solaranlagen werden knapp.",
    wirkung: { wirtschaft: -4, energie: -3 } },
  { id: "immobilienblase", titel: "Immobilienblase platzt", icon: "🏚️", gruppe: "wirtschaft", p: 0.04, abfederung: "rechtsstaat", krise: "finanz",
    text: "Tausende halbfertige Wohntürme stehen leer. Baufirmen gehen pleite, Ersparnisse sind weg.",
    wirkung: { wirtschaft: -8, vertrauen: -5 } },
  { id: "rohstoffcrash", titel: "Rohstoffpreis-Crash", icon: "🛢️", gruppe: "wirtschaft", p: 0.06,
    wenn: (z) => (typ(z).rohstoff > 0.2 ? 2 : typ(z).rohstoff > 0 ? 0.3 : 0), krise: "wirtschaft",
    text: "Der Ölpreis halbiert sich. Der Staatshaushalt hängt daran.",
    sonder: (z) => {
      const weg = Math.round(typ(z).rohstoff * 8);
      z.apKorrektur -= weg;
      z.w.wirtschaft = klemme(z.w.wirtschaft - typ(z).rohstoff * 20);
      return `Nächste Runde fehlen ${weg} Aktionspunkte; Wirtschaft −${Math.round(typ(z).rohstoff * 20)}.`;
    } },
  { id: "rohstofffund", titel: "Großer Rohstofffund", icon: "💎", gruppe: "wirtschaft", p: 0.03, einmalig: true, abfederung: "rechtsstaat",
    text: "Vor der Küste wird ein riesiges Gasfeld entdeckt. Viel Geld – aber auch viel Versuchung.",
    wirkung: { korruption: 8, energie: -3 }, ap: 3 },
  { id: "kiwelle", titel: "KI-Welle", icon: "🧠", gruppe: "wirtschaft", p: 0.08, ab: 2, quelle: "imf2024",
    text: "Neue KI-Systeme übernehmen Büroarbeit. Unternehmen verdienen prächtig, viele Angestellte bangen um ihre Stelle.",
    sonder: (z) => {
      const schutz = (z.w.bildung + z.w.soziales) / 200;
      const verlust = Math.round(8 * (1 - schutz));
      z.w.wirtschaft = klemme(z.w.wirtschaft + 6);
      z.w.gleichheit = klemme(z.w.gleichheit - verlust);
      return `Wirtschaft +6, Gleichheit −${verlust} (Bildung und Soziales fangen einen Teil ab).`;
    } },
  { id: "automatisierung", titel: "Automatisierungswelle", icon: "🦾", gruppe: "wirtschaft", p: 0.05, abfederung: "bildung",
    text: "Roboter ersetzen ganze Fertigungslinien.",
    wirkung: { wirtschaft: 4, gleichheit: -4 } },
  { id: "fachkraefte", titel: "Fachkräftemangel", icon: "🧑‍🔧", gruppe: "wirtschaft", p: 0.05,
    wenn: (z) => (altAnteil(z.bev) > 0.2 ? 2 : 0.3), abfederung: "familie",
    text: "In Pflege, Handwerk und Schulen fehlen Hunderttausende. Aufträge bleiben liegen.",
    wirkung: { wirtschaft: -5, soziales: -3 } },
  { id: "konzern", titel: "Großkonzern wandert ab", icon: "✈️", gruppe: "wirtschaft", p: 0.04,
    wenn: (z) => (z.w.energie < 35 ? 1.5 : 1), abfederung: "energie",
    text: "Ein großer Arbeitgeber verlegt seine Werke ins Ausland – wegen hoher Energiepreise.",
    wirkung: { wirtschaft: -5 } },

  // ── Klima & Umwelt ───────────────────────────────────────────────
  { id: "hitzewelle", titel: "Hitzewelle", icon: "🥵", gruppe: "klima", p: 0.06, wenn: kf, abfederung: "soziales",
    krise: "katastrophe", quelle: "lancetCountdown2025",
    text: "Wochenlang über 40 °C. Krankenhäuser sind überfüllt, besonders alte Menschen sterben.",
    wirkung: { soziales: -6, wirtschaft: -3 },
    sonder: (z) => { z.bev.alt *= 1 - 0.004 * (z.w.klima / 50); } },
  { id: "duerre", titel: "Dürre und Missernte", icon: "🌾", gruppe: "klima", p: 0.05, wenn: kf, abfederung: "staatskapazitaet", krise: "katastrophe",
    text: "Der Regen bleibt aus, die Ernte vertrocknet auf den Feldern.",
    wirkung: { wirtschaft: -6, zusammenhalt: -3 } },
  { id: "hochwasser", titel: "Jahrhunderthochwasser", icon: "🌊", gruppe: "klima", p: 0.05, wenn: kf, abfederung: "staatskapazitaet", krise: "katastrophe",
    text: "Flüsse treten über die Ufer, ganze Ortschaften stehen unter Wasser. Der Wiederaufbau kostet.",
    wirkung: { wirtschaft: -5 }, ap: -2 },
  { id: "waldbrand", titel: "Waldbrände", icon: "🔥", gruppe: "klima", p: 0.04, wenn: kf, abfederung: "staatskapazitaet", krise: "katastrophe",
    text: "Riesige Brände verschlingen Wälder; der Rauch liegt tagelang über den Städten.",
    wirkung: { soziales: -3, klima: 2 } },
  { id: "sturmflut", titel: "Sturmflut", icon: "🌀", gruppe: "klima", p: 0.02, abfederung: "staatskapazitaet", krise: "katastrophe",
    wenn: (z) => kf(z) * (typ(z).kueste ? 6 : 0.5),
    text: "Eine Sturmflut bricht durch die Deiche. Hunderttausende verlieren ihr Zuhause.",
    wirkung: { wirtschaft: -8, zusammenhalt: -4 },
    sonder: (z) => { z.bev.erwerb *= 0.995; z.bev.jung *= 0.995; } },
  { id: "versalzung", titel: "Versalzung des Grundwassers", icon: "🧂", gruppe: "klima", p: 0.02,
    wenn: (z) => (typ(z).kueste ? 4 : 0), abfederung: "staatskapazitaet",
    text: "Meerwasser drückt ins Grundwasser. Felder werden unfruchtbar, Trinkwasser wird knapp.",
    wirkung: { wirtschaft: -4, soziales: -4 }, laufend: { runden: 2, wirkung: { wirtschaft: -1 } } },
  { id: "wasser", titel: "Wasserknappheit", icon: "🚱", gruppe: "klima", p: 0.03, wenn: kf, abfederung: "staatskapazitaet",
    text: "Stauseen sind leer; Wasser wird rationiert.",
    wirkung: { wirtschaft: -4, zusammenhalt: -3 } },
  { id: "bestaeuber", titel: "Bestäuber sterben", icon: "🐝", gruppe: "klima", p: 0.02,
    wenn: (z) => (z.w.klima > 60 ? 1 : 0),
    text: "Bienen und andere Bestäuber verschwinden; Obsternten brechen ein.",
    wirkung: { wirtschaft: -3 } },
  { id: "chemieunfall", titel: "Chemieunfall", icon: "☣️", gruppe: "klima", p: 0.03,
    wenn: (z) => (z.w.rechtsstaat < 45 ? 2 : 1), abfederung: "rechtsstaat",
    text: "Ein Werk leitet giftige Abwässer in den Fluss – Kontrollen gab es seit Jahren nicht.",
    wirkung: { klima: 3, vertrauen: -4 } },
  { id: "heuschrecken", titel: "Heuschreckenplage", icon: "🦗", gruppe: "klima", p: 0.02, abfederung: "staatskapazitaet",
    wenn: (z) => (z.typ === "fragil" ? 2 : 0),
    text: "Riesige Schwärme fressen die Felder kahl.",
    wirkung: { wirtschaft: -5, soziales: -3 } },
  { id: "kipppunkt", titel: "Kipppunkt überschritten", icon: "🧊", gruppe: "klima", p: 0, nurDrehbuch: true, quelle: "armstrongMcKay2022",
    text: "Ein Teil des Klimasystems ist gekippt – etwa ein Eisschild oder der Permafrost. Das lässt sich nicht mehr zurückdrehen." },

  // ── Gesundheit & Soziales ────────────────────────────────────────
  { id: "pandemie", titel: "Pandemie", icon: "🦠", gruppe: "gesundheit", p: 0.03, abfederung: "vertrauen", krise: "katastrophe",
    text: "Ein neues Virus verbreitet sich weltweit. Wo die Menschen den Behörden vertrauen, halten sie sich eher an die Regeln.",
    wirkung: { soziales: -8, wirtschaft: -7, zusammenhalt: -5 } },
  { id: "antibiotika", titel: "Antibiotika wirken nicht mehr", icon: "💊", gruppe: "gesundheit", p: 0.02,
    wenn: (z) => (z.w.soziales < 40 ? 2 : 1),
    text: "Resistente Keime breiten sich in Kliniken aus.",
    laufend: { runden: 3, wirkung: { soziales: -1.5 } } },
  { id: "einsamkeit", titel: "Einsamkeitswelle", icon: "🪑", gruppe: "gesundheit", p: 0.05, abfederung: "zusammenhalt", quelle: "who2025",
    wenn: (z) => (z.w.zusammenhalt < 45 ? 2 : 1) * (altAnteil(z.bev) > 0.2 ? 1.5 : 1),
    text: "Jeder Vierte sagt, er habe niemanden, mit dem er reden kann. Einsamkeit macht krank.",
    wirkung: { soziales: -4, vertrauen: -2 } },
  { id: "jugendkrise", titel: "Psychische Krise bei Jugendlichen", icon: "😔", gruppe: "gesundheit", p: 0.04, abfederung: "soziales", quelle: "sozialeMedien",
    wenn: (z) => (z.w.zusammenhalt < 50 ? 1.5 : 1),
    text: "Therapieplätze für Jugendliche sind auf Monate ausgebucht. Ob Smartphones die Ursache sind, ist unter Fachleuten umstritten.",
    wirkung: { bildung: -3, soziales: -2 } },
  { id: "pflegenotstand", titel: "Pflegenotstand", icon: "🧓", gruppe: "gesundheit", p: 0.04, abfederung: "familie",
    wenn: (z) => (altAnteil(z.bev) > 0.22 ? 2.5 : 0.3),
    text: "Pflegeheime nehmen niemanden mehr auf; Angehörige geben ihren Job auf.",
    wirkung: { soziales: -5 } },
  { id: "wohnungskrise", titel: "Wohnungskrise", icon: "🏘️", gruppe: "gesundheit", p: 0.05, abfederung: "soziales",
    wenn: (z) => (z.w.wirtschaft > 55 ? 1.5 : 1),
    text: "In den Städten sind Mieten kaum noch bezahlbar. Junge Paare verschieben die Familiengründung.",
    wirkung: { gleichheit: -4, zusammenhalt: -3 },
    sonder: (z) => { z.bev.tfr = Math.max(0.6, z.bev.tfr - 0.05); } },
  { id: "drogen", titel: "Drogenkrise", icon: "💉", gruppe: "gesundheit", p: 0.03, abfederung: "soziales",
    wenn: (z) => (z.w.gleichheit < 40 ? 2 : 1),
    text: "Billige synthetische Drogen überschwemmen die Städte.",
    wirkung: { soziales: -4, zusammenhalt: -3 } },

  // ── Demografie & Migration ───────────────────────────────────────
  { id: "geburtenknick", titel: "Geburtenknick", icon: "👶", gruppe: "demografie", p: 0.04, quelle: "lancet2024",
    text: "Unsicherheit und hohe Kosten: Die Zahl der Geburten fällt auf ein Rekordtief.",
    sonder: (z) => { z.bev.tfr = Math.max(0.6, z.bev.tfr - 0.15); return "Kinder je Frau −0,15."; } },
  { id: "babyboom", titel: "Kleiner Babyboom", icon: "🍼", gruppe: "demografie", p: 0.03, positiv: true,
    wenn: (z) => (z.w.familie > 55 ? 2 : 1),
    text: "Gute Kitas und sichere Jobs: Mehr Paare entscheiden sich für Kinder.",
    sonder: (z) => { z.bev.tfr += 0.15; return "Kinder je Frau +0,15."; } },
  { id: "flucht", titel: "Fluchtbewegung aus dem Nachbarland", icon: "🧳", gruppe: "demografie", p: 0.04, heikel: true, abfederung: "familie",
    wenn: (z) => (["fragil", "schwellenland", "kueste"].includes(z.typ) ? 2 : 1),
    text: "Krieg und Dürre treiben Hunderttausende über die Grenze. Ob daraus später Fachkräfte oder Spannungen werden, entscheidet die Integration.",
    wirkung: { zusammenhalt: -3 }, ap: -2,
    sonder: (z) => {
      z.bev.erwerb *= 1.015;
      z.bev.jung *= 1.01;
      if (z.w.familie >= 50) {
        z.laufend.push({ id: "flucht-integration", titel: "Integration gelingt", runden: 3, wirkung: { wirtschaft: 1 } });
        return "Dank guter Integration arbeiten viele bald mit: 3 Runden Wirtschaft +1.";
      }
      return "Ohne Integrationsangebote bleiben viele lange ohne Arbeit.";
    } },
  { id: "braindrain", titel: "Junge Fachkräfte wandern ab", icon: "🛫", gruppe: "demografie", p: 0.05, abfederung: "wirtschaft",
    wenn: (z) => (z.w.wirtschaft < 45 || z.regierung.autokrat ? 2 : 0.5),
    text: "Gut ausgebildete Junge sehen keine Zukunft im Land und gehen.",
    wirkung: { bildung: -5 }, sonder: (z) => { z.bev.erwerb *= 0.99; } },
  { id: "rueckkehr", titel: "Rückkehrwelle", icon: "🏡", gruppe: "demografie", p: 0.03, positiv: true,
    wenn: (z) => (z.w.wirtschaft > 55 && z.w.demokratie > 55 ? 1 : 0),
    text: "Ausgewanderte kommen zurück – mit Erfahrung und Ideen.",
    wirkung: { bildung: 4 }, sonder: (z) => { z.bev.erwerb *= 1.005; } },
  { id: "landflucht", titel: "Landflucht", icon: "🚌", gruppe: "demografie", p: 0.04, abfederung: "soziales",
    wenn: (z) => (["schwellenland", "fragil"].includes(z.typ) ? 2 : 0.5),
    text: "Dörfer leeren sich, am Stadtrand wachsen Siedlungen ohne Wasser und Strom.",
    wirkung: { zusammenhalt: -3, soziales: -3 } },

  // ── Sicherheit & Technik ─────────────────────────────────────────
  { id: "cyberangriff", titel: "Cyberangriff", icon: "💻", gruppe: "sicherheit", p: 0.05, abfederung: "rechtsstaat",
    wenn: (z) => (z.w.wirtschaft > 55 ? 1.5 : 1),
    text: "Erpresser legen Krankenhäuser und Stadtverwaltungen lahm.",
    wirkung: { soziales: -4, vertrauen: -3 }, ap: -1 },
  { id: "kabel", titel: "Sabotage an Unterseekabeln", icon: "🔌", gruppe: "sicherheit", p: 0.03, abfederung: "energie",
    text: "Unbekannte durchtrennen Daten- und Stromkabel am Meeresgrund.",
    wirkung: { wirtschaft: -4 } },
  { id: "blackout", titel: "Großer Stromausfall", icon: "🕯️", gruppe: "sicherheit", p: 0.03, abfederung: "energie",
    wenn: (z) => (z.w.energie < 30 || z.w.klima > 65 ? 2 : 1),
    text: "Das alte Netz bricht in einer Hitzeperiode zusammen – zwei Tage ohne Strom.",
    wirkung: { wirtschaft: -4 } },
  { id: "sonnensturm", titel: "Sonnensturm", icon: "☀️", gruppe: "sicherheit", p: 0.01,
    text: "Ein gewaltiger Sonnensturm stört Satelliten und Stromnetze weltweit.",
    wirkung: { wirtschaft: -3, soziales: -2 } },
  { id: "krieg", titel: "Krieg im Nachbarland", icon: "💣", gruppe: "sicherheit", p: 0.02, heikel: true, abfederung: "vertrauen",
    text: "Im Nachbarland bricht Krieg aus. Energie wird teuer, Menschen fliehen, die Rüstung verschlingt Geld.",
    wirkung: { wirtschaft: -4 }, ap: -2,
    sonder: (z) => { z.bev.erwerb *= 1.01; } },

  // ── Gute Nachrichten ─────────────────────────────────────────────
  { id: "batterie", titel: "Durchbruch bei Batteriespeichern", icon: "🔋", gruppe: "positiv", p: 0.06, positiv: true, quelle: "way2022",
    wenn: (z) => (z.w.energie >= 40 ? 1 : 0),
    text: "Neue Speicher kosten nur noch einen Bruchteil. Die Lernkurve macht einen Sprung.",
    wirkung: { energie: 5 }, sonder: (z) => { z.energieKumuliert += 15; } },
  { id: "medizin", titel: "Medizinischer Durchbruch", icon: "🔬", gruppe: "positiv", p: 0.04, positiv: true,
    wenn: (z) => (z.w.bildung >= 60 ? 1 : 0),
    text: "Forschende im Land entwickeln eine neue Therapie.",
    wirkung: { soziales: 6 } },
  { id: "buergerrat", titel: "Bürgerrat löst einen Streit", icon: "🪑", gruppe: "positiv", p: 0.06, positiv: true,
    wenn: (z) => (z.w.demokratie >= 50 ? 1 : 0),
    text: "Zufällig ausgeloste Bürgerinnen und Bürger finden einen Kompromiss, auf den sich die Parteien jahrelang nicht einigen konnten.",
    wirkung: { vertrauen: 5, desinformation: -4 } },
  { id: "frieden", titel: "Friedensabkommen in der Region", icon: "🕊️", gruppe: "positiv", p: 0.04, positiv: true,
    text: "Ein lange schwelender Konflikt in der Nachbarschaft wird beigelegt.",
    wirkung: { zusammenhalt: 2 }, ap: 2 },
  { id: "klimafonds", titel: "Internationaler Klimafonds", icon: "🌐", gruppe: "positiv", p: 0.04, positiv: true,
    wenn: (z) => (typ(z).kueste || z.typ === "fragil" ? 3 : 0),
    text: "Reiche Länder zahlen in einen Fonds für Klimaschäden ein.",
    sonder: (z) => {
      const an = Math.round(3 * (1 - z.w.korruption / 100));
      z.apKorrektur += an;
      return an < 3 ? `Nur ${an} von 3 Aktionspunkten kommen an – der Rest versickert.` : "Nächste Runde +3 Aktionspunkte.";
    } },
  { id: "presse", titel: "Unabhängige Presse deckt auf", icon: "🗞️", gruppe: "positiv", p: 0.05, positiv: true, quelle: "vdem2026",
    wenn: (z) => (z.w.demokratie >= 50 && z.w.korruption > 30 ? 1 : 0),
    text: "Eine Recherche bringt ein Schmiergeld-Netzwerk ans Licht.",
    wirkung: { korruption: -8, vertrauen: -2 } },
  { id: "faktencheck", titel: "Faktencheck-Netzwerk gegründet", icon: "✅", gruppe: "positiv", p: 0.05, positiv: true,
    wenn: (z) => (z.w.demokratie >= 45 && z.w.bildung >= 50 ? 1 : 0),
    text: "Redaktionen und Schulen prüfen gemeinsam, was im Netz kursiert.",
    wirkung: { desinformation: -8 } },
  { id: "prebunking", titel: "Prebunking-Kampagne wirkt", icon: "🛡️", gruppe: "positiv", p: 0.06, positiv: true, quelle: "roozenbeek2022",
    wenn: (z) => (z.w.bildung >= 60 ? 1 : 0),
    text: "Kurze Clips vor Videos erklären Manipulationstricks. Viele erkennen Falschmeldungen jetzt schneller.",
    wirkung: { desinformation: -6 } },
  { id: "ehrenamt", titel: "Ehrenamts-Boom", icon: "🙌", gruppe: "positiv", p: 0.05, positiv: true, quelle: "whr2025",
    wenn: (z) => (z.w.zusammenhalt >= 60 ? 1 : 0),
    text: "Vereine, Tafeln und Nachbarschaftshilfen haben so viele Freiwillige wie nie.",
    wirkung: { zusammenhalt: 4, soziales: 2 } },
  { id: "sportfest", titel: "Großes Sportereignis", icon: "🏆", gruppe: "positiv", p: 0.05, positiv: true,
    text: "Das Land richtet ein großes Turnier aus. Wochenlang feiern alle zusammen.",
    wirkung: { zusammenhalt: 4 }, sonder: (z) => { z.lqSchock += 3; } },
];

export const EREIGNIS: Record<string, Ereignis> = Object.fromEntries(EREIGNISSE.map((e) => [e.id, e]));

const vz = (x: number) => (x > 0 ? `+${Math.round(x)}` : `−${Math.abs(Math.round(x))}`);

/** Stürmische Zeiten: Schocks treffen härter. */
const WUCHT = { ruhig: 1, normal: 1, stuermisch: 1.25, zusammenbruch: 1.6 } as const;

/** Wendet ein Ereignis auf den Zustand an und schreibt die Meldung. */
export function anwenden(z: Zustand, e: Ereignis): Meldung {
  const teile: string[] = [];
  const wucht = WUCHT[z.einst.krise];
  const daempfung = (g: Groesse, d: number) => {
    const schaedlich = HOCH_SCHLECHT.has(g) ? d > 0 : d < 0;
    if (!schaedlich) return d;
    return d * wucht * (e.abfederung ? 1 - 0.6 * z.w[e.abfederung] / 100 : 1);
  };
  for (const [g, d] of Object.entries(e.wirkung ?? {}) as [Groesse, number][]) {
    const wirk = daempfung(g, d);
    z.w[g] = klemme(z.w[g] + wirk);
    if (Math.round(wirk) !== 0) teile.push(`${BEREICH[g].name} ${vz(wirk)}`);
  }
  if (e.ap) {
    const ap = e.ap < 0 ? Math.round(e.ap * wucht) : e.ap;
    z.apKorrektur += ap;
    teile.push(`nächste Runde ${vz(ap)} Aktionspunkte`);
  }
  if (e.laufend) z.laufend.push({ id: e.id, titel: e.titel, ...e.laufend, wirkung: { ...e.laufend.wirkung } });
  if (e.sperre) {
    z.gesperrt[e.sperre.hebel] = Math.max(z.gesperrt[e.sperre.hebel] ?? 0, e.sperre.runden);
    teile.push(`»${BEREICH[e.sperre.hebel].name}« ${e.sperre.runden} Runden gesperrt`);
  }
  if (e.krise === "finanz") { z.letzteFinanzkrise = z.runde; z.letzteKrise = z.runde; }
  if (e.krise === "wirtschaft") z.letzteKrise = z.runde;
  if (e.krise === "katastrophe") z.letzteKatastrophe = z.runde;
  const satz = e.sonder?.(z, () => zufall(z));
  if (e.abfederung && !e.positiv) teile.push(`abgefedert durch ${BEREICH[e.abfederung].name}`);
  if (!z.gewesen.includes(e.id)) z.gewesen.push(e.id);
  return {
    runde: z.runde, ereignis: e.id, titel: e.titel, text: e.text, icon: e.icon, positiv: e.positiv, quelle: e.quelle,
    folgen: [teile.join(", "), satz].filter(Boolean).join(" "),
  };
}
