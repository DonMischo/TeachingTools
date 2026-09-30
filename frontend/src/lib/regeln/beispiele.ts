/**
 * Beispielgalerie des Regel-Labors. Labyrinth, Blumen und Höhle sind aus
 * MarkovJunior von Maxim Gumin übertragen (MIT-Lizenz, github.com/mxgmn/MarkovJunior,
 * Dateien models/MazeBacktracker.xml, Flowers.xml, Cave.xml); Platine,
 * Verlies und Game of Life sind eigene Programme nach derselben Idee.
 */
import type { Start } from "./maschine";

export interface Beispiel {
  id: string;
  titel: string;
  icon: string;
  herkunft: "MarkovJunior" | "eigen";
  text: string[];
  programm: string;
  start: Start;
}

export const BEISPIELE: Beispiel[] = [
  {
    id: "labyrinth",
    titel: "Labyrinth",
    icon: "🌀",
    herkunft: "MarkovJunior",
    text: [
      "Zwei Regeln, Vorrang für die erste: Der rote Kopf gräbt zwei Felder weit ins Schwarze und legt eine grüne Spur; kommt er nicht weiter, geht er auf der Spur zurück.",
    ],
    programm: "markov: RBB=GGR, RGG=WWR",
    start: { b: 39, h: 39, grund: "B", mitte: "R" },
  },
  {
    id: "blumen",
    titel: "Blumen",
    icon: "🌼",
    herkunft: "MarkovJunior",
    text: [
      "Die ersten beiden Blöcke legen Erde (braun), Rasen (grün) und Himmel (blau) an: Jedes Feld, unter dem noch drei bzw. vier Felder liegen, wird umgefärbt.",
      "Dann wachsen Stängel nach oben. »spiegel« heißt: Die Regeln gelten gespiegelt, aber nie gedreht — Pflanzen wachsen nicht zur Seite oder nach unten.",
      "Eine Knospe (lila) wächst weiter, knickt ab oder verzweigt sich; ist oben kein Platz mehr, blüht sie auf. Erst wenn keine Knospe mehr wachsen kann, sprießt ein neuer Stängel aus dem Rasen (die Regel nach dem Komma hat Nachrang).",
    ],
    programm: [
      "alle spiegel: N/*/*/*=G/*/*/*",
      "alle spiegel: G/*/*/*/*=U/*/*/*/*",
      "markov spiegel: UUU/UUU/UPU=***/*P*/*E* | UUU/UUU/UUU/PUU/**U=***/*P*/*E*/EE*/*** | UUUUU/UUUUU/UUUUU/UUPUU/U***U=*****/*P*P*/*E*E*/*EEE*/***** | UUU/UPU/UEU/UEU=*Y*/YEY/*Y*/***, UUUUU/UUUUU/UUUUU/GGGGG/NNNNN=*****/**P**/**E**/**E**/**E**",
      "alle spiegel: ***/*P*/***=*Y*/YEY/*Y*",
    ].join("\n"),
    start: { b: 60, h: 60, grund: "N" },
  },
  {
    id: "hoehle",
    titel: "Höhle",
    icon: "🕳️",
    herkunft: "MarkovJunior",
    text: [
      "Erst wird das Innere hell, dann wird jedes helle Feld mit 44 % Chance wieder dunkel — Rauschen.",
      "»nachbarn« ist ein Zellautomat: Ein helles Feld mit 5 bis 8 dunklen Nachbarn wird dunkel, ein dunkles mit 6 bis 8 hellen wird hell. Alle Felder gleichzeitig, bis sich nichts mehr ändert — aus Rauschen werden Höhlen.",
    ],
    programm: [
      "alle: ***/*D*/***=***/*A*/***",
      "alle x1 p44: A=D",
      "nachbarn: A=D bei 5-8 D, D=A bei 6-8 A",
      "alle: AD/DA=AA/DA",
    ].join("\n"),
    start: { b: 60, h: 60, grund: "D" },
  },
  {
    id: "platine",
    titel: "Platine",
    icon: "🔌",
    herkunft: "eigen",
    text: [
      "Zuerst wächst das Lochraster: IEE=IEI setzt von der Mitte aus jedes zweite Feld ein Loch — wie beim Rätsel »Punktgitter«. Zwischen den Löchern bleiben Kanäle frei, darin laufen später die Leiterbahnen.",
      "Dann kommen die Chips (braun) mit je vier Anschlüssen, einer nach dem anderen. Der Stempel passt nur genau aufs Raster; die Anschlüsse (grau) sitzen in den Kanälen, ein Sperrring (hautfarben, am Ende weg) lässt sie nur nach außen hinaus.",
      "»pfad« sucht für jeden Anschluss des neuen Chips per Breitensuche den kürzesten Weg zum Netz — zu einem Anschluss der schon verbundenen Chips (blau) oder an eine vorhandene Leiterbahn (grün, das gibt eine Abzweigung). Die neuen Bahnen sind erst türkis und der angeschlossene Pin rosa (»start K«): So verbinden sich die Anschlüsse eines Chips nicht untereinander. Das Lochraster hält die Bahnen von selbst auseinander: sie laufen nur in den Kanälen. Wer keinen Weg mehr findet, bleibt rot.",
    ],
    programm: "# Lochraster: von der Mitte aus jedes zweite Feld\nalle: IEE=IEI\n# der erste Chip — seine Anschlüsse sind das Netz\neins x1: IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI=***A*****/*FFFFFFF*/*FNNNNNF*/*FNNNNNFA/*FNNNNNF*/AFNNNNNF*/*FNNNNNF*/*FFFFFFF*/*****A***\nalle: A=U\neins x1: IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI=***A*****/*FFFFFFF*/*FNNNNNF*/*FNNNNNFA/*FNNNNNF*/AFNNNNNF*/*FNNNNNF*/*FFFFFFF*/*****A***\npfad: A → UG über E = C, start K\nalle: A=R\nalle: K=U\nalle: C=G\neins x1: IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI=***A*****/*FFFFFFF*/*FNNNNNF*/*FNNNNNFA/*FNNNNNF*/AFNNNNNF*/*FNNNNNF*/*FFFFFFF*/*****A***\npfad: A → UG über E = C, start K\nalle: A=R\nalle: K=U\nalle: C=G\neins x1: IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI=***A*****/*FFFFFFF*/*FNNNNNF*/*FNNNNNFA/*FNNNNNF*/AFNNNNNF*/*FNNNNNF*/*FFFFFFF*/*****A***\npfad: A → UG über E = C, start K\nalle: A=R\nalle: K=U\nalle: C=G\neins x1: IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI=***A*****/*FFFFFFF*/*FNNNNNF*/*FNNNNNFA/*FNNNNNF*/AFNNNNNF*/*FNNNNNF*/*FFFFFFF*/*****A***\npfad: A → UG über E = C, start K\nalle: A=R\nalle: K=U\nalle: C=G\neins x1: IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI=***A*****/*FFFFFFF*/*FNNNNNF*/*FNNNNNFA/*FNNNNNF*/AFNNNNNF*/*FNNNNNF*/*FFFFFFF*/*****A***\npfad: A → UG über E = C, start K\nalle: A=R\nalle: K=U\nalle: C=G\neins x1: IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI/EEEEEEEEE/IEIEIEIEI=***A*****/*FFFFFFF*/*FNNNNNF*/*FNNNNNFA/*FNNNNNF*/AFNNNNNF*/*FNNNNNF*/*FFFFFFF*/*****A***\npfad: A → UG über E = C, start K\nalle: A=R\nalle: K=U\nalle: C=G\nalle: U=A\nalle: F=E",
    start: { b: 55, h: 55, grund: "E", mitte: "I" },
  },
  {
    id: "verlies",
    titel: "Verlies",
    icon: "🏰",
    herkunft: "eigen",
    text: [
      "Zimmer stempeln — ihre Wände sind erst grau, damit der rote Kopf beim Flure-Graben (Backtracker) nicht hindurchbricht. Danach werden sie schwarz, und zu jedem Zimmer brechen Türen durch.",
      "Dann verschwinden alle Sackgassen: Ein Flurfeld mit drei Wänden drumherum wird selbst zur Wand, immer wieder, bis nur noch Flure übrig sind, die irgendwo hinführen.",
    ],
    programm: [
      "eins x10: BBBBBBB/BBBBBBB/BBBBBBB/BBBBBBB/BBBBBBB/BBBBBBB/BBBBBBB=DDDDDDD/DUUUUUD/DUUUUUD/DUUUUUD/DUUUUUD/DUUUUUD/DDDDDDD",
      "markov: RBB=GGR, RGG=WWR",
      "alle: R=W",
      "alle: D=B",
      "eins x14: UBW=UYW",
      "alle: *B*/BWB/*W*=*B*/BBB/*W*",
    ].join("\n"),
    start: { b: 51, h: 51, grund: "B", mitte: "R" },
  },
  {
    id: "leben",
    titel: "Game of Life",
    icon: "🧫",
    herkunft: "eigen",
    text: [
      "John Conways Zellautomat: Jedes Feld zählt seine acht Nachbarn. Eine tote Zelle mit genau drei lebenden wird geboren, eine lebende mit weniger als zwei oder mehr als drei Nachbarn stirbt.",
      "Start ist Zufall (35 % lebend). Die Schrittgrenze x150 bremst — manche Muster blinken ewig.",
    ],
    programm: [
      "alle x1 p35: B=W",
      "nachbarn x150: B=W bei 3 W, W=B bei 0-1 W, W=B bei 4-8 W",
    ].join("\n"),
    start: { b: 48, h: 48, grund: "B" },
  },
];
