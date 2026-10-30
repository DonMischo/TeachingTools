/**
 * Spielstand und Welt von »Elemon«: Gebiete mit wilden Elemon, Trainern und
 * einer Arena, Münzen, Käfige, Tränke und Energie. Die Energie füllt sich mit
 * der Spielzeit oder per Werbevideo — genau die Mechanik, die zurückholt.
 */
import { ART, ARTEN, STARTER } from "./daten";
import { erfahrung, heile, neuesElemon, zufall, type Aufstieg, type Elemon, type Kampf } from "./kampf";

export interface ElemonStand {
  team: Elemon[];
  lager: Elemon[];
  muenzen: number;
  kaefige: number;
  goldkaefige: number;
  traenke: number;
  orden: string[];
  /** besiegte Trainer (Gebiet:nr) */
  besiegt: string[];
  gesehen: string[];
  gefangen: string[];
  energie: number;
  /** Spielminute (tag*1440+uhr), ab der die nächste Energie gezählt wird */
  energieAb: number;
  standort: boolean | null;
  werbungen: number;
  kaufVersuche: number;
  siege: number;
  niederlagen: number;
  duelle: { id?: number; gegner: string; sieg: boolean }[];
  /** Antwort der Eltern auf die Bitte um Extra-Zeit (eine Bitte pro Tag) */
  elternAntwort?: { tag: number; ja: boolean; plus: number; text: string };
  wurf: number;
}

/** Wo man die App verlassen hat — beim Wiederöffnen geht es genau dort weiter */
export interface ElemonOrt {
  reiter: "karte" | "team" | "kartei" | "laden" | "duell";
  kampf?: { kampf: Kampf; gebiet: string; trainer?: Trainer & { schluessel: string; orden?: string } };
  bericht?: { titel: string; zeilen: string[] };
  /** laufendes Werbevideo: Restsekunden */
  werbung?: number;
}

export const ENERGIE_MAX = 5;
/** so viele Spielminuten pro Energiepunkt */
export const ENERGIE_MINUTEN = 45;
export const TEAM_MAX = 6;
export const PREISE = { kaefig: 20, trank: 25 } as const;

export interface Trainer { name: string; emoji: string; team: [string, number][]; spruch: string; lohn: number }
export interface Gebiet {
  id: string;
  name: string;
  emoji: string;
  farbe: string;
  stufen: [number, number];
  wild: string[];
  trainer: Trainer[];
  arena: Trainer & { orden: string };
  /** Orden, die man braucht, um hinzukommen */
  braucht: number;
}

export const GEBIETE: Gebiet[] = [
  {
    id: "park", name: "Stadtpark", emoji: "🌳", farbe: "#14532d", stufen: [2, 5], braucht: 0,
    wild: ["duck", "bee", "hedgehog", "dog", "cat", "greenblob", "pinkblob", "mushnub", "butterfly", "pig"],
    trainer: [
      { name: "Kim", emoji: "🧢", team: [["dog", 3], ["bee", 3]], spruch: "Hey, Elemon-Kampf? Klar!", lohn: 30 },
      { name: "Noah", emoji: "🛹", team: [["hedgehog", 5]], spruch: "Mein Stachelchen ist unbesiegbar.", lohn: 40 },
    ],
    arena: { name: "Parkwächterin Ida", emoji: "👩‍🌾", team: [["mushnub", 6], ["cactoro", 7]], spruch: "Im Park wächst alles nach. Auch meine Elemon.", lohn: 100, orden: "🍃 Blattorden" },
  },
  {
    id: "see", name: "Baggersee", emoji: "🏖️", farbe: "#0c4a6e", stufen: [6, 10], braucht: 1,
    wild: ["glub", "frog", "otter", "crab", "turtle", "flamingo", "axolotl", "penguin", "duck", "dolphin"],
    trainer: [
      { name: "Lina", emoji: "🏄", team: [["otter", 8], ["flamingo", 8]], spruch: "Wer zuletzt ins Wasser kommt …", lohn: 60 },
      { name: "Elias", emoji: "🎣", team: [["crab", 9], ["frog", 9]], spruch: "Hier beißt heute nur meine Krabbe.", lohn: 70 },
    ],
    arena: { name: "Bademeister Ole", emoji: "🛟", team: [["whale", 11], ["axolotl", 11], ["shark", 12]], spruch: "Abtauchen ist keine Option.", lohn: 180, orden: "🌊 Wellenorden" },
  },
  {
    id: "altstadt", name: "Altstadt bei Nacht", emoji: "🏚️", farbe: "#1e1b4b", stufen: [11, 16], braucht: 2,
    wild: ["ghost", "ghost_skull", "owl", "wizard_blob", "cat", "octopus", "alien_blob", "parrot", "peacock", "ninja"],
    trainer: [
      { name: "Mira", emoji: "🕯️", team: [["ghost", 13], ["owl", 13]], spruch: "Psst. Hörst du das auch?", lohn: 90 },
      { name: "Jannis", emoji: "🎸", team: [["parrot", 14], ["dog", 14], ["orc", 15]], spruch: "Lautstärke ist eine Strategie.", lohn: 110 },
    ],
    arena: { name: "Nachtwächterin Runa", emoji: "🧙‍♀️", team: [["ghost_skull", 16], ["wizard_blob", 17], ["alien_blob", 18]], spruch: "Die Sterne kämpfen auf meiner Seite.", lohn: 260, orden: "🌙 Mondorden" },
  },
  {
    id: "vulkan", name: "Vulkanberg", emoji: "🌋", farbe: "#450a0a", stufen: [17, 24], braucht: 3,
    wild: ["dino_m", "yeti", "orc", "orc_skull", "tiger", "lion", "birb", "armabee_evolved", "panda", "demon", "unicorn", "alpaking_evolved", "dragon_evolved"],
    trainer: [
      { name: "Tarek", emoji: "🧗", team: [["yeti", 19], ["birb", 19], ["tiger", 20]], spruch: "Oben ist die Luft dünn. Für dich.", lohn: 150 },
    ],
    arena: { name: "Vulkanmeister Brand", emoji: "🔥", team: [["dino_m", 22], ["demon", 23], ["dragon_evolved", 25]], spruch: "Nur wer Hitze aushält, bekommt diesen Orden.", lohn: 400, orden: "🌋 Glutorden" },
  },
];

export const neuerElemonStand = (): ElemonStand => ({
  team: [], lager: [], muenzen: 50, kaefige: 5, goldkaefige: 0, traenke: 2, orden: [], besiegt: [], gesehen: [], gefangen: [],
  energie: ENERGIE_MAX, energieAb: 0, standort: null, werbungen: 0, kaufVersuche: 0, siege: 0, niederlagen: 0, duelle: [], wurf: 1,
});

export function starten(e: ElemonStand, starter: (typeof STARTER)[number]): ElemonStand {
  const n = structuredClone(e);
  n.team = [neuesElemon(starter, 5)];
  n.gesehen = [starter]; n.gefangen = [starter];
  return n;
}

/** Energie seit der letzten Zählung auffüllen; `jetzt` = Spielminute (tag*1440+uhr) */
export function energieAuffuellen(e: ElemonStand, jetzt: number): ElemonStand {
  if (e.energie >= ENERGIE_MAX) return e.energieAb === jetzt ? e : { ...e, energieAb: jetzt };
  const plus = Math.floor((jetzt - e.energieAb) / ENERGIE_MINUTEN);
  if (plus <= 0) return e;
  const energie = Math.min(ENERGIE_MAX, e.energie + plus);
  return { ...e, energie, energieAb: energie >= ENERGIE_MAX ? jetzt : e.energieAb + plus * ENERGIE_MINUTEN };
}

/** Minuten bis zur nächsten Energie */
export const naechsteEnergie = (e: ElemonStand, jetzt: number) =>
  e.energie >= ENERGIE_MAX ? 0 : ENERGIE_MINUTEN - ((jetzt - e.energieAb) % ENERGIE_MINUTEN);

/** Ein wildes Elemon im Gebiet: Seltenheit 1 häufig, 3 selten; mit Standort tauchen seltene öfter auf */
export function wildesElemon(g: Gebiet, wurf: number, standort: boolean): Elemon {
  const r = zufall(wurf);
  const gewicht = (id: string) => ({ 1: 10, 2: 4, 3: standort ? 1.5 : 0.6 })[ART[id].seltenheit];
  const summe = g.wild.reduce((s, id) => s + gewicht(id), 0);
  let x = r() * summe, art = g.wild[0];
  for (const id of g.wild) { x -= gewicht(id); if (x <= 0) { art = id; break; } }
  const [lo, hi] = g.stufen;
  return neuesElemon(art, lo + Math.floor(r() * (hi - lo + 1)));
}

export const trainerTeam = (t: Trainer) => t.team.map(([art, stufe]) => neuesElemon(art, stufe));

export const darfIns = (e: ElemonStand, g: Gebiet) => e.orden.length >= g.braucht;

export type Ausgang =
  | { art: "sieg"; besiegt: Elemon[]; lohn: number; trainer?: string; orden?: string }
  | { art: "gefangen"; elemon: Elemon }
  | { art: "niederlage" }
  | { art: "flucht" };

/** Ergebnis eines Kampfes übernehmen; `team` ist das Team mit den KP nach dem Kampf */
export function kampfEnde(alt: ElemonStand, team: Elemon[], aus: Ausgang): { stand: ElemonStand; aufstiege: Aufstieg[]; xp: number; verlust: number } {
  const e = structuredClone(alt);
  e.team = team;
  let aufstiege: Aufstieg[] = [], xp = 0, verlust = 0;
  if (aus.art === "sieg" || aus.art === "gefangen") {
    const r = erfahrung(e.team, aus.art === "sieg" ? aus.besiegt : [aus.elemon]);
    e.team = r.team; aufstiege = r.aufstiege; xp = r.xp;
  }
  if (aus.art === "sieg") {
    e.siege++;
    e.muenzen += aus.lohn;
    if (aus.trainer && !e.besiegt.includes(aus.trainer)) e.besiegt.push(aus.trainer);
    if (aus.orden && !e.orden.includes(aus.orden)) e.orden.push(aus.orden);
  }
  if (aus.art === "gefangen") {
    const neu = { ...aus.elemon, xp: 0 };
    if (e.team.length < TEAM_MAX) e.team.push(neu); else e.lager.push(neu);
    if (!e.gefangen.includes(neu.art)) e.gefangen.push(neu.art);
  }
  if (aus.art === "niederlage") {
    // Zur Heilstation geschleppt: Team geheilt, ein Zehntel der Münzen weg
    e.niederlagen++;
    verlust = Math.floor(e.muenzen / 10);
    e.muenzen -= verlust;
    e.team = heile(e.team);
  }
  return { stand: e, aufstiege, xp, verlust };
}

export function sehen(e: ElemonStand, art: string): ElemonStand {
  return e.gesehen.includes(art) ? e : { ...e, gesehen: [...e.gesehen, art] };
}

export function kaufen(e: ElemonStand, was: keyof typeof PREISE): ElemonStand {
  if (e.muenzen < PREISE[was]) return e;
  return { ...e, muenzen: e.muenzen - PREISE[was], ...(was === "kaefig" ? { kaefige: e.kaefige + 1 } : { traenke: e.traenke + 1 }) };
}

/** Elemon zwischen Team und Lager tauschen (das Team bleibt mindestens eins groß) */
export function tauschen(alt: ElemonStand, teamNr: number | null, lagerNr: number | null): ElemonStand {
  const e = structuredClone(alt);
  const ausLager = lagerNr !== null ? e.lager.splice(lagerNr, 1)[0] : null;
  const ausTeam = teamNr !== null ? e.team.splice(teamNr, 1)[0] : null;
  if (ausLager) e.team.push(ausLager);
  if (ausTeam) e.lager.push(ausTeam);
  if (e.team.length === 0 || e.team.length > TEAM_MAX) return alt;
  return e;
}

export const ALLE_ARTEN = ARTEN.map(a => a.id);
