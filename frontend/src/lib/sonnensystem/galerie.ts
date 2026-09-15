/**
 * Der Blick von außen: was Weltraumteleskope und Raumsonden gesehen haben.
 * Die Reihenfolge ist eine Reise — von der Erde hinaus bis zum tiefsten Blick
 * ins All, der zeigt, wie klein das ganze Sonnensystem ist.
 */

export interface GalerieEintrag {
  id: string;
  titel: string;
  /** Wer das Bild aufgenommen hat: Teleskop oder Sonde. */
  von: string;
  jahr: number;
  text: string;
  /** Wozu im Steckbrief ein Link erscheint. */
  koerper?: string;
  /** Zwei Bilder desselben Motivs zum Vergleich. */
  paar?: string;
}

export const GALERIE: GalerieEintrag[] = [
  {
    id: "earthrise", titel: "Erdaufgang", von: "Apollo 8 (NASA)", jahr: 1968, koerper: "erde",
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
    id: "komet-rosetta", titel: "Komet Tschurjumow-Gerassimenko", von: "Rosetta (ESA)", jahr: 2014,
    text: "Die europäische Sonde Rosetta verfolgte zwei Jahre lang diesen Kometen, der wie eine Badeente geformt ist, und setzte als erste Sonde überhaupt einen Lander auf einem Kometen ab: Philae. Der Komet ist nur rund 4 km lang.",
  },
  {
    id: "pale-blue-dot", titel: "Der blassblaue Punkt", von: "Voyager 1 (NASA)", jahr: 1990, koerper: "erde",
    text: "Aus 6 Milliarden km Entfernung drehte sich Voyager 1 noch einmal um. In dem hellen Streifen (Streulicht der Sonne) liegt ein Pünktchen, kleiner als ein Pixel: die Erde. Der Astronom Carl Sagan schrieb dazu, auf diesem Punkt habe jeder gelebt, von dem man je gehört hat.",
  },
  {
    id: "saeulen-hubble", titel: "Säulen der Schöpfung", von: "Hubble-Weltraumteleskop", jahr: 2014,
    text: "Weit außerhalb des Sonnensystems, 6 500 Lichtjahre entfernt: Säulen aus Gas und Staub im Adlernebel. In ihrem Inneren entstehen neue Sterne — so, wie vor 4,6 Milliarden Jahren auch unsere Sonne entstanden ist.",
    paar: "saeulen-webb",
  },
  {
    id: "saeulen-webb", titel: "Säulen der Schöpfung", von: "James-Webb-Weltraumteleskop", jahr: 2022,
    text: "Dieselben Säulen, aber im Infrarotlicht: Webb blickt durch den Staub hindurch. Die roten Punkte an den Rändern sind junge Sterne, gerade erst ein paar hunderttausend Jahre alt.",
    paar: "saeulen-hubble",
  },
  {
    id: "hubble-deep-field", titel: "Hubble Ultra Deep Field", von: "Hubble-Weltraumteleskop", jahr: 2004,
    text: "Hubble starrte elf Tage lang auf einen dunklen Fleck am Himmel, nur ein Zehntel so breit wie der Vollmond. Fast jeder Lichtpunkt ist eine ganze Galaxie mit Milliarden Sternen.",
    paar: "webb-deep-field",
  },
  {
    id: "webb-deep-field", titel: "Webbs erstes tiefes Feld", von: "James-Webb-Weltraumteleskop", jahr: 2022,
    text: "Webbs erstes veröffentlichtes Bild: ein Himmelsausschnitt so klein wie ein Sandkorn auf der ausgestreckten Hand. Der Haufen darin ist so schwer, dass er das Licht noch fernerer Galaxien dahinter zu Bögen verbiegt. Manches Licht hier war über 13 Milliarden Jahre unterwegs — länger, als es unser Sonnensystem gibt.",
    paar: "hubble-deep-field",
  },
];
