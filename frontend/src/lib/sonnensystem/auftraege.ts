/**
 * Forschungsaufträge für den Flugmodus.
 *
 * Ein Auftrag ist ein Rätsel, das zu einem Himmelskörper führt. Wer hinfliegt
 * und ihn scannt, bekommt eine Frage, deren Antwort im Steckbrief steht —
 * lesen lohnt sich also. Gezählt wird nur im Browser, ohne Hauspunkte.
 *
 * Die Reihenfolge ist beliebig: jeder Auftrag zählt, sobald sein Ziel gescannt
 * wird — auch wenn man zufällig dort vorbeikommt. Sortiert sind sie von
 * Grundwissen (Stufe 1) bis zu speziellem Wissen (Stufe 3); je Himmelskörper
 * gibt es höchstens einen Auftrag.
 *
 * Die richtige Antwort steht immer an Position 0; die Oberfläche mischt.
 */

export interface Auftrag {
  id: string;
  /** Das Rätsel: sagt, was gesucht ist, aber nicht den Namen. */
  hinweis: string;
  ziel: string;
  frage: string;
  antworten: [string, string, string, string];
  erklaerung: string;
  /** 1 = Grundwissen, 2 = mittel, 3 = speziell */
  stufe: 1 | 2 | 3;
}

export const STUFEN_NAME = { 1: "Grundwissen", 2: "Fortgeschritten", 3: "Profi" } as const;

const ROH: Omit<Auftrag, "stufe">[] = [
  {
    id: "heissester", ziel: "venus",
    hinweis: "Der heißeste Planet ist nicht der, der am nächsten an der Sonne liegt. Flieg zu ihm und scanne ihn.",
    frage: "Warum ist es auf der Venus heißer als auf Merkur?",
    antworten: [
      "Ihre dichte Kohlenstoffdioxid-Hülle hält die Wärme fest.",
      "Sie ist näher an der Sonne als Merkur.",
      "Ihre Vulkane heizen die Oberfläche.",
      "Sie dreht sich besonders schnell.",
    ],
    erklaerung: "Der Treibhauseffekt: Sonnenlicht kommt durch, die Wärmestrahlung vom Boden aber nicht mehr hinaus. Merkur hat gar keine Lufthülle und kühlt nachts auf −173 °C ab.",
  },
  {
    id: "fontaenen", ziel: "enceladus",
    hinweis: "Irgendwo schießt ein kleiner Eismond Wasserfontänen ins All. Finde ihn.",
    frage: "Um welchen Planeten kreist dieser Mond?",
    antworten: ["Saturn", "Jupiter", "Uranus", "Neptun"],
    erklaerung: "Enceladus kreist um Saturn. Das Eis aus seinen Fontänen bildet sogar einen von Saturns Ringen, den E-Ring.",
  },
  {
    id: "groesster-mond", ziel: "ganymed",
    hinweis: "Der größte Mond des Sonnensystems ist größer als ein Planet. Flieg hin.",
    frage: "Welcher Planet ist kleiner als dieser Mond?",
    antworten: ["Merkur", "Mars", "Venus", "Neptun"],
    erklaerung: "Ganymed hat 5 268 km Durchmesser, Merkur nur 4 879 km. Schwerer ist Merkur trotzdem: er besteht aus Gestein und Eisen, Ganymed zur Hälfte aus Eis.",
  },
  {
    id: "seitenlage", ziel: "uranus",
    hinweis: "Ein Planet liegt auf der Seite und rollt um die Sonne. Scanne ihn.",
    frage: "Wie lange dauert dort an einem Pol die Nacht?",
    antworten: ["rund 42 Jahre", "rund 17 Stunden", "rund ein halbes Jahr", "Es wird dort nie Nacht."],
    erklaerung: "Die Achse ist um 98° gekippt. Ein Uranusjahr dauert 84 Erdjahre — die eine Hälfte davon zeigt ein Pol zur Sonne, die andere Hälfte von ihr weg.",
  },
  {
    id: "vulkane", ziel: "io",
    hinweis: "Auf einem Mond brechen mehr Vulkane aus als irgendwo sonst im Sonnensystem. Finde ihn.",
    frage: "Was hält das Innere dieses Mondes so heiß?",
    antworten: [
      "Jupiters Schwerkraft knetet ihn ständig durch.",
      "Er ist sehr nah an der Sonne.",
      "Sein Kern besteht aus glühendem Uran.",
      "Meteoriten schlagen ständig auf ihm ein.",
    ],
    erklaerung: "Io wird von Jupiter auf der einen und von Europa und Ganymed auf der anderen Seite gezogen. Die Verformung reibt das Gestein warm — wie ein Knetball, der beim Drücken warm wird.",
  },
  {
    id: "methanseen", ziel: "titan",
    hinweis: "Ein Mond hat eine dichtere Lufthülle als die Erde, dazu Seen und Regen. Flieg durch den Dunst.",
    frage: "Woraus bestehen die Seen dort?",
    antworten: ["aus flüssigem Methan und Ethan", "aus Wasser", "aus flüssigem Schwefel", "aus geschmolzenem Eisen"],
    erklaerung: "Bei −179 °C ist Wasser steinhart gefroren, Methan (Erdgas) aber flüssig. Auf Titan regnet es also Erdgas.",
  },
  {
    id: "rost", ziel: "mars",
    hinweis: "Der rote Planet wartet. Flieg hin und finde heraus, woher die Farbe kommt.",
    frage: "Warum ist der Mars rot?",
    antworten: ["Sein Staub enthält Eisenoxid — Rost.", "Er ist sehr heiß.", "Seine Luft färbt das Licht rot.", "Er ist mit rotem Sand aus Kupfer bedeckt."],
    erklaerung: "Eisen im Gestein hat mit Sauerstoff reagiert. Der feine Staub wird von Stürmen über den ganzen Planeten verteilt.",
  },
  {
    id: "sturm", ziel: "jupiter",
    hinweis: "Seit Jahrhunderten tobt auf einem Planeten ein Sturm, größer als die Erde. Flieg zu ihm.",
    frage: "Was ist der Große Rote Fleck?",
    antworten: ["ein riesiger Wirbelsturm", "ein Vulkan", "ein Einschlagkrater", "der Schatten eines Mondes"],
    erklaerung: "Er ist ein Hochdruckwirbel, der seit mindestens 350 Jahren beobachtet wird. Er schrumpft seit Jahrzehnten, passt aber noch immer eine ganze Erde hinein.",
  },
  {
    id: "rueckwaerts", ziel: "triton",
    hinweis: "Ein großer Mond läuft falsch herum um seinen Planeten. Suche ihn ganz draußen.",
    frage: "Was ist an der Bahn dieses Mondes besonders?",
    antworten: [
      "Er kreist entgegen der Drehrichtung seines Planeten.",
      "Er kreist um zwei Planeten.",
      "Seine Bahn geht durch die Ringe hindurch.",
      "Er steht immer still über demselben Ort.",
    ],
    erklaerung: "Triton läuft rückwärts um Neptun — ein Hinweis, dass er nicht dort entstanden, sondern eingefangen worden ist.",
  },
  {
    id: "absturz", ziel: "phobos",
    hinweis: "Ein winziger Mond kommt seinem Planeten jedes Jahrhundert fast zwei Meter näher. Finde ihn.",
    frage: "Was wird mit diesem Mond geschehen?",
    antworten: [
      "Er wird in Millionen Jahren zerbrechen oder aufschlagen.",
      "Er fliegt davon ins All.",
      "Er wird zu einem Planeten.",
      "Nichts, seine Bahn bleibt für immer gleich.",
    ],
    erklaerung: "Phobos kreist schneller um den Mars, als der Mars sich dreht. Die Gezeiten bremsen ihn deshalb ab — in rund 50 Mio. Jahren ist es so weit.",
  },
  {
    id: "badewanne", ziel: "saturn",
    hinweis: "Ein Planet würde in einer riesigen Badewanne schwimmen. Flieg hin und scanne ihn.",
    frage: "Warum würde er schwimmen?",
    antworten: [
      "Seine Dichte ist geringer als die von Wasser.",
      "Seine Ringe tragen ihn wie ein Rettungsring.",
      "Er ist innen hohl.",
      "Er ist leichter als die Erde.",
    ],
    erklaerung: "Saturn hat eine Dichte von 0,69 g/cm³, Wasser 1 g/cm³. Er ist zwar 95-mal so schwer wie die Erde, aber so riesig, dass jeder Kubikzentimeter im Mittel leichter als Wasser ist.",
  },
  {
    id: "herz", ziel: "pluto",
    hinweis: "Ganz draußen liegt ein Zwergplanet mit einem hellen Herz auf der Oberfläche. Das ist ein weiter Flug.",
    frage: "Warum zählt er seit 2006 nicht mehr zu den Planeten?",
    antworten: [
      "Er hat seine Bahn nicht von anderen Brocken freigeräumt.",
      "Er ist nicht rund.",
      "Er kreist nicht um die Sonne.",
      "Er hat keinen Mond.",
    ],
    erklaerung: "Ein Planet muss um die Sonne kreisen, rund sein und seine Bahn beherrschen. Pluto teilt seine Umgebung mit tausenden Körpern des Kuipergürtels.",
  },
  {
    id: "eine-seite", ziel: "mond",
    hinweis: "Starte nah an zu Hause: Flieg zu unserem Mond.",
    frage: "Warum sehen wir von der Erde aus immer dieselbe Seite des Mondes?",
    antworten: [
      "Er dreht sich genau einmal um sich selbst, während er einmal um die Erde läuft.",
      "Er dreht sich überhaupt nicht.",
      "Die andere Seite ist immer im Dunkeln.",
      "Die Erde verdeckt die andere Seite.",
    ],
    erklaerung: "Man nennt das gebundene Rotation. Die Rückseite des Mondes ist übrigens nicht dunkel — sie hat genauso Tag und Nacht wie die Vorderseite.",
  },
  {
    id: "zwei-gesichter", ziel: "iapetus",
    hinweis: "Ein Mond ist auf der einen Seite hell wie Schnee und auf der anderen dunkel wie Kohle. Er kreist weit draußen um einen Ringplaneten.",
    frage: "Was ist die auffälligste Form auf diesem Mond?",
    antworten: [
      "ein Bergrücken entlang des Äquators, wie bei einer Walnuss",
      "ein Krater, der den halben Mond bedeckt",
      "ein Ozean an der Oberfläche",
      "ein Vulkan, höher als Olympus Mons",
    ],
    erklaerung: "Iapetus hat einen bis zu 20 km hohen Rücken um den Äquator. Woher er kommt, ist bis heute nicht sicher geklärt.",
  },
  {
    id: "wind", ziel: "neptun",
    hinweis: "Auf dem äußersten Planeten wehen die schnellsten Winde des Sonnensystems. Flieg hin.",
    frage: "Wie wurde dieser Planet entdeckt?",
    antworten: [
      "Man hat ausgerechnet, wo er stehen muss, und dort nachgesehen.",
      "Voyager 2 hat ihn zufällig fotografiert.",
      "Man sah ihn schon in der Antike mit bloßem Auge.",
      "Ein Komet ist auf ihn gestürzt und hat ihn verraten.",
    ],
    erklaerung: "Uranus lief nicht genau auf der vorhergesagten Bahn. Urbain Le Verrier berechnete daraus einen unbekannten Planeten, und Johann Galle fand ihn 1846 in Berlin — nicht einmal ein Grad neben der Vorhersage.",
  },
  {
    id: "langer-tag", ziel: "merkur",
    hinweis: "Auf dem sonnennächsten Planeten ist ein Tag länger als ein Jahr. Flieg ganz nach innen.",
    frage: "Wie lange dauert auf Merkur ein Tag von Mittag zu Mittag?",
    antworten: ["176 Erdtage", "24 Stunden", "88 Erdtage", "10 Stunden"],
    erklaerung: "Merkur dreht sich in 59 Tagen einmal um sich selbst und läuft in 88 Tagen um die Sonne. Zusammen ergibt das 176 Tage von Mittag zu Mittag — zwei Merkurjahre.",
  },
  {
    id: "stern", ziel: "sonne",
    hinweis: "Alles dreht sich um ihn: den Stern in der Mitte. Flieg hin — aber komm ihm nicht zu nah!",
    frage: "Warum sehen wir die Sonne immer so, wie sie vor gut 8 Minuten war?",
    antworten: [
      "Ihr Licht braucht so lange bis zur Erde.",
      "Die Erde dreht sich 8 Minuten zu langsam.",
      "Die Lufthülle hält das Licht 8 Minuten auf.",
      "Die Sonne schickt ihr Licht nur alle 8 Minuten los.",
    ],
    erklaerung: "Licht ist schnell, aber nicht unendlich schnell: rund 300 000 km pro Sekunde. Für die 150 Mio. km bis zur Erde braucht es 8 Minuten und 20 Sekunden.",
  },
  {
    id: "jahreszeiten", ziel: "erde",
    hinweis: "Fang zu Hause an: Scanne den Planeten, auf dem du lebst.",
    frage: "Warum gibt es auf der Erde Jahreszeiten?",
    antworten: [
      "Weil die Erdachse schief steht.",
      "Weil die Erde im Sommer näher an der Sonne ist.",
      "Weil die Sonne mal heller und mal schwächer scheint.",
      "Weil sich die Erde im Winter langsamer dreht.",
    ],
    erklaerung: "Die Achse ist um 23,4° geneigt. Im Juni ist die Nordhalbkugel zur Sonne gekippt: die Sonne steht höher, die Tage sind länger. Am nächsten an der Sonne ist die Erde übrigens im Januar.",
  },
  {
    id: "ozean", ziel: "europa",
    hinweis: "Unter dem Eis eines Jupitermondes liegt mehr Wasser als in allen Meeren der Erde. Finde ihn.",
    frage: "Warum suchen Forschende gerade dort nach Leben?",
    antworten: [
      "Unter dem Eis gibt es vermutlich einen Ozean aus flüssigem Wasser.",
      "Dort ist es so warm wie auf der Erde.",
      "Raumsonden haben dort schon Pflanzen fotografiert.",
      "Der Mond hat eine Lufthülle zum Atmen.",
    ],
    erklaerung: "Flüssiges Wasser gilt als Voraussetzung für Leben, wie wir es kennen. Die Sonde Europa Clipper soll ab 2030 genauer nachsehen.",
  },
  {
    id: "guertel", ziel: "ceres",
    hinweis: "Zwischen Mars und Jupiter kreisen unzählige Gesteinsbrocken. Finde den größten von ihnen.",
    frage: "Wie heißt die Zone, in der dieser Zwergplanet kreist?",
    antworten: ["Asteroidengürtel", "Kuipergürtel", "Oortsche Wolke", "Milchstraße"],
    erklaerung: "Ceres ist das größte Objekt im Asteroidengürtel. In ihr steckt über ein Drittel der Masse des ganzen Gürtels.",
  },
  {
    id: "todesstern", ziel: "mimas",
    hinweis: "Ein kleiner Saturnmond sieht aus wie die Raumstation aus einem berühmten Science-Fiction-Film.",
    frage: "Woher kommt der riesige Krater auf diesem Mond?",
    antworten: [
      "Von einem Einschlag, der den Mond beinahe zerbrochen hätte.",
      "Von einem erloschenen Vulkan.",
      "Von einer Raumsonde, die dort abgestürzt ist.",
      "Er ist ein Tunnel quer durch den Mond.",
    ],
    erklaerung: "Der Krater Herschel ist 130 km breit — ein Drittel des ganzen Mondes. Ein etwas heftigerer Einschlag, und Mimas wäre zerbrochen.",
  },
  {
    id: "krater", ziel: "kallisto",
    hinweis: "Kein Himmelskörper hat mehr Krater als dieser Jupitermond.",
    frage: "Warum ist seine Oberfläche so voller Krater?",
    antworten: [
      "Sie ist uralt: kein Vulkan und kein Wasser hat die Krater seit Milliarden Jahren verwischt.",
      "Er wird öfter getroffen als alle anderen Monde.",
      "Jupiter schleudert Gestein auf ihn.",
      "Die Krater stammen von Raumsonden.",
    ],
    erklaerung: "Auf der Erde verschwinden Krater durch Wind, Wasser, Vulkane und wandernde Kontinentalplatten. Auf Kallisto passiert seit rund 4 Milliarden Jahren fast nichts — jeder Einschlag bleibt sichtbar.",
  },
  {
    id: "tanz", ziel: "charon",
    hinweis: "Ein Mond ist halb so groß wie sein Zwergplanet — die beiden tanzen umeinander.",
    frage: "Wie sieht dieser Mond für jemanden aus, der auf Pluto steht?",
    antworten: [
      "Er steht immer an derselben Stelle am Himmel.",
      "Er geht jeden Tag zweimal auf.",
      "Man sieht ihn nie, weil er zu klein ist.",
      "Er wandert rückwärts über den Himmel.",
    ],
    erklaerung: "Pluto und Charon zeigen einander immer dieselbe Seite: Plutos Tag und Charons Umlauf dauern beide 6,4 Tage. Von der einen Hälfte Plutos sieht man Charon also immer am selben Fleck — von der anderen nie.",
  },
  {
    id: "klippe", ziel: "miranda",
    hinweis: "Ein kleiner Uranusmond hat die höchste bekannte Klippe im Sonnensystem.",
    frage: "Wie hoch ist diese Klippe, Verona Rupes, ungefähr?",
    antworten: ["etwa 20 km", "etwa 200 m", "etwa 2 km", "etwa 200 km"],
    erklaerung: "Verona Rupes ist vermutlich rund 20 km hoch — mehr als doppelt so hoch wie der Mount Everest. Bei der schwachen Schwerkraft bräuchte ein fallender Stein gut zehn Minuten bis nach unten.",
  },
];

const STUFE: Record<string, 1 | 2 | 3> = {
  // Grundwissen: was man über das Sonnensystem wissen sollte.
  jahreszeiten: 1, stern: 1, "eine-seite": 1, rost: 1, sturm: 1, heissester: 1,
  // Fortgeschritten: steht im Steckbrief, braucht aber Nachdenken.
  badewanne: 2, fontaenen: 2, "groesster-mond": 2, seitenlage: 2, vulkane: 2, methanseen: 2,
  herz: 2, "langer-tag": 2, ozean: 2, guertel: 2, todesstern: 2,
  // Profi: spezielles Wissen über einzelne Monde und Entdeckungen.
  rueckwaerts: 3, absturz: 3, "zwei-gesichter": 3, wind: 3, krater: 3, tanz: 3, klippe: 3,
};

export const AUFTRAEGE: Auftrag[] = ROH
  .map(a => ({ ...a, stufe: STUFE[a.id] }))
  .sort((a, b) => a.stufe - b.stufe);

/** Der offene Auftrag zu einem Himmelskörper — egal, welcher gerade vorgeschlagen ist. */
export function auftragZu(ziel: string, erledigt: readonly string[]): Auftrag | null {
  return AUFTRAEGE.find(a => a.ziel === ziel && !erledigt.includes(a.id)) ?? null;
}

/** Fisher-Yates mit festem Startwert: die Reihenfolge bleibt beim Neuzeichnen gleich. */
export function gemischteAntworten(auftrag: Auftrag): { text: string; richtig: boolean }[] {
  const liste = auftrag.antworten.map((text, i) => ({ text, richtig: i === 0 }));
  let s = 0;
  for (const c of auftrag.id) s = (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0;
  for (let i = liste.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1_103_515_245) + 12_345) >>> 0;
    const j = s % (i + 1);
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}
