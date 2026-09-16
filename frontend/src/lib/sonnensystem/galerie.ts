/**
 * Der Blick von außen und von vor Ort: was Weltraumteleskope, Raumsonden,
 * Rover und Astronauten gesehen haben — dazu die Porträts aller Himmelskörper.
 *
 * Die Reihenfolge ist eine Reise von der Sonne nach außen bis zum tiefsten
 * Blick ins All. Ein Bild wird freigeschaltet, sobald im Flug der Körper
 * gescannt ist, zu dem es gehört (`freischalten`, sonst `koerper`).
 */
import { KOERPER, KOERPER_NACH_ID } from "./daten";
import { foto, galerieBild, type Bildnachweis } from "./bilder";

export interface GalerieEintrag {
  id: string;
  titel: string;
  /** Wer das Bild aufgenommen hat: Teleskop, Sonde, Rover, Mensch. */
  von: string;
  jahr?: number;
  text: string;
  /** Was zu sehen ist — danach wird gefiltert, und dort erscheint ein Link im Steckbrief. */
  koerper?: string;
  /** Welche Körper gescannt sein müssen. Ohne Angabe: `koerper`. */
  freischalten?: string[];
  /** Zwei Bilder desselben Motivs zum Vergleich. */
  paar?: string;
  /** Porträts liegen bei den Fotos, nicht bei der Galerie. */
  portraet?: boolean;
}

const BASIS: GalerieEintrag[] = [
  {
    id: "earthrise", titel: "Erdaufgang", von: "Apollo 8 (NASA)", jahr: 1968, koerper: "erde", freischalten: ["mond"],
    text: "Heiligabend 1968, beim vierten Umlauf um den Mond: plötzlich steigt die Erde über den Mondhorizont. Bill Anders griff zur Kamera. Das Foto gilt als eines der einflussreichsten der Geschichte — es zeigte zum ersten Mal, wie verletzlich und allein unser Planet ist.",
  },
  {
    id: "erde-juice", titel: "Die Erde von JUICE", von: "JUICE (ESA)", jahr: 2024, koerper: "erde",
    text: "Die europäische Sonde JUICE holte sich 2024 bei Mond und Erde Schwung für die Reise zum Jupiter. Im Vorbeiflug fotografierte ihre Überwachungskamera die Erde; rechts ragt ein Stück der Sonde selbst ins Bild.",
  },
  {
    id: "merkur-bepi", titel: "Merkur neben BepiColombo", von: "BepiColombo (ESA/JAXA)", jahr: 2023, koerper: "merkur",
    text: "Eine Überwachungskamera zeigt Merkur beim dritten Vorbeiflug, links ein Stück der Sonde. Um überhaupt bei Merkur bremsen zu können, braucht BepiColombo acht Jahre und neun Vorbeiflüge an Erde, Venus und Merkur.",
  },
  {
    id: "jupiter-juno-fleck", titel: "Der Große Rote Fleck", von: "Juno (NASA)", jahr: 2019, koerper: "jupiter",
    text: "Die Sonde Juno fliegt in wenigen tausend Kilometern Höhe über Jupiters Wolken. Die Farben sind verstärkt, damit man die Wirbel erkennt. Der Rote Fleck ist ein Sturm, größer als die ganze Erde.",
  },
  {
    id: "jupiter-juno-suedpol", titel: "Jupiters Südpol", von: "Juno (NASA)", jahr: 2017, koerper: "jupiter",
    text: "Von der Erde aus sieht man Jupiter nie von unten. Juno umkreist ihn über die Pole und fand dort statt Streifen ein Gewimmel aus Wirbelstürmen, jeder so groß wie ein Kontinent.",
  },
  {
    id: "jupiter-webb", titel: "Jupiter im Infrarotlicht", von: "James-Webb-Weltraumteleskop", jahr: 2022, koerper: "jupiter",
    text: "Webb sieht Wärmestrahlung, die unsere Augen nicht sehen. Die Farben sind deshalb übersetzt: an den Polen leuchten Polarlichter, dazu der dünne Ring und zwei kleine Monde als Punkte.",
  },
  {
    id: "europa-juno", titel: "Europa aus der Nähe", von: "Juno (NASA)", jahr: 2022, koerper: "europa",
    text: "Bei einem Vorbeiflug in 352 km Höhe fotografierte Juno den Eismond. Unter den Rissen und Streifen liegt ein Ozean aus Salzwasser.",
  },
  {
    id: "saturn-hubble", titel: "Sommer auf Saturn", von: "Hubble-Weltraumteleskop", jahr: 2019, koerper: "saturn",
    text: "Hubble fotografiert die äußeren Planeten jedes Jahr, um das Wetter dort zu beobachten. 2019 war auf Saturns Nordhalbkugel Sommer — die Ringe sind uns weit zugeneigt.",
    paar: "saturn-webb",
  },
  {
    id: "saturn-webb", titel: "Saturn im Infrarotlicht", von: "James-Webb-Weltraumteleskop", jahr: 2023, koerper: "saturn",
    text: "Im Licht, das Webb sieht, schluckt das Methan der Atmosphäre fast alles — der Planet wird dunkel, während die Eisringe hell leuchten. Dasselbe Motiv, ein ganz anderes Bild.",
    paar: "saturn-hubble",
  },
  {
    id: "erde-von-saturn", titel: "Der Tag, an dem die Erde lächelte", von: "Cassini (NASA/ESA)", jahr: 2013, koerper: "saturn",
    text: "Cassini stand im Schatten des Saturn und fotografierte die Ringe im Gegenlicht. Unten rechts, 1,4 Milliarden km entfernt, ist ein winziger blauer Punkt: die Erde. Menschen auf der ganzen Welt winkten zur verabredeten Zeit hinauf.",
  },
  {
    id: "riesen-webb", titel: "Vier Riesen mit Ringen", von: "James-Webb-Weltraumteleskop", jahr: 2023,
    freischalten: ["jupiter", "saturn", "uranus", "neptun"],
    text: "Jupiter, Saturn, Uranus und Neptun nebeneinander, alle von Webb. Im Infrarotlicht zeigen alle vier ihre Ringe — auch die, die im sichtbaren Licht fast unsichtbar sind. Die Größen sind hier nicht maßstabsgetreu.",
  },
  {
    id: "uranus-webb", titel: "Uranus und seine Ringe", von: "James-Webb-Weltraumteleskop", jahr: 2023, koerper: "uranus",
    text: "Weil Uranus auf der Seite liegt, schauen wir derzeit fast auf seinen Pol. Die Ringe umgeben ihn deshalb wie eine Zielscheibe; die helle Kappe ist die Polregion im Sommer.",
  },
  {
    id: "neptun-webb", titel: "Neptun und Triton", von: "James-Webb-Weltraumteleskop", jahr: 2022, koerper: "neptun",
    text: "Seit Voyager 2 im Jahr 1989 hatte niemand Neptuns Ringe so deutlich gesehen. Der helle Stern oben links ist kein Stern: es ist der Mond Triton, der Sonnenlicht von seinem Stickstoffeis zurückwirft.",
  },
  {
    id: "komet-rosetta", titel: "Komet Tschurjumow-Gerassimenko", von: "Rosetta (ESA)", jahr: 2014, freischalten: ["sonne"],
    text: "Die europäische Sonde Rosetta verfolgte zwei Jahre lang diesen Kometen, der wie eine Badeente geformt ist, und setzte als erste Sonde überhaupt einen Lander auf einem Kometen ab: Philae. Der Komet ist nur rund 4 km lang.",
  },
  {
    id: "pale-blue-dot", titel: "Der blassblaue Punkt", von: "Voyager 1 (NASA)", jahr: 1990, koerper: "erde", freischalten: ["neptun"],
    text: "Aus 6 Milliarden km Entfernung drehte sich Voyager 1 noch einmal um. In dem hellen Streifen (Streulicht der Sonne) liegt ein Pünktchen, kleiner als ein Pixel: die Erde. Der Astronom Carl Sagan schrieb dazu, auf diesem Punkt habe jeder gelebt, von dem man je gehört hat.",
  },
  {
    id: "saeulen-hubble", titel: "Säulen der Schöpfung", von: "Hubble-Weltraumteleskop", jahr: 2014, freischalten: ["pluto"],
    text: "Weit außerhalb des Sonnensystems, 6 500 Lichtjahre entfernt: Säulen aus Gas und Staub im Adlernebel. In ihrem Inneren entstehen neue Sterne — so, wie vor 4,6 Milliarden Jahren auch unsere Sonne entstanden ist.",
    paar: "saeulen-webb",
  },
  {
    id: "saeulen-webb", titel: "Säulen der Schöpfung", von: "James-Webb-Weltraumteleskop", jahr: 2022, freischalten: ["pluto"],
    text: "Dieselben Säulen, aber im Infrarotlicht: Webb blickt durch den Staub hindurch. Die roten Punkte an den Rändern sind junge Sterne, gerade erst ein paar hunderttausend Jahre alt.",
    paar: "saeulen-hubble",
  },
  {
    id: "hubble-deep-field", titel: "Hubble Ultra Deep Field", von: "Hubble-Weltraumteleskop", jahr: 2004, freischalten: ["pluto"],
    text: "Hubble starrte elf Tage lang auf einen dunklen Fleck am Himmel, nur ein Zehntel so breit wie der Vollmond. Fast jeder Lichtpunkt ist eine ganze Galaxie mit Milliarden Sternen.",
    paar: "webb-deep-field",
  },
  {
    id: "webb-deep-field", titel: "Webbs erstes tiefes Feld", von: "James-Webb-Weltraumteleskop", jahr: 2022, freischalten: ["pluto"],
    text: "Webbs erstes veröffentlichtes Bild: ein Himmelsausschnitt so klein wie ein Sandkorn auf der ausgestreckten Hand. Der Haufen darin ist so schwer, dass er das Licht noch fernerer Galaxien dahinter zu Bögen verbiegt. Manches Licht hier war über 13 Milliarden Jahre unterwegs — länger, als es unser Sonnensystem gibt.",
    paar: "hubble-deep-field",
  },
];

/** Bilder von Missionen, die selbst dort waren — Landesonden, Rover, Astronauten. */
const MISSIONEN: GalerieEintrag[] = [
  {
    id: "sonne-solar-orbiter", titel: "Die Sonne in höchster Auflösung", von: "Solar Orbiter (ESA/NASA)", jahr: 2022, koerper: "sonne",
    text: "Aus 75 Mio. km Entfernung setzte Solar Orbiter 25 Einzelbilder zu diesem Mosaik zusammen, aufgenommen im extremen Ultraviolett. Zu sehen ist die Korona, die äußerste Schicht der Sonne — rund eine Million Grad heiß.",
  },
  {
    id: "mond-aldrin", titel: "Buzz Aldrin auf dem Mond", von: "Apollo 11 (NASA)", jahr: 1969, koerper: "mond",
    text: "Juli 1969: Neil Armstrong fotografiert Buzz Aldrin. In Aldrins Visier spiegeln sich Armstrong und die Mondfähre. Fast alle Fotos von Apollo 11 zeigen Aldrin — die Kamera hatte meistens Armstrong.",
  },
  {
    id: "mond-schmitt", titel: "Ein Geologe auf dem Mond", von: "Apollo 17 (NASA)", jahr: 1972, koerper: "mond",
    text: "Harrison Schmitt, der einzige Geologe, der je auf dem Mond war, neben einem riesigen Felsbrocken im Taurus-Littrow-Tal. Apollo 17 ist bis heute die letzte Mondlandung mit Menschen.",
  },
  {
    id: "mond-yutu", titel: "Ein Rover auf der Rückseite", von: "Chang’e 4 (CNSA)", jahr: 2019, koerper: "mond",
    text: "Im Januar 2019 landete China als erstes Land auf der Rückseite des Mondes. Der Lander fotografiert, wie der Rover Yutu-2 losrollt. Mit der Erde sprachen beide nur über einen Relaissatelliten — die Rückseite sieht die Erde nie.",
  },
  {
    id: "mond-rueckseite", titel: "Panorama der Mondrückseite", von: "Chang’e 4 (CNSA)", jahr: 2019, koerper: "mond",
    text: "Das erste Rundumbild von der Oberfläche der Mondrückseite, im Von-Kármán-Krater: grauer Staub, kleine Krater und die Fahrspur des Rovers.",
  },
  {
    id: "venus-venera", titel: "Auf der Venus gelandet", von: "Venera 13 (Sowjetunion)", jahr: 1982, koerper: "venus",
    text: "Die sowjetische Landesonde Venera 13 schickte 1982 Bilder vom Boden der Venus: flache Gesteinsplatten, unten rechts ein Teil der Sonde. Bei 457 °C und fast 90-fachem Luftdruck hielt sie 127 Minuten durch.",
  },
  {
    id: "erde-epic", titel: "Die ganze Erde auf einmal", von: "DSCOVR (NASA/NOAA)", jahr: 2015, koerper: "erde",
    text: "Die Kamera EPIC blickt aus 1,5 Mio. km Entfernung ständig auf die Tagseite der Erde. Dieses Bild war eines ihrer ersten, im Juli 2015.",
  },
  {
    id: "erde-polarlicht", titel: "Polarlicht von oben", von: "Internationale Raumstation (NASA)", jahr: 2015, koerper: "erde",
    text: "Astronaut Scott Kelly fotografierte von der Raumstation ein Südpolarlicht. Es leuchtet, wenn Teilchen des Sonnenwinds in 100 bis 300 km Höhe auf die Lufthülle treffen — die Station fliegt mitten hindurch.",
  },
  {
    id: "komet-neowise", titel: "Komet NEOWISE", von: "Internationale Raumstation (NASA)", jahr: 2020, koerper: "erde", freischalten: ["erde", "sonne"],
    text: "Im Juli 2020 war der Komet NEOWISE sogar mit bloßem Auge zu sehen. Von der Raumstation aus steht er links über dem Horizont der Erde. Sein Schweif zeigt immer von der Sonne weg.",
  },
  {
    id: "mars-sojourner", titel: "Sojourner, das erste Marsauto", von: "Mars Pathfinder (NASA)", jahr: 1997, koerper: "mars",
    text: "1997 rollte der erste Rover über den Mars: Sojourner, nicht größer als ein Mikrowellenherd. In knapp drei Monaten fuhr er rund 100 Meter weit.",
  },
  {
    id: "mars-sonnenuntergang", titel: "Blauer Sonnenuntergang", von: "Curiosity (NASA)", jahr: 2015, koerper: "mars",
    text: "Auf dem Mars ist der Sonnenuntergang blau. Der feine Staub in der Luft lässt das blaue Licht nahe an der Sonne durch und streut das rote zur Seite — genau umgekehrt wie auf der Erde.",
  },
  {
    id: "mars-curiosity", titel: "Curiosity im Staubsturm", von: "Curiosity (NASA)", jahr: 2018, koerper: "mars",
    text: "Ein Selbstporträt, zusammengesetzt aus vielen Bildern der Kamera am Roboterarm — deshalb ist der Arm selbst nicht zu sehen. Der Himmel ist vom großen Staubsturm im Juni 2018 verdunkelt.",
  },
  {
    id: "mars-ingenuity", titel: "Ingenuity, der Mars-Hubschrauber", von: "Perseverance (NASA)", jahr: 2021, koerper: "mars",
    text: "Der kleine Hubschrauber flog 2021 als erstes Fluggerät auf einem anderen Planeten. Weil die Marsluft so dünn ist, drehen sich seine Rotoren rund 2 500-mal pro Minute. Geplant waren fünf Flüge — es wurden 72.",
  },
  {
    id: "mars-perseverance", titel: "Perseverance am Probenlager", von: "Perseverance (NASA)", jahr: 2023, koerper: "mars",
    text: "Ein Selbstporträt am Ort »Three Forks«: Hier legte der Rover Röhrchen mit Gesteinsproben auf dem Boden ab — ein Vorrat für den Fall, dass eine spätere Mission sie zur Erde bringt.",
  },
  {
    id: "ceres-flecken", titel: "Helle Flecken auf Ceres", von: "Dawn (NASA)", jahr: 2015, koerper: "ceres",
    text: "Beim Anflug entdeckte Dawn leuchtende Flecken im Krater Occator. Heute weiß man: es sind Salzablagerungen aus salzigem Wasser, das aus dem Inneren aufstieg.",
  },
  {
    id: "jupiter-voyager", titel: "Jupiter mit Io und Europa", von: "Voyager 1 (NASA)", jahr: 1979, koerper: "jupiter",
    text: "Voyager 1 fotografierte Jupiter 1979 mit zwei seiner Monde, Io und Europa, vor der Wolkendecke. Auf Voyager-Bildern entdeckte man die ersten aktiven Vulkane außerhalb der Erde — auf Io.",
  },
  {
    id: "jupiter-polarlicht", titel: "Polarlicht auf Jupiter", von: "Hubble-Weltraumteleskop", jahr: 1998, koerper: "jupiter",
    text: "Im ultravioletten Licht zeigt Hubble einen Ring aus Polarlicht um Jupiters Nordpol, größer als die ganze Erde. Die kleinen Leuchtpunkte daneben sind Spuren, die die Monde Io, Europa und Ganymed im Magnetfeld hinterlassen.",
  },
  {
    id: "io-juno", titel: "Io vor Jupiter", von: "Juno (NASA)", jahr: 2023, koerper: "io", freischalten: ["io"],
    text: "Juno kommt Io bei jeder Runde näher. Links der kleine Vulkanmond, rechts der Rand des Riesenplaneten — die Farben sind nachträglich verstärkt.",
  },
  {
    id: "saturn-hexagon", titel: "Das Sechseck am Nordpol", von: "Cassini (NASA/ESA)", jahr: 2014, koerper: "saturn",
    text: "Um Saturns Nordpol läuft ein Wolkenband in Form eines Sechsecks; jede Seite ist länger als der Durchmesser der Erde. In der Mitte dreht sich ein Wirbelsturm.",
  },
  {
    id: "saturn-gegenlicht", titel: "Saturn im Gegenlicht", von: "Cassini (NASA/ESA)", jahr: 2012, koerper: "saturn",
    text: "Cassini stand im Schatten des Planeten, die Sonne genau dahinter. So leuchten die Ringe und der Rand der Atmosphäre, wie man es von der Erde aus nie sehen kann.",
  },
  {
    id: "enceladus-fontaenen", titel: "Die Fontänen von Enceladus", von: "Cassini (NASA/ESA)", jahr: 2009, koerper: "enceladus",
    text: "Aus Rissen am Südpol, den »Tigerstreifen«, sprühen Dutzende Fontänen aus Wassereis ins All. Das Wasser stammt aus einem Ozean unter der Eiskruste.",
  },
  {
    id: "titan-huygens", titel: "Auf Titan gelandet", von: "Huygens (ESA)", jahr: 2005, koerper: "titan",
    text: "Das erste Bild vom Boden eines Mondes im äußeren Sonnensystem: rundliche Brocken aus Wassereis, glattgeschliffen von Flüssen aus Methan. Die Farben sind nachträglich angepasst.",
  },
  {
    id: "miranda-voyager", titel: "Miranda aus der Nähe", von: "Voyager 2 (NASA)", jahr: 1986, koerper: "miranda",
    text: "Voyager 2 flog 1986 an Miranda vorbei — es sind bis heute die einzigen Nahaufnahmen. Die Oberfläche sieht aus, als wäre der Mond zerbrochen und neu zusammengesetzt worden.",
  },
  {
    id: "neptun-dunkler-fleck", titel: "Der Große Dunkle Fleck", von: "Voyager 2 (NASA)", jahr: 1989, koerper: "neptun",
    text: "Ein Wirbelsturm so groß wie die Erde, am Rand weiße Wolken aus gefrorenem Methan. Als Hubble 1994 nachsah, war er verschwunden.",
  },
  {
    id: "pluto-berge", titel: "Plutos Berge im Gegenlicht", von: "New Horizons (NASA)", jahr: 2015, koerper: "pluto",
    text: "Kurz nach dem Vorbeiflug blickte New Horizons zurück: Berge aus Wassereis bis 3 500 m Höhe, eine glatte Ebene aus gefrorenem Stickstoff und darüber Schichten aus Dunst in Plutos dünner Lufthülle.",
  },
  {
    id: "arrokoth", titel: "Arrokoth", von: "New Horizons (NASA)", jahr: 2019, koerper: "pluto",
    text: "Am Neujahrstag 2019 flog New Horizons an Arrokoth vorbei, 6,6 Mrd. km von der Sonne — das fernste Objekt, das je aus der Nähe erforscht wurde. Zwei Brocken, die sich ganz sanft berührt haben und seitdem zusammenkleben.",
  },
];

/** Die Porträts aller Himmelskörper, aus den Steckbrief-Fotos. */
const PORTRAETS: GalerieEintrag[] = KOERPER.filter(k => foto(k.id)).map(k => ({
  id: `portraet-${k.id}`,
  titel: k.name,
  von: foto(k.id)!.urheber.split(/[,;(]/)[0].trim().slice(0, 60),
  text: k.intro,
  koerper: k.id,
  portraet: true,
}));

/** Reihenfolge der Reise: Sonne, dann jeder Planet mit seinen Monden, am Ende der Blick ins All. */
const REISE = KOERPER.filter(k => k.art !== "mond")
  .flatMap(k => [k.id, ...KOERPER.filter(m => m.mutter === k.id).map(m => m.id)]);

function reiseplatz(e: GalerieEintrag): number {
  // Nur mit Freischaltung, ohne Motiv im Sonnensystem: der Blick hinaus, ganz ans Ende.
  if (!e.koerper) return REISE.length + (e.freischalten?.includes("pluto") ? 1 : 0);
  return REISE.indexOf(e.koerper) + (e.portraet ? 0 : 0.5);
}

export const GALERIE: GalerieEintrag[] = [...PORTRAETS, ...BASIS, ...MISSIONEN]
  .map((e, i) => ({ e, i }))
  .sort((a, b) => reiseplatz(a.e) - reiseplatz(b.e) || a.i - b.i)
  .map(x => x.e);

export function bildFuer(e: GalerieEintrag): Bildnachweis | undefined {
  return e.portraet ? foto(e.koerper!) : galerieBild(e.id);
}

export function benoetigt(e: GalerieEintrag): string[] {
  return e.freischalten ?? (e.koerper ? [e.koerper] : []);
}

export function freigeschaltet(e: GalerieEintrag, erforscht: readonly string[]): boolean {
  return benoetigt(e).every(id => erforscht.includes(id));
}

/** Filter nach Himmelskörper: ein Planet zeigt auch die Bilder seiner Monde. */
export function zeigt(e: GalerieEintrag, filter: string | null): boolean {
  if (!filter) return true;
  if (!e.koerper) return false;
  return e.koerper === filter || KOERPER_NACH_ID[e.koerper]?.mutter === filter;
}
