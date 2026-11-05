/**
 * Renovieren: Wände eines Raums (Quader) streichen, tapezieren oder fliesen.
 * Der Raum ist ein Quader ohne die Flächen, die man weglässt — meist ohne
 * Boden. Fenster und Türen werden abgezogen, wo das im echten Leben auch
 * geschieht. Am Ende steht, wie viel man kaufen muss, und der günstigste
 * Einkauf. Reine Rechnung; das Spiel steht in components/koerper/Renovieren.tsx.
 */
import { z } from "@/lib/prozent";
import { ganz, eins, type Zufall } from "@/lib/geometrie/aufgabe";
import { ist } from "@/lib/koerper";

export type Wand = "nord" | "ost" | "sued" | "west";
export const WAENDE: Wand[] = ["nord", "ost", "sued", "west"];
export type Flaeche = Wand | "decke" | "boden";
export const FLAECHEN: Flaeche[] = [...WAENDE, "decke", "boden"];
export const FLAECHEN_NAME: Record<Flaeche, string> = {
  nord: "Nordwand", ost: "Ostwand", sued: "Südwand", west: "Westwand", decke: "Decke", boden: "Boden",
};

export type OeffnungArt = "fenster" | "tuer" | "balkontuer";
/** Übliche Maße in m; `unten` = Brüstungshöhe über dem Boden. */
export const OEFFNUNG: Record<OeffnungArt, { name: string; icon: string; b: number; h: number; unten: number }> = {
  fenster: { name: "Fenster", icon: "🪟", b: 1.2, h: 1.4, unten: 0.9 },
  tuer: { name: "Tür", icon: "🚪", b: 0.9, h: 2.0, unten: 0 },
  balkontuer: { name: "Balkontür", icon: "🌇", b: 1.0, h: 2.2, unten: 0 },
};

export type Raum = {
  L: number; B: number; H: number;
  oeffnungen: Record<Wand, OeffnungArt[]>;
  an: Record<Flaeche, boolean>;
};

export type ArtId = "streichen" | "tapezieren" | "fliesen";
export type Gebinde = { name: string; inhalt: number; preis: number };
export type Einstellung = { anstriche: number; ergiebigkeit: number; fliesenhoehe: number };
export const START_EINSTELLUNG: Einstellung = { anstriche: 2, ergiebigkeit: 7, fliesenhoehe: 1.2 };

export const ARTEN: Record<ArtId, { name: string; icon: string; einheit: string; gebinde: Gebinde[]; erlaubt: Flaeche[]; farbe: string }> = {
  streichen: {
    name: "Streichen", icon: "🖌️", einheit: "l", erlaubt: FLAECHEN, farbe: "#60a5fa",
    gebinde: [{ name: "Eimer 2,5 l", inhalt: 2.5, preis: 21.99 }, { name: "Eimer 5 l", inhalt: 5, preis: 36.99 }, { name: "Eimer 10 l", inhalt: 10, preis: 64.99 }],
  },
  tapezieren: {
    name: "Tapezieren", icon: "🧻", einheit: "Rollen", erlaubt: [...WAENDE, "decke"], farbe: "#f472b6",
    gebinde: [{ name: "1 Rolle", inhalt: 1, preis: 12.99 }, { name: "5er-Pack", inhalt: 5, preis: 54.99 }],
  },
  fliesen: {
    name: "Fliesen", icon: "🧱", einheit: "m²", erlaubt: [...WAENDE, "boden"], farbe: "#2dd4bf",
    gebinde: [{ name: "Paket 1,44 m²", inhalt: 1.44, preis: 29.9 }, { name: "Palette 14,4 m²", inhalt: 14.4, preis: 259 }],
  },
};

/** Tapetenrolle: 10,05 m lang, 0,53 m breit; jede Bahn 10 cm länger als die Wand hoch ist. */
export const ROLLE = { laenge: 10.05, breite: 0.53, zugabe: 0.1 };
const VERSCHNITT = 0.1;

export const wandBreite = (r: Raum, w: Wand) => (w === "nord" || w === "sued" ? r.L : r.B);

export type Teilrechnung = { f: Flaeche; name: string; brutto: number; abzug: number; netto: number; zeilen: string[]; bahnen?: number };
export type Rechnung = { teile: Teilrechnung[]; netto: number; bedarf: number; zeilen: string[]; schluessel: { label: string; einheit: string; wert: number } };

/** Fläche eines Fensters/einer Tür, die in das Band von 0 bis `oben` (Fliesenhöhe) fällt. */
function imBand(o: OeffnungArt, oben: number) {
  const x = OEFFNUNG[o];
  return x.b * Math.max(0, Math.min(x.unten + x.h, oben) - x.unten);
}

export function rechne(r: Raum, art: ArtId, e: Einstellung = START_EINSTELLUNG): Rechnung {
  const teile: Teilrechnung[] = [];
  const oben = art === "fliesen" ? Math.min(e.fliesenhoehe, r.H) : r.H;
  for (const f of FLAECHEN) {
    if (!r.an[f] || !ARTEN[art].erlaubt.includes(f)) continue;
    if (f === "decke" || f === "boden") {
      const a = r.L * r.B;
      const t: Teilrechnung = { f, name: FLAECHEN_NAME[f], brutto: a, abzug: 0, netto: a, zeilen: [`${FLAECHEN_NAME[f]}: ${z(r.L)} · ${z(r.B)} ${ist(a, "m²")}`] };
      if (art === "tapezieren") {
        t.bahnen = Math.ceil(r.B / ROLLE.breite);
        t.zeilen.push(`Bahnen: ${z(r.B)} : ${z(ROLLE.breite)} → ${t.bahnen} Bahnen à ${z(r.L + ROLLE.zugabe)} m`);
      }
      teile.push(t);
      continue;
    }
    const b = wandBreite(r, f), brutto = b * oben;
    const os = r.oeffnungen[f];
    // Tapete: Fenster und Türen werden nicht abgezogen, die Bahnen laufen trotzdem darüber und darunter.
    const abzug = art === "tapezieren" ? 0 : os.reduce((s, o) => s + imBand(o, oben), 0);
    const zeilen = [`${FLAECHEN_NAME[f]}: ${z(b)} · ${z(oben)} ${ist(brutto, "m²")}`];
    if (abzug > 0) zeilen.push(`− ${os.filter(o => imBand(o, oben) > 0).map(o => `${OEFFNUNG[o].name} ${z(imBand(o, oben))} m²`).join(" − ")} → ${z(brutto - abzug)} m²`);
    const t: Teilrechnung = { f, name: FLAECHEN_NAME[f], brutto, abzug, netto: brutto - abzug, zeilen };
    if (art === "tapezieren") {
      t.bahnen = Math.ceil(b / ROLLE.breite - 1e-9);
      zeilen.push(`Bahnen: ${z(b)} : ${z(ROLLE.breite)} ≈ ${z(b / ROLLE.breite)} → ${t.bahnen} Bahnen`);
    }
    teile.push(t);
  }
  const netto = teile.reduce((s, t) => s + t.netto, 0);
  const zeilen: string[] = [`Zu bearbeiten: ${teile.map(t => z(t.netto)).join(" + ") || "0"} ${ist(netto, "m²")}`];
  let bedarf = 0;
  let schluessel = { label: "Fläche", einheit: "m²", wert: netto };
  if (art === "streichen") {
    bedarf = netto * e.anstriche / e.ergiebigkeit;
    zeilen.push(`${e.anstriche} Anstrich${e.anstriche > 1 ? "e" : ""}: ${z(netto)} · ${e.anstriche} ${ist(netto * e.anstriche, "m²")}`,
      `Farbe: ${z(netto * e.anstriche)} : ${z(e.ergiebigkeit)} m²/l ${ist(bedarf, "l")}`);
  } else if (art === "fliesen") {
    bedarf = netto * (1 + VERSCHNITT);
    zeilen.push(`mit 10 % Verschnitt: ${z(netto)} · 1,1 ${ist(bedarf, "m²")}`);
  } else {
    const wandBahnen = teile.filter(t => t.f !== "decke").reduce((s, t) => s + (t.bahnen ?? 0), 0);
    const jeRolle = Math.floor(ROLLE.laenge / (r.H + ROLLE.zugabe));
    const decke = teile.find(t => t.f === "decke");
    const jeRolleDecke = Math.max(1, Math.floor(ROLLE.laenge / (r.L + ROLLE.zugabe)));
    const rollenWand = Math.ceil(wandBahnen / jeRolle);
    const rollenDecke = decke ? Math.ceil((decke.bahnen ?? 0) / jeRolleDecke) : 0;
    bedarf = rollenWand + rollenDecke;
    zeilen.push(
      `Bahnlänge: ${z(r.H)} + ${z(ROLLE.zugabe)} = ${z(r.H + ROLLE.zugabe)} m → ${jeRolle} Bahnen je Rolle (${z(ROLLE.laenge)} m)`,
      `Wände: ${wandBahnen} Bahnen : ${jeRolle} → ${rollenWand} Rollen`,
      ...(decke ? [`Decke: ${decke.bahnen} Bahnen : ${jeRolleDecke} → ${rollenDecke} Rollen`] : []),
      `Zusammen: ${bedarf} Rollen`,
    );
    schluessel = { label: "Bahnen an den Wänden", einheit: "Bahnen", wert: wandBahnen };
  }
  return { teile, netto, bedarf, zeilen, schluessel };
}

/** Günstigster Einkauf, der den Bedarf deckt (alle Kombinationen durchprobiert — es sind wenige). */
export function guenstigsterEinkauf(gebinde: Gebinde[], bedarf: number): { anzahl: number[]; preis: number; menge: number } {
  let best = { anzahl: gebinde.map(() => 0), preis: Infinity, menge: 0 };
  const grenzen = gebinde.map(g => Math.ceil(bedarf / g.inhalt + 1e-9));
  const probiere = (i: number, anzahl: number[]) => {
    if (i === gebinde.length) {
      const menge = anzahl.reduce((s, n, j) => s + n * gebinde[j].inhalt, 0);
      const preis = anzahl.reduce((s, n, j) => s + n * gebinde[j].preis, 0);
      if (menge + 1e-9 >= bedarf && preis < best.preis - 1e-9) best = { anzahl: [...anzahl], preis, menge };
      return;
    }
    for (let n = 0; n <= grenzen[i]; n++) probiere(i + 1, [...anzahl, n]);
  };
  probiere(0, []);
  if (bedarf <= 0) best = { anzahl: gebinde.map(() => 0), preis: 0, menge: 0 };
  return best;
}

export const leererRaum = (L = 5, B = 4, H = 2.5): Raum => ({
  L, B, H,
  oeffnungen: { nord: ["fenster"], ost: [], sued: ["tuer"], west: [] },
  an: { nord: true, ost: true, sued: true, west: true, decke: true, boden: false },
});

export type Auftrag = { art: ArtId; raum: Raum; einst: Einstellung; text: string; kunde: string };

const KUNDEN = ["Familie Sonnenschein", "Herr Pinselstrich", "Frau Kleistermann", "die WG im 3. Stock", "Oma Fliesenbach", "der Hausmeister"];

/** Ein gewürfelter Auftrag fürs Spiel. */
export function auftrag(art: ArtId, r: Zufall = Math.random): Auftrag {
  const viertel = (a: number, b: number) => ganz(r, a * 4, b * 4) / 4;
  const bad = art === "fliesen";
  const L = bad ? viertel(2, 3.5) : viertel(3.5, 7), B = bad ? viertel(1.75, 3) : viertel(3, 5), H = eins(r, [2.4, 2.5, 2.6, 2.75]);
  const raum: Raum = { L, B, H, oeffnungen: { nord: [], ost: [], sued: [], west: [] }, an: { nord: true, ost: true, sued: true, west: true, decke: false, boden: false } };
  raum.oeffnungen[eins(r, WAENDE)].push("tuer");
  for (let i = 0, n = bad ? 1 : ganz(r, 1, 3); i < n; i++) raum.oeffnungen[eins(r, ["nord", "ost", "west"] as Wand[])].push("fenster");
  if (!bad && r() < 0.3) raum.oeffnungen.sued.push("balkontuer");
  const einst: Einstellung = { ...START_EINSTELLUNG };
  const kunde = eins(r, KUNDEN);
  let text: string;
  if (art === "streichen") {
    raum.an.decke = r() < 0.5;
    einst.anstriche = ganz(r, 1, 2);
    einst.ergiebigkeit = eins(r, [6, 7, 8]);
    text = `${kunde} möchte die vier Wände${raum.an.decke ? " und die Decke" : ""} streichen lassen, den Boden natürlich nicht. ${einst.anstriche === 2 ? "Es braucht zwei Anstriche." : "Ein Anstrich reicht."} Laut Eimer reicht 1 l Farbe für ${einst.ergiebigkeit} m².`;
  } else if (art === "tapezieren") {
    text = `${kunde} möchte alle vier Wände tapezieren. Eine Rolle ist ${z(ROLLE.laenge)} m lang und ${z(ROLLE.breite)} m breit, jede Bahn braucht 10 cm Zugabe. Fenster und Türen werden überklebt und ausgeschnitten.`;
  } else {
    raum.an.boden = true;
    einst.fliesenhoehe = eins(r, [1.2, 1.5, 2]);
    text = `${kunde} lässt das Bad fliesen: den Boden und die Wände bis ${z(einst.fliesenhoehe)} m Höhe. Für Verschnitt rechnet man 10 % dazu.`;
  }
  return { art, raum, einst, text, kunde };
}
