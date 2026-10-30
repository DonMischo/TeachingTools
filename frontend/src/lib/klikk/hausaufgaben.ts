/**
 * Hausaufgaben in »Klikk«: Mathe wird von Tag zu Tag schwerer, die letzte
 * Aufgabe ist eine Seite im Geschichtsbuch mit Verständnisfrage. Wer nur
 * durchklickt, um Punkte (und Extra-Zeit bei den Eltern) zu sammeln, kommt
 * so nicht weit: lesen dauert, und eine falsche Antwort heißt nochmal lesen.
 * Die Texte sind eigene, kurze Sachtexte.
 */
import { zufall } from "./feed";

export interface Lesetext {
  fach: string;
  seite: string;
  titel: string;
  text: string;
  frage: string;
  antworten: string[];
  /** Index der richtigen Antwort */
  richtig: number;
}

/** Seiten aus dem Geschichtsbuch (eigene Sachtexte) */
export const GESCHICHTE: Lesetext[] = [
  {
    fach: "Geschichte", seite: "S. 42–43", titel: "Der Limes – Grenze des Römischen Reiches",
    text: "Um 100 n. Chr. reichte das Römische Reich bis an den Rhein und die Donau. Dazwischen bauten die Römer eine Grenzanlage: den Limes. "
      + "Er war rund 550 Kilometer lang und bestand aus Wällen, Gräben, Palisaden und Steinmauern. Alle paar hundert Meter stand ein Wachturm, "
      + "dahinter lagen Kastelle mit Soldaten.\n\nDer Limes war keine undurchdringliche Mauer. Er sollte die Grenze überwachen: Wer ins Reich wollte, "
      + "musste an einem Durchgang vorbei. Dort wurden Waren kontrolliert und Zölle verlangt. Germanen und Römer trieben über den Limes hinweg Handel – "
      + "mit Vieh, Fellen, Keramik und Wein.\n\nHeute sind vom Limes vor allem Reste von Türmen und Kastellen zu sehen. Seit 2005 gehört er zum UNESCO-Welterbe.",
    frage: "Wozu diente der Limes vor allem?",
    antworten: [
      "Er sollte alle Germanen vollständig aussperren.", "Er überwachte die Grenze und kontrollierte Handel und Durchgang.",
      "Er leitete Wasser vom Rhein in die römischen Städte.", "Er war eine Heerstraße quer durch Germanien bis zur Ostsee.",
      "Er schützte die Kastelle vor Hochwasser an der Donau.", "Er war die Stadtmauer rund um Rom.",
    ],
    richtig: 1,
  },
  {
    fach: "Geschichte", seite: "S. 78–79", titel: "Gutenberg und der Buchdruck",
    text: "Im Mittelalter wurden Bücher von Hand abgeschrieben, oft von Mönchen in Klöstern. Für eine Bibel brauchte ein Schreiber manchmal Jahre. "
      + "Bücher waren deshalb selten und sehr teuer.\n\nUm 1450 entwickelte Johannes Gutenberg in Mainz ein neues Verfahren. Er goss einzelne Buchstaben "
      + "aus Metall, die man zu Wörtern und Zeilen zusammensetzen konnte. Nach dem Druck ließen sich die Buchstaben wieder auseinandernehmen und für die "
      + "nächste Seite neu ordnen. Dazu kamen eine Druckerpresse und eine Farbe, die auf Metall haftete.\n\nUm 1454 war Gutenbergs Bibel fertig. "
      + "In den folgenden Jahrzehnten entstanden in vielen Städten Druckereien. Flugblätter und Bücher verbreiteten Nachrichten und neue Ideen viel schneller als zuvor.",
    frage: "Was war an Gutenbergs Verfahren neu?",
    antworten: [
      "Bücher wurden erstmals auf Papier geschrieben.", "Mönche schrieben mit seiner Methode doppelt so schnell ab.",
      "Einzelne Metall-Buchstaben ließen sich immer wieder neu zusammensetzen.", "Jede Seite wurde als Ganzes in eine Holzplatte geschnitzt.",
      "Er erfand die Tinte, mit der man auf Pergament schreiben konnte.", "Er schrieb das erste Buch der Welt.",
    ],
    richtig: 2,
  },
  {
    fach: "Geschichte", seite: "S. 134–135", titel: "Kinderarbeit in der Industrialisierung",
    text: "Im 19. Jahrhundert entstanden in Deutschland immer mehr Fabriken. Viele Familien zogen vom Land in die Städte, weil sie dort Arbeit fanden. "
      + "Der Lohn reichte oft trotzdem nicht. Deshalb mussten auch Kinder mitarbeiten – in Spinnereien, Webereien und Bergwerken.\n\n"
      + "Manche Kinder waren erst sechs oder acht Jahre alt. Sie arbeiteten zwölf Stunden und länger, in Lärm, Staub und schlechter Luft. "
      + "Für die Schule blieb kaum Zeit, viele wurden krank.\n\n1839 erließ Preußen ein erstes Gesetz dagegen: Kinder unter neun Jahren durften "
      + "nicht mehr regelmäßig in Fabriken arbeiten, Jugendliche unter 16 Jahren höchstens zehn Stunden am Tag. Kontrolliert wurde das anfangs kaum. "
      + "Erst spätere Gesetze und die Schulpflicht drängten die Kinderarbeit nach und nach zurück.",
    frage: "Was regelte das preußische Gesetz von 1839?",
    antworten: [
      "Kinder unter neun Jahren durften nicht mehr regelmäßig in Fabriken arbeiten.", "Kinderarbeit war ab sofort überall verboten.",
      "Kinder bekamen den gleichen Lohn wie Erwachsene.", "Kinder mussten ab sechs Jahren in die Fabrik.",
      "Die Schulpflicht wurde für Fabrikkinder abgeschafft.", "Kinder durften nur noch nachts arbeiten.",
    ],
    richtig: 0,
  },
  {
    fach: "Geschichte", seite: "S. 210–211", titel: "Der Fall der Mauer",
    text: "Am 13. August 1961 riegelte die DDR die Grenze nach West-Berlin ab. Aus Stacheldraht wurde bald eine Mauer, mit Wachtürmen und einem "
      + "streng bewachten Grenzstreifen. Wer zu fliehen versuchte, riskierte sein Leben.\n\nIm Herbst 1989 gingen in der DDR Hunderttausende auf die "
      + "Straße und forderten Freiheit und offene Grenzen. Am Abend des 9. November 1989 verkündete das SED-Politbüromitglied Günter Schabowski auf einer "
      + "Pressekonferenz eine neue Reiseregelung. Auf die Frage, ab wann sie gelte, sagte er: »sofort, unverzüglich«.\n\nNoch in der Nacht strömten "
      + "Tausende zu den Grenzübergängen. Am Übergang Bornholmer Straße öffneten die Grenzsoldaten schließlich die Schlagbäume. Ein knappes Jahr später, "
      + "am 3. Oktober 1990, war Deutschland wiedervereinigt.",
    frage: "Wie lange stand die Berliner Mauer ungefähr?",
    antworten: ["etwa 5 Jahre", "etwa 28 Jahre", "etwa 10 Jahre", "etwa 18 Jahre", "etwa 35 Jahre", "etwa 45 Jahre"],
    richtig: 1,
  },
  {
    fach: "Geschichte", seite: "S. 156–157", titel: "Frauen dürfen wählen",
    text: "Lange durften in Deutschland nur Männer wählen. Frauenrechtlerinnen kämpften jahrzehntelang dafür, das zu ändern: mit Vereinen, Zeitungen, "
      + "Versammlungen und Bittschriften an die Regierung.\n\nNach dem Ende des Ersten Weltkriegs und dem Sturz des Kaisers kam im November 1918 der "
      + "Durchbruch: Das neue Wahlrecht galt für Männer und Frauen ab 20 Jahren.\n\nAm 19. Januar 1919 wählten Frauen in ganz Deutschland zum ersten Mal "
      + "– bei der Wahl zur Nationalversammlung. Die Wahlbeteiligung der Frauen war sehr hoch. 37 Frauen zogen als Abgeordnete in die Nationalversammlung "
      + "ein. Am 19. Februar 1919 hielt Marie Juchacz dort als erste Frau eine Rede in einem deutschen Parlament.",
    frage: "Wann durften Frauen in Deutschland zum ersten Mal wählen?",
    antworten: ["im Januar 1919", "im März 1871", "im Mai 1900", "im Mai 1933", "im Mai 1949", "im Oktober 1990"],
    richtig: 0,
  },
];

/** Deutsch: Goethe und Fontane (gemeinfrei) und eine eigene Kurzgeschichte */
export const DEUTSCH: Lesetext[] = [
  {
    fach: "Deutsch", seite: "Lesebuch S. 64–65", titel: "Johann Wolfgang von Goethe: Der Zauberlehrling (1797, Anfang)",
    text: "Hat der alte Hexenmeister\nSich doch einmal wegbegeben!\nUnd nun sollen seine Geister\nAuch nach meinem Willen leben.\n"
      + "Seine Wort und Werke\nMerkt ich und den Brauch,\nUnd mit Geistesstärke\nTu ich Wunder auch.\nWalle! walle\nManche Strecke,\n"
      + "Daß, zum Zwecke,\nWasser fließe\nUnd mit reichem, vollem Schwalle\nZu dem Bade sich ergieße.\n\n"
      + "Und nun komm, du alter Besen!\nNimm die schlechten Lumpenhüllen;\nBist schon lange Knecht gewesen:\nNun erfülle meinen Willen!\n"
      + "Auf zwei Beinen stehe,\nOben sei ein Kopf,\nEile nun und gehe\nMit dem Wassertopf!\n\n"
      + "Seht, er läuft zum Ufer nieder,\nWahrlich! ist schon an dem Flusse,\nUnd mit Blitzesschnelle wieder\nIst er hier mit raschem Gusse.\n"
      + "Schon zum zweiten Male!\nWie das Becken schwillt!\nWie sich jede Schale\nVoll mit Wasser füllt!\nStehe! stehe!\nDenn wir haben\n"
      + "Deiner Gaben\nVollgemessen! –\nAch, ich merk es! Wehe! wehe!\nHab ich doch das Wort vergessen!\n\n"
      + "(Im weiteren Gedicht flutet der Besen das ganze Haus. Erst der zurückgekehrte Meister kann ihn mit dem richtigen Wort stoppen.)",
    frage: "Warum kann der Lehrling den Besen nicht mehr anhalten?",
    antworten: [
      "Er hat das Zauberwort vergessen.", "Der Besen ist zu schnell für ihn.", "Der Meister hat den Besen verzaubert, bevor er ging.",
      "Der Lehrling will gar nicht, dass der Besen aufhört.", "Der Besen ist kaputtgegangen.", "Das Wasser hat den Zauberspruch weggespült.",
    ],
    richtig: 0,
  },
  {
    fach: "Deutsch", seite: "Lesebuch S. 112–113", titel: "Die Bank an der Haltestelle (Kurzgeschichte)",
    text: "Um 16:12 Uhr ging Mias Handy aus. Einfach so, mitten in einem Video, schwarz. Der Bus kam erst in zwanzig Minuten.\n\n"
      + "Sie setzte sich auf die Bank an der Haltestelle und wusste nicht, wohin mit ihren Händen. Neben ihr saß ein alter Mann mit einer "
      + "Thermoskanne, auf der ein verblasster Leuchtturm klebte. Er goss sich Tee in den Deckel und sagte: »Kaputt?«\n\n"
      + "»Akku leer«, sagte Mia.\n\n»Dann siehst du heute mal was«, sagte er und zeigte auf die andere Straßenseite. Dort hing ein Schild über "
      + "einem Laden, den Mia jeden Tag passierte: »Uhren & Schlüssel – seit 1962«. Sie hatte es nie bemerkt. Im Fenster saß eine graue Katze "
      + "zwischen lauter Weckern.\n\nAls der Bus kam, stand der Mann nicht auf. »Ich warte auf meine Enkelin«, sagte er. »Die hat auch immer "
      + "ein Handy in der Hand.« Mia lachte. Abends schrieb sie in ihr Heft: Katze, Wecker, 1962. Und dass zwanzig Minuten länger sind, als man denkt.",
    frage: "Was sitzt im Schaufenster des Ladens gegenüber?",
    antworten: [
      "eine graue Katze zwischen Weckern", "ein Hund mit Leuchtturm-Halsband", "ein Mädchen mit Handy",
      "eine Katze auf einem Stapel Schlüssel", "ein alter Mann mit Thermoskanne", "ein Papagei neben einer Standuhr",
    ],
    richtig: 0,
  },
  {
    fach: "Deutsch", seite: "Lesebuch S. 140–141", titel: "Theodor Fontane: John Maynard (1886, gekürzt)",
    text: "John Maynard!\n»Wer ist John Maynard?«\n»John Maynard war unser Steuermann,\naushielt er, bis er das Ufer gewann,\n"
      + "er hat uns gerettet, er trägt die Kron',\ner starb für uns, unsre Liebe sein Lohn.\nJohn Maynard.«\n\n"
      + "Die »Schwalbe« fliegt über den Eriesee,\nGischt schäumt um den Bug wie Flocken von Schnee;\nvon Detroit fliegt sie nach Buffalo –\n"
      + "die Herzen aber sind frei und froh,\nund die Passagiere mit Kindern und Fraun\nim Dämmerlicht schon das Ufer schaun,\n"
      + "und plaudernd an John Maynard heran\ntritt alles: »Wie weit noch, Steuermann?«\nDer schaut nach vorn und schaut in die Rund:\n"
      + "»Noch dreißig Minuten ... Halbe Stund.«\n\n"
      + "Alle Herzen sind froh, alle Herzen sind frei –\nda klingt's aus dem Schiffsraum her wie Schrei,\n»Feuer!« war es, was da klang,\n"
      + "ein Qualm aus Kajüt und Luke drang,\nein Qualm, dann Flammen lichterloh,\nund noch zwanzig Minuten bis Buffalo.\n\n"
      + "Und die Passagiere, buntgemengt,\nam Bugspriet stehn sie zusammengedrängt,\nam Bugspriet vorn ist noch Luft und Licht,\n"
      + "am Steuer aber lagert sich's dicht,\nund ein Jammern wird laut: »Wo sind wir? wo?«\nUnd noch fünfzehn Minuten bis Buffalo. –\n\n"
      + "Der Zugwind wächst, doch die Qualmwolke steht,\nder Kapitän nach dem Steuer späht,\ner sieht nicht mehr seinen Steuermann,\n"
      + "aber durchs Sprachrohr fragt er an:\n»Noch da, John Maynard?«\n»Ja, Herr. Ich bin.«\n»Auf den Strand! In die Brandung!«\n"
      + "»Ich halte drauf hin.«\nUnd das Schiffsvolk jubelt: »Halt aus! Hallo!«\nUnd noch zehn Minuten bis Buffalo. –\n\n"
      + "»Noch da, John Maynard?« Und Antwort schallt's\nmit ersterbender Stimme: »Ja, Herr, ich halt's!«\nUnd in die Brandung, was Klippe, was Stein,\n"
      + "jagt er die »Schwalbe« mitten hinein.\nSoll Rettung kommen, so kommt sie nur so.\nRettung: der Strand von Buffalo!\n\n"
      + "Das Schiff geborsten. Das Feuer verschwelt.\nGerettet alle. Nur einer fehlt!\n\n"
      + "(Zum Schluss trägt die ganze Stadt Buffalo John Maynard zu Grabe und setzt ihm einen Grabstein mit Dankspruch.)",
    frage: "Wie viele Minuten sind es noch bis Buffalo, als das Feuer entdeckt wird?",
    antworten: ["zwanzig Minuten", "dreißig Minuten", "fünfzehn Minuten", "zehn Minuten", "fünf Minuten", "eine Stunde"],
    richtig: 0,
  },
];

/** Wochenplan: Mo Geschichte, Di Zauberlehrling, Mi Geschichte, Do Kurzgeschichte, Fr John Maynard */
const PLAN: [Lesetext[], number][] = [[GESCHICHTE, 0], [DEUTSCH, 0], [GESCHICHTE, 2], [DEUTSCH, 1], [DEUTSCH, 2]];
export const ALLE_LESETEXTE = [...GESCHICHTE, ...DEUTSCH];

/** Die Buchseite des Tages; welche Geschichtsseite kommt, hängt an der Person (seed) */
export function lesetextFuer(seed: number, tag: number): Lesetext | null {
  const p = PLAN[tag];
  if (!p) return null;
  const [liste, versatz] = p;
  return liste === GESCHICHTE ? liste[(seed + versatz) % liste.length] : liste[versatz];
}

export type Aufgabe =
  | { art: "rechnen"; text: string; loesung: number }
  | { art: "lesen"; text: string; loesung: number; lesetext: Lesetext; reihenfolge: number[] };

/** Die letzte Aufgabe des Tages ist die Buchseite; die Antworten stehen je Person anders gemischt */
export function hausaufgabe(seed: number, tag: number, i: number, anzahl: number): Aufgabe {
  const t = lesetextFuer(seed, tag);
  if (i === anzahl - 1 && t) {
    const r = zufall(seed * 7 + tag);
    const reihenfolge = t.antworten.map((_, k) => k).sort(() => r() - 0.5);
    return { art: "lesen", text: `${t.fach}: ${t.seite} lesen`, loesung: t.richtig, lesetext: t, reihenfolge };
  }
  return { art: "rechnen", ...rechenAufgabe(seed, tag, i) };
}

/** Die Mathe-Aufgaben werden jeden Tag ein Stück schwerer */
export function rechenAufgabe(seed: number, tag: number, i: number): { text: string; loesung: number } {
  const r = zufall(seed * 97 + tag * 13 + i);
  const z = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  if (tag <= 0) { const a = z(6, 12), b = z(6, 9); return { text: `${a} · ${b}`, loesung: a * b }; }
  if (tag === 1) { const a = z(12, 19), b = z(3, 9); return { text: `${a} · ${b}`, loesung: a * b }; }
  if (tag === 2) { const a = z(6, 12), b = z(6, 9), c = z(12, 48); return { text: `${a} · ${b} + ${c}`, loesung: a * b + c }; }
  if (tag === 3) { const a = z(7, 19), b = z(6, 18), c = z(3, 8); return { text: `(${a} + ${b}) · ${c}`, loesung: (a + b) * c }; }
  const a = z(12, 19), b = z(4, 9), c = z(15, 60);
  return { text: `${a} · ${b} − ${c}`, loesung: a * b - c };
}
