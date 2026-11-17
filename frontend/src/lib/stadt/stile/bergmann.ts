/**
 * Bergmannsstadt nach dem Vorbild Freiberg (1168 Silberfund, »Sächsstadt«)
 * und Annaberg (1496 planmäßig am Hang angelegt):
 *   um 1170  Berggeschrei: Schächte über dem Erzgang, wilde Siedlung am Hang
 *   um 1500  Planmäßige Bergstadt: Markt, Kirche, Bergamt, Mauer, Hütte am Bach
 *   um 1900  Bahn im Tal, der Bergbau geht zurück, Industrie zieht ins Tal
 *   heute    Halden als Welterbe (Montanregion Erzgebirge 2019), Hochschule
 */
import { neigungBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, inPoly, rechteck, type P } from "../geometrie";
import { kopie, leereStadt, type Epoche, type Stadt } from "../modell";
import { band, bau, baubar, baubarNahe, besterPunkt, fernstrasse, flussRichtung, freiraeumen, gedrehtesRaster, type Z } from "../hilfen";
import { industrialisierung, moderne } from "../moderne";
import { eignung, flussAbstand } from "../standort";
import { weg } from "../wege";

const polar = (c: P, w: number, r: number): P => ({ x: c.x + Math.cos(w) * r, y: c.y + Math.sin(w) * r });

/** unregelmäßiger Umriss um c */
function umriss(c: P, r: number, z: Z, k = 14): P[] {
  return Array.from({ length: k }, (_, i) => polar(c, (i / k) * Math.PI * 2, r * (0.75 + z() * 0.45)));
}

/** Halden zuletzt eintragen, damit kein Viertel sie überdeckt */
const haldenOben = (s: Stadt) => { s.zonen = [...s.zonen.filter(z => z.typ !== "halde"), ...s.zonen.filter(z => z.typ === "halde")]; };

/** Erzgang: geplant oder am steilen Hang nahe dem Tal */
export function erzgang(g: Gelaende, z: Z): P {
  if (g.erz) return g.erz;
  const mitte = { x: g.breite / 2, y: g.breite / 2 };
  return besterPunkt(g, 500, p => {
    const n = neigungBei(g, p.x, p.y), d = flussAbstand(g, p);
    if (!baubar(g, p, 40) || n < 6) return -1e9;
    return -Math.abs(n - 16) / 4 - (Number.isFinite(d) ? Math.abs(d - 450) / 200 : 0) - abstand(p, mitte) / 1000 + z() * 0.3;
  }) ?? mitte;
}

export function bergmann(g: Gelaende, seed: number): Epoche[] {
  const z = zufallsquelle(seed);
  const s = leereStadt("bergmann");
  const erz = erzgang(g, z);
  // Talstraße: entlang des Bachs, oder durch den Erzgang
  const wt = flussRichtung(g, erz) ?? z() * Math.PI;
  const talPunkt = g.flussLinie.length > 1 ? (() => {
    let best = erz, bd = Infinity;
    for (const p of g.flussLinie) { const d = abstand(p, erz); if (d < bd) { bd = d; best = p; } }
    // ein Stück neben dem Bach, nicht hinein
    const q = { x: best.x + (erz.x - best.x) * 0.25, y: best.y + (erz.y - best.y) * 0.25 };
    return baubarNahe(g, q, z, 200, 20) ?? q;
  })() : polar(erz, wt + Math.PI / 2, 300);
  s.strassen.push({ art: "fernstrasse", name: "Talstraße", punkte: fernstrasse(g, talPunkt, wt, 0.4, 30) });
  // Gangrichtung quer zum Hang: mehrere Schächte in einer Reihe
  const gang = wt;
  const schaechte: P[] = [];
  for (const t of [0, -1, 1, -2, 2]) {
    const p = polar(erz, gang, t * 110);
    if (baubar(g, p, 45)) { schaechte.push(p); bau(s, "schacht", p, gang); }
    if (schaechte.length >= 3) break;
  }
  if (!schaechte.length) { const p = baubarNahe(g, erz, z, 250, 60) ?? erz; schaechte.push(p); bau(s, "schacht", p, gang); }
  // Halden neben den Schächten, hangabwärts gekippt
  for (const sch of schaechte) {
    const ab = Math.atan2(talPunkt.y - sch.y, talPunkt.x - sch.x);
    s.zonen.push({ typ: "halde", poly: rechteck(polar(sch, ab + 0.6, 50), 60, 36, ab) });
  }
  // wilde Siedlung: Fußwege von jedem Schacht hinab ins Tal und zueinander
  const kosten = { steigung: 0.25, wasser: 40, raster: 16 };
  for (const sch of schaechte) s.strassen.push({ art: "gasse", punkte: weg(g, sch, talPunkt, kosten) });
  for (let i = 0; i + 1 < schaechte.length; i++) s.strassen.push({ art: "gasse", punkte: weg(g, schaechte[i], schaechte[i + 1], kosten) });
  for (let i = 0; i < 6; i++) {
    const a = polar(erz, z() * Math.PI * 2, 120 + z() * 160);
    if (baubar(g, a, 35)) s.strassen.push({ art: "gasse", punkte: weg(g, a, schaechte[Math.floor(z() * schaechte.length)] ?? erz, kosten) });
  }
  const siedlung = { x: (erz.x + talPunkt.x) / 2, y: (erz.y + talPunkt.y) / 2 };
  const rS = Math.max(220, abstand(erz, talPunkt) * 0.7);
  s.zonen.push({ typ: "bergstadt", poly: umriss(siedlung, rS, z) });
  s.namen = [{ text: "Erzgang", x: erz.x + 30, y: erz.y - 30 }];
  freiraeumen(s);
  haldenOben(s);
  const e1: Epoche = {
    jahr: "um 1170", titel: "Berggeschrei",
    text: "Fuhrleute finden Silbererz im Bachgeröll — das »Berggeschrei« lockt Bergleute aus dem Harz. Sie teufen Schächte direkt über dem Erzgang ab, egal wie steil der Hang ist. Daneben wächst der Abraum zu Halden. Die Häuser entstehen ohne Plan an den Fußwegen zwischen Schacht und Bach. Der Ort liegt dort, wo das Erz ist — nicht dort, wo es bequem wäre.",
    neu: ["Silberfund am Hang", "Schächte über dem Erzgang", "Halden aus Abraum", "Wilde Bergmannssiedlung an Fußwegen"],
    stadt: kopie(s),
  };

  // Planmäßige Bergstadt (Annaberg 1496): Markt auf der flachsten Stelle nahe dem Gang
  const markt = besterPunkt(g, 300, p => {
    const d = abstand(p, erz);
    if (d < 180 || d > 650 || !baubar(g, p, 10)) return -1e9;
    return eignung(g, p, "bergmann") - neigungBei(g, p.x, p.y) * 0.3 - d / 400 + z() * 0.2;
  }) ?? siedlung;
  const dreh = Math.atan2(erz.y - markt.y, erz.x - markt.x);
  const R = 230;
  bau(s, "markt", markt, dreh);
  bau(s, "kirche", baubarNahe(g, polar(markt, dreh + Math.PI / 2, 95), z, 80, 14), dreh);
  bau(s, "rathaus", polar(markt, dreh - Math.PI / 2, 60), dreh);
  bau(s, "bergamt", baubarNahe(g, polar(markt, dreh, 90), z, 60, 16), dreh);
  // Raster am Hang: wie in Annaberg, die Straßen laufen trotz Gefälle gerade
  const mauer = umriss(markt, R * 1.12, z, 16);
  s.strassen.push(...gedrehtesRaster(g, markt, 2 * R, 2 * R, 70, 55, dreh, "neben", p => inPoly(p, mauer)));
  s.mauern.push(mauer);
  s.zonen.push({ typ: "altstadt", poly: mauer });
  // Hütte unten am Bach (Wasserrad für Blasebalg und Pochwerk)
  const huette = besterPunkt(g, 200, p => {
    const d = flussAbstand(g, p);
    if (!baubar(g, p, 8) || abstand(p, markt) < R + 80) return -1e9;
    return -(Number.isFinite(d) ? Math.abs(d - 50) / 20 : 0) - abstand(p, markt) / 300;
  });
  if (huette) {
    bau(s, "huettenwerk", huette, wt);
    s.zonen.push({ typ: "huette", poly: rechteck(huette, 220, 120, wt) });
    s.strassen.push({ art: "haupt", punkte: weg(g, huette, markt, { steigung: 0.4, wasser: 30, raster: 20 }) });
  }
  s.strassen.push({ art: "haupt", name: "Bergstraße", punkte: weg(g, markt, erz, { steigung: 0.2, wasser: 40, raster: 16 }) });
  freiraeumen(s);
  haldenOben(s);
  const e2: Epoche = {
    jahr: "um 1500", titel: "Planmäßige Bergstadt",
    text: "Der Landesherr verdient am Silber mit (»Bergregal«) und lässt eine Stadt nach Plan anlegen: großer Markt auf der flachsten Stelle, gerades Straßenraster — auch wenn es dafür den Hang hinaufgeht —, eine riesige Hallenkirche und das Bergamt, das den Bergbau verwaltet. Unten am Bach treibt Wasserkraft die Blasebälge der Schmelzhütte und die Pochwerke, die das Erz zerkleinern.",
    neu: ["Markt, Hallenkirche, Bergamt", "Straßenraster trotz Hang", "Stadtmauer", "Schmelzhütte mit Wasserrad am Bach"],
    stadt: kopie(s),
  };

  // Industrialisierung: Bahn im Tal, Bergbau lohnt kaum noch
  industrialisierung(g, s, mauer, markt, z, false);
  for (const sch of schaechte.slice(1)) s.bauten = s.bauten.filter(b => !(b.typ === "schacht" && abstand(b, sch) < 1));
  if (huette) s.zonen = s.zonen.map(x => (x.typ === "huette" ? { ...x, typ: "industrie" as const } : x));
  freiraeumen(s);
  haldenOben(s);
  const e3: Epoche = {
    jahr: "um 1900", titel: "Bahn im Tal, Silber am Ende",
    text: "Silber aus Amerika ist billiger, viele Gruben schließen (Freiberg 1913). Die Eisenbahn kommt — aber nur durchs Tal, denn Züge schaffen kaum Steigung. Bahnhof und neue Fabriken liegen deshalb unten, die alte Bergstadt bleibt oben am Hang. Aus den Hütten werden Metallwerke.",
    neu: ["Bahn und Bahnhof im Tal", "Viele Schächte stillgelegt", "Hütte wird Metallindustrie"],
    stadt: kopie(s),
  };

  moderne(g, s, mauer, markt, z);
  s.zonen = s.zonen.map(x => (x.typ === "halde" ? { ...x, typ: "park" as const } : x));
  const uni = baubarNahe(g, polar(markt, dreh + Math.PI, R + 220), z, 250, 10);
  if (uni) { bau(s, "universitaet", uni, dreh); s.zonen.push({ typ: "uni", poly: rechteck(uni, 260, 200, dreh) }); }
  s.zonen.push({ typ: "park", poly: band([polar(erz, gang, -200), polar(erz, gang, 200)], 60) });
  freiraeumen(s);
  const e4: Epoche = {
    jahr: "heute", titel: "Welterbe und Hochschule",
    text: "Die Halden sind begrünt und gehören seit 2019 zum UNESCO-Welterbe »Montanregion Erzgebirge«. Aus der Bergschule wurde eine Hochschule für Rohstoffe (TU Bergakademie Freiberg). Am Rand stehen Plattenbauten und Einfamilienhäuser; die Altstadt am Hang ist schwer mit Bus und Auto zu erreichen.",
    neu: ["Halden als Welterbe", "Hochschule", "Neubaugebiete am Rand"],
    stadt: kopie(s),
  };
  return [e1, e2, e3, e4];
}
