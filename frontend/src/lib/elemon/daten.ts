/**
 * »Elemon« — das Monster-Sammelspiel auf dem Klikk-Handy: Arten, Attacken und
 * die Typentabelle der 18 Elemente aus den Elementar-Angriffen. Gefangen wird
 * mit dem Käfig. Alles eigene Regeln, keine Werte aus anderen Spielen.
 */
import { ELEMENTE, type ElementId } from "@/lib/angriffe/effekte";
import type { MonsterId } from "@/lib/angriffe/monster";

export type { ElementId };
export { ELEMENTE };

/** Woher das 3D-Modell kommt: Monster aus dem Verlies oder ein Tier-Avatar */
export type Modell = { monster: MonsterId } | { tier: string };

export interface Art {
  id: string;
  name: string;
  emoji: string;
  modell: Modell;
  elemente: ElementId[];
  /** zweites Element, dessen Attacke die Art zusätzlich lernt */
  extra: ElementId;
  /** Grundwerte 30–110 */
  kp: number; ang: number; ver: number; tempo: number;
  /** 0–1: wie leicht der Käfig hält */
  fang: number;
  /** 1 häufig … 3 selten */
  seltenheit: 1 | 2 | 3;
}

const a = (id: string, name: string, emoji: string, modell: Modell, elemente: ElementId[], extra: ElementId,
  [kp, ang, ver, tempo]: number[], fang: number, seltenheit: 1 | 2 | 3 = 1): Art =>
  ({ id, name, emoji, modell, elemente, extra, kp, ang, ver, tempo, fang, seltenheit });

const T = (tier: string): Modell => ({ tier });
const M = (monster: MonsterId): Modell => ({ monster });

export const ARTEN: Art[] = [
  // Starter
  a("fox", "Funkfuchs", "🦊", T("fox"), ["feuer"], "klingen", [55, 70, 50, 75], 0.4),
  a("turtle", "Panzerkröte", "🐢", T("turtle"), ["wasser"], "erde", [70, 55, 75, 40], 0.4),
  a("koala", "Kuschelkoala", "🐨", T("koala"), ["pflanzen"], "heilung", [65, 60, 65, 50], 0.4),
  // Tiere
  a("cat", "Schattenkatze", "🐱", T("cat"), ["schatten"], "klingen", [45, 60, 40, 85], 0.7),
  a("dog", "Bellhund", "🐶", T("dog"), ["schall"], "erde", [55, 60, 50, 65], 0.75),
  a("frog", "Giftfrosch", "🐸", T("frog"), ["gift", "wasser"], "pflanzen", [50, 55, 50, 70], 0.65),
  a("panda", "Bambusbär", "🐼", T("panda"), ["erde"], "pflanzen", [80, 70, 70, 30], 0.45, 2),
  a("tiger", "Krallentiger", "🐯", T("tiger"), ["klingen"], "feuer", [65, 90, 55, 80], 0.3, 2),
  a("lion", "Sonnenlöwe", "🦁", T("lion"), ["licht"], "feuer", [75, 85, 65, 70], 0.25, 3),
  a("cow", "Donnerkuh", "🐮", T("cow"), ["erde"], "schall", [90, 55, 70, 30], 0.6),
  a("pig", "Matschschwein", "🐷", T("pig"), ["erde"], "gift", [70, 50, 60, 40], 0.75),
  a("penguin", "Frostpinguin", "🐧", T("penguin"), ["eis"], "wasser", [55, 55, 60, 50], 0.6),
  a("duck", "Quakente", "🦆", T("duck"), ["wasser"], "wind", [45, 45, 45, 60], 0.85),
  a("owl", "Runeneule", "🦉", T("owl"), ["arkan"], "wind", [55, 70, 50, 70], 0.45, 2),
  a("octopus", "Tintenkrake", "🐙", T("octopus"), ["dunkel", "wasser"], "gift", [60, 65, 60, 55], 0.45, 2),
  a("butterfly", "Feenfalter", "🦋", T("butterfly"), ["fee"], "wind", [40, 55, 40, 85], 0.7),
  a("unicorn", "Glanzhorn", "🦄", T("unicorn"), ["fee", "licht"], "heilung", [75, 80, 70, 80], 0.15, 3),
  a("bee", "Summbiene", "🐝", T("bee"), ["blitz"], "gift", [40, 55, 40, 80], 0.8),
  a("dino", "Urzeitdino", "🦕", T("dino"), ["erde"], "klingen", [85, 80, 80, 35], 0.3, 2),
  a("whale", "Tiefenwal", "🐳", T("whale"), ["wasser"], "schall", [100, 65, 70, 30], 0.3, 2),
  a("shark", "Klingenhai", "🦈", T("shark"), ["wasser", "klingen"], "dunkel", [65, 85, 55, 75], 0.3, 2),
  a("dolphin", "Echodelfin", "🐬", T("dolphin"), ["schall"], "wasser", [60, 65, 55, 80], 0.5),
  a("otter", "Flussotter", "🦦", T("otter"), ["wasser"], "klingen", [55, 60, 50, 70], 0.7),
  a("sloth", "Ruhefaultier", "🦥", T("sloth"), ["heilung"], "pflanzen", [95, 40, 70, 20], 0.7),
  a("hedgehog", "Stachelchen", "🦔", T("hedgehog"), ["klingen"], "erde", [45, 55, 70, 45], 0.8),
  a("crab", "Scherenkrabbe", "🦀", T("crab"), ["klingen", "wasser"], "erde", [55, 70, 80, 35], 0.6),
  a("parrot", "Plapperpapagei", "🦜", T("parrot"), ["schall", "wind"], "fee", [50, 55, 45, 80], 0.65),
  a("flamingo", "Windflamingo", "🦩", T("flamingo"), ["wind"], "wasser", [55, 60, 50, 70], 0.6),
  a("peacock", "Prachtpfau", "🦚", T("peacock"), ["licht"], "fee", [55, 65, 55, 65], 0.45, 2),
  a("axolotl", "Heilaxolotl", "🦎", T("axolotl"), ["heilung", "wasser"], "fee", [70, 45, 60, 45], 0.55, 2),
  // Monster
  a("greenblob", "Glibber", "🟢", M("greenblob"), ["gift"], "erde", [50, 45, 50, 40], 0.9),
  a("pinkblob", "Rosaglibber", "🩷", M("pinkblob"), ["fee"], "heilung", [50, 45, 50, 45], 0.9),
  a("mushnub", "Pilzling", "🍄", M("mushnub"), ["heilung"], "pflanzen", [60, 40, 55, 35], 0.85),
  a("glub", "Blubb", "🫧", M("glub"), ["wasser"], "eis", [55, 50, 55, 50], 0.8),
  a("greenspikyblob", "Stachelschleim", "🦠", M("greenspikyblob"), ["gift"], "klingen", [55, 60, 60, 45], 0.6),
  a("ghost", "Gespensti", "👻", M("ghost"), ["dunkel"], "schatten", [45, 65, 40, 75], 0.6),
  a("ghost_skull", "Schädelgeist", "💀", M("ghost_skull"), ["dunkel"], "arkan", [55, 75, 50, 70], 0.35, 2),
  a("wizard_blob", "Zauberblob", "🔮", M("wizard_blob"), ["arkan"], "sterne", [55, 75, 50, 60], 0.45, 2),
  a("alien_blob", "Tentakelstern", "👾", M("alien_blob"), ["sterne"], "dunkel", [65, 80, 60, 60], 0.3, 2),
  a("hywirl", "Wirbelfee", "🌀", M("hywirl"), ["fee", "wind"], "licht", [50, 65, 50, 85], 0.45, 2),
  a("armabee_evolved", "Panzerbiene", "🐞", M("armabee_evolved"), ["blitz"], "klingen", [60, 80, 70, 75], 0.3, 2),
  a("birb", "Sturmvogel", "🐦", M("birb"), ["wind"], "blitz", [60, 70, 50, 85], 0.45),
  a("cactoro", "Kaktoro", "🌵", M("cactoro"), ["pflanzen"], "klingen", [70, 70, 75, 40], 0.5),
  a("ninja", "Schattenninja", "🥷", M("ninja"), ["schatten"], "klingen", [60, 85, 55, 95], 0.25, 3),
  a("orc", "Brüllork", "👹", M("orc"), ["schall"], "erde", [85, 85, 65, 45], 0.3, 2),
  a("orc_skull", "Knochenork", "☠️", M("orc_skull"), ["klingen"], "dunkel", [80, 90, 70, 45], 0.25, 3),
  a("yeti", "Yeti", "🦍", M("yeti"), ["eis"], "erde", [90, 80, 75, 45], 0.3, 2),
  a("dino_m", "Lavadino", "🦖", M("dino"), ["erde", "feuer"], "klingen", [85, 85, 75, 50], 0.25, 3),
  a("demon", "Blutdämon", "😈", M("demon"), ["blut"], "dunkel", [80, 95, 65, 65], 0.15, 3),
  a("alpaking_evolved", "Alpakönig", "🦙", M("alpaking_evolved"), ["licht"], "sterne", [85, 80, 80, 60], 0.15, 3),
  a("dragon_evolved", "Glutdrache", "🐉", M("dragon_evolved"), ["feuer", "wind"], "blut", [95, 105, 85, 80], 0.08, 3),
];

export const ART = Object.fromEntries(ARTEN.map(x => [x.id, x])) as Record<string, Art>;
export const STARTER = ["fox", "turtle", "koala"] as const;

// --- Attacken -----------------------------------------------------------

export interface Attacke {
  id: string;
  name: string;
  /** null: neutraler Rempler ohne Element */
  element: ElementId | null;
  staerke: number;
  /** Trefferquote 0–100 */
  genau: number;
  /** Heilung: heilt den Täter um diesen Anteil der Höchst-KP statt Schaden */
  heilt?: number;
}

/** je Element eine leichte und eine starke Attacke */
const NAMEN: Record<ElementId, [string, string]> = {
  eis: ["Frosthauch", "Eiszapfenhagel"], feuer: ["Glutfunke", "Flammensturm"], erde: ["Steinwurf", "Erdspalte"],
  blitz: ["Funkenschlag", "Donnerkeil"], pflanzen: ["Rankenhieb", "Dornenwald"], dunkel: ["Finstergriff", "Nachtschlund"],
  gift: ["Giftspritzer", "Säureflut"], blut: ["Blutdorn", "Blutmond"], schatten: ["Schattenstoß", "Schattenfessel"],
  fee: ["Feenstaub", "Zauberreigen"], wind: ["Windklinge", "Wirbelsturm"], schall: ["Brüller", "Schallwelle"],
  licht: ["Lichtblitz", "Sonnenstrahl"], klingen: ["Kratzer", "Klingentanz"], arkan: ["Runenpfeil", "Arkanbombe"],
  wasser: ["Wasserstrahl", "Flutwelle"], sterne: ["Sternschnuppe", "Meteorregen"], heilung: ["Kräuterkur", "Lebensquelle"],
};

export const RUMPEL: Attacke = { id: "rempler", name: "Rempler", element: null, staerke: 35, genau: 100 };

export const ATTACKEN: Record<string, Attacke> = { rempler: RUMPEL };
for (const e of ELEMENTE) {
  const [leicht, stark] = NAMEN[e.id];
  ATTACKEN[`${e.id}1`] = e.id === "heilung"
    ? { id: "heilung1", name: leicht, element: "heilung", staerke: 0, genau: 100, heilt: 0.35 }
    : { id: `${e.id}1`, name: leicht, element: e.id, staerke: 45, genau: 100 };
  ATTACKEN[`${e.id}2`] = e.id === "heilung"
    ? { id: "heilung2", name: stark, element: "heilung", staerke: 0, genau: 85, heilt: 0.6 }
    : { id: `${e.id}2`, name: stark, element: e.id, staerke: 85, genau: 80 };
}

/** Welche Attacke eine Art auf welcher Stufe lernt */
export function lernliste(art: Art): [number, string][] {
  const [e1, e2] = art.elemente;
  const l: [number, string][] = [[1, "rempler"], [1, `${e1}1`], [5, `${art.extra}1`], [10, `${e1}2`]];
  if (e2) l.push([14, `${e2}1`], [22, `${e2}2`]);
  l.push([18, `${art.extra}2`]);
  return l.sort((x, y) => x[0] - y[0]);
}

// --- Typentabelle --------------------------------------------------------

/** Angreifendes Element → [doppelt wirksam gegen, halb wirksam gegen] */
const TABELLE: Record<ElementId, [ElementId[], ElementId[]]> = {
  feuer: [["pflanzen", "eis", "klingen"], ["wasser", "erde", "feuer"]],
  wasser: [["feuer", "erde"], ["pflanzen", "wasser", "eis"]],
  pflanzen: [["wasser", "erde", "blut"], ["feuer", "gift", "wind"]],
  erde: [["feuer", "blitz", "gift"], ["pflanzen", "wind"]],
  blitz: [["wasser", "wind"], ["erde", "pflanzen"]],
  eis: [["pflanzen", "wind", "erde"], ["feuer", "wasser"]],
  wind: [["pflanzen", "gift"], ["erde", "blitz"]],
  gift: [["pflanzen", "fee", "heilung"], ["erde", "gift", "klingen"]],
  klingen: [["eis", "fee", "gift"], ["erde", "feuer"]],
  licht: [["dunkel", "schatten"], ["licht", "sterne"]],
  dunkel: [["licht", "arkan", "fee"], ["dunkel", "schall"]],
  schatten: [["arkan", "schall"], ["licht", "schatten"]],
  fee: [["dunkel", "blut", "klingen"], ["gift", "feuer"]],
  blut: [["heilung", "licht"], ["fee", "gift"]],
  schall: [["eis", "dunkel"], ["wind", "schatten"]],
  arkan: [["blut", "sterne", "gift"], ["dunkel", "schatten"]],
  sterne: [["wind", "arkan"], ["sterne"]],
  heilung: [[], []],
};

/** Wirkung einer Attacke auf ein Elemon mit diesen Elementen (Faktoren multiplizieren sich) */
export function wirkung(angriff: ElementId | null, ziel: ElementId[]): number {
  if (!angriff) return 1;
  const [stark, schwach] = TABELLE[angriff];
  return ziel.reduce((f, e) => f * (stark.includes(e) ? 2 : schwach.includes(e) ? 0.5 : 1), 1);
}

export const elementInfo = (e: ElementId) => ELEMENTE.find(x => x.id === e)!;
export const TYPEN_STARK = (e: ElementId) => TABELLE[e][0];
export const TYPEN_SCHWACH = (e: ElementId) => TABELLE[e][1];
