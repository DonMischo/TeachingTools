/**
 * Sozialistische Planstadt nach dem Vorbild Eisenhüttenstadt (ab 1950):
 * Ein Kombinat ist der Grund für die Stadt. Nach den »16 Grundsätzen des
 * Städtebaus« (1950) führt eine Magistrale vom Werk zum zentralen Platz mit
 * Kulturhaus; die Wohnkomplexe haben je Schule, Kaufhalle und Kindergarten.
 *   1955  Werk, Magistrale, Wohnkomplexe I–III (Nationale Tradition)
 *   1980  Plattenbau-Wohnkomplexe (WBS 70), Poliklinik
 *   2015  Schrumpfung: Werk verkleinert, Rückbau, Einfamilienhäuser, Discounter
 */
import { eignung } from "../standort";
import { istWasser, neigungBei, wasserAbstand, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, geschlossen, inPoly, rechteck, schwerpunkt, type P } from "../geometrie";
import { kopie, leereStadt, type Epoche, type Stadt } from "../modell";
import { bau, baubar, besterPunkt, freiraeumen, raster, zerschneiden, type Z } from "../hilfen";
import { randPunkt, weg } from "../wege";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

/** parallele Straßen quer durch ein gedrehtes Rechteck, im Abstand d */
function parallelen(m: P, b: number, h: number, dreh: number, d: number): P[][] {
  const aus: P[][] = [];
  const ux = Math.cos(dreh), uy = Math.sin(dreh), vx = -uy, vy = ux;
  for (let t = -b / 2 + d / 2; t < b / 2; t += d) aus.push([{ x: m.x + ux * t - vx * h / 2, y: m.y + uy * t - vy * h / 2 }, { x: m.x + ux * t + vx * h / 2, y: m.y + uy * t + vy * h / 2 }]);
  return aus;
}

/** Wohnkomplex als Rechteck mit Erschließungsring und Versorgung in der Mitte */
function wohnkomplex(s: Stadt, m: P, b: number, h: number, dreh: number, platte: boolean) {
  s.zonen.push({ typ: platte ? "platte" : "tradition", poly: rechteck(m, b, h, dreh) });
  s.strassen.push({ art: "neben", punkte: geschlossen(rechteck(m, b - 40, h - 40, dreh)) });
  // Blockrand: Straßen in beide Richtungen; Zeilenbau: nur parallele Wohnwege
  for (const l of parallelen(m, b - 40, h - 40, dreh, platte ? 78 : 95)) s.strassen.push({ art: "neben", punkte: l });
  if (!platte) for (const l of parallelen(m, h - 40, b - 40, dreh + Math.PI / 2, 95)) s.strassen.push({ art: "neben", punkte: l });
  bau(s, "schule", { x: m.x + Math.cos(dreh) * 40, y: m.y + Math.sin(dreh) * 40 }, dreh);
  bau(s, "kaufhalle", { x: m.x - Math.cos(dreh) * 50, y: m.y - Math.sin(dreh) * 50 }, dreh);
}

/** kein Wasser auf der Strecke */
function trocken(g: Gelaende, a: P, b: P): boolean {
  const k = Math.ceil(abstand(a, b) / 6);
  for (let i = 0; i <= k; i++) if (istWasser(g, a.x + (b.x - a.x) * i / k, a.y + (b.y - a.y) * i / k)) return false;
  return true;
}

export function sozialistisch(g: Gelaende, seed: number): Epoche[] {
  const z: Z = zufallsquelle(seed);
  const s = leereStadt("sozialistisch");
  // Werk: flach, am Wasser (Kühlwasser, Schiffe), etwas abseits
  const werk = besterPunkt(g, 400, p => {
    if (!baubar(g, p, 4)) return -1e9;
    for (const q of rechteck(p, 340, 180)) if (!baubar(g, q, 6)) return -1e9;
    const dw = g.wasser.some(w => w) ? wasserAbstand(g, p.x, p.y) : 300;
    return -Math.abs(dw - 180) / 100 - neigungBei(g, p.x, p.y) + z() * 0.5;
  }) ?? { x: g.breite * 0.3, y: g.breite / 2 };
  // Stadtmitte gut 1 km entfernt auf trockenem, flachem Land
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  const c = besterPunkt(g, 500, p => {
    const d = abstand(p, werk);
    if (d < 900 || d > 1500 || !baubar(g, p, 6) || !trocken(g, p, werk)) return -1e9;
    let gut = 0;
    for (let k = 0; k < 12; k++) { const q = polar(p, (k / 12) * Math.PI * 2, 500); if (baubar(g, q, 12)) gut++; }
    return gut + eignung(g, p, "sozialistisch") - abstand(p, mitte) / 500 + z() * 0.3;
  }) ?? { x: werk.x + 1100, y: werk.y };
  const w = Math.atan2(c.y - werk.y, c.x - werk.x);
  const quer = w + Math.PI / 2;

  bau(s, "werk", werk, w + Math.PI / 2);
  s.zonen.push({ typ: "kombinat", poly: rechteck(werk, 560, 380, w + Math.PI / 2) });
  // Bahn am Werk vorbei
  const bahnRoh = [randPunkt(werk, quer + Math.PI, g.breite), randPunkt(werk, quer, g.breite)].map(p => ({ x: p.x - Math.cos(w) * 230, y: p.y - Math.sin(w) * 230 }));
  const bahn = zerschneiden(bahnRoh, g, true).sort((a, b) => b.length - a.length)[0];
  if (bahn) s.strassen.push({ art: "bahn", name: "Eisenbahn", punkte: [bahn[0], bahn[bahn.length - 1]] });
  // Magistrale vom Werktor zum zentralen Platz
  const tor = polar(werk, w, 100);
  s.strassen.push({ art: "ring", name: "Magistrale", punkte: [tor, polar(c, w + Math.PI, 80)] });
  bau(s, "aufmarschplatz", c, quer);
  bau(s, "kulturhaus", polar(c, w, 110), quer);
  // Querachse durch den Platz
  s.strassen.push({ art: "haupt", punkte: [polar(c, quer, 650), polar(c, quer + Math.PI, 650)] });
  // Wohnkomplexe I–III beiderseits der Magistrale und am Platz
  // Wohnkomplexe I–III: erst beiderseits der Magistrale, sonst am Platz
  const kandidaten: P[] = [polar(polar(c, w + Math.PI, 330), quer, 280), polar(polar(c, w + Math.PI, 330), quer, -280), polar(c, quer, 460), polar(c, quer, -460), polar(polar(c, w, 380), quer, 260), polar(polar(c, w, 380), quer, -260)];
  const wk: P[] = [];
  for (const m of kandidaten) {
    if (wk.length >= 3) break;
    if (!rechteck(m, 380, 340, w).every(q => baubar(g, q, 16)) || !baubar(g, m, 14)) continue;
    wk.push(m);
    wohnkomplex(s, m, 380, 340, w, false);
  }
  s.namen = [{ text: "Magistrale", x: (tor.x + c.x) / 2 + 12, y: (tor.y + c.y) / 2 }, { text: "Kombinat", x: werk.x - 40, y: werk.y - 110 }];
  freiraeumen(s);
  const e1: Epoche = {
    jahr: "um 1955", titel: "Erste sozialistische Stadt",
    text: "Für ein neues Hüttenwerk braucht es Tausende Arbeiter — also wird eine ganze Stadt geplant, nach den »16 Grundsätzen des Städtebaus« der DDR. Eine breite Magistrale führt vom Werktor zum zentralen Platz für Kundgebungen, dort steht das Kulturhaus als Dominante. Die ersten Wohnkomplexe im Stil der »Nationalen Tradition«: geschlossene Blöcke mit Innenhöfen, Schule, Kindergarten und Kaufhalle in jedem Komplex.",
    neu: ["Kombinat als Grund der Stadt", "Magistrale vom Werk zum Platz", "Zentraler Platz mit Kulturhaus", "Wohnkomplexe mit eigener Versorgung"],
    stadt: kopie(s),
  };

  // 1980: Plattenbau
  const platte: P[] = [];
  const orte: [number, number][] = [];
  for (const r of [850, 1050, 700]) for (let k = 0; k < 12; k++) orte.push([((k / 12) * 2 - 1) * Math.PI, r]);
  for (const [a, r] of orte) {
    if (platte.length >= 5) break;
    const m = polar(c, w + Math.PI + a, r);
    if (m.x < 250 || m.y < 250 || m.x > g.breite - 250 || m.y > g.breite - 250) continue;
    if (abstand(m, werk) < 650 || !baubar(g, m, 18) || istWasser(g, m.x, m.y)) continue;
    if (rechteck(m, 460, 360, w + a).filter(q => !baubar(g, q, 22)).length > 1) continue;
    if (platte.some(q => abstand(q, m) < 450)) continue;
    platte.push(m);
    const dm = Math.atan2(m.y - c.y, m.x - c.x);
    wohnkomplex(s, m, 460, 360, dm, true);
    s.strassen.push({ art: "haupt", punkte: weg(g, polar(m, dm + Math.PI, 190), polar(c, dm, 160), { steigung: 0.6, wasser: 30, raster: 24 }) });
  }
  bau(s, "poliklinik", polar(c, quer, -160), quer);
  freiraeumen(s);
  const e2: Epoche = {
    jahr: "um 1980", titel: "Plattenbau",
    text: "Wohnungen fehlen überall in der DDR. Das Wohnungsbauprogramm setzt auf Fertigteile: Plattenbauten (Typ WBS 70) mit 5 bis 11 Geschossen, schnell und billig gebaut, mit Fernheizung und Bad — begehrt. Die neuen Wohnkomplexe liegen weiter draußen, jeder mit Schule, Kaufhalle und Grün dazwischen.",
    neu: ["Plattenbau-Wohnkomplexe (WBS 70)", "Poliklinik", "Stadt wächst nach außen"],
    stadt: kopie(s),
  };

  // Schrumpfung nach 1990
  const aussen = platte.slice().sort((a, b) => abstand(b, c) - abstand(a, c)).slice(0, Math.max(1, Math.floor(platte.length / 2)));
  s.zonen = s.zonen.map(x => (x.typ === "platte" && aussen.some(m => abstand(m, schwerpunkt(x.poly)) < 50) ? { ...x, typ: "rueckbau" as const } : x));
  s.zonen = s.zonen.map(x => (x.typ === "kombinat" ? { ...x, poly: rechteck(werk, 300, 380, w + Math.PI / 2) } : x));
  s.zonen.push({ typ: "gewerbe", poly: rechteck(polar(werk, quer, 300), 260, 380, w + Math.PI / 2) });
  bau(s, "einkauf", polar(werk, quer, 300), w);
  const ef = [0.75, -0.75, 0.5, -0.5, 1].map(a => polar(c, w + Math.PI * a, 760)).find(q => baubar(g, q, 14) && !s.zonen.some(x => x.typ !== "rueckbau" && rechteck(q, 380, 300, w).some(e => inPoly(e, x.poly)))) ?? polar(c, w + Math.PI * 0.75, 760);
  if (baubar(g, ef, 14)) {
    s.zonen.push({ typ: "einfamilienhaus", poly: rechteck(ef, 380, 300, w) });
    s.strassen.push(...raster(g, ef.x - 160, ef.y - 120, ef.x + 160, ef.y + 120, 80, 60, ef.x, ef.y));
  }
  s.strassen = s.strassen.filter(st => !(st.art === "neben" && aussen.some(m => abstand(m, st.punkte[0]) < 320 && abstand(m, st.punkte[st.punkte.length - 1]) < 320)));
  s.bauten = s.bauten.filter(b => !((b.typ === "schule" || b.typ === "kaufhalle") && aussen.some(m => abstand(m, b) < 120)));
  freiraeumen(s);
  const e3: Epoche = {
    jahr: "um 2015", titel: "Schrumpfende Stadt",
    text: "Nach 1990 bricht die Industrie ein: Das Werk entlässt den Großteil der Belegschaft. Junge Menschen ziehen in den Westen, Geburten gehen zurück — die Einwohnerzahl halbiert sich etwa. Ganze Plattenbauviertel stehen leer und werden mit dem Programm »Stadtumbau Ost« abgerissen (Rückbau); zurück bleiben Wiesen. Die Innenstadt wird saniert, am Rand entstehen Einfamilienhäuser und ein Discounter-Gewerbegebiet.",
    neu: ["Werk verkleinert", "Rückbau leerer Plattenbauten", "Einfamilienhäuser am Rand", "Gewerbegebiet mit Einkaufszentrum", "Schrumpfung durch Abwanderung"],
    stadt: kopie(s),
  };
  return [e1, e2, e3];
}

