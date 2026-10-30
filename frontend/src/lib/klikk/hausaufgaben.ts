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

/** Eine Buchseite pro Schultag (Mo–Fr) */
export const LESETEXTE: Lesetext[] = [
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

export type Aufgabe =
  | { art: "rechnen"; text: string; loesung: number }
  | { art: "lesen"; text: string; loesung: number; lesetext: Lesetext; reihenfolge: number[] };

/** Die letzte Aufgabe des Tages ist die Buchseite; die Antworten stehen je Person anders gemischt */
export function hausaufgabe(seed: number, tag: number, i: number, anzahl: number): Aufgabe {
  if (i === anzahl - 1 && LESETEXTE[tag]) {
    const t = LESETEXTE[tag];
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
