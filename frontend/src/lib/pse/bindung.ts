/**
 * Das Bindungslabor: aus bis zu acht Atomen eine Verbindung bauen.
 *
 * Gerechnet wird mit der Schulregel. Jedes Atom hat eine Bindigkeit (siehe
 * `bindigkeit` in atommodell.ts), und ein Elektronenpaar, das zwei Atome
 * gemeinsam nutzen, zählt bei beiden mit. Daraus ergibt sich, wie viele
 * Elektronen am Ende um jedes Atom liegen — und ob das Oktett erreicht ist.
 *
 * Genau dort wird Bor interessant: Bor ist dreibindig und kommt damit nur auf
 * sechs Elektronen. Dieser Elektronenmangel fällt in der Rechnung sofort auf,
 * und darum steht er auch in den Hinweisen.
 *
 * Was hier nicht steht: die echten Bindungswinkel. Die Atome werden gleichmäßig
 * um das Zentralatom gelegt (bei zwei Nachbarn und freien Paaren gewinkelt) —
 * das ist das Bild aus dem Heft, nicht die Geometrie. Die gibt es im
 * Strukturformelzeichner in 3D.
 */
import { bindigkeit, schalen, orbitale } from "./atommodell";
import { pseElement, type PseElement } from "./elemente";
import { sub } from "@/lib/chemie";

export type BindungsAtom = {
  e: PseElement;
  /** Elektronen je Schale — für das Schalenbild. */
  schalen: number[];
  /** Außenelektronen des freien Atoms. */
  valenz: number;
  bindigkeit: number;
  /** Platz auf der Bühne in Einheiten; das Zentrum liegt bei (0, 0). */
  x: number;
  y: number;
  /** Summe der Bindungsgrade an diesem Atom. */
  gebunden: number;
  /** Freie Elektronenpaare. */
  einsam: number;
  /** Elektronen in der Außenschale, geteilte doppelt gezählt. */
  huelle: number;
  /** 8 — beim Wasserstoff und Helium nur 2. */
  soll: number;
  erfuellt: boolean;
};

/** Eine Bindung zwischen zwei Atomen; `grad` ist die Zahl der geteilten Paare. */
export type Bindung = { a: number; b: number; grad: number };

export type Verbindung = {
  atome: BindungsAtom[];
  bindungen: Bindung[];
  /** Index des Zentralatoms, oder null bei einem oder zwei Atomen. */
  zentrum: number | null;
  /** Summenformel mit normalen Ziffern — zum Vergleichen. */
  formel: string;
  /** Dieselbe Formel zum Hinsehen: BF₃. */
  gesetzt: string;
  name: string | null;
  /** Was an dieser Verbindung auffällt, in Sätzen. */
  hinweise: string[];
};

/** Außenelektronen des freien Atoms; Helium hat zwei, nicht acht. */
const valenzVon = (e: PseElement): number =>
  e.z === 2 ? 2 : e.hauptgruppe ?? 0;

/** Namen der Verbindungen, die im Unterricht vorkommen. */
const NAMEN: Record<string, string> = {
  BF3: "Bortrifluorid", BCl3: "Bortrichlorid", BH3: "Boran", BBr3: "Bortribromid",
  BN: "Bornitrid", AlCl3: "Aluminiumchlorid",
  H2: "Wasserstoff", O2: "Sauerstoff", N2: "Stickstoff", F2: "Fluor", Cl2: "Chlor",
  Br2: "Brom", HCl: "Chlorwasserstoff", HF: "Fluorwasserstoff",
  H2O: "Wasser", H2S: "Schwefelwasserstoff", NH3: "Ammoniak", PH3: "Phosphan",
  CH4: "Methan", SiH4: "Silan", CCl4: "Tetrachlormethan", CF4: "Tetrafluormethan",
  CH3Cl: "Chlormethan", CHCl3: "Trichlormethan (Chloroform)",
  CH2O: "Methanal (Formaldehyd)", CS2: "Schwefelkohlenstoff",
  CO2: "Kohlenstoffdioxid", CO: "Kohlenstoffmonoxid", SiO2: "Siliciumdioxid",
  NF3: "Stickstofftrifluorid", PCl3: "Phosphortrichlorid", SO2: "Schwefeldioxid",
};

/**
 * Die Reihenfolge, in der die Symbole in einer Formel stehen. Das ist die
 * Folge der IUPAC: das elektropositivere Element zuerst. Wasserstoff steht
 * darin zwischen Stickstoff und Schwefel — deshalb schreibt man NH₃ und PH₃,
 * aber H₂O, H₂S und HCl. Mit einer rein alphabetischen Regel käme »H₃N« heraus.
 */
const REIHENFOLGE = ["He", "Ne", "Ar", "Al", "B", "Si", "C", "P", "N", "H", "S", "I", "Br", "Cl", "O", "F"];

/** Summenformel in der üblichen Schreibweise. */
export function summenformel(symbole: string[]): string {
  const zahl = new Map<string, number>();
  for (const s of symbole) zahl.set(s, (zahl.get(s) ?? 0) + 1);
  const rang = (s: string): number => {
    const i = REIHENFOLGE.indexOf(s);
    return i === -1 ? REIHENFOLGE.length : i;
  };
  return [...zahl.keys()]
    .sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
    .map(s => s + (zahl.get(s)! > 1 ? String(zahl.get(s)) : ""))
    .join("");
}

/** Die Formel zum Hinsehen: aus »BF3« wird »BF₃«. */
export const formelGesetzt = (formel: string): string =>
  formel.replace(/\d+/g, z => sub(Number(z)));

/** Höchstens so viele Atome lassen sich zusammenstecken. */
export const MAX_ATOME = 8;

/**
 * Welche Atome das Zentrum bilden könnte: das mit der größten Bindigkeit.
 * Bei Gleichstand das mit der kleineren Elektronegativität — das gibt seine
 * Elektronen leichter her und steht darum in der Mitte.
 */
function zentrumVon(atome: PseElement[]): number {
  let best = 0;
  atome.forEach((e, i) => {
    const b = bindigkeit(e), bb = bindigkeit(atome[best]);
    if (b > bb || (b === bb && (e.en ?? 9) < (atome[best].en ?? 9))) best = i;
  });
  return best;
}

/** Gleichmäßig im Kreis; bei zwei Nachbarn und freien Paaren gewinkelt. */
function plaetze(anzahl: number, gewinkelt: boolean): { x: number; y: number }[] {
  if (anzahl === 2) {
    // Wie beim Wasser drücken freie Paare die Nachbarn zusammen; ohne sie
    // liegen sie einander gegenüber (CO₂ ist gestreckt).
    return gewinkelt
      ? [-52, 52].map(g => ({ x: Math.sin((g * Math.PI) / 180), y: Math.cos((g * Math.PI) / 180) }))
      : [{ x: -1, y: 0 }, { x: 1, y: 0 }];
  }
  return Array.from({ length: anzahl }, (_, i) => {
    const w = (i / anzahl) * 2 * Math.PI - Math.PI / 2;
    return { x: Math.cos(w), y: Math.sin(w) };
  });
}

/**
 * Baut aus den Symbolen eine Verbindung: ein Zentralatom, die übrigen ringsum,
 * und so viele geteilte Paare, dass möglichst alle ihr Oktett erreichen.
 */
export function baue(symbole: string[]): Verbindung {
  const atome = symbole.slice(0, MAX_ATOME).map(pseElement).filter((e): e is PseElement => !!e);
  const formel = summenformel(atome.map(e => e.symbol));
  const leer: Verbindung = {
    atome: [], bindungen: [], zentrum: null, formel: "", gesetzt: "", name: null, hinweise: [],
  };
  if (atome.length === 0) return leer;

  const bindungen: Bindung[] = [];
  const hinweise: string[] = [];
  let zentrum: number | null = null;
  let orte: { x: number; y: number }[];

  if (atome.length === 1) {
    orte = [{ x: 0, y: 0 }];
  } else if (atome.length === 2) {
    // Eine halbe Einheit je Seite: der Abstand zwischen zwei gebundenen Kernen
    // ist überall gleich, egal ob mit oder ohne Zentralatom.
    orte = [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }];
    const grad = Math.min(bindigkeit(atome[0]), bindigkeit(atome[1]), 3);
    if (grad > 0) bindungen.push({ a: 0, b: 1, grad });
  } else {
    zentrum = zentrumVon(atome);
    const z = atome[zentrum];
    const nachbarn = atome.map((_, i) => i).filter(i => i !== zentrum);
    // Wer nicht bindet (Edelgase, Nebengruppenelemente), steht nur dabei.
    const partner = nachbarn.filter(i => bindigkeit(atome[i]) > 0);
    let rest = bindigkeit(z) - partner.length;
    const grade = new Map<number, number>(partner.map(i => [i, 1]));
    // Was an Bindigkeit übrig ist, geht in Doppel- und Dreifachbindungen.
    for (const i of partner) {
      if (rest <= 0) break;
      const mehr = Math.min(rest, bindigkeit(atome[i]) - 1, 2);
      if (mehr > 0) { grade.set(i, 1 + mehr); rest -= mehr; }
    }
    for (const i of partner) bindungen.push({ a: zentrum, b: i, grad: grade.get(i)! });
    // Plätze: Zentrum in die Mitte, die Nachbarn ringsum.
    const eigen = valenzVon(z) - partner.reduce((s, i) => s + grade.get(i)!, 0);
    const ring = plaetze(nachbarn.length, eigen >= 2);
    orte = atome.map(() => ({ x: 0, y: 0 }));
    nachbarn.forEach((i, k) => { orte[i] = ring[k]; });
    if (bindigkeit(z) < partner.length) {
      hinweise.push(`${z.name} kann nur ${bindigkeit(z)} Bindungen eingehen — für ${partner.length} Nachbarn reicht das nicht. In Wirklichkeit entsteht daraus ein Netzwerk oder eine andere Verbindung.`);
    }
  }

  const fertig: BindungsAtom[] = atome.map((e, i) => {
    const gebunden = bindungen.filter(b => b.a === i || b.b === i).reduce((s, b) => s + b.grad, 0);
    const valenz = valenzVon(e);
    const eigen = Math.max(0, valenz - gebunden);
    const soll = e.z <= 2 ? 2 : 8;
    const huelle = eigen + 2 * gebunden;
    return {
      e, schalen: schalen(orbitale(e)), valenz, bindigkeit: bindigkeit(e),
      x: orte[i].x, y: orte[i].y, gebunden,
      einsam: Math.floor(eigen / 2), huelle, soll, erfuellt: huelle === soll,
    };
  });

  // Hinweise: erst die Besonderheiten, dann das Fazit.
  const mangel = fertig.filter(a => a.huelle < a.soll && a.bindigkeit > 0);
  for (const a of mangel) {
    hinweise.push(a.e.z === 5
      ? `Bor hat nur drei Außenelektronen und kommt deshalb auf ${a.huelle} statt 8 — ein Elektronensextett. Dieser Elektronenmangel macht Bor gierig: ${a.e.symbol}-Verbindungen nehmen gern ein freies Elektronenpaar auf, etwa vom Ammoniak, und erreichen so doch das Oktett.`
      : `${a.e.name} kommt hier nur auf ${a.huelle} Außenelektronen statt ${a.soll} — so geht die Verbindung nicht auf.`);
  }
  if (fertig.some(a => a.bindigkeit === 0 && a.e.hauptgruppe === null)) {
    hinweise.push("Für Nebengruppenelemente gilt die Oktettregel nicht — hier hört das Schalenmodell auf.");
  }
  if (fertig.some(a => a.bindigkeit === 0 && a.e.hauptgruppe === 8 && a.e.z !== 2)) {
    hinweise.push("Edelgase haben ihre Außenschale schon voll und binden darum nicht mit.");
  }
  if (fertig.length > 1 && fertig.every(a => a.erfuellt)) {
    hinweise.push("Alle Atome haben die Edelgaskonfiguration erreicht — die Verbindung geht auf.");
  }

  return {
    atome: fertig, bindungen, zentrum,
    formel, gesetzt: formelGesetzt(formel), name: NAMEN[formel] ?? null, hinweise,
  };
}

/**
 * Die Richtungen, in die die freien Elektronenpaare eines Atoms zeigen: acht
 * Plätze rings herum, davon die, die am weitesten von allen Bindungen weg
 * sind. So drängeln sich freie Paare und Bindungen nicht auf derselben Seite.
 */
export function freiePlaetze(richtungen: number[], anzahl: number): number[] {
  const slots = Array.from({ length: 8 }, (_, i) => (i / 8) * 2 * Math.PI);
  // Abstand zur nächsten Bindung, über den kürzeren Weg um den Kreis gemessen.
  const abstand = (w: number) =>
    richtungen.length === 0 ? 1
      : Math.min(...richtungen.map(b => Math.abs(Math.atan2(Math.sin(w - b), Math.cos(w - b)))));
  return slots.sort((x, y) => abstand(y) - abstand(x)).slice(0, anzahl);
}

/**
 * Die Richtungen der Bindungen je Atom, aus den Plätzen gerechnet — das
 * Gegenstück zu `freiePlaetze`.
 */
export function bindungsrichtungen(v: Verbindung): number[][] {
  return v.atome.map((a, i) =>
    v.bindungen.filter(b => b.a === i || b.b === i).map(b => {
      const anderer = b.a === i ? b.b : b.a;
      return Math.atan2(v.atome[anderer].y - a.y, v.atome[anderer].x - a.x);
    }));
}

/**
 * Zum Anklicken: Verbindungen, die im Unterricht vorkommen, in drei Gruppen.
 * Bor steht vorn — daran hängen die Beispiele dieses Reiters.
 *
 * Aufgenommen ist nur, was sich als einzelnes Molekül mit einem Zentralatom
 * zeichnen lässt. Salze (NaCl) fehlen deshalb: die halten keine gemeinsamen
 * Elektronenpaare, sondern Ionen zusammen — ein anderes Modell.
 */
export const VORLAGEN: { label: string; gruppe: string; symbole: string[] }[] = [
  { gruppe: "Bor und Nachbarn", label: "BF₃", symbole: ["B", "F", "F", "F"] },
  { gruppe: "Bor und Nachbarn", label: "BCl₃", symbole: ["B", "Cl", "Cl", "Cl"] },
  { gruppe: "Bor und Nachbarn", label: "BBr₃", symbole: ["B", "Br", "Br", "Br"] },
  { gruppe: "Bor und Nachbarn", label: "BH₃", symbole: ["B", "H", "H", "H"] },
  { gruppe: "Bor und Nachbarn", label: "AlCl₃", symbole: ["Al", "Cl", "Cl", "Cl"] },

  { gruppe: "Elemente", label: "H₂", symbole: ["H", "H"] },
  { gruppe: "Elemente", label: "O₂", symbole: ["O", "O"] },
  { gruppe: "Elemente", label: "N₂", symbole: ["N", "N"] },
  { gruppe: "Elemente", label: "F₂", symbole: ["F", "F"] },
  { gruppe: "Elemente", label: "Cl₂", symbole: ["Cl", "Cl"] },
  { gruppe: "Elemente", label: "Br₂", symbole: ["Br", "Br"] },

  { gruppe: "Moleküle", label: "HCl", symbole: ["H", "Cl"] },
  { gruppe: "Moleküle", label: "HF", symbole: ["H", "F"] },
  { gruppe: "Moleküle", label: "H₂O", symbole: ["O", "H", "H"] },
  { gruppe: "Moleküle", label: "H₂S", symbole: ["S", "H", "H"] },
  { gruppe: "Moleküle", label: "NH₃", symbole: ["N", "H", "H", "H"] },
  { gruppe: "Moleküle", label: "PH₃", symbole: ["P", "H", "H", "H"] },
  { gruppe: "Moleküle", label: "NF₃", symbole: ["N", "F", "F", "F"] },
  { gruppe: "Moleküle", label: "CH₄", symbole: ["C", "H", "H", "H", "H"] },
  { gruppe: "Moleküle", label: "SiH₄", symbole: ["Si", "H", "H", "H", "H"] },
  { gruppe: "Moleküle", label: "CH₃Cl", symbole: ["C", "H", "H", "H", "Cl"] },
  { gruppe: "Moleküle", label: "CHCl₃", symbole: ["C", "H", "Cl", "Cl", "Cl"] },
  { gruppe: "Moleküle", label: "CCl₄", symbole: ["C", "Cl", "Cl", "Cl", "Cl"] },
  { gruppe: "Moleküle", label: "CF₄", symbole: ["C", "F", "F", "F", "F"] },
  { gruppe: "Moleküle", label: "CH₂O", symbole: ["C", "O", "H", "H"] },
  { gruppe: "Moleküle", label: "CO₂", symbole: ["C", "O", "O"] },
  { gruppe: "Moleküle", label: "CS₂", symbole: ["C", "S", "S"] },
];

/** Die Gruppen in ihrer Reihenfolge, ohne Wiederholung. */
export const VORLAGENGRUPPEN = [...new Set(VORLAGEN.map(v => v.gruppe))];

/** Die Atome, aus denen im Labor gebaut wird — die Schulelemente der ersten drei Perioden. */
export const BAUSTEINE = ["H", "B", "C", "N", "O", "F", "Cl", "Br", "S", "P", "Si", "Al", "He", "Ne"];
