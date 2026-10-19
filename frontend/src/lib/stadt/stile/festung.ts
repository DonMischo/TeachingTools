/**
 * Festungsstadt nach Vauban (Neuf-Brisach 1698, Saarlouis 1680):
 * achteckiger Stern aus Bastionen, davor Graben, Ravelins und das freie
 * Schussfeld (Glacis); innen ein Raster um den Paradeplatz. Steht ein Hügel
 * nahe, kommt eine Zitadelle darauf (wie der Petersberg in Erfurt).
 *   um 1700  Festung
 *   um 1870  Entfestigung: Ring und Parks auf den Wällen, Bahnhof, Gründerzeit
 *   heute    Moderne
 */
import { istWasser, neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, inPoly, schnitte, skaliere, geschlossen, type P } from "../geometrie";
import { kopie, leereStadt, type Epoche } from "../modell";
import { bau, besterPunkt, fernstrasse, freiraeumen, raster } from "../hilfen";
import { industrialisierung, moderne } from "../moderne";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

/** Sternförmiger Wall: n Bastionen, Kurtine dazwischen */
export function bastionen(c: P, R: number, n: number, dreh = 0): P[] {
  const poly: P[] = [];
  for (let i = 0; i < n; i++) {
    const w = dreh + ((i + 0.5) / n) * Math.PI * 2;
    const d = Math.PI / n;
    // Schulter, Flanke, Spitze, Flanke, Schulter
    poly.push(polar(c, w - d * 0.42, R * 0.97), polar(c, w - d * 0.3, R * 1.1), polar(c, w, R * 1.3), polar(c, w + d * 0.3, R * 1.1), polar(c, w + d * 0.42, R * 0.97));
  }
  return poly;
}

/** Ravelin (Halbmond) vor der Mitte jeder Kurtine */
function ravelins(c: P, R: number, n: number, dreh = 0): P[][] {
  const aus: P[][] = [];
  for (let i = 0; i < n; i++) {
    const w = dreh + (i / n) * Math.PI * 2;
    aus.push([polar(c, w - 0.13, R * 1.18), polar(c, w, R * 1.42), polar(c, w + 0.13, R * 1.18)]);
  }
  return aus;
}

export function festung(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const R = 300;
  const c = besterPunkt(g, 900, p => {
    let neig = 0;
    for (let k = 0; k < 16; k++) {
      const q = polar(p, (k / 16) * Math.PI * 2, R * 1.6);
      if (istWasser(g, q.x, q.y)) return -1e9;
      neig += neigungBei(g, q.x, q.y);
    }
    return -neig / 16 - neigungBei(g, p.x, p.y) + z() * 0.4 - abstand(p, { x: g.breite / 2, y: g.breite / 2 }) / 800;
  }) ?? { x: g.breite / 2, y: g.breite / 2 };
  const s = leereStadt("festung");
  const wall = bastionen(c, R, 8);
  s.mauern.push(wall, ...ravelins(c, R, 8));
  const innen = skaliere(wall, 0.9, c);
  s.zonen.push({ typ: "glacis", poly: skaliere(wall, 1.75, c) }, { typ: "graben", poly: skaliere(wall, 1.22, c) }, { typ: "festung", poly: wall });
  // Raster und Achsen zu den vier Toren
  s.strassen.push(...raster(g, c.x - R, c.y - R, c.x + R, c.y + R, 66, 66, c.x, c.y, "neben", p => inPoly(p, innen))
    .filter(st => !st.punkte.every(p => Math.abs(p.x - c.x) < 1) && !st.punkte.every(p => Math.abs(p.y - c.y) < 1)));
  const tore: P[] = [];
  for (let i = 0; i < 4; i++) {
    const w = (i / 4) * Math.PI * 2;
    const aussen = polar(c, w, R * 1.5);
    const t = schnitte([c, aussen], geschlossen(wall))[0] ?? polar(c, w, R);
    tore.push(t);
    bau(s, "tor", t);
    s.strassen.push({ art: "haupt", punkte: [c, t] });
    const f = fernstrasse(g, polar(c, w, R * 1.5), w);
    // nur der äußere Teil (ab dem Ravelin)
    const ab = f.findIndex(p => abstand(p, c) > R * 1.5);
    const teil = f.slice(Math.max(0, ab - 1)).filter(p => abstand(p, c) > R * 1.45);
    if (teil.length > 1) s.strassen.push({ art: "fernstrasse", punkte: [t, ...teil] });
  }
  bau(s, "paradeplatz", c, 0);
  bau(s, "kirche", { x: c.x + 85, y: c.y - 85 }, 0);
  for (let i = 0; i < 4; i++) bau(s, "kaserne", polar(c, ((i + 0.5) / 4) * Math.PI * 2, R * 0.72), ((i + 0.5) / 4) * Math.PI * 2 + Math.PI / 2);
  // Zitadelle auf dem Hügel, wenn einer nah genug ist
  let zit: P | null = null;
  if (g.berg && abstand(g.berg, c) < 1100 && abstand(g.berg, c) > R * 1.8) {
    zit = g.berg;
    s.mauern.push(bastionen(zit, 90, 4, Math.PI / 4));
    bau(s, "zitadelle", zit, 0);
    s.zonen.splice(0, 0, { typ: "glacis", poly: skaliere(bastionen(zit, 90, 4, Math.PI / 4), 1.8, zit) });
  }
  s.namen = [{ text: "Glacis", x: c.x + R * 1.45, y: c.y + R * 0.6 }, { text: "Bastion", x: c.x + R * 1.25, y: c.y - R * 0.55 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 1700", titel: "Festung nach Vauban",
    text: "Kanonen machten mittelalterliche Mauern nutzlos. Festungsbaumeister wie Vauban entwarfen niedrige, dicke Wälle mit spitzen Bastionen: Von jeder Bastion aus kann man die Nachbarn seitlich beschießen — es gibt keinen toten Winkel. Davor liegen Graben und Ravelins, ganz außen das Glacis: ein freier Hang ohne Haus und Baum, damit Angreifer keine Deckung finden. Innen ein Raster um den Paradeplatz, Kasernen für die Garnison." + (zit ? " Auf dem Hügel sichert eine Zitadelle die Stadt." : ""),
    neu: ["Sternförmiger Wall mit Bastionen", "Graben, Ravelins, Glacis", "Raster um den Paradeplatz", "Kasernen", ...(zit ? ["Zitadelle auf dem Hügel"] : [])],
    stadt: kopie(s),
  };

  // Entfestigung
  s.zonen = s.zonen.filter(x => x.typ === "festung");
  industrialisierung(g, s, wall, c, z, true);
  if (zit) s.mauern.push(bastionen(zit, 90, 4, Math.PI / 4));
  const e2: Epoche = {
    jahr: "um 1870", titel: "Entfestigung",
    text: "Gegen moderne Artillerie helfen auch Bastionen nicht mehr, und die Stadt platzt aus den Nähten. Die Wälle werden geschleift. Wo Wall und Graben waren, entstehen ein Ring und Parks — das Glacis wird zu Bauland. Bahnhof und Gründerzeitviertel liegen vor der alten Festung." + (zit ? " Die Zitadelle bleibt oft als Kaserne oder Denkmal stehen." : ""),
    neu: ["Wälle geschleift, Ring mit Grünanlagen", "Glacis wird bebaut", "Bahnhof und Gründerzeit", ...(zit ? ["Zitadelle bleibt"] : [])],
    stadt: kopie(s),
  };

  moderne(g, s, wall, c, z);
  const e3: Epoche = {
    jahr: "heute", titel: "Festung im Stadtplan",
    text: "Im Stadtplan erkennt man die Festung noch am sternförmigen Ring und am Raster der Altstadt um den großen Platz. Neuf-Brisach ist UNESCO-Welterbe; in Saarlouis heißt der Paradeplatz heute Großer Markt.",
    neu: ["Sternförmiger Ring bleibt sichtbar", "Neubaugebiete und Umgehung"],
    stadt: kopie(s),
  };
  return [e1, e2, e3];
}
