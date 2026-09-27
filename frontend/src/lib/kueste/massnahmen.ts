/**
 * Küstenschutz: was Menschen gegen das Meer tun — und was es kostet.
 *
 * Kosten sind grobe Richtwerte in Mio € für 1 km Küste. Sand: Auf Sylt
 * wurden 1972–2024 rund 61,3 Mio m³ für rund 289 Mio € vorgespült, also
 * knapp 5 € je m³ (Land Schleswig-Holstein, Pressemitteilung 18.02.2025).
 * Deiche: Regelprofil mit Außenböschung 1:6, Binnenböschung 1:3, Sandkern
 * mit 1–1,5 m Kleidecke.
 */
import {
  BEWUCHS, SCHUTZ, boden, kennzahlen, krone, mhw, mnw, uferIndex,
  type KuestenArt, type Profil,
} from "./profil";

export type MassnahmeId =
  | "strand" | "vorstrand" | "duene" | "deckwerk" | "deich" | "lahnung" | "zurueck" | "sperren";

export interface Massnahme {
  id: MassnahmeId;
  icon: string;
  name: string;
  arten: KuestenArt[];
  /** Mio € je km Küste (Richtwert) */
  kosten: number;
  was: string;
  plus: string;
  minus: string;
}

export const MASSNAHMEN: Massnahme[] = [
  {
    id: "strand", icon: "🚢", name: "Sandaufspülung am Strand", arten: ["flach"], kosten: 0.5,
    was: "Ein Baggerschiff saugt draußen Sand vom Meeresgrund und pumpt ihn durch eine Rohrleitung an den Strand — 100 m³ auf jeden Meter Küste.",
    plus: "Der Strand ist sofort breit, die Düne dahinter geschützt. Der Sand gehört zur Natur, nichts wird verbaut.",
    minus: "Das Meer holt ihn sich wieder: nach einigen Jahren muss neu gespült werden. Auf Sylt passiert das seit 1972 jedes Jahr.",
  },
  {
    id: "vorstrand", icon: "🌊", name: "Vorstrandaufspülung (Riff)", arten: ["flach"], kosten: 1.0,
    was: "Der Sand wird unter Wasser vor dem Strand abgelegt (200 m³ je Meter). Er wirkt wie ein zusätzliches Sandriff.",
    plus: "Die Wellen brechen schon draußen und kommen schwächer am Strand an. Die Brandung schiebt den Sand nach und nach selbst an den Strand.",
    minus: "Man sieht zunächst nichts. Wirkt langsamer als die Strandaufspülung und muss ebenfalls wiederholt werden.",
  },
  {
    id: "duene", icon: "🌾", name: "Strandhafer und Sandfangzäune", arten: ["flach"], kosten: 0.05,
    was: "Strandhafer wird auf die Düne gepflanzt, am Dünenfuß stehen Zäune aus Reisig.",
    plus: "Billig und wirksam: Zäune und Halme bremsen den Wind, der Sand fällt heraus — die Düne wächst. Strandhafer wächst sogar mit, wenn er zugeweht wird.",
    minus: "Hilft nur gegen Wind, nicht gegen Sturmflut-Wellen. Betreten zerstört die Pflanzen — darum die Wege und Verbotsschilder.",
  },
  {
    id: "deckwerk", icon: "🧱", name: "Deckwerk / Tetrapoden", arten: ["flach", "steil", "marsch"], kosten: 15,
    was: "Ein Panzer aus Beton, Steinen oder vierbeinigen Tetrapoden am Fuß von Düne, Kliff oder Deich.",
    plus: "Dahinter frisst das Meer nichts mehr weg.",
    minus: "Die Wellen prallen zurück und spülen den Sand davor weg — der Strand vor der Mauer verschwindet. Am Kliff fehlt der Sand danach an den Nachbarstränden. Sehr teuer.",
  },
  {
    id: "deich", icon: "🛡️", name: "Deich verstärken (Klimadeich)", arten: ["marsch"], kosten: 12,
    was: "Der alte Deich wird zum Regelprofil umgebaut: Krone auf 8,5 m über NHN, Außenböschung 1:6, Binnenböschung 1:3, Sandkern mit Kleidecke und Gras.",
    plus: "Die flache Außenböschung lässt die Wellen auslaufen, die flache Binnenböschung übersteht auch überschwappendes Wasser.",
    minus: "Teuer und braucht viel Platz. Der Meeresspiegel steigt weiter — Deiche müssen immer wieder erhöht werden.",
  },
  {
    id: "lahnung", icon: "🪵", name: "Lahnungen (Landgewinnung)", arten: ["marsch"], kosten: 0.3,
    was: "Doppelte Pfahlreihen mit Reisig dazwischen bilden im Watt Felder vor dem Deich.",
    plus: "Das Wasser wird ruhig, Schlick setzt sich ab (einige Zentimeter im Jahr). Ist das Feld hoch genug, wächst Queller — eine Salzwiese entsteht, die die Wellen bremst.",
    minus: "Dauert Jahrzehnte und muss gepflegt werden. Salzwiesen sind heute als Lebensraum geschützt.",
  },
  {
    id: "zurueck", icon: "🚚", name: "Zurückweichen", arten: ["steil"], kosten: 2,
    was: "Gebäude, die zu nah an der Kante stehen, werden abgerissen und weiter hinten neu gebaut; Wege werden verlegt.",
    plus: "Das Kliff bleibt natürlich und liefert weiter Sand für die Strände der Nachbarschaft.",
    minus: "Land geht verloren. Denkmäler wie der Burgwall lassen sich nicht umsetzen.",
  },
  {
    id: "sperren", icon: "🚧", name: "Kliffweg sperren", arten: ["steil"], kosten: 0.01,
    was: "Abschnitte an der Kante und am Fuß des Kliffs werden abgesperrt, Schilder warnen.",
    plus: "Schützt Menschen: Abbrüche kommen ohne Vorwarnung, besonders nach Regen, Frost und Sturm.",
    minus: "Schützt das Kliff nicht — es bricht trotzdem ab.",
  },
];

export function massnahmenFuer(art: KuestenArt) {
  // Was nur zu dieser Küste passt, zuerst — das Deckwerk gibt es überall.
  return MASSNAHMEN.filter(m => m.arten.includes(art)).sort((a, b) => a.arten.length - b.arten.length);
}

/** Sand bis `dach` aufschütten, beginnend bei `von` Richtung See */
function aufschuetten(p: Profil, von: number, bis: number, dach: number, menge: number) {
  let rest = menge;
  // Schicht um Schicht, damit die Aufspülung flach wird statt spitz
  for (let lage = 0; lage < 400 && rest > 1e-6; lage++) {
    let gesetzt = 0;
    for (let i = bis; i >= von && rest > 1e-6; i--) {
      const luecke = dach - boden(p, i);
      if (luecke <= 0) continue;
      const t = Math.min(0.1, luecke, rest);
      p.sand[i] += t; rest -= t; gesetzt += t;
    }
    if (gesetzt === 0) break;
  }
  return menge - rest;
}

export interface Ergebnis { ok: boolean; text: string }

export function anwenden(p: Profil, id: MassnahmeId): Ergebnis {
  const m = MASSNAHMEN.find(x => x.id === id)!;
  if (!m.arten.includes(p.art)) return { ok: false, text: "Passt nicht zu dieser Küste." };
  const hw = uferIndex(p, mhw(p));
  const k = kennzahlen(p);
  let kosten = m.kosten;
  let text = "";

  switch (id) {
    case "strand": {
      // Zwischen Niedrigwasserlinie und Dünenfuß auf 1,5 m über MHW
      const nw = uferIndex(p, mnw(p));
      const fuss = Math.max(hw + 5, dueneFuss(p));
      const gesetzt = aufschuetten(p, Math.max(0, nw - 30), fuss, mhw(p) + 1.5, 100);
      p.bilanz.aufgespuelt += gesetzt;
      text = `${Math.round(gesetzt)} m³ Sand je Meter aufgespült — der Strand ist wieder breit.`;
      break;
    }
    case "vorstrand": {
      const nw = uferIndex(p, mnw(p));
      const gesetzt = aufschuetten(p, Math.max(0, nw - 110), Math.max(0, nw - 25), mnw(p) - 1.0, 200);
      p.bilanz.aufgespuelt += gesetzt;
      text = `${Math.round(gesetzt)} m³ Sand je Meter vor dem Strand abgelegt — ein neues Riff.`;
      break;
    }
    case "duene": {
      let n = 0;
      for (let i = hw; i < p.n; i++) {
        if (boden(p, i) > mhw(p) + 2 && p.sand[i] > 0.3 && p.bewuchs[i] === BEWUCHS.KEIN) { p.bewuchs[i] = BEWUCHS.STRANDHAFER; n++; }
      }
      const fuss = dueneFuss(p);
      for (let i = fuss - 12; i < fuss; i += 4) if (i > hw) p.schutz[i] = SCHUTZ.ZAUN;
      text = n > 0 ? `Strandhafer auf ${n} m Düne gepflanzt, Sandfangzäune am Dünenfuß gesetzt.` : "Sandfangzäune gesetzt — die Düne ist schon bewachsen.";
      break;
    }
    case "deckwerk": {
      // am Fuß von Düne, Kliff oder Deich, 10 m breit Richtung See
      const fuss = p.art === "steil" ? Math.max(0, (k.kante < 0 ? hw : k.kante) - 1)
        : p.art === "marsch" ? deichFuss(p) : dueneFuss(p);
      for (let i = Math.max(0, fuss - 9); i <= fuss; i++) p.schutz[i] = SCHUTZ.DECKWERK;
      text = "Deckwerk gebaut. Dahinter ist Ruhe — achte auf den Strand davor.";
      break;
    }
    case "deich": {
      const alt = boden(p, krone(p, hw));
      const fuss = deichFuss(p);
      for (let i = fuss; i < p.n; i++) p.deich[i] = 0;
      const g0 = (i: number) => p.fels[i] + p.sand[i];
      const kroneZ = 8.5;
      const kx = fuss + (kroneZ - g0(fuss)) * 6;
      for (let i = fuss; i < p.n; i++) {
        const z = i <= kx ? g0(fuss) + (i - fuss) / 6 : i <= kx + 5 ? kroneZ : kroneZ - (i - kx - 5) / 3;
        p.deich[i] = Math.max(0, z - g0(i));
        if (p.deich[i] > 0) { p.bewuchs[i] = BEWUCHS.GRAS; p.schutz[i] = SCHUTZ.KEIN; }
      }
      p.deichSchaden = 0;
      p.deichGebrochen = false;
      kosten = Math.max(4, m.kosten * Math.max(0.5, (kroneZ - alt) / 2.5));
      // Häuser, die jetzt unter dem breiteren Deich lägen, bleiben stehen — der Deich wächst seewärts.
      text = `Deich auf ${kroneZ.toString().replace(".", ",")} m über NHN verstärkt (vorher ${alt.toFixed(1).replace(".", ",")} m).`;
      break;
    }
    case "lahnung": {
      const vorland = Array.from(p.bewuchs).findIndex(b => b === BEWUCHS.SALZWIESE);
      const rand = vorland < 0 ? hw : vorland;
      let n = 0;
      for (let i = Math.max(0, rand - 50); i < rand; i++) {
        if (boden(p, i) > mnw(p) - 0.5) { p.schutz[i] = SCHUTZ.LAHNUNG; n++; }
      }
      text = n > 0 ? `Lahnungsfelder auf ${n} m Watt vor dem Vorland gebaut.` : "Hier ist das Watt zu tief für Lahnungen.";
      break;
    }
    case "zurueck": {
      const kante = k.kante;
      const bedroht = p.objekte.filter(o => !o.zerstoert && kante >= 0 && o.x - kante < 25);
      if (bedroht.length === 0) return { ok: false, text: "Nichts steht gerade gefährlich nah an der Kante." };
      const namen: string[] = [];
      for (const o of bedroht) {
        if (o.art === "burgwall") { namen.push(`${o.name} (Denkmal — bleibt)`); continue; }
        o.x = Math.min(p.n - 2, o.x + 30);
        o.boden0 = boden(p, Math.round(o.x));
        namen.push(o.name);
      }
      kosten = m.kosten * bedroht.filter(o => o.art !== "burgwall").length;
      text = `Zurückverlegt: ${namen.join(", ")}.`;
      break;
    }
    case "sperren": {
      p.merker.gesperrt = true;
      text = "Kliffweg und Kliffuß abgesperrt, Warnschilder aufgestellt.";
      break;
    }
  }
  p.kosten += kosten;
  p.meldungen.push({ stunde: p.stunde, text: `${m.icon} ${text}`, art: "gut" });
  return { ok: true, text };
}

/** Wo der Strand in die Düne übergeht (erster deutlicher Anstieg über MHW) */
export function dueneFuss(p: Profil) {
  const hw = uferIndex(p, mhw(p));
  for (let i = hw + 1; i < p.n - 1; i++) {
    if (boden(p, i + 1) - boden(p, i) > 0.3 && boden(p, i) > mhw(p) + 0.8) return i;
  }
  return Math.min(p.n - 1, hw + 20);
}

/** Wo der Deich auf dem Vorland aufsitzt */
export function deichFuss(p: Profil) {
  for (let i = 0; i < p.n; i++) if (p.deich[i] > 0.05) return Math.max(0, i - 1);
  return krone(p, 0);
}
