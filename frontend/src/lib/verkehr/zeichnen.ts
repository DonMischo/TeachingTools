/**
 * Zeichnet die Stadt mit Pixi — alles in Metern, die Kamera skaliert.
 * Draufsicht wie im ersten GTA: Dächer mit Schlagschatten, graue Fahrbahnen,
 * helle Gehwege, rote Radwege.
 */
import { Container, Graphics, Text, Texture, TilingSprite } from "pixi.js";
import type { P } from "./geometrie";
import { bahnsteigUm, bereichVon, schulMitte, spurLagen, winkelVon, type Stadt } from "./stadt";
import type { Aussehen } from "./aussehen";
import type { SchildArt } from "./schilder";

export const FARBE = {
  boden: 0x5f7a45,
  gehweg: 0xb9b4a8,
  bordstein: 0x8f8a80,
  fahrbahn: 0x4a4a4f,
  spielstrasse: 0x7d7468,
  markierung: 0xf2f2f2,
  /** Radwege orange-rot wie der Belag in Erfurt; der gemeinsame Geh- und Radweg etwas blasser. */
  radweg: 0xe0552b,
  gehRad: 0xeb9a78,
  fussweg: 0xcdc6b4,
  gleisbett: 0x8a7f70,
  schiene: 0x3a3a3a,
  schwelle: 0x5e4a36,
  schatten: 0x000000,
  baumkrone: 0x2f5a2a,
  baumlicht: 0x44793a,
} as const;

const FLAECHE: Record<string, number> = {
  parkplatz: 0x77767a, schulhof: 0xb3a384, sportplatz: 0x4d8a3b, spielplatz: 0xc9b27a,
  gruen: 0x5a8d44, garten: 0x6b9848, gehoelz: 0x3d6934, gleisbett: 0x8a7f70,
  wasser: 0x3d6fa0, bahnsteig: 0xa9a9a2,
};

const DACH: Record<string, number> = {
  apartments: 0x9a8a80, retail: 0x7a8b9a, commercial: 0x7a8b9a, supermarket: 0x7a8b9a,
  school: 0xa0785a, kindergarten: 0xb08a5a, garages: 0x8d8d8d, industrial: 0x8a8578,
  warehouse: 0x8a8578, allotment_house: 0x8a6a4a, roof: 0x9e9e9e,
};

function linie(g: Graphics, punkte: P[]) {
  g.moveTo(punkte[0][0], punkte[0][1]);
  for (let i = 1; i < punkte.length; i++) g.lineTo(punkte[i][0], punkte[i][1]);
}

function flach(punkte: P[]): number[] {
  return punkte.flat();
}

/** Gestrichelte Linie in Metern. */
function strichel(g: Graphics, punkte: P[], strich: number, luecke: number) {
  let rest = 0, zeichnen = true;
  for (let i = 0; i + 1 < punkte.length; i++) {
    const [ax, ay] = punkte[i], [bx, by] = punkte[i + 1];
    const l = Math.hypot(bx - ax, by - ay);
    let s = 0;
    while (s < l) {
      const stueck = Math.min((zeichnen ? strich : luecke) - rest, l - s);
      if (zeichnen) {
        g.moveTo(ax + ((bx - ax) * s) / l, ay + ((by - ay) * s) / l);
        g.lineTo(ax + ((bx - ax) * (s + stueck)) / l, ay + ((by - ay) * (s + stueck)) / l);
      }
      s += stueck;
      rest += stueck;
      if (rest >= (zeichnen ? strich : luecke) - 1e-6) { rest = 0; zeichnen = !zeichnen; }
    }
  }
}

export type Ebenen = { boden: Container; oben: Container; haltZeichen: Container };

/**
 * Baut die feste Karte. `boden` liegt unter den Figuren, `oben` (Baumkronen,
 * Beschriftung) darüber.
 */
export function zeichneStadt(stadt: Stadt): Ebenen {
  const { karte } = stadt;
  const boden = new Container();
  const oben = new Container();

  const b = bereichVon(karte);
  const rasen = new TilingSprite({ texture: rasenTextur(), width: b.x1 - b.x0 + 80, height: b.y1 - b.y0 + 80 });
  rasen.position.set(b.x0 - 40, b.y0 - 40);
  // Die Kachel ist 128 px groß und soll 12 m decken.
  rasen.tileScale.set(12 / 128);
  boden.addChild(rasen);
  const grund = new Graphics();
  for (const f of karte.flaechen) {
    const farbe = FLAECHE[f.art];
    if (farbe !== undefined && f.umriss.length >= 3) grund.poly(flach(f.umriss)).fill(farbe);
  }
  boden.addChild(grund);

  // Gleisbett und Schienen
  const gleise = new Graphics();
  for (const gl of karte.gleise) { linie(gleise, gl.linie); gleise.stroke({ width: 3, color: FARBE.gleisbett, cap: "round", join: "round" }); }
  for (const gl of karte.gleise) {
    strichel(gleise, gl.linie, 0.25, 0.45);
    gleise.stroke({ width: 2.4, color: FARBE.schwelle });
    for (const seite of [-0.72, 0.72]) {
      linie(gleise, versetzt(gl.linie, seite));
      gleise.stroke({ width: 0.12, color: FARBE.schiene, join: "round" });
    }
  }
  boden.addChild(gleise);

  // Gehwege als breiter Streifen unter der Fahrbahn, Bordstein als Kante
  const strassen = new Graphics();
  for (const s of stadt.strassen) if (s.gehwegBreite) { linie(strassen, s.linie); strassen.stroke({ width: s.breite + 2 * s.gehwegBreite + 0.3, color: FARBE.bordstein, cap: "round", join: "round" }); }
  for (const s of stadt.strassen) if (s.gehwegBreite) { linie(strassen, s.linie); strassen.stroke({ width: s.breite + 2 * s.gehwegBreite, color: FARBE.gehweg, cap: "round", join: "round" }); }
  for (const w of karte.wege) {
    const breite = w.art === "geh_rad_getrennt" ? 3.4 : w.art === "rad" || w.art === "geh_rad" ? 2.5 : w.art === "feldweg" ? 2.5 : 2;
    const farbe = w.art === "rad" ? FARBE.radweg : w.art === "geh_rad" ? FARBE.gehRad : FARBE.fussweg;
    linie(strassen, w.linie);
    strassen.stroke({ width: breite, color: farbe, cap: "round", join: "round" });
    // Getrennter Geh- und Radweg: zur Fahrbahn hin die orange-rote Radhälfte, ein weißer Strich dazwischen
    if (w.art === "geh_rad_getrennt") {
      const rad = versetzt(w.linie, 0.85 * stadt.radSeite(w.linie));
      linie(strassen, rad);
      strassen.stroke({ width: 1.7, color: FARBE.radweg, cap: "round", join: "round" });
      linie(strassen, w.linie);
      strassen.stroke({ width: 0.15, color: FARBE.markierung });
      radSymbole(strassen, rad);
    }
    if (w.art === "rad") radSymbole(strassen, w.linie);
  }
  for (const s of stadt.strassen) if (s.gehwegBreite) { linie(strassen, s.linie); strassen.stroke({ width: s.breite + 0.3, color: FARBE.bordstein, cap: "round", join: "round" }); }
  // Schmale Straßen zuerst, damit Hauptstraßen an Kreuzungen oben liegen.
  for (const s of [...stadt.strassen].sort((a, b) => a.breite - b.breite)) {
    linie(strassen, s.linie);
    strassen.stroke({ width: s.breite, color: s.art === "living_street" ? FARBE.spielstrasse : FARBE.fahrbahn, cap: "round", join: "round" });
  }
  // Leitlinie zwischen den Richtungen (auf breiten Straßen) und zwischen den Spuren einer Richtung
  for (const s of stadt.strassen) {
    const hin = spurLagen(s, true);
    const linien: number[] = [];
    if (s.einbahn) for (let i = 1; i < hin.lagen.length; i++) linien.push(hin.mitte + hin.breite * i);
    else {
      const rueck = spurLagen(s, false);
      if (s.breite >= 6.5) linien.push(hin.mitte);
      for (let i = 1; i < hin.lagen.length; i++) linien.push(hin.mitte + hin.breite * i);
      for (let i = 1; i < rueck.lagen.length; i++) linien.push(hin.mitte - rueck.breite * i);
    }
    for (const d of linien) strichel(strassen, d === 0 ? s.linie : versetzt(s.linie, d), 3, 6);
  }
  strassen.stroke({ width: 0.15, color: FARBE.markierung });
  // Randlinien und Rinnstein auf Durchgangsstraßen
  for (const s of stadt.strassen) {
    if (s.art !== "secondary" && s.art !== "tertiary" && s.art !== "primary") continue;
    for (const seite of [-1, 1]) {
      linie(strassen, versetzt(s.linie, seite * (s.breite / 2 - 0.35)));
      strassen.stroke({ width: 0.12, color: FARBE.markierung, alpha: 0.8, join: "round" });
      linie(strassen, versetzt(s.linie, seite * (s.breite / 2 - 0.1)));
      strassen.stroke({ width: 0.2, color: 0x3a3a3e, join: "round" });
    }
  }
  boden.addChild(strassen);

  // Einfahrt auf dem Schulgelände: Pflaster statt Asphalt — hier fahren keine Autos.
  const schulPflaster = new Graphics();
  for (const z of stadt.schulZufahrten) {
    schulPflaster.moveTo(z.a[0], z.a[1]).lineTo(z.b[0], z.b[1]).stroke({ width: z.breite + 0.2, color: 0xc9b99a, cap: "round" });
  }
  boden.addChild(schulPflaster);

  // Übergänge: Zebrastreifen und Fußgängerfurten an Ampeln
  const querungen = new Graphics();
  for (const p of karte.punkte) {
    if (p.art !== "zebra" && p.art !== "ampelUebergang") continue;
    const n = stadt.naechsteStrasse(p.p[0], p.p[1], 6);
    if (!n) continue;
    const w = winkelVon(n.st), c = Math.cos(w), s = Math.sin(w);
    const halb = n.s.breite / 2;
    // Quer zur Straße laufen: Achse q = (-s, c); längs l = (c, s).
    const punkt = (l: number, q: number): P => [p.p[0] + c * l - s * q, p.p[1] + s * l + c * q];
    if (p.art === "zebra") {
      for (let q = -halb + 0.25; q <= halb - 0.25; q += 1) {
        const a = punkt(-2, q), b = punkt(2, q), d = punkt(2, q + 0.5), e = punkt(-2, q + 0.5);
        querungen.poly([...a, ...b, ...d, ...e]).fill(FARBE.markierung);
      }
    } else {
      for (const l of [-2, 2]) {
        strichel(querungen, [punkt(l, -halb), punkt(l, halb)], 0.5, 0.4);
        querungen.stroke({ width: 0.3, color: FARBE.markierung });
      }
    }
  }
  boden.addChild(querungen);

  // Warteflächen an den Bushaltestellen, mit Bordstein
  const warten = new Graphics();
  for (const w of stadt.wartebereiche) warten.poly(flach(w)).fill(FARBE.gehweg).stroke({ width: 0.2, color: FARBE.bordstein });
  boden.addChild(warten);

  // Bahnsteige der ausgedachten Halte (die echten kommen als Fläche)
  const steige = new Graphics();
  for (const h of stadt.halte) if (h.fiktiv) {
    const umriss = bahnsteigUm(h);
    steige.poly(flach(umriss)).fill(FLAECHE.bahnsteig);
    // Weiße Linie 0,8 m hinter der Bahnsteigkante
    const [a, b, , d] = umriss;
    const nx = (d[0] - a[0]) / 3, ny = (d[1] - a[1]) / 3;
    steige.moveTo(a[0] + nx * 0.8, a[1] + ny * 0.8).lineTo(b[0] + nx * 0.8, b[1] + ny * 0.8).stroke({ width: 0.15, color: 0xffffff });
    // Kante mit Noppen-Streifen
    steige.moveTo(a[0] + nx * 0.2, a[1] + ny * 0.2).lineTo(b[0] + nx * 0.2, b[1] + ny * 0.2).stroke({ width: 0.3, color: 0xd9d9d0 });
  }
  boden.addChild(steige);

  // Schultore: zwei Pfosten, dazwischen ein Gittertor
  const tore = new Graphics();
  // Nur an unserer Schule wissen wir von einem Tor.
  const [smx, smy] = schulMitte(stadt);
  for (const t of stadt.tore.filter((t) => Math.hypot(t.p[0] - smx, t.p[1] - smy) < 200)) {
    const c = Math.cos(t.winkel + Math.PI / 2), sn = Math.sin(t.winkel + Math.PI / 2), h = 2.3;
    const a: P = [t.p[0] - c * h, t.p[1] - sn * h], b: P = [t.p[0] + c * h, t.p[1] + sn * h];
    tore.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 0.25, color: 0x4b5563 });
    for (let i = 1; i < 8; i++) {
      const f = i / 8;
      tore.circle(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.07).fill(0x9ca3af);
    }
    tore.circle(a[0], a[1], 0.25).fill(0x374151).circle(b[0], b[1], 0.25).fill(0x374151);
  }
  boden.addChild(tore);

  // Häuser: Schlagschatten, dann Dach
  const haeuser = new Graphics();
  const hoehe = (h: (typeof karte.gebaeude)[number]) => (h.etagen ?? (h.art === "apartments" ? 4 : h.art === "garages" ? 1 : 2)) * 0.7;
  for (const h of karte.gebaeude) if (h.umriss.length >= 3) {
    const d = hoehe(h);
    haeuser.poly(flach(h.umriss.map(([x, y]) => [x + d, y + d] as P))).fill({ color: FARBE.schatten, alpha: 0.33 });
  }
  for (const h of karte.gebaeude) {
    if (h.umriss.length < 3) continue;
    const farbe = DACH[h.art ?? ""] ?? 0x8e6e5e;
    haeuser.poly(flach(h.umriss)).fill(farbe).stroke({ width: 0.3, color: dunkler(farbe), join: "round" });
    // Dachfläche: etwas hellerer Kern, als läge dort der First im Licht
    const mx = h.umriss.reduce((a, p) => a + p[0], 0) / h.umriss.length, my = h.umriss.reduce((a, p) => a + p[1], 0) / h.umriss.length;
    haeuser.poly(flach(h.umriss.map(([x, y]) => [mx + (x - mx) * 0.72, my + (y - my) * 0.72] as P))).fill({ color: heller(farbe), alpha: 0.35 });
  }
  boden.addChild(haeuser);

  // Unsere Turnhalle: weißes Metalldach mit einem Streifen Gründach zum Schulhof (nach Süden).
  const halle = turnhalle(stadt);
  if (halle) {
    const g = new Graphics();
    g.poly(flach(halle.umriss)).fill(0xe8ebee).stroke({ width: 0.3, color: 0x9aa3ab, join: "round" });
    const { x0, x1, y0, y1 } = halle.box;
    // Gründach: Streifen an der Kante, die zur Schulmitte zeigt
    const u = halle.umriss, [smx2, smy2] = schulMitte(stadt);
    let beste = 0, bd = Infinity;
    for (let i = 0; i < u.length; i++) {
      const a = u[i], b = u[(i + 1) % u.length];
      const d = Math.hypot((a[0] + b[0]) / 2 - smx2, (a[1] + b[1]) / 2 - smy2);
      if (d < bd) { bd = d; beste = i; }
    }
    const a = u[beste], b = u[(beste + 1) % u.length];
    const mx2 = u.reduce((s, p) => s + p[0], 0) / u.length, my2 = u.reduce((s, p) => s + p[1], 0) / u.length;
    const nach = (p: P): P => { const l = Math.hypot(mx2 - p[0], my2 - p[1]) || 1; return [p[0] + (mx2 - p[0]) / l * 5, p[1] + (my2 - p[1]) / l * 5]; };
    // Blechfalze längs der Halle
    for (let f = 0.08; f < 0.95; f += 0.06) {
      const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] as P;
      const q = [u[(beste + 3) % 4][0] + (u[(beste + 2) % 4][0] - u[(beste + 3) % 4][0]) * f, u[(beste + 3) % 4][1] + (u[(beste + 2) % 4][1] - u[(beste + 3) % 4][1]) * f] as P;
      g.moveTo(p[0], p[1]).lineTo(q[0], q[1]).stroke({ width: 0.08, color: 0xc5ccd3 });
    }
    g.poly([...a, ...b, ...nach(b), ...nach(a)]).fill(0x6b9a3f);
    boden.addChild(g);
    const t = beschriftung("Turnhalle", 0x334155, 1.8);
    t.style.stroke = { color: 0xffffff, width: 8 };
    t.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 2);
    boden.addChild(t);
  }

  // Fahrradständer (aus OSM): drei Bügel nebeneinander
  const staender = new Graphics();
  for (const p of karte.punkte) if (p.art === "radstaender") {
    for (let i = -1; i <= 1; i++) staender.roundRect(p.p[0] + i * 0.8 - 0.05, p.p[1] - 0.45, 0.1, 0.9, 0.05).fill(0x9ca3af).stroke({ width: 0.03, color: 0x4b5563 });
    staender.roundRect(p.p[0] - 1.2, p.p[1] - 0.6, 2.4, 1.2, 0.2).stroke({ width: 0.06, color: 0x60a5fa, alpha: 0.7 });
  }
  boden.addChild(staender);

  // Haltestellenschilder: auf den Gehweg gerückt (der Bus hält am Bordstein und würde sie verdecken)
  // und über den Fahrzeugen gezeichnet
  const haltZeichen = new Container();
  const schilder = new Graphics();
  haltZeichen.addChild(schilder);
  for (const h of stadt.halte) {
    const [x, y] = haltAufGehweg(stadt, h.p);
    schilder.circle(x, y, 0.55).fill(0xf4c430).stroke({ width: 0.12, color: 0x1f7a3a });
    const t = beschriftung("H", 0x1f7a3a, 1);
    t.position.set(x, y);
    haltZeichen.addChild(t);
  }

  // Bäume über allem am Boden
  const baeume = new Graphics();
  for (const p of karte.punkte) if (p.art === "baum") {
    const r = 1.9 + (Math.abs(Math.sin(p.p[0] * 12.9898 + p.p[1] * 78.233)) * 1.2);
    baeume.circle(p.p[0] + 1, p.p[1] + 1, r).fill({ color: FARBE.schatten, alpha: 0.3 });
    baeume.circle(p.p[0], p.p[1], r).fill(FARBE.baumkrone);
    baeume.circle(p.p[0] + r * 0.3, p.p[1] - r * 0.2, r * 0.55).fill({ color: 0x3a6b31, alpha: 0.9 });
    baeume.circle(p.p[0] - r * 0.3, p.p[1] - r * 0.3, r * 0.45).fill(FARBE.baumlicht);
  }
  oben.addChild(baeume);

  // Spielplätze: Rutsche, Schaukel, Sand
  for (const f of karte.flaechen) {
    if (f.art !== "spielplatz" || f.umriss.length < 3) continue;
    const mx = f.umriss.reduce((a, p) => a + p[0], 0) / f.umriss.length, my = f.umriss.reduce((a, p) => a + p[1], 0) / f.umriss.length;
    const zeug = ["🛝", "⛱️", "🪀"];
    zeug.forEach((z, i) => {
      const t = new Text({ text: z, style: { fontSize: 48 } });
      t.anchor.set(0.5);
      t.scale.set(3.2 / 48);
      t.position.set(mx + (i - 1) * 6, my + (i % 2) * 3);
      oben.addChild(t);
    });
  }

  // Namen der Läden und Haltestellen
  for (const p of karte.punkte) {
    if (p.art !== "ort" || !p.name) continue;
    const gross = p.shop === "supermarket";
    const t = beschriftung(p.name, gross ? 0xffe14d : 0xffffff, gross ? 2.4 : 1.2);
    t.position.set(p.p[0], p.p[1]);
    oben.addChild(t);
  }
  for (const h of stadt.halte) {
    const t = beschriftung(h.name, 0xffffff, 1.1);
    t.position.set(h.p[0], h.p[1] - 1.6);
    oben.addChild(t);
  }
  return { boden, oben, haltZeichen };
}

/** Der Punkt einer Haltestelle, mindestens 1,8 m vom Fahrbahnrand weg. */
function haltAufGehweg(stadt: Stadt, p: P): P {
  const n = stadt.naechsteStrasse(p[0], p[1], 15);
  if (!n || n.s.art === "service") return p;
  const q: P = [n.st.a[0] + (n.st.b[0] - n.st.a[0]) * n.t, n.st.a[1] + (n.st.b[1] - n.st.a[1]) * n.t];
  const dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1;
  const soll = n.s.breite / 2 + 1.8;
  return d >= soll ? p : [q[0] + (dx / d) * soll, q[1] + (dy / d) * soll];
}

/** Text in Metern: gerendert groß, dann verkleinert, damit er scharf bleibt. */
export function beschriftung(text: string, farbe: number, hoeheM: number): Text {
  const t = new Text({
    text,
    style: { fontFamily: "Arial", fontWeight: "bold", fontSize: 48, fill: farbe, stroke: { color: 0x000000, width: 8 } },
  });
  t.anchor.set(0.5);
  t.scale.set(hoeheM / 48);
  return t;
}

/**
 * Die Turnhalle der Schule: das große rechteckige Gebäude im Westen des
 * Geländes (in OSM als building=school ohne Namen). Weißes Metalldach, zur
 * Hofseite (Osten, zur Schule hin) ein Streifen Gründach.
 */
export function turnhalle(stadt: Stadt): { umriss: P[]; box: { x0: number; x1: number; y0: number; y1: number } } | null {
  const [mx, my] = schulMitte(stadt);
  let best: { umriss: P[]; flaeche: number } | null = null;
  for (const g of stadt.karte.gebaeude) {
    if (g.art !== "school" || g.umriss.length < 3) continue;
    const xs = g.umriss.map((p) => p[0]), ys = g.umriss.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    // ein großes Rechteck westlich der Schulmitte
    if (g.umriss.length !== 4 || cx > mx - 10 || Math.hypot(cx - mx, cy - my) > 80) continue;
    const flaeche = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (!best || flaeche > best.flaeche) best = { umriss: g.umriss, flaeche };
  }
  if (!best) return null;
  const xs = best.umriss.map((p) => p[0]), ys = best.umriss.map((p) => p[1]);
  return { umriss: best.umriss, box: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } };
}

/** Gras mit Flecken und Halmen — eine kleine Kachel, im Browser gemalt. */
function rasenTextur(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5f7a45";
  g.fillRect(0, 0, 128, 128);
  let z = 7;
  const zufall = () => ((z = (z * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = zufall() < 0.5 ? "rgba(80,110,55,0.5)" : "rgba(110,140,70,0.35)";
    const x = zufall() * 128, y = zufall() * 128, r = 4 + zufall() * 12;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    // an den Rändern doppelt, damit die Kachel nahtlos ist
    g.beginPath(); g.arc(x - 128, y, r, 0, Math.PI * 2); g.arc(x, y - 128, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 500; i++) {
    g.fillStyle = zufall() < 0.5 ? "rgba(140,170,90,0.4)" : "rgba(60,85,40,0.4)";
    g.fillRect(zufall() * 128, zufall() * 128, 1, 2);
  }
  return Texture.from(c);
}

function heller(farbe: number): number {
  const r = (farbe >> 16) & 255, g = (farbe >> 8) & 255, b = farbe & 255;
  const h = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.35));
  return (h(r) << 16) | (h(g) << 8) | h(b);
}

function dunkler(farbe: number): number {
  const r = (farbe >> 16) & 255, g = (farbe >> 8) & 255, b = farbe & 255;
  return ((r * 0.6) << 16) | ((g * 0.6) << 8) | (b * 0.6);
}

/** Weiße Fahrrad-Piktogramme auf dem Belag, etwa alle 30 m. */
function radSymbole(g: Graphics, punkte: P[]) {
  let bis = 8;
  for (let i = 0; i + 1 < punkte.length; i++) {
    const [a, b] = [punkte[i], punkte[i + 1]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const c = (b[0] - a[0]) / l, s = (b[1] - a[1]) / l;
    for (; bis < l; bis += 30) {
      const x = a[0] + c * bis, y = a[1] + s * bis;
      // Zwei Räder längs des Weges
      const p = (u: number, v: number): [number, number] => [x + c * u - s * v, y + s * u + c * v];
      g.circle(...p(-0.42, 0), 0.26).circle(...p(0.42, 0), 0.26).stroke({ width: 0.07, color: FARBE.markierung });
      // Seitenansicht wie auf der Straße: Hinterrad – Tretlager – Sattel, Oberrohr zum Lenker, Gabel
      g.moveTo(...p(-0.42, 0)).lineTo(...p(0, 0)).lineTo(...p(-0.12, -0.38)).lineTo(...p(-0.42, 0)).stroke({ width: 0.07, color: FARBE.markierung });
      g.moveTo(...p(-0.12, -0.38)).lineTo(...p(0.3, -0.38)).lineTo(...p(0, 0)).stroke({ width: 0.07, color: FARBE.markierung });
      g.moveTo(...p(0.26, -0.5)).lineTo(...p(0.42, 0)).stroke({ width: 0.07, color: FARBE.markierung });
      g.moveTo(...p(-0.24, -0.44)).lineTo(...p(0, -0.44)).stroke({ width: 0.09, color: FARBE.markierung });
    }
    bis -= l;
  }
}

/** Linie seitlich versetzt (für Schienenpaare). */
function versetzt(punkte: P[], ab: number): P[] {
  return punkte.map((p, i) => {
    const a = punkte[Math.max(0, i - 1)], b = punkte[Math.min(punkte.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / l) * ab, p[1] + ((b[0] - a[0]) / l) * ab];
  });
}

/** Eine Figur von oben: Schultern, Arme, Kopf. Blickrichtung nach +x. Der Kopf dreht sich eigens (Umschauen). */
export function zeichneFigur(farbe: number): Container & { kopf: Container } {
  const c = new Container() as Container & { kopf: Container };
  const g = new Graphics();
  g.ellipse(0.12, 0.12, 0.32, 0.38).fill({ color: FARBE.schatten, alpha: 0.3 });
  g.ellipse(0, 0, 0.2, 0.34).fill(farbe).stroke({ width: 0.04, color: dunkler(farbe) });
  const kopf = new Container();
  const k = new Graphics();
  k.circle(0.02, 0, 0.15).fill(0x5a3a22);
  k.circle(0.08, 0, 0.1).fill(0xe8b98f);
  kopf.addChild(k);
  c.addChild(g, kopf);
  c.kopf = kopf;
  return c;
}

/** Die Spielfigur mit Aussehen: Oberteil, Mütze, Rucksack, Handy. `stelle` ändert es ohne Neubau. */
export type SpielerFigur = Container & {
  kopf: Container; ranzen: Graphics; handy: Graphics;
  stelle: (a: Aussehen) => void;
};

export function zeichneSpieler(a: Aussehen): SpielerFigur {
  const c = new Container() as SpielerFigur;
  const schatten = new Graphics().ellipse(0.12, 0.12, 0.32, 0.38).fill({ color: FARBE.schatten, alpha: 0.3 });
  const ranzen = new Graphics();
  const koerper = new Graphics();
  const handy = new Graphics();
  handy.visible = false;
  const kopf = new Container();
  const k = new Graphics().circle(0.02, 0, 0.15).fill(0x5a3a22).circle(0.08, 0, 0.1).fill(0xe8b98f);
  const muetze = new Graphics();
  kopf.addChild(k, muetze);
  c.addChild(schatten, ranzen, koerper, handy, kopf);
  Object.assign(c, { kopf, ranzen, handy });
  c.stelle = (x: Aussehen) => {
    const f = x.shirtFarbe, d = dunkler(f);
    koerper.clear().ellipse(0, 0, 0.2, 0.34).fill(f).stroke({ width: 0.04, color: d });
    if (x.shirt === "hoodie") {
      // Kapuze hinter dem Kopf, Kordeln vorn
      koerper.ellipse(-0.1, 0, 0.13, 0.17).fill(d);
      koerper.moveTo(0.14, -0.06).lineTo(0.2, -0.05).moveTo(0.14, 0.06).lineTo(0.2, 0.05).stroke({ width: 0.02, color: 0xffffff });
    } else if (x.shirt === "jacke") {
      // Reißverschluss und Kragen
      koerper.moveTo(0.02, 0).lineTo(0.2, 0).stroke({ width: 0.025, color: 0xdddddd });
      koerper.ellipse(0.02, -0.13, 0.07, 0.05).fill(d).ellipse(0.02, 0.13, 0.07, 0.05).fill(d);
    } else if (x.shirt === "trikot") {
      // Zwei helle Streifen über die Schultern
      koerper.rect(-0.15, -0.24, 0.3, 0.05).fill(0xffffff).rect(-0.15, 0.19, 0.3, 0.05).fill(0xffffff);
    }
    ranzen.clear().roundRect(-0.36, -0.18, 0.16, 0.36, 0.05).fill(x.rucksackFarbe).stroke({ width: 0.03, color: dunkler(x.rucksackFarbe) });
    const m = x.muetzeFarbe, md = dunkler(m);
    muetze.clear();
    if (x.muetze === "cap") muetze.circle(0, 0, 0.15).fill(m).roundRect(0.08, -0.12, 0.18, 0.24, 0.1).fill(md);
    else if (x.muetze === "beanie") muetze.circle(0, 0, 0.16).fill(m).circle(0, 0, 0.1).stroke({ width: 0.02, color: md }).circle(-0.02, 0, 0.05).fill(0xffffff);
    else if (x.muetze === "hut") muetze.circle(0, 0, 0.3).fill({ color: m, alpha: 0.95 }).stroke({ width: 0.02, color: md }).circle(0, 0, 0.15).fill(md);
    else if (x.muetze === "helm") muetze.ellipse(0, 0, 0.2, 0.17).fill(m).stroke({ width: 0.03, color: md })
      .moveTo(-0.15, 0).lineTo(0.15, 0).stroke({ width: 0.03, color: 0xffffff }).rect(-0.08, -0.12, 0.05, 0.05).fill(md).rect(-0.08, 0.07, 0.05, 0.05).fill(md);
    // Handy in der Hand: Apple silbern, Android dunkel mit grünem Punkt
    handy.clear().roundRect(0.16, 0.2, 0.1, 0.16, 0.025).fill(x.handy === "apple" ? 0xd4d4d8 : 0x262626)
      .roundRect(0.175, 0.215, 0.07, 0.13, 0.015).fill(x.handy === "apple" ? 0x1e293b : 0x14532d);
    if (x.handy === "android") handy.circle(0.21, 0.33, 0.012).fill(0x4ade80);
  };
  c.stelle(a);
  return c;
}

/** Kopfdrehung beim Umschauen: links – rechts – links über `dauer` Sekunden. */
export function kopfWinkel(alter: number, dauer: number): number {
  if (alter < 0 || alter >= dauer) return 0;
  const phase = alter / dauer;
  return Math.sin(phase * Math.PI * 3) * -1.2;
}

/** Ein Auto oder Bus von oben, Front nach +x. */
export function zeichneFahrzeug(art: "auto" | "bus" | "tram" | "zug", farbe: number, laenge: number, breite: number): Container {
  const c = new Container();
  const g = new Graphics();
  const l = laenge / 2, b = breite / 2;
  g.roundRect(-l + 0.3, -b + 0.3, laenge, breite, 0.4).fill({ color: FARBE.schatten, alpha: 0.35 });
  g.roundRect(-l, -b, laenge, breite, art === "auto" ? 0.5 : 0.3).fill(farbe).stroke({ width: 0.06, color: dunkler(farbe) });
  if (art === "auto") {
    g.roundRect(l - 1.7, -b + 0.2, 0.7, breite - 0.4, 0.15).fill(0x1d2a38); // Frontscheibe
    g.roundRect(-l + 0.35, -b + 0.25, 0.5, breite - 0.5, 0.15).fill(0x1d2a38); // Heckscheibe
    g.roundRect(-l + 0.9, -b + 0.2, laenge - 2.7, breite - 0.4, 0.3).fill(dunkler(farbe));
  } else {
    g.rect(l - 0.6, -b + 0.15, 0.4, breite - 0.3).fill(0x1d2a38);
    for (let x = -l + 1; x < l - 1.5; x += 2) g.rect(x, -b + 0.35, 1.2, breite - 0.7).fill(dunkler(farbe));
  }
  g.circle(l - 0.1, -b + 0.3, 0.15).fill(0xfff6c0);
  g.circle(l - 0.1, b - 0.3, 0.15).fill(0xfff6c0);
  c.addChild(g);
  return c;
}

/**
 * Gelenkbus (»Schlenky«) von oben, Front nach +x: vorderer Wagen fest, der
 * hintere hängt am Gelenk bei `gelenkX` und lässt sich knicken (`heck.rotation`).
 */
export function zeichneGelenkbus(farbe: number, laenge: number, breite: number, gelenkX: number): Container & { heck: Container } {
  const c = new Container() as Container & { heck: Container };
  const l = laenge / 2, b = breite / 2, spalt = 0.45;
  const vorn = new Graphics();
  vorn.roundRect(gelenkX + spalt + 0.3, -b + 0.3, l - gelenkX - spalt, breite, 0.4).fill({ color: FARBE.schatten, alpha: 0.35 });
  vorn.roundRect(gelenkX + spalt, -b, l - gelenkX - spalt, breite, 0.3).fill(farbe).stroke({ width: 0.06, color: dunkler(farbe) });
  vorn.rect(l - 0.6, -b + 0.15, 0.4, breite - 0.3).fill(0x1d2a38);
  for (let x = gelenkX + spalt + 0.6; x < l - 1.5; x += 2) vorn.rect(x, -b + 0.35, 1.2, breite - 0.7).fill(dunkler(farbe));
  vorn.circle(l - 0.1, -b + 0.3, 0.15).fill(0xfff6c0).circle(l - 0.1, b - 0.3, 0.15).fill(0xfff6c0);
  const heck = new Container();
  heck.position.set(gelenkX, 0);
  const h = new Graphics();
  // Faltenbalg, dann der hintere Wagen (in Heck-Koordinaten: Gelenk bei 0)
  h.rect(-spalt, -b + 0.1, spalt * 2, breite - 0.2).fill(0x2a2a2a);
  for (let x = -spalt; x <= spalt; x += 0.12) h.moveTo(x, -b + 0.1).lineTo(x, b - 0.1).stroke({ width: 0.03, color: 0x555555 });
  const rl = l + gelenkX - spalt;
  h.roundRect(-spalt - rl + 0.3, -b + 0.3, rl, breite, 0.4).fill({ color: FARBE.schatten, alpha: 0.35 });
  h.roundRect(-spalt - rl, -b, rl, breite, 0.3).fill(farbe).stroke({ width: 0.06, color: dunkler(farbe) });
  for (let x = -spalt - rl + 0.6; x < -spalt - 0.8; x += 2) h.rect(x, -b + 0.35, 1.2, breite - 0.7).fill(dunkler(farbe));
  heck.addChild(h);
  c.addChild(heck, vorn);
  c.heck = heck;
  return c;
}

const LICHTFARBE = { an: { rot: 0xff2a1a, gelb: 0xffc21a, gruen: 0x2bdc4a }, aus: 0x2a2a2a };

/** Autoampel: schwarzer Kasten mit drei Lichtern, zeigt zur Fahrbahn. */
export function zeichneAutoampel(licht: "gruen" | "gelb" | "rot" | "rotgelb", g: Graphics) {
  g.clear();
  g.roundRect(-0.3, -0.75, 0.6, 1.5, 0.1).fill(0x111111);
  g.circle(0, -0.45, 0.18).fill(licht === "rot" || licht === "rotgelb" ? LICHTFARBE.an.rot : LICHTFARBE.aus);
  g.circle(0, 0, 0.18).fill(licht === "gelb" || licht === "rotgelb" ? LICHTFARBE.an.gelb : LICHTFARBE.aus);
  g.circle(0, 0.45, 0.18).fill(licht === "gruen" ? LICHTFARBE.an.gruen : LICHTFARBE.aus);
}

/** Fußgängerampel: rotes stehendes oder grünes gehendes Männchen. `taster` = Signal kommt. */
export function zeichneFussampel(gruen: boolean, signalKommt: boolean, g: Graphics) {
  g.clear();
  g.roundRect(-0.35, -0.7, 0.7, 1.4, 0.1).fill(0x111111);
  const farbe = gruen ? LICHTFARBE.an.gruen : LICHTFARBE.an.rot;
  const y = gruen ? 0.3 : -0.3;
  g.circle(0, y - 0.18, 0.08).fill(farbe);
  g.rect(-0.08, y - 0.08, 0.16, 0.26).fill(farbe);
  g.circle(0, gruen ? -0.3 : 0.3, 0.2).fill(LICHTFARBE.aus);
  if (signalKommt) g.roundRect(-0.3, 0.75, 0.6, 0.3, 0.05).fill(0xffc21a);
}

/** Polizist von oben: dunkelblaue Jacke, weiße Mütze. */
export function zeichnePolizist(): Container {
  const c = zeichneFigur(0x1e3a8a);
  const muetze = new Graphics().circle(0.02, 0, 0.17).fill(0xf4f4f4).stroke({ width: 0.04, color: 0x1e3a8a });
  c.kopf.addChild(muetze);
  return c;
}

/** Ein Verkehrszeichen von schräg oben: Pfosten-Schatten und Schildfläche (etwa 0,9 m). */
export function zeichneSchild(art: SchildArt): Container {
  const c = new Container();
  const g = new Graphics();
  g.circle(0.15, 0.15, 0.12).fill({ color: FARBE.schatten, alpha: 0.4 });
  g.circle(0, 0, 0.08).fill(0x777777);
  const r = 0.45;
  const bild = (text: string, farbe = 0xffffff, groesse = 0.5) => {
    const t = new Text({ text, style: { fontFamily: "Arial", fontWeight: "bold", fontSize: 48, fill: farbe } });
    t.anchor.set(0.5);
    t.scale.set(groesse / 48);
    t.position.set(0, -0.9);
    c.addChild(t);
  };
  const y = -0.9;
  switch (art) {
    case "stopp": {
      const pkt: number[] = [];
      for (let i = 0; i < 8; i++) { const w = Math.PI / 8 + (i * Math.PI) / 4; pkt.push(Math.cos(w) * r, y + Math.sin(w) * r); }
      g.poly(pkt).fill(0xc8102e).stroke({ width: 0.05, color: 0xffffff });
      c.addChild(g);
      bild("STOP", 0xffffff, 0.28);
      return c;
    }
    case "vorfahrtAchten":
      g.poly([-r, y - r * 0.8, r, y - r * 0.8, 0, y + r]).fill(0xffffff).stroke({ width: 0.09, color: 0xc8102e });
      c.addChild(g);
      return c;
    case "vorfahrtstrasse":
      // Gelbe Raute mit weißem Rand
      g.poly([0, y - r * 1.05, r * 1.05, y, 0, y + r * 1.05, -r * 1.05, y]).fill(0xffffff).stroke({ width: 0.03, color: 0x555555 });
      g.poly([0, y - r * 0.72, r * 0.72, y, 0, y + r * 0.72, -r * 0.72, y]).fill(0xf4c430);
      c.addChild(g);
      return c;
    case "zebra":
      g.rect(-r, y - r, 2 * r, 2 * r).fill(0x1f5fbf).stroke({ width: 0.04, color: 0xffffff });
      g.poly([-r * 0.75, y + r * 0.6, r * 0.75, y + r * 0.6, 0, y - r * 0.75]).fill(0xffffff);
      c.addChild(g);
      bild("🚶", 0x000000, 0.4);
      return c;
    case "haltestelle":
      g.circle(0, y, r).fill(0xf4c430).stroke({ width: 0.06, color: 0x1f7a3a });
      c.addChild(g);
      bild("H", 0x1f7a3a, 0.55);
      return c;
    case "radweg":
      g.circle(0, y, r).fill(0x1f5fbf).stroke({ width: 0.04, color: 0xffffff });
      c.addChild(g);
      bild("🚲", 0xffffff, 0.45);
      return c;
    case "gehRad":
      g.circle(0, y, r).fill(0x1f5fbf).stroke({ width: 0.04, color: 0xffffff });
      g.moveTo(-r * 0.8, y).lineTo(r * 0.8, y).stroke({ width: 0.04, color: 0xffffff });
      c.addChild(g);
      bild("🚶\n🚲", 0xffffff, 0.3);
      return c;
    case "gehRadGetrennt":
      g.circle(0, y, r).fill(0x1f5fbf).stroke({ width: 0.04, color: 0xffffff });
      g.moveTo(0, y - r * 0.8).lineTo(0, y + r * 0.8).stroke({ width: 0.04, color: 0xffffff });
      c.addChild(g);
      bild("🚶🚲", 0xffffff, 0.26);
      return c;
    case "radfrei":
      // Gehweg (239) mit Zusatzzeichen »Radfahrer frei« darunter
      g.circle(0, y, r).fill(0x1f5fbf).stroke({ width: 0.04, color: 0xffffff });
      g.rect(-r * 0.9, y + r + 0.04, r * 1.8, r * 0.7).fill(0xffffff).stroke({ width: 0.03, color: 0x222222 });
      c.addChild(g);
      bild("🚶", 0xffffff, 0.4);
      {
        const t = new Text({ text: "🚲 frei", style: { fontFamily: "Arial", fontWeight: "bold", fontSize: 48, fill: 0x000000 } });
        t.anchor.set(0.5); t.scale.set(0.22 / 48); t.position.set(0, y + r * 1.4);
        c.addChild(t);
      }
      return c;
    case "spielstrasse":
      g.rect(-r * 1.2, y - r * 0.8, 2.4 * r, 1.6 * r).fill(0x1f5fbf).stroke({ width: 0.04, color: 0xffffff });
      c.addChild(g);
      bild("🏠⚽", 0xffffff, 0.3);
      return c;
  }
}
