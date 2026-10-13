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
import { bindigkeit, madelung, orbitale, schalen } from "./atommodell";
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

/**
 * Jedes Atom bekommt eine Farbe, damit man seine Elektronen wiedererkennt —
 * auch dann noch, wenn sie beim Nachbarn sitzen. Die Kategorienfarben taugen
 * dafür nicht: Kohlenstoff, Stickstoff und Sauerstoff waeren alle gleich grün.
 */
export const ATOMFARBE = ["#fbbf24", "#60a5fa", "#4ade80", "#f472b6", "#a78bfa", "#fb923c", "#22d3ee", "#e879f9"];

/** Die Farbe des Atoms an dieser Stelle. */
export const atomfarbe = (i: number): string => ATOMFARBE[i % ATOMFARBE.length];

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
 * Ein Ion, nachdem die Elektronen übertragen wurden.
 */
export type Ion = {
  e: PseElement;
  /** +3 beim Bor, −1 beim Fluorid. */
  ladung: number;
  /** Elektronen je Schale nach der Übertragung. */
  schalen: number[];
  /** Elektronen auf der äußersten besetzten Schale (0 beim nackten H⁺). */
  aussen: number;
  /** Edelgaskonfiguration erreicht? */
  voll: boolean;
  x: number;
  y: number;
  /** Von welchem Atom kommen wie viele Elektronen hierher. */
  bekommt: { von: number; zahl: number }[];
};

export type Uebertragung = {
  ionen: Ion[];
  formel: string;
  gesetzt: string;
  name: string | null;
  /** Geht die Bilanz auf — gibt einer genau so viele ab, wie die anderen brauchen? */
  geht: boolean;
  hinweise: string[];
};

/**
 * Die Verbindung als Elektronenübertragung: der unedlere Partner gibt seine
 * Außenelektronen ganz ab, der andere nimmt sie auf, bis seine Schale voll
 * ist. Übrig bleiben Ionen mit Ladung.
 *
 * Das ist das Bild der Ionenbindung. Es passt dort, wo die Elektronegativität
 * weit auseinanderliegt (Kochsalz), und es ist bei Molekülen wie Wasser oder
 * Methan nur ein Gedankenspiel — dort teilen sich die Atome die Elektronen
 * wirklich. Welches Bild gemeint ist, entscheidet nicht die Rechnung, sondern
 * der Unterricht; darum stehen beide nebeneinander zur Wahl.
 *
 * Achtung bei den Zahlen: wer abgibt, landet auf der Schale darunter. Bor gibt
 * drei Elektronen ab und hat danach die zwei der K-Schale — die Konfiguration
 * des Heliums, also ein volles Duett, **kein** Oktett. Acht Außenelektronen
 * bekommt Bor auf keinem Weg allein; dafür braucht es ein fremdes
 * Elektronenpaar dazu (BF₄⁻, F₃B–NH₃).
 */
export function uebertrage(symbole: string[]): Uebertragung {
  const v = baue(symbole);
  const leer: Uebertragung = { ionen: [], formel: v.formel, gesetzt: v.gesetzt, name: v.name, geht: false, hinweise: [] };
  if (v.atome.length === 0) return leer;

  const en = v.atome.map(a => a.e.en ?? 0);
  const kleinste = Math.min(...en);
  const groesste = Math.max(...en);
  const hinweise: string[] = [];
  if (kleinste === groesste) {
    return { ...leer, hinweise: ["Zwischen gleichen Partnern wird nichts übertragen — keiner zieht stärker. Sie teilen sich die Elektronen."] };
  }

  // Wer die kleinste Elektronegativität hat, gibt ab; alle anderen nehmen auf.
  const gibt = v.atome.map((a, i) => (en[i] === kleinste ? a.valenz : 0));
  const nimmt = v.atome.map((a, i) => (en[i] === kleinste ? 0 : (a.e.z <= 2 ? 2 : 8) - a.valenz));
  const abgegeben = gibt.reduce((x, y) => x + y, 0);
  const gebraucht = nimmt.reduce((x, y) => x + y, 0);
  const geht = abgegeben === gebraucht;

  // Die abgegebenen Elektronen der Reihe nach verteilen.
  const bekommt: { von: number; zahl: number }[][] = v.atome.map(() => []);
  const uebrig = [...gibt];
  const offen = [...nimmt];
  for (let j = 0; j < v.atome.length; j++) {
    for (let i = 0; i < v.atome.length && offen[j] > 0; i++) {
      const zahl = Math.min(uebrig[i], offen[j]);
      if (zahl > 0) { bekommt[j].push({ von: i, zahl }); uebrig[i] -= zahl; offen[j] -= zahl; }
    }
  }

  const ionen: Ion[] = v.atome.map((a, i) => {
    const ladung = gibt[i] - (nimmt[i] - offen[i]);
    const sch = schalen(madelung(a.e.z - ladung));
    const aussen = sch[sch.length - 1] ?? 0;
    return {
      e: a.e, ladung, schalen: sch, aussen,
      voll: aussen === 8 || (sch.length === 1 && aussen === 2) || sch.length === 0,
      x: a.x, y: a.y, bekommt: bekommt[i],
    };
  });

  if (!geht) {
    hinweise.push(`Die Bilanz geht nicht auf: abgegeben werden ${abgegeben} Elektronen, gebraucht ${gebraucht}. In dieser Zusammenstellung entsteht so kein Salz.`);
  }
  const abgeber = ionen.filter(i => i.ladung > 0);
  for (const a of abgeber) {
    hinweise.push(a.schalen.length === 0
      ? `${a.e.name} gibt sein Elektron ab und bleibt als nackter Kern zurück — ${a.e.symbol}⁺ hat gar keine Hülle mehr.`
      : `${a.e.name} gibt ${a.ladung} Elektron${a.ladung === 1 ? "" : "en"} ab und hat danach ${a.aussen} auf der äußersten Schale — die Konfiguration des ${a.schalen.length === 1 ? "Heliums" : "nächstkleineren Edelgases"}.`);
  }
  if (geht && ionen.every(i => i.voll)) {
    hinweise.push("Jedes Ion hat jetzt eine volle Außenschale. Zusammengehalten werden sie durch die Anziehung der Ladungen, nicht durch gemeinsame Paare.");
  }

  return { ionen, formel: v.formel, gesetzt: v.gesetzt, name: v.name, geht, hinweise };
}

/**
 * Wohin die freien Elektronenpaare eines Atoms zeigen.
 *
 * Sie füllen die Lücken zwischen den Bindungen, und zwar gleichmäßig: jedes
 * Paar kommt in die Lücke, in der danach am meisten Platz je Paar bleibt, und
 * innerhalb einer Lücke stehen die Paare in gleichen Abständen. So liegen die
 * zwei freien Paare des Wassers symmetrisch über dem Sauerstoff, und die drei
 * des Fluors verteilen sich gleichmäßig um die eine Bindung herum.
 *
 * (Feste Plätze im 45°-Raster taugen dafür nicht: der Winkel des Wassers ist
 * 104°, da fällt jede Rasterwahl schief aus.)
 */
export function freiePlaetze(richtungen: number[], anzahl: number): number[] {
  if (anzahl <= 0) return [];
  // Ohne Bindung verteilen sie sich gleichmäßig im ganzen Kreis.
  if (richtungen.length === 0) {
    return Array.from({ length: anzahl }, (_, i) => -Math.PI / 2 + (i / anzahl) * 2 * Math.PI);
  }
  const sortiert = [...richtungen].sort((a, b) => a - b);
  const luecken = sortiert.map((w, i) => ({
    start: w,
    weite: (i + 1 < sortiert.length ? sortiert[i + 1] : sortiert[0] + 2 * Math.PI) - w,
    zahl: 0,
  }));
  for (let i = 0; i < anzahl; i++) {
    let best = luecken[0];
    for (const l of luecken) if (l.weite / (l.zahl + 1) > best.weite / (best.zahl + 1)) best = l;
    best.zahl++;
  }
  const aus: number[] = [];
  for (const l of luecken) {
    for (let k = 0; k < l.zahl; k++) aus.push(l.start + (l.weite * (k + 1)) / (l.zahl + 1));
  }
  return aus;
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
