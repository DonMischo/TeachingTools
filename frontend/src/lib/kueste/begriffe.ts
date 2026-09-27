/**
 * Die Fachbegriffe aus den Profilskizzen — berechnet aus dem aktuellen
 * Zustand. Wandert das Kliff zurück, wandert die Beschriftung mit; ist die
 * Kliffhalde abgeräumt, verschwindet ihr Schild.
 *
 * Dieselbe Liste dient dem Beschriftungs-Quiz: gefragt wird nur, was gerade
 * zu sehen ist.
 */
import { BEWUCHS, SCHUTZ, boden, kennzahlen, krone, mhw, mnw, uferIndex, wellen, type Profil } from "./profil";
import { dueneFuss, deichFuss } from "./massnahmen";

export interface Begriff {
  id: string;
  name: string;
  /** Spalte (m) und Höhe (m über NHN), auf die das Schild zeigt */
  x: number;
  z: number;
  text: string;
}

const T: Record<string, string> = {
  mhw: "Mittlere Hochwasserlinie: bis hierher reicht das Wasser bei Flut im Mittel.",
  mnw: "Mittlere Niedrigwasserlinie: so weit zieht sich das Wasser bei Ebbe im Mittel zurück.",
  mw: "An der Ostsee gibt es kaum Gezeiten — der Wasserstand ändert sich vor allem durch Wind.",
  brecher: "Hier wird das Wasser zu flach für die Welle: sie kippt vornüber und bricht.",
  roller: "Nach dem Brechen rollen die Wellen als Schaumwalze weiter zum Strand.",
  spuel: "Der Spülsaum: hier läuft die Welle am Strand aus und fließt zurück.",
  vorstrand: "Der Vorstrand liegt meist unter Wasser — zwischen Brecherzone und Spülsaum.",
  riff: "Ein Sandriff (Barre) unter Wasser. Die großen Wellen brechen schon hier.",
  priel: "Der Küstenpriel: eine Rinne zwischen Riff und Strand, durch die das Wasser zurückströmt.",
  strand: "Der Strand: trockener Sand zwischen Hochwasserlinie und Düne.",
  strandwall: "Ein flacher Sandwall, den die Wellen bei ruhigem Wetter aufschieben.",
  duene: "Die Düne: vom Wind aufgewehter Sand, festgehalten von Strandhafer.",
  kliff: "Das Kliff: die steile Wand, an der Brandung, Regen und Frost nagen.",
  kehle: "Die Brandungshohlkehle: hier frisst die Brandung eine Kerbe in den Fuß des Kliffs.",
  halde: "Die Kliffhalde: abgestürztes Material am Fuß. Sie schützt das Kliff, bis das Meer sie abgeräumt hat.",
  block: "Der Blockstrand: große Steine (Findlinge) bleiben liegen, wenn das Meer den Rest fortspült.",
  plattform: "Die Abrasionsplattform: der flach abgeschliffene Untergrund, über den das Kliff früher reichte.",
  seehalde: "Die Seehalde: draußen abgelagertes feines Material aus dem Kliff.",
  watt: "Das Watt: Meeresboden, der bei Ebbe trockenfällt.",
  wattpriel: "Ein Priel: eine tiefe Rinne im Watt. Bei Flut läuft das Wasser hier zuerst ein!",
  vorland: "Das Vorland mit Salzwiese: bremst die Wellen, bevor sie den Deich erreichen.",
  lahnung: "Lahnungsfelder: Pfahlreihen mit Reisig. Das Wasser wird ruhig, Schlick setzt sich ab.",
  aussen: "Die Außenböschung: flach (1:6), damit die Wellen auslaufen statt aufzuprallen.",
  kronen: "Die Deichkrone mit Fahrweg: der höchste Punkt des Deichs.",
  binnen: "Die Binnenböschung: auf der Landseite. Ist sie zu steil, spült überlaufendes Wasser sie weg.",
  klei: "Die Kleidecke: fester, toniger Boden mit Gras — wasserdicht und zäh.",
  kern: "Der Sandkern: das billige Innere des Deichs.",
  koog: "Der Koog: eingedeichtes Land, oft tiefer als das Hochwasser draußen.",
  deckwerk: "Das Deckwerk: ein Panzer aus Steinen oder Beton gegen die Brandung.",
};

function b(id: string, name: string, x: number, z: number, text = T[id]): Begriff {
  return { id, name, x: Math.round(x), z, text };
}

/** Höchste Erhebung (bzw. tiefste Senke) im Bereich, gemessen gegen die Umgebung */
function buckel(p: Profil, von: number, bis: number, weite: number, vorzeichen: 1 | -1) {
  let best = -1, wert = 0.25;
  for (let i = Math.max(weite, von); i <= Math.min(p.n - 1 - weite, bis); i++) {
    const umgebung = (boden(p, i - weite) + boden(p, i + weite)) / 2;
    const d = (boden(p, i) - umgebung) * vorzeichen;
    if (d > wert) { wert = d; best = i; }
  }
  return best;
}

export function begriffe(p: Profil, W: number, H0: number): Begriff[] {
  const out: Begriff[] = [];
  const hw = uferIndex(p, mhw(p));
  const nw = uferIndex(p, mnw(p));

  if (p.hub >= 0.5) {
    out.push(b("mhw", "MHW", Math.max(4, nw - 150), mhw(p)));
    out.push(b("mnw", "MNW", Math.max(4, nw - 150), mnw(p)));
  } else {
    out.push(b("mw", "Mittelwasser", 10, 0));
  }

  if (p.art === "flach") {
    const wl = wellen(p, W, H0);
    if (wl.brecher >= 0 && H0 > 0.4) {
      out.push(b("brecher", "Brecherzone", wl.brecher + 3, W));
      if (wl.ufer - wl.brecher > 25) out.push(b("roller", "Rollerzone", (wl.brecher + wl.ufer) / 2 + 8, W));
      out.push(b("vorstrand", "Vorstrand", (wl.brecher + wl.ufer) / 2, W + 1.5));
    }
    out.push(b("spuel", "Spülsaum", wl.ufer, W));
    const riff = buckel(p, nw - 160, nw - 5, 15, 1);
    if (riff >= 0) {
      out.push(b("riff", "Sandriff (Barre)", riff, boden(p, riff)));
      const priel = buckel(p, riff + 5, nw, 10, -1);
      if (priel >= 0) out.push(b("priel", "Küstenpriel", priel, boden(p, priel)));
    }
    const fuss = dueneFuss(p);
    if (fuss - hw > 4) {
      out.push(b("strand", "Strand", (hw + fuss) / 2, boden(p, Math.round((hw + fuss) / 2))));
      const wall = buckel(p, hw, fuss - 2, 6, 1);
      if (wall >= 0) out.push(b("strandwall", "Strandwall", wall, boden(p, wall)));
    }
    const k = krone(p, hw);
    if (k >= 0) out.push(b("duene", "Düne", k, boden(p, k)));
  }

  if (p.art === "steil") {
    const kante = kennzahlen(p).kante;
    if (kante > 0) {
      const oben = boden(p, Math.min(p.n - 1, kante + 1));
      const fuss = p.fels[kante - 1];
      out.push(b("kliff", "Kliff", kante + 2, (oben + fuss) / 2 + 6));
      out.push(b("kehle", "Brandungshohlkehle", kante, Math.max(W, fuss) + 0.6));
      let top = -1, h = 1.5;
      for (let i = Math.max(0, kante - 20); i < kante; i++) if (p.sand[i] > h) { h = p.sand[i]; top = i; }
      if (top >= 0) out.push(b("halde", "Kliffhalde", top, boden(p, top)));
      let bl = -1;
      for (let i = kante - 1; i > kante - 60 && i > 0; i--) if (p.bloecke[i] > 0.5 && boden(p, i) > W - 0.8) { bl = i; break; }
      if (bl >= 0) out.push(b("block", "Blockstrand", bl, boden(p, bl)));
      let a = -1, e = -1;
      for (let i = kante - 1; i > 0; i--) {
        const flach = p.sand[i] < 0.15 && boden(p, i) < W + 0.3 && boden(p, i) > -3;
        if (flach && e < 0) e = i;
        if (flach) a = i; else if (e >= 0 && e - i > 30) break;
      }
      if (a >= 0 && e - a > 10) out.push(b("plattform", "Abrasionsplattform", (a + e) / 2, boden(p, Math.round((a + e) / 2))));
      let see = -1, dick = 0.8;
      for (let i = 0; i < p.n && boden(p, i) < -3; i++) if (p.sand[i] > dick) { dick = p.sand[i]; see = i; }
      if (see >= 0) out.push(b("seehalde", "Seehalde", see, boden(p, see)));
    }
  }

  if (p.art === "marsch") {
    const vorland = Array.from(p.bewuchs).findIndex(x => x === BEWUCHS.SALZWIESE);
    const wattEnde = vorland > 0 ? vorland : hw;
    const priel = buckel(p, 10, wattEnde - 10, 12, -1);
    if (priel >= 0) out.push(b("wattpriel", "Priel", priel, boden(p, priel)));
    const w = Math.round(Math.max(priel + 30, wattEnde - 50));
    out.push(b("watt", "Watt", w, boden(p, w)));
    const lz = Array.from(p.schutz).findIndex(x => x === SCHUTZ.LAHNUNG);
    if (lz >= 0) out.push(b("lahnung", "Lahnungen", lz + 10, boden(p, lz + 10)));
    const fuss = deichFuss(p);
    if (vorland > 0 && fuss - vorland > 5) out.push(b("vorland", "Vorland (Salzwiese)", (vorland + fuss) / 2, boden(p, Math.round((vorland + fuss) / 2))));
    const k = krone(p, fuss);
    if (k > fuss && p.deich[k] > 0.5) {
      const kz = boden(p, k);
      out.push(b("aussen", "Außenböschung", (fuss + k) / 2, boden(p, Math.round((fuss + k) / 2))));
      out.push(b("kronen", "Deichkrone mit Fahrweg", k + 2, kz));
      let ende = k;
      while (ende < p.n - 1 && p.deich[ende + 1] > 0.05) ende++;
      out.push(b("binnen", "Binnenböschung", (k + ende) / 2 + 2, boden(p, Math.round((k + ende) / 2 + 2))));
      out.push(b("klei", "Kleidecke", k - 8, boden(p, k - 8) - 0.5));
      out.push(b("kern", "Sandkern", k, (kz + p.fels[k] + p.sand[k]) / 2 - 0.5));
      const koog = Math.round((ende + p.n) / 2);
      out.push(b("koog", "Koog", koog, boden(p, koog)));
    }
  }

  const dw = Array.from(p.schutz).findIndex(x => x === SCHUTZ.DECKWERK);
  if (dw >= 0) out.push(b("deckwerk", "Deckwerk", dw + 5, boden(p, dw + 5)));
  return out;
}
