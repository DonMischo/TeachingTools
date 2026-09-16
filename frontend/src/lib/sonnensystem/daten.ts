/**
 * Die Himmelskörper der Simulation »Sonnensystem«.
 *
 * Planetenbahnen: Keplerelemente zur Epoche J2000 samt Änderung je Jahrhundert
 * aus der JPL-Tabelle »Approximate Positions of the Planets« (Standish), gültig
 * 1800–2050 auf wenige Bogenminuten. Ceres aus der JPL-Kleinkörperdatenbank,
 * auf J2000 zurückgerechnet (ohne Störungen, also nur ungefähr).
 *
 * Physikalische Werte: NASA Planetary Fact Sheets. Mondzahlen Stand 2025 —
 * sie ändern sich, sobald jemand wieder ein paar Kilometer große Brocken findet.
 *
 * Die Mondbahnen selbst stehen in mondbahnen.json: echte Bahnelemente von JPL
 * Horizons, geholt mit scripts/fetch-mondbahnen.mjs. Die Werte hier (Abstand,
 * Umlaufzeit, Neigung) sind die Lehrbuchzahlen für den Steckbrief.
 */

export type Art = "stern" | "planet" | "zwergplanet" | "mond";

/** Keplerelemente in AE und Grad; d… = Änderung je julianischem Jahrhundert. */
export interface Bahnelemente {
  a: number; e: number; i: number; L: number; varpi: number; Omega: number;
  da: number; de: number; di: number; dL: number; dvarpi: number; dOmega: number;
}

export interface MondBahn {
  aKm: number;
  /** Negativ: der Mond läuft rückwärts um seinen Planeten. */
  umlaufTage: number;
  /** Neigung gegen den Äquator des Planeten, Grad. */
  neigung: number;
}

export interface Koerper {
  id: string;
  name: string;
  art: Art;
  mutter?: string;
  /** Ersatzfarbe für Punkte, Bahnlinien und Beschriftungen. */
  farbe: string;
  radiusKm: number;
  masseKg: number;
  /** g/cm³ */
  dichte: number;
  /** m/s² am Äquator */
  schwerkraft: number;
  /** Siderische Rotation in Stunden; negativ = dreht sich rückwärts. */
  rotationStunden: number;
  /** Von Mittag bis Mittag — nur angegeben, wo er auffällig vom Sterntag abweicht. */
  sonnentagStunden?: number;
  achsneigung: number;
  temperatur: string;
  atmosphaere: string;
  mondeAnzahl?: number;
  entdeckung?: string;
  bahn?: Bahnelemente;
  mondBahn?: MondBahn;
  /** Ringe in Planetenradien vom Mittelpunkt. */
  ringe?: { innen: number; aussen: number };
  /** Farbe des Leuchtsaums am Rand, wo eine Atmosphäre Licht streut. */
  saum?: string;
  intro: string;
  fakten: string[];
}

const B = (
  a: number, e: number, i: number, L: number, varpi: number, Omega: number,
  da: number, de: number, di: number, dL: number, dvarpi: number, dOmega: number,
): Bahnelemente => ({ a, e, i, L, varpi, Omega, da, de, di, dL, dvarpi, dOmega });

export const KOERPER: Koerper[] = [
  {
    id: "sonne", name: "Sonne", art: "stern", farbe: "#ffcc33",
    radiusKm: 696_340, masseKg: 1.989e30, dichte: 1.41, schwerkraft: 274,
    rotationStunden: 609.1, achsneigung: 7.25,
    temperatur: "5 500 °C an der Oberfläche, 15 Mio. °C im Kern",
    atmosphaere: "Wasserstoff (73 %) und Helium (25 %) — die Sonne ist ganz aus Gas",
    intro: "Ein ganz gewöhnlicher Stern, der zufällig unserer ist. In ihm stecken 99,86 % der Masse des ganzen Sonnensystems.",
    fakten: [
      "Im Kern verschmelzen jede Sekunde rund 4 Mio. Tonnen Wasserstoff zu Helium — daher kommt ihr Licht.",
      "Ihr Licht braucht 8 Minuten und 20 Sekunden bis zur Erde. Wir sehen die Sonne also immer, wie sie vor 8 Minuten war.",
      "In die Sonne würden rund 1,3 Millionen Erden passen.",
      "Sie dreht sich nicht als Ganzes: am Äquator in 25 Tagen, an den Polen in 35.",
    ],
  },
  {
    id: "merkur", name: "Merkur", art: "planet", farbe: "#a8a29e",
    radiusKm: 2_439.7, masseKg: 3.301e23, dichte: 5.43, schwerkraft: 3.7,
    rotationStunden: 1_407.6, sonnentagStunden: 4_222.6, achsneigung: 0.03,
    temperatur: "−173 °C nachts bis 427 °C am Tag",
    atmosphaere: "praktisch keine — nur eine hauchdünne Hülle aus Teilchen",
    mondeAnzahl: 0, entdeckung: "seit der Antike bekannt",
    bahn: B(0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081),
    intro: "Der kleinste Planet und der sonnennächste. Ohne Luft, die Wärme hält, ist er gleichzeitig glühend heiß und eisig kalt.",
    fakten: [
      "Ein Merkurjahr dauert 88 Erdtage — ein Tag von Mittag zu Mittag aber 176. Ein Tag ist dort also zwei Jahre lang.",
      "Er ist nicht der heißeste Planet: die Venus ist heißer, obwohl sie weiter von der Sonne entfernt ist.",
      "In Kratern an den Polen, in die nie Sonnenlicht fällt, liegt vermutlich Wassereis.",
      "Die europäisch-japanische Sonde BepiColombo ist seit 2018 zu ihm unterwegs und ist schon sechsmal an ihm vorbeigeflogen.",
    ],
  },
  {
    id: "venus", name: "Venus", art: "planet", farbe: "#e8c77a", saum: "#f5dca0",
    radiusKm: 6_051.8, masseKg: 4.867e24, dichte: 5.24, schwerkraft: 8.87,
    rotationStunden: -5_832.5, sonnentagStunden: 2_802, achsneigung: 177.4,
    temperatur: "rund 464 °C — Tag und Nacht, am Pol wie am Äquator",
    atmosphaere: "96,5 % Kohlenstoffdioxid, Wolken aus Schwefelsäure, 92-mal so viel Druck wie auf der Erde",
    mondeAnzahl: 0, entdeckung: "seit der Antike bekannt",
    bahn: B(0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
      0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418),
    intro: "Fast so groß wie die Erde, aber ein Glutofen: ihre dicke Kohlenstoffdioxid-Hülle hält die Wärme fest — der Treibhauseffekt außer Kontrolle.",
    fakten: [
      "Der heißeste Planet — heiß genug, um Blei zu schmelzen.",
      "Sie dreht sich rückwärts und so langsam, dass ein Venustag (243 Erdtage) länger ist als ein Venusjahr (225 Erdtage).",
      "Auf dem Boden herrscht ein Druck wie auf der Erde in 900 m Meerestiefe.",
      "Nach dem Mond ist sie das hellste Objekt am Nachthimmel: der »Abendstern« oder »Morgenstern«.",
    ],
  },
  {
    id: "erde", name: "Erde", art: "planet", farbe: "#3b82f6", saum: "#6db3ff",
    radiusKm: 6_371, masseKg: 5.972e24, dichte: 5.51, schwerkraft: 9.81,
    rotationStunden: 23.934, sonnentagStunden: 24, achsneigung: 23.44,
    temperatur: "−89 °C bis 57 °C, im Mittel 15 °C",
    atmosphaere: "78 % Stickstoff, 21 % Sauerstoff, 1 % Argon",
    mondeAnzahl: 1,
    bahn: B(1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
      0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0),
    intro: "Der einzige Ort, von dem wir wissen, dass es dort Leben gibt — und der einzige Planet mit flüssigem Wasser an der Oberfläche.",
    fakten: [
      "Die Jahreszeiten kommen von der schiefen Achse (23,4°), nicht vom Abstand zur Sonne: im Januar ist die Erde der Sonne am nächsten.",
      "Sie ist der dichteste Planet des Sonnensystems.",
      "Rund 71 % der Oberfläche sind von Wasser bedeckt.",
      "Ihr Magnetfeld lenkt den Sonnenwind ab — an den Polen sieht man das als Polarlicht.",
    ],
  },
  {
    id: "mars", name: "Mars", art: "planet", farbe: "#dc6a3c", saum: "#e8a07a",
    radiusKm: 3_389.5, masseKg: 6.417e23, dichte: 3.93, schwerkraft: 3.71,
    rotationStunden: 24.623, achsneigung: 25.19,
    temperatur: "−140 °C bis 20 °C, im Mittel −63 °C",
    atmosphaere: "95 % Kohlenstoffdioxid, sehr dünn (etwa 1 % des Erdluftdrucks)",
    mondeAnzahl: 2, entdeckung: "seit der Antike bekannt",
    bahn: B(1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343),
    intro: "Der rote Planet: kalt, trocken und staubig, aber mit Spuren alter Flüsse und Seen. Hier suchen Rover nach Zeichen früheren Lebens.",
    fakten: [
      "Rot ist er durch Eisenoxid — der Staub ist im Grunde Rost.",
      "Olympus Mons ist mit rund 22 km der höchste Vulkan des Sonnensystems, zweieinhalbmal so hoch wie der Mount Everest.",
      "Ein Marstag dauert 24 h 37 min, fast wie bei uns; die Achse ist ähnlich schief, also gibt es Jahreszeiten.",
      "Die Schwerkraft ist nur 38 % der irdischen: wer hier 40 kg wiegt, fühlt sich dort wie 15 kg.",
    ],
  },
  {
    id: "ceres", name: "Ceres", art: "zwergplanet", farbe: "#8b8680",
    radiusKm: 469.7, masseKg: 9.38e20, dichte: 2.16, schwerkraft: 0.28,
    rotationStunden: 9.07, achsneigung: 4,
    temperatur: "etwa −105 °C",
    atmosphaere: "keine",
    mondeAnzahl: 0, entdeckung: "1801 durch Giuseppe Piazzi",
    bahn: B(2.7655526, 0.0796923, 10.5880278, 158.7667, 153.5428, 80.2486,
      0, 0, 0, 7827.4735, 0, 0),
    intro: "Das größte Objekt im Asteroidengürtel zwischen Mars und Jupiter — rund genug, um als Zwergplanet zu gelten.",
    fakten: [
      "Sie wurde 1801 als »neuer Planet« gefeiert und ein halbes Jahrhundert lang auch so genannt.",
      "Die hellen Flecken im Krater Occator sind Salzablagerungen aus salzigem Wasser, das von unten aufstieg.",
      "Die Sonde Dawn umkreiste sie von 2015 bis 2018.",
    ],
  },
  {
    id: "jupiter", name: "Jupiter", art: "planet", farbe: "#d8a878", saum: "#e8c8a0",
    radiusKm: 69_911, masseKg: 1.898e27, dichte: 1.33, schwerkraft: 24.79,
    rotationStunden: 9.925, achsneigung: 3.13,
    temperatur: "etwa −110 °C an den Wolkenobergrenzen",
    atmosphaere: "90 % Wasserstoff, 10 % Helium — ein Gasriese ohne feste Oberfläche",
    mondeAnzahl: 97, entdeckung: "seit der Antike bekannt",
    ringe: { innen: 1.4, aussen: 1.8 },
    bahn: B(5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106),
    intro: "Der König der Planeten: mehr als doppelt so schwer wie alle anderen zusammen. Er hat keine Oberfläche — nur Wolken, die immer dichter werden.",
    fakten: [
      "In ihn würden über 1 300 Erden passen.",
      "Der Große Rote Fleck ist ein Wirbelsturm, der seit mindestens 350 Jahren tobt — und größer ist als die Erde.",
      "Er dreht sich in unter 10 Stunden einmal um sich selbst, schneller als jeder andere Planet. Deshalb ist er an den Polen sichtbar abgeplattet.",
      "Seine vier großen Monde entdeckte Galileo Galilei 1610 — der Beweis, dass sich nicht alles um die Erde dreht.",
      "Er hat schwache Ringe aus Staub, die man erst mit Raumsonden entdeckte.",
    ],
  },
  {
    id: "saturn", name: "Saturn", art: "planet", farbe: "#e3c88f", saum: "#eedcb0",
    radiusKm: 58_232, masseKg: 5.683e26, dichte: 0.69, schwerkraft: 10.44,
    rotationStunden: 10.656, achsneigung: 26.73,
    temperatur: "etwa −140 °C an den Wolkenobergrenzen",
    atmosphaere: "96 % Wasserstoff, 3 % Helium",
    mondeAnzahl: 274, entdeckung: "seit der Antike bekannt",
    ringe: { innen: 1.24, aussen: 2.35 },
    bahn: B(9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
      -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794),
    intro: "Der Ringplanet. Seine Hauptringe messen von Rand zu Rand 280 000 km, sind aber meist nur zehn Meter dick — Milliarden Eisbrocken von Staubkorn- bis Hausgröße.",
    fakten: [
      "Seine Dichte ist geringer als die von Wasser: in einer gigantischen Badewanne würde Saturn schwimmen.",
      "Er hat die meisten bekannten Monde: 274 (Stand 2025).",
      "Am Nordpol dreht sich ein Wolkenband in Form eines Sechsecks, breiter als die Erde.",
      "Die Sonde Cassini umkreiste ihn 13 Jahre lang und stürzte 2017 absichtlich in ihn hinein.",
    ],
  },
  {
    id: "uranus", name: "Uranus", art: "planet", farbe: "#9fd8e0", saum: "#b8ecf0",
    radiusKm: 25_362, masseKg: 8.681e25, dichte: 1.27, schwerkraft: 8.87,
    rotationStunden: -17.24, achsneigung: 97.77,
    temperatur: "etwa −195 °C, kältester gemessener Wert −224 °C",
    atmosphaere: "83 % Wasserstoff, 15 % Helium, 2 % Methan (das macht ihn blaugrün)",
    mondeAnzahl: 29, entdeckung: "1781 durch Wilhelm Herschel",
    ringe: { innen: 1.64, aussen: 2.0 },
    bahn: B(19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589),
    intro: "Ein Eisriese, der auf der Seite liegt: seine Achse ist um 98° gekippt. Er rollt gewissermaßen um die Sonne.",
    fakten: [
      "Der erste Planet, der mit einem Fernrohr entdeckt wurde — von Wilhelm Herschel, einem Musiker aus Hannover.",
      "Durch die gekippte Achse ist an jedem Pol 42 Jahre lang Tag und dann 42 Jahre lang Nacht.",
      "Seine Monde sind nach Figuren aus Stücken von Shakespeare und Alexander Pope benannt.",
      "Bisher war nur eine einzige Sonde dort: Voyager 2, im Januar 1986.",
    ],
  },
  {
    id: "neptun", name: "Neptun", art: "planet", farbe: "#4f7fe0", saum: "#7aa2ff",
    radiusKm: 24_622, masseKg: 1.024e26, dichte: 1.64, schwerkraft: 11.15,
    rotationStunden: 16.11, achsneigung: 28.32,
    temperatur: "etwa −200 °C",
    atmosphaere: "80 % Wasserstoff, 19 % Helium, 1,5 % Methan",
    mondeAnzahl: 16, entdeckung: "1846 durch Johann Galle in Berlin, nach Berechnungen von Urbain Le Verrier",
    ringe: { innen: 1.7, aussen: 2.55 },
    bahn: B(30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664),
    intro: "Der äußerste Planet — und der erste, der mit Mathematik gefunden wurde, bevor ihn jemand gesehen hatte.",
    fakten: [
      "Auf Neptun wehen die schnellsten Winde des Sonnensystems: über 2 000 km/h.",
      "Seit seiner Entdeckung 1846 hat er erst 2011 seine erste volle Runde um die Sonne geschafft: ein Neptunjahr dauert 165 Erdjahre.",
      "Uranus wurde auf seiner Bahn ein wenig gezogen — daraus berechnete Le Verrier, wo ein unbekannter Planet stehen muss.",
      "Sonnenlicht braucht bis Neptun gut vier Stunden.",
    ],
  },
  {
    id: "pluto", name: "Pluto", art: "zwergplanet", farbe: "#d4b89c",
    radiusKm: 1_188.3, masseKg: 1.303e22, dichte: 1.85, schwerkraft: 0.62,
    rotationStunden: -153.29, achsneigung: 122.5,
    temperatur: "etwa −230 °C",
    atmosphaere: "sehr dünn: Stickstoff, Methan, Kohlenmonoxid — sie friert aus, wenn Pluto sich von der Sonne entfernt",
    mondeAnzahl: 5, entdeckung: "1930 durch Clyde Tombaugh",
    bahn: B(39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684,
      -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482),
    intro: "Bis 2006 der neunte Planet, heute ein Zwergplanet im Kuipergürtel. Kleiner als unser Mond — aber mit Bergen aus Wassereis und einem großen Herz.",
    fakten: [
      "Das helle »Herz« heißt Tombaugh Regio: eine riesige Ebene aus gefrorenem Stickstoff.",
      "2006 wurde er zum Zwergplaneten: er hat seine Bahn nicht von anderen Brocken freigeräumt.",
      "Seine Bahn ist so lang gestreckt, dass er zeitweise näher an der Sonne ist als Neptun.",
      "Die Sonde New Horizons flog 2015 an ihm vorbei; die Fotos brauchten über ein Jahr zur Erde.",
    ],
  },

  // ── Monde ──
  {
    id: "mond", name: "Mond", art: "mond", mutter: "erde", farbe: "#c9c5bd",
    radiusKm: 1_737.4, masseKg: 7.342e22, dichte: 3.34, schwerkraft: 1.62,
    rotationStunden: 655.7, achsneigung: 6.7,
    temperatur: "−173 °C bis 127 °C",
    atmosphaere: "keine",
    entdeckung: "seit jeher bekannt",
    mondBahn: { aKm: 384_400, umlaufTage: 27.3217, neigung: 5.1 },
    intro: "Unser Begleiter. Er entstand vermutlich, als vor 4,5 Milliarden Jahren ein marsgroßer Körper mit der jungen Erde zusammenstieß.",
    fakten: [
      "Er zeigt uns immer dieselbe Seite: er dreht sich genau einmal um sich selbst, während er einmal um die Erde läuft (gebundene Rotation).",
      "Er entfernt sich jedes Jahr um 3,8 cm von der Erde.",
      "Zwölf Menschen sind auf ihm gelaufen, zwischen 1969 und 1972.",
      "Seine Anziehung erzeugt auf der Erde Ebbe und Flut.",
    ],
  },
  {
    id: "phobos", name: "Phobos", art: "mond", mutter: "mars", farbe: "#8a7968",
    radiusKm: 11.3, masseKg: 1.066e16, dichte: 1.88, schwerkraft: 0.0057,
    rotationStunden: 7.65, achsneigung: 0,
    temperatur: "etwa −40 °C", atmosphaere: "keine",
    entdeckung: "1877 durch Asaph Hall",
    mondBahn: { aKm: 9_376, umlaufTage: 0.31891, neigung: 1.1 },
    intro: "Ein Kartoffel-förmiger Brocken, 27 km lang. Er kreist so nah am Mars, dass er zweimal am Tag aufgeht — und zwar im Westen.",
    fakten: [
      "Er kommt Mars jedes Jahrhundert fast 2 m näher. In rund 50 Mio. Jahren wird er zerbrechen oder aufschlagen.",
      "Sein Name bedeutet »Furcht«; sein Bruder Deimos heißt »Schrecken«.",
      "Der große Krater Stickney nimmt fast die halbe Breite des Mondes ein.",
    ],
  },
  {
    id: "deimos", name: "Deimos", art: "mond", mutter: "mars", farbe: "#a89880",
    radiusKm: 6.2, masseKg: 1.476e15, dichte: 1.47, schwerkraft: 0.003,
    rotationStunden: 30.3, achsneigung: 0,
    temperatur: "etwa −40 °C", atmosphaere: "keine",
    entdeckung: "1877 durch Asaph Hall",
    mondBahn: { aKm: 23_463, umlaufTage: 1.263, neigung: 0.9 },
    intro: "Der kleinere Marsmond, nur 15 km lang. Vom Mars aus sieht er aus wie ein heller Stern.",
    fakten: [
      "Auf Deimos ist die Schwerkraft so gering, dass ein kräftiger Sprung reichen würde, um ihn zu verlassen.",
      "Beide Marsmonde sind vielleicht eingefangene Asteroiden — oder Trümmer eines alten Einschlags.",
    ],
  },
  {
    id: "io", name: "Io", art: "mond", mutter: "jupiter", farbe: "#e8d060",
    radiusKm: 1_821.6, masseKg: 8.932e22, dichte: 3.53, schwerkraft: 1.79,
    rotationStunden: 42.46, achsneigung: 0,
    temperatur: "−130 °C, an Lavaseen über 1 200 °C", atmosphaere: "hauchdünn, aus Schwefeldioxid",
    entdeckung: "1610 durch Galileo Galilei",
    mondBahn: { aKm: 421_700, umlaufTage: 1.769, neigung: 0.05 },
    intro: "Der vulkanreichste Ort im Sonnensystem: über 400 aktive Vulkane, die Schwefel hunderte Kilometer hoch schleudern.",
    fakten: [
      "Jupiters Schwerkraft knetet Io ständig durch, weil Europa und Ganymed an ihm zerren. Die Reibung hält das Innere flüssig.",
      "Die gelben, roten und weißen Flecken sind verschiedene Formen von Schwefel.",
      "Io ist ein wenig größer als unser Mond.",
    ],
  },
  {
    id: "europa", name: "Europa", art: "mond", mutter: "jupiter", farbe: "#c8b89a",
    radiusKm: 1_560.8, masseKg: 4.80e22, dichte: 3.01, schwerkraft: 1.31,
    rotationStunden: 85.23, achsneigung: 0.1,
    temperatur: "etwa −160 °C", atmosphaere: "hauchdünn, aus Sauerstoff",
    entdeckung: "1610 durch Galileo Galilei",
    mondBahn: { aKm: 671_034, umlaufTage: 3.551, neigung: 0.47 },
    intro: "Unter ihrem Eispanzer liegt ein Ozean aus Salzwasser — mit mehr Wasser als alle Meere der Erde zusammen.",
    fakten: [
      "Die rotbraunen Linien sind Risse im Eis, durch die vielleicht Wasser von unten nach oben dringt.",
      "Europa gilt als einer der aussichtsreichsten Orte für die Suche nach Leben außerhalb der Erde.",
      "Die NASA-Sonde Europa Clipper ist seit 2024 unterwegs und soll 2030 ankommen.",
    ],
  },
  {
    id: "ganymed", name: "Ganymed", art: "mond", mutter: "jupiter", farbe: "#9c8f80",
    radiusKm: 2_634.1, masseKg: 1.482e23, dichte: 1.94, schwerkraft: 1.43,
    rotationStunden: 171.7, achsneigung: 0.2,
    temperatur: "−200 °C bis −120 °C", atmosphaere: "hauchdünn, aus Sauerstoff",
    entdeckung: "1610 durch Galileo Galilei",
    mondBahn: { aKm: 1_070_412, umlaufTage: 7.155, neigung: 0.2 },
    intro: "Der größte Mond des Sonnensystems — größer als der Planet Merkur.",
    fakten: [
      "Als einziger Mond hat Ganymed ein eigenes Magnetfeld und sogar Polarlichter.",
      "Unter der Eiskruste liegt vermutlich ein salziger Ozean.",
      "Die europäische Sonde JUICE ist seit 2023 unterwegs und soll 2034 in eine Umlaufbahn um Ganymed einschwenken.",
    ],
  },
  {
    id: "kallisto", name: "Kallisto", art: "mond", mutter: "jupiter", farbe: "#6e6458",
    radiusKm: 2_410.3, masseKg: 1.076e23, dichte: 1.83, schwerkraft: 1.24,
    rotationStunden: 400.5, achsneigung: 0,
    temperatur: "etwa −140 °C", atmosphaere: "hauchdünn, aus Kohlenstoffdioxid",
    entdeckung: "1610 durch Galileo Galilei",
    mondBahn: { aKm: 1_882_709, umlaufTage: 16.689, neigung: 0.2 },
    intro: "Der Himmelskörper mit den meisten Kratern im Sonnensystem. Seine Oberfläche hat sich seit Milliarden Jahren kaum verändert.",
    fakten: [
      "Kallisto ist fast so groß wie Merkur, aber nur ein Drittel so schwer — sie ist halb Gestein, halb Eis.",
      "Weil sie weit von Jupiter kreist, trifft sie weniger Strahlung: ein möglicher Standort für eine spätere Station.",
    ],
  },
  {
    id: "mimas", name: "Mimas", art: "mond", mutter: "saturn", farbe: "#b0aca4",
    radiusKm: 198.2, masseKg: 3.75e19, dichte: 1.15, schwerkraft: 0.064,
    rotationStunden: 22.6, achsneigung: 0,
    temperatur: "etwa −200 °C", atmosphaere: "keine",
    entdeckung: "1789 durch Wilhelm Herschel",
    mondBahn: { aKm: 185_539, umlaufTage: 0.942, neigung: 1.57 },
    intro: "Der »Todesstern-Mond«: ein Krater mit einem Drittel seines Durchmessers lässt ihn aussehen wie die Raumstation aus Star Wars.",
    fakten: [
      "Der Krater Herschel ist 130 km breit. Der Einschlag hat Mimas beinahe zerbrochen.",
      "Mimas ist der kleinste Körper, von dem man weiß, dass er durch seine eigene Schwerkraft rund ist.",
    ],
  },
  {
    id: "enceladus", name: "Enceladus", art: "mond", mutter: "saturn", farbe: "#f0f0f0",
    radiusKm: 252.1, masseKg: 1.08e20, dichte: 1.61, schwerkraft: 0.113,
    rotationStunden: 32.9, achsneigung: 0,
    temperatur: "etwa −200 °C", atmosphaere: "Wasserdampf aus den Fontänen",
    entdeckung: "1789 durch Wilhelm Herschel",
    mondBahn: { aKm: 237_948, umlaufTage: 1.370, neigung: 0.02 },
    intro: "Ein kleiner Eismond, aus dessen Südpol Fontänen aus Wasser ins All schießen. Sie kommen aus einem Ozean unter dem Eis.",
    fakten: [
      "Er ist der hellste Körper im Sonnensystem: sein frisches Eis wirft fast alles Sonnenlicht zurück.",
      "Die Sonde Cassini flog durch die Fontänen und fand Salz, Kieselsäure und organische Moleküle.",
      "Das Eis aus den Fontänen bildet Saturns E-Ring.",
    ],
  },
  {
    id: "tethys", name: "Tethys", art: "mond", mutter: "saturn", farbe: "#d8d6d0",
    radiusKm: 531.1, masseKg: 6.17e20, dichte: 0.98, schwerkraft: 0.146,
    rotationStunden: 45.3, achsneigung: 0,
    temperatur: "etwa −187 °C", atmosphaere: "keine",
    entdeckung: "1684 durch Giovanni Domenico Cassini",
    mondBahn: { aKm: 294_619, umlaufTage: 1.888, neigung: 1.12 },
    intro: "Ein Mond fast ganz aus Wassereis, mit einem riesigen Graben, der sich über drei Viertel seines Umfangs zieht.",
    fakten: [
      "Seine Dichte liegt knapp unter der von Wasser — er besteht fast nur aus Eis.",
      "Der Graben Ithaca Chasma ist 2 000 km lang und bis zu 5 km tief.",
    ],
  },
  {
    id: "dione", name: "Dione", art: "mond", mutter: "saturn", farbe: "#c8c6c0",
    radiusKm: 561.4, masseKg: 1.095e21, dichte: 1.48, schwerkraft: 0.232,
    rotationStunden: 65.7, achsneigung: 0,
    temperatur: "etwa −186 °C", atmosphaere: "hauchdünn, aus Sauerstoff",
    entdeckung: "1684 durch Giovanni Domenico Cassini",
    mondBahn: { aKm: 377_396, umlaufTage: 2.737, neigung: 0.03 },
    intro: "Ein Eismond, dessen eine Seite von hellen Eisklippen durchzogen ist — Risse, die aus der Ferne wie feine Schleier aussehen.",
    fakten: [
      "Unter der Kruste könnte es eine Schicht aus flüssigem Wasser geben.",
      "Dione teilt ihre Bahn mit zwei winzigen Monden, Helene und Polydeuces.",
    ],
  },
  {
    id: "rhea", name: "Rhea", art: "mond", mutter: "saturn", farbe: "#bcbab4",
    radiusKm: 763.8, masseKg: 2.307e21, dichte: 1.24, schwerkraft: 0.264,
    rotationStunden: 108.4, achsneigung: 0,
    temperatur: "etwa −174 °C", atmosphaere: "hauchdünn, aus Sauerstoff und Kohlenstoffdioxid",
    entdeckung: "1672 durch Giovanni Domenico Cassini",
    mondBahn: { aKm: 527_108, umlaufTage: 4.518, neigung: 0.35 },
    intro: "Saturns zweitgrößter Mond: eine eisige, dicht verkraterte Kugel.",
    fakten: [
      "Rhea besteht zu drei Vierteln aus Eis und zu einem Viertel aus Gestein.",
      "Sie ist nicht einmal halb so groß wie unser Mond, aber immer noch der neuntgrößte Mond im Sonnensystem.",
    ],
  },
  {
    id: "titan", name: "Titan", art: "mond", mutter: "saturn", farbe: "#e0a850", saum: "#f0b860",
    radiusKm: 2_574.7, masseKg: 1.345e23, dichte: 1.88, schwerkraft: 1.35,
    rotationStunden: 382.7, achsneigung: 0.3,
    temperatur: "etwa −179 °C", atmosphaere: "95 % Stickstoff, 5 % Methan — dichter als die Lufthülle der Erde",
    entdeckung: "1655 durch Christiaan Huygens",
    mondBahn: { aKm: 1_221_870, umlaufTage: 15.945, neigung: 0.35 },
    intro: "Der einzige Mond mit dichter Atmosphäre. Unter dem orangen Dunst gibt es Flüsse, Seen und Regen — aber aus Methan statt Wasser.",
    fakten: [
      "Titan ist größer als Merkur und nach Ganymed der zweitgrößte Mond.",
      "Die Seen bestehen aus flüssigem Methan und Ethan — bei −179 °C ist Erdgas dort flüssig.",
      "2005 landete die europäische Sonde Huygens auf ihm: die bisher fernste Landung.",
      "Mit der dichten Luft und der geringen Schwerkraft könnte ein Mensch mit Flügeln an den Armen fliegen.",
    ],
  },
  {
    id: "iapetus", name: "Iapetus", art: "mond", mutter: "saturn", farbe: "#8c7a60",
    radiusKm: 734.5, masseKg: 1.806e21, dichte: 1.09, schwerkraft: 0.223,
    rotationStunden: 1_903.7, achsneigung: 0,
    temperatur: "−173 °C bis −143 °C", atmosphaere: "keine",
    entdeckung: "1671 durch Giovanni Domenico Cassini",
    mondBahn: { aKm: 3_560_820, umlaufTage: 79.32, neigung: 15.47 },
    intro: "Ein Mond mit zwei Gesichtern: eine Hälfte schneeweiß, die andere dunkel wie Kohle.",
    fakten: [
      "Cassini sah ihn nur auf einer Seite seiner Bahn — und schloss richtig, dass die beiden Hälften verschieden hell sind.",
      "Um seinen Äquator läuft ein bis zu 20 km hoher Bergrücken, der ihn wie eine Walnuss aussehen lässt.",
    ],
  },
  {
    id: "miranda", name: "Miranda", art: "mond", mutter: "uranus", farbe: "#a8a8a8",
    radiusKm: 235.8, masseKg: 6.4e19, dichte: 1.2, schwerkraft: 0.079,
    rotationStunden: 33.9, achsneigung: 0,
    temperatur: "etwa −187 °C", atmosphaere: "keine",
    entdeckung: "1948 durch Gerard Kuiper",
    mondBahn: { aKm: 129_390, umlaufTage: 1.413, neigung: 4.34 },
    intro: "Ein Flickenteppich von Mond: Streifen, Rillen und Klippen, als hätte man ihn aus Einzelteilen zusammengesetzt.",
    fakten: [
      "Verona Rupes ist eine Klippe von rund 20 km Höhe — die höchste bekannte im Sonnensystem. Ein Stein bräuchte gut zehn Minuten nach unten.",
      "Wie alle Uranusmonde ist sie nach einer Figur von Shakespeare benannt (»Der Sturm«).",
    ],
  },
  {
    id: "titania", name: "Titania", art: "mond", mutter: "uranus", farbe: "#b0a498",
    radiusKm: 788.4, masseKg: 3.4e21, dichte: 1.71, schwerkraft: 0.367,
    rotationStunden: 208.9, achsneigung: 0,
    temperatur: "etwa −203 °C", atmosphaere: "keine nachgewiesen",
    entdeckung: "1787 durch Wilhelm Herschel",
    mondBahn: { aKm: 435_910, umlaufTage: 8.706, neigung: 0.34 },
    intro: "Der größte Uranusmond, benannt nach der Feenkönigin aus Shakespeares »Sommernachtstraum«.",
    fakten: [
      "Riesige Grabenbrüche zeigen, dass sich Titania beim Gefrieren ihres Inneren ausgedehnt hat.",
      "Wie Uranus selbst liegt auch ihre Bahn auf der Seite: Uranus' Monde kreisen über seine Pole hinweg.",
    ],
  },
  {
    id: "oberon", name: "Oberon", art: "mond", mutter: "uranus", farbe: "#9a8e84",
    radiusKm: 761.4, masseKg: 3.08e21, dichte: 1.63, schwerkraft: 0.346,
    rotationStunden: 323.1, achsneigung: 0,
    temperatur: "etwa −198 °C", atmosphaere: "keine nachgewiesen",
    entdeckung: "1787 durch Wilhelm Herschel",
    mondBahn: { aKm: 583_520, umlaufTage: 13.46, neigung: 0.06 },
    intro: "Der äußerste der großen Uranusmonde — benannt nach dem Feenkönig aus dem »Sommernachtstraum«.",
    fakten: [
      "Auf Oberon gibt es einen Berg von etwa 11 km Höhe.",
      "Manche Krater haben dunkle Böden — vielleicht dunkles Material, das von unten hochquoll.",
    ],
  },
  {
    id: "triton", name: "Triton", art: "mond", mutter: "neptun", farbe: "#c8b8b0",
    radiusKm: 1_353.4, masseKg: 2.139e22, dichte: 2.06, schwerkraft: 0.779,
    rotationStunden: -141.0, achsneigung: 0,
    temperatur: "etwa −235 °C — einer der kältesten gemessenen Orte", atmosphaere: "sehr dünn, aus Stickstoff",
    entdeckung: "1846 durch William Lassell, nur 17 Tage nach Neptun",
    mondBahn: { aKm: 354_759, umlaufTage: -5.877, neigung: 157 },
    intro: "Der einzige große Mond, der rückwärts um seinen Planeten kreist. Vermutlich ein eingefangener Brocken aus dem Kuipergürtel.",
    fakten: [
      "Auf Triton gibt es Geysire, die Stickstoff und dunklen Staub 8 km hoch blasen.",
      "Weil er rückwärts läuft, bremst ihn Neptun langsam ab. In Milliarden Jahren wird er zerrissen — und Neptun bekommt vielleicht prächtige Ringe.",
      "Ein Teil der Oberfläche sieht aus wie die Schale einer Honigmelone.",
    ],
  },
  {
    id: "charon", name: "Charon", art: "mond", mutter: "pluto", farbe: "#9a9088",
    radiusKm: 606, masseKg: 1.586e21, dichte: 1.70, schwerkraft: 0.288,
    rotationStunden: 153.29, achsneigung: 0,
    temperatur: "etwa −220 °C", atmosphaere: "keine",
    entdeckung: "1978 durch James Christy",
    mondBahn: { aKm: 19_591, umlaufTage: 6.387, neigung: 0 },
    intro: "Halb so groß wie Pluto — so groß, dass die beiden eigentlich umeinander tanzen wie ein Doppelplanet.",
    fakten: [
      "Pluto und Charon zeigen einander immer dieselbe Seite. Von Pluto aus steht Charon also still am Himmel.",
      "Sein rötlicher Nordpol heißt Mordor Macula: dort friert Gas fest, das von Pluto herüberweht.",
    ],
  },
];

export const KOERPER_NACH_ID: Record<string, Koerper> = Object.fromEntries(KOERPER.map(k => [k.id, k]));

/** Sonne, Planeten und Zwergplaneten in Reihenfolge des Abstands. */
export const HAUPTKOERPER = KOERPER.filter(k => k.art !== "mond");

export const PLANETEN = KOERPER.filter(k => k.art === "planet");

export function mondeVon(id: string): Koerper[] {
  return KOERPER.filter(k => k.mutter === id);
}

export const ERDE = KOERPER_NACH_ID.erde;

/** Kilometer je Astronomischer Einheit. */
export const KM_JE_AE = 149_597_870.7;

/** Lichtgeschwindigkeit in km/s. */
export const LICHT_KM_S = 299_792.458;

export const ART_NAME: Record<Art, string> = {
  stern: "Stern",
  planet: "Planet",
  zwergplanet: "Zwergplanet",
  mond: "Mond",
};
