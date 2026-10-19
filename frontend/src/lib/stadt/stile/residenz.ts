/**
 * Residenzstadt des Absolutismus nach dem Vorbild Karlsruhe (1715):
 * Vom Schloss strahlen die Straßen fächerförmig in die Stadt, nach hinten
 * Schneisen in den Wald — alles läuft auf den Herrscher zu.
 *   1715  Gründung: Schloss, Fächer, Zirkel, Modellhäuser
 *   1800  Ausbau: Markt mit Kirche und Rathaus auf der Hauptachse, Erweiterung
 *   heute Bahn, Gründerzeit, Moderne
 */
import { istWasser, neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import type { P } from "../geometrie";
import { kopie, leereStadt, type Epoche } from "../modell";
import { bau, baubar, besterPunkt, freiraeumen, raster, zerschneiden } from "../hilfen";
import { moderne } from "../moderne";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

export function residenzStandort(g: Gelaende, z: () => number): P {
  return besterPunkt(g, 900, c => {
    let neig = 0;
    for (let k = 0; k < 36; k++) {
      const w = (k / 36) * Math.PI * 2;
      // im Fächer (Süden) bis zum Stadtrand, sonst bis zum Garten kein Wasser
      const imFaecher = Math.abs(w - Math.PI / 2) < Math.PI / 4 + 0.1;
      for (let r = 50; r <= 750; r += 50) {
        const p = polar(c, w, r);
        if ((r <= 450 || imFaecher) && istWasser(g, p.x, p.y)) return -1e9;
        neig += neigungBei(g, p.x, p.y);
      }
    }
    return -neig / 540 + z() * 0.3 - Math.hypot(c.x - g.breite / 2, c.y - g.breite / 2) / 900;
  }) ?? { x: g.breite / 2, y: g.breite / 2 };
}

export function residenz(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const c = residenzStandort(g, z);
  const s = leereStadt("residenz");
  const SUED = Math.PI / 2, F = Math.PI / 4; // Fächer ±45° um Süden
  const R1 = 190, R2 = 680;
  // Fächer: 9 Straßen in die Stadt
  const strahlen: number[] = [];
  for (let k = -4; k <= 4; k++) strahlen.push(SUED + (k / 4) * F);
  for (const w of strahlen) for (const st of zerschneiden([polar(c, w, 40), polar(c, w, R2)], g)) {
    s.strassen.push({ art: w === SUED ? "haupt" : "neben", name: w === SUED ? "Hauptachse" : undefined, punkte: [st[0], st[st.length - 1]] });
  }
  // nach hinten: Schneisen in Park und Wald, zusammen 32 Strahlen
  for (let k = 0; k < 23; k++) {
    const w = SUED + F + ((k + 1) / 24) * (Math.PI * 2 - 2 * F);
    for (const st of zerschneiden([polar(c, w, 60), polar(c, w, 1300)], g)) s.strassen.push({ art: "gasse", punkte: [st[0], st[st.length - 1]] });
  }
  // Zirkel: Bogen um den Schlossplatz
  const zirkel: P[] = [];
  for (let k = 0; k <= 16; k++) zirkel.push(polar(c, SUED - F * 1.05 + (k / 16) * F * 2.1, R1));
  s.strassen.push({ art: "haupt", name: "Zirkel", punkte: zirkel });
  // Querstraße durch den Fächer (Lange Straße)
  const yq = c.y + 430;
  s.strassen.push({ art: "haupt", name: "Lange Straße", punkte: [{ x: c.x - 520, y: yq }, { x: c.x + 520, y: yq }] });
  // Schlossplatz (Garten vor dem Schloss) und Schlossgarten dahinter
  const platz: P[] = [c];
  for (let k = 0; k <= 12; k++) platz.push(polar(c, SUED - F + (k / 12) * 2 * F, R1 - 12));
  const garten: P[] = [];
  for (let k = 0; k <= 20; k++) garten.push(polar(c, SUED + F + (k / 20) * (Math.PI * 2 - 2 * F), 430));
  garten.push(c);
  const stadt: P[] = [];
  for (let k = 0; k <= 16; k++) stadt.push(polar(c, SUED - F * 1.1 + (k / 16) * F * 2.2, R1 + 6));
  for (let k = 16; k >= 0; k--) stadt.push(polar(c, SUED - F * 1.1 + (k / 16) * F * 2.2, R2));
  s.zonen.push({ typ: "residenz", poly: stadt }, { typ: "schlossgarten", poly: garten }, { typ: "park", poly: platz });
  bau(s, "schloss", { x: c.x, y: c.y - 6 }, 0);
  bau(s, "kirche", polar(c, SUED - F * 0.875, R1 + 45), SUED - F * 0.875);
  bau(s, "kaserne", polar(c, SUED + F * 0.875, R1 + 75), SUED + F * 0.875 + Math.PI / 2);
  s.namen = [{ text: "Schlossplatz", x: c.x - 40, y: c.y + 110 }, { text: "Schlossgarten", x: c.x - 50, y: c.y - 260 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "1715", titel: "Gründung der Residenz",
    text: "Der Fürst lässt eine neue Hauptstadt anlegen — auf freiem, ebenem Land, ganz nach seinem Plan. Mittelpunkt ist das Schloss mit dem Turm. Von dort strahlen 32 Straßen und Schneisen aus wie ein Fächer: neun in die Stadt, die übrigen durch Park und Wald. Wer bauen will, bekommt Grund geschenkt, muss aber nach Modellhaus bauen — die Stadt sieht einheitlich aus.",
    neu: ["Schloss als Mittelpunkt", "Fächer: alle Straßen laufen aufs Schloss zu", "Zirkel und Schlossplatz", "Schlossgarten und Jagdschneisen", "Modellhäuser, einheitlich"],
    stadt: kopie(s),
  };

  // um 1800: Markt auf der Hauptachse, Erweiterung im Raster
  const markt = { x: c.x, y: c.y + 580 };
  bau(s, "markt", markt, 0);
  bau(s, "kirche", { x: markt.x + 80, y: markt.y }, 0);
  bau(s, "rathaus", { x: markt.x - 80, y: markt.y }, 0);
  const ach = zerschneiden([polar(c, SUED, R2), polar(c, SUED, 1050)], g)[0];
  if (ach) s.strassen.push({ art: "haupt", name: "Via triumphalis", punkte: [ach[0], ach[ach.length - 1]] });
  bau(s, "tor", polar(c, SUED, 1050));
  const x0 = c.x - 420, x1 = c.x + 420, y0 = c.y + R2 - 40, y1 = c.y + 1000;
  s.strassen.push(...raster(g, x0, y0, x1, y1, 120, 100, c.x, y0).filter(st => !st.punkte.every(p => Math.abs(p.x - c.x) < 1)));
  s.zonen.push({ typ: "residenz", poly: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
  bau(s, "theater", polar(c, SUED + F * 0.625, R1 + 70), SUED + F * 0.625);
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "um 1800", titel: "Ausbau der Residenz",
    text: "Die Stadt wächst nach Süden. Auf der Hauptachse entsteht der Marktplatz mit Kirche und Rathaus einander gegenüber — streng symmetrisch. Die Achse führt weiter bis zu einem Tor: eine Via triumphalis für Einzüge des Fürsten. Die Erweiterung folgt einem regelmäßigen Raster.",
    neu: ["Markt, Kirche und Rathaus auf der Hauptachse", "Via triumphalis bis zum Tor", "Erweiterung im Raster", "Hoftheater"],
    stadt: kopie(s),
  };

  // heute: Bahn südlich, Bahnhof auf der Achse, Moderne
  const yb = c.y + 1260;
  const bahn = zerschneiden([{ x: 0, y: yb + (z() - 0.5) * 60 }, { x: g.breite, y: yb + (z() - 0.5) * 60 }], g, true).sort((a, b) => b.length - a.length)[0];
  if (bahn) s.strassen.push({ art: "bahn", name: "Eisenbahn", punkte: [bahn[0], bahn[bahn.length - 1]] });
  const bhf = { x: c.x, y: yb - 30 };
  if (baubar(g, bhf, 20)) bau(s, "bahnhof", bhf, 0);
  s.strassen.push({ art: "haupt", name: "Bahnhofstraße", punkte: [polar(c, SUED, 1050), { x: c.x, y: yb - 60 }] });
  const gz: P[] = [{ x: c.x - 900, y: c.y + 300 }, { x: c.x + 900, y: c.y + 300 }, { x: c.x + 900, y: yb - 20 }, { x: c.x - 900, y: yb - 20 }];
  s.zonen.splice(0, 0, { typ: "gruenderzeit", poly: gz });
  s.strassen.push(...raster(g, c.x - 900, c.y + 300, c.x - 440, yb - 50, 110, 100, c.x, c.y), ...raster(g, c.x + 440, c.y + 300, c.x + 900, yb - 50, 110, 100, c.x, c.y));
  moderne(g, s, stadt, { x: c.x, y: c.y + 450 }, z);
  s.namen = [{ text: "Schloss (Museum)", x: c.x - 60, y: c.y - 50 }];
  const e3: Epoche = {
    jahr: "heute", titel: "Residenz ohne Fürst",
    text: "Das Schloss ist Museum, der Schlossgarten ein öffentlicher Park. Der Fächer prägt die Innenstadt bis heute — von oben sieht man die Macht des Absolutismus noch immer. Draußen wuchs die Stadt wie andere auch: Bahnhof, Gründerzeit, Neubaugebiete.",
    neu: ["Bahnhof am Ende der Achse", "Gründerzeitviertel", "Neubaugebiete und Umgehung", "Fächer bleibt im Stadtplan"],
    stadt: kopie(s),
  };
  return [e1, e2, e3];
}
