/**
 * Die Atommodelle: vom Teilchenmodell bis zum Orbitalmodell.
 *
 * Hier steht die Rechnung, nicht das Bild — welche Schale wie viele
 * Elektronen trägt, welche Orbitale besetzt sind, wie viele Neutronen im Kern
 * sitzen. Gezeichnet wird das in `components/pse/Atombild.tsx`.
 *
 * Die Reihenfolge der Modelle ist die des Unterrichts: jedes erklärt mehr als
 * das vorige, und jedes hat eine Lücke, die das nächste schließt. Darum steht
 * bei jedem Modell beides dabei — was es kann und wo es aufhört.
 */
import type { PseElement } from "./elemente";

/** Ein Orbital mit seiner Besetzung. `l` ist 0 = s, 1 = p, 2 = d, 3 = f. */
export type Orbital = { n: number; l: number; zahl: number };

const BUCHSTABE = "spdf";

/** »2p« — Hauptquantenzahl und Buchstabe. */
export const orbitalName = (o: Orbital): string => `${o.n}${BUCHSTABE[o.l]}`;

/** Plätze eines Orbitaltyps: s 2, p 6, d 10, f 14. */
export const plaetze = (l: number): number => 2 * (2 * l + 1);

/**
 * Die Orbitale in der Reihenfolge, in der sie gefüllt werden: nach der Summe
 * n + l, bei Gleichstand das mit der kleineren Hauptquantenzahl zuerst
 * (Madelung-Regel). Daher kommt 4s vor 3d.
 */
const REIHE: { n: number; l: number }[] = (() => {
  const alle: { n: number; l: number }[] = [];
  for (let n = 1; n <= 8; n++) for (let l = 0; l < Math.min(n, 4); l++) alle.push({ n, l });
  return alle.sort((a, b) => a.n + a.l - (b.n + b.l) || a.n - b.n);
})();

/** Besetzung nach der Madelung-Regel — die Reihenfolge aus dem Schulbuch. */
export function madelung(z: number): Orbital[] {
  const aus: Orbital[] = [];
  let rest = z;
  for (const { n, l } of REIHE) {
    if (rest <= 0) break;
    const zahl = Math.min(rest, plaetze(l));
    aus.push({ n, l, zahl });
    rest -= zahl;
  }
  return aus;
}

/** Die Edelgase als Kurzschreibweise: »[Ar]« steht für 18 Elektronen. */
const EDELGAS: Record<string, number> = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };

const sortiert = (os: Orbital[]): Orbital[] => [...os].sort((a, b) => a.n - b.n || a.l - b.l);

/**
 * Die Besetzung aus der Konfiguration von PubChem, etwa »[Ar]4s2 3d6«.
 *
 * Der Kern in Klammern wird nach Madelung ergänzt — bis zum Edelgas stimmt die
 * Regel ausnahmslos. Die geschriebenen Orbitale dahinter sind die gemessenen,
 * und die weichen bei einigen Nebengruppenelementen von der Regel ab (Chrom
 * hat 3d⁵ 4s¹, nicht 3d⁴ 4s²). Ergibt die Summe nicht die Ordnungszahl, ist
 * mit dem String etwas nicht in Ordnung; dann gilt Madelung.
 */
export function orbitale(e: PseElement): Orbital[] {
  const m = /^\s*(?:\[(\w+)\])?\s*(.*)$/.exec(e.konfiguration);
  if (!m) return madelung(e.z);
  const kern = m[1] ? EDELGAS[m[1]] : 0;
  if (m[1] && kern === undefined) return madelung(e.z);
  const aus = kern ? madelung(kern) : [];
  for (const t of m[2].matchAll(/(\d)([spdf])(\d+)/g)) {
    aus.push({ n: Number(t[1]), l: BUCHSTABE.indexOf(t[2]), zahl: Number(t[3]) });
  }
  const summe = aus.reduce((s, o) => s + o.zahl, 0);
  return summe === e.z ? sortiert(aus) : madelung(e.z);
}

/**
 * Elektronen je Schale, von innen nach außen: [2, 3] für Bor.
 *
 * Das ist das Schalenmodell — eine Schale fasst alle Orbitale mit derselben
 * Hauptquantenzahl zusammen.
 */
export function schalen(os: Orbital[]): number[] {
  const aus: number[] = [];
  for (const o of os) aus[o.n - 1] = (aus[o.n - 1] ?? 0) + o.zahl;
  for (let i = 0; i < aus.length; i++) aus[i] ??= 0;
  return aus;
}

/** Die Namen der Schalen, wie sie im Unterricht heißen. */
export const SCHALENNAME = ["K", "L", "M", "N", "O", "P", "Q"];

/** Elektronen auf der äußersten besetzten Schale. */
export const aussen = (sch: number[]): number => sch[sch.length - 1] ?? 0;

/**
 * Bindigkeit nach der Schulregel: Elemente der Gruppen I–III geben ihre
 * Außenelektronen her und bilden so viele Bindungen, wie sie Außenelektronen
 * haben; ab Gruppe IV zählt, wie viele Elektronen zum Oktett fehlen.
 *
 * Darum ist Bor dreibindig (drei Außenelektronen) und kommt dabei nur auf
 * sechs Elektronen — das ist der Elektronenmangel, der Bor so reaktionsfreudig
 * macht. Für Nebengruppenelemente gibt es keine solche Regel; die geben 0.
 */
export function bindigkeit(e: PseElement): number {
  if (e.hauptgruppe === null) return 0;
  const g = e.hauptgruppe;
  if (e.z === 1) return 1;
  if (g === 8) return 0;
  return g <= 3 ? g : 8 - g;
}

/**
 * Neutronen im Kern: gerundete Massenzahl minus Protonen. Das ist das
 * häufigste Isotop, nicht das leichteste — bei Bor sind das 6 Neutronen (¹¹B,
 * vier Fünftel allen Bors).
 */
export const neutronen = (e: PseElement): number | null =>
  e.masse === null ? null : Math.round(e.masse) - e.z;

/**
 * Die Elektronen eines Orbitals auf seine Kästchen verteilt — nach der
 * Hundschen Regel: erst besetzt jedes Kästchen ein einzelnes Elektron, erst
 * danach wird gepaart. Darum hat Stickstoff drei ungepaarte Elektronen.
 */
export function kaestchen(zahl: number, l: number): ("leer" | "einzeln" | "paar")[] {
  const k = plaetze(l) / 2;
  return Array.from({ length: k }, (_, i) =>
    zahl >= k + i + 1 ? "paar" : zahl >= i + 1 ? "einzeln" : "leer");
}

/**
 * Die Zeilen des Energiestufendiagramms: alle Orbitale, die gefüllt werden,
 * in der Reihenfolge, in der sie gefüllt werden — von unten nach oben.
 *
 * Grundlage ist die Madelung-Reihenfolge. Dazu kommen Orbitale, die das
 * Element gemessen besetzt, die die Regel aber noch gar nicht vorsieht: Uran
 * hat ein Elektron im 6d, obwohl die Regel erst das 5f voll machen würde.
 * Ohne diesen Zusatz fiele dieses Elektron aus dem Bild.
 */
export function energiestufen(e: PseElement): Orbital[] {
  const besetzt = orbitale(e);
  const reihen = madelung(e.z).map(o => ({ n: o.n, l: o.l, zahl: 0 }));
  for (const o of besetzt) {
    if (!reihen.some(r => r.n === o.n && r.l === o.l)) reihen.push({ n: o.n, l: o.l, zahl: 0 });
  }
  return reihen
    .map(r => ({ ...r, zahl: besetzt.find(b => b.n === r.n && b.l === r.l)?.zahl ?? 0 }))
    .sort((a, b) => a.n + a.l - (b.n + b.l) || a.n - b.n);
}

export type ModellId = "teilchen" | "kern" | "schalen" | "energie" | "orbital";

export type Modell = {
  id: ModellId;
  name: string;
  /** Jahr und Name — Modelle gehören zu Menschen, nicht in die Luft. */
  jahr: string;
  wer: string;
  /** Der Kerngedanke in einem Satz. */
  idee: string;
  /** Was sich damit erklären lässt. */
  kann: string;
  /** Und wo es aufhört — genau das schließt das nächste Modell. */
  luecke: string;
};

export const MODELLE: Modell[] = [
  {
    id: "teilchen",
    name: "Teilchenmodell",
    jahr: "1808",
    wer: "John Dalton",
    idee: "Jeder Stoff besteht aus winzigen, unteilbaren Kugeln. Alle Atome eines Elements sind gleich schwer.",
    kann: "Erklärt, warum sich Stoffe immer im gleichen Massenverhältnis verbinden, und warum Zucker im Tee verschwindet, ohne weniger zu werden.",
    luecke: "Eine Kugel ohne Innenleben kann nicht geladen sein — Blitze, Batterien und Ionen bleiben unerklärt.",
  },
  {
    id: "kern",
    name: "Kern-Hülle-Modell",
    jahr: "1911",
    wer: "Ernest Rutherford",
    idee: "Fast die ganze Masse steckt in einem winzigen, positiven Kern; darum herum ist fast nur leerer Raum mit den Elektronen.",
    kann: "Erklärt den Streuversuch: Schießt man auf Goldfolie, fliegt fast alles hindurch — und ganz selten prallt etwas zurück.",
    luecke: "Ein kreisendes Elektron müsste ständig Energie abstrahlen und in den Kern stürzen. Atome gibt es aber immer noch.",
  },
  {
    id: "schalen",
    name: "Schalenmodell",
    jahr: "1913",
    wer: "Niels Bohr",
    idee: "Die Elektronen sitzen auf festen Schalen mit festen Energien. Dazwischen ist nichts — ein Elektron springt oder bleibt.",
    kann: "Erklärt die Außenelektronen und damit das ganze Periodensystem: gleiche Spalte, gleich viele Außenelektronen, ähnliches Verhalten. Und: springt ein Elektron herunter, wird Licht einer bestimmten Farbe frei.",
    luecke: "Genau stimmt die Rechnung nur beim Wasserstoff. Und niemand kann sagen, wo auf der Schale das Elektron gerade ist.",
  },
  {
    id: "energie",
    name: "Energiestufenmodell",
    jahr: "ab 1916",
    wer: "Bohr und Sommerfeld",
    idee: "Jede Schale zerfällt in Unterschalen s, p, d, f. Jedes Kästchen nimmt zwei Elektronen mit entgegengesetztem Spin.",
    kann: "Erklärt, warum die dritte Schale erst mit acht Elektronen zufrieden scheint und die vierte vorher anfängt — und damit die Nebengruppen.",
    luecke: "Die Elektronen sind hier noch Kügelchen in Kästchen. Wo sie sich aufhalten, sagt das Modell nicht.",
  },
  {
    id: "orbital",
    name: "Orbitalmodell",
    jahr: "1926",
    wer: "Erwin Schrödinger",
    idee: "Es gibt keine Bahn. Es gibt einen Raum, in dem sich das Elektron mit 90 % Wahrscheinlichkeit aufhält — das Orbital.",
    kann: "Erklärt die Form der Moleküle: s-Orbitale sind Kugeln, p-Orbitale Hanteln in drei Richtungen. Wie sie sich überlappen, bestimmt die Bindungswinkel.",
    luecke: "Anschaulich ist das kaum noch. Ein Bild davon ist immer eine Vereinfachung — gerechnet wird mit einer Wellenfunktion.",
  },
];

export const modell = (id: ModellId): Modell => MODELLE.find(m => m.id === id)!;
