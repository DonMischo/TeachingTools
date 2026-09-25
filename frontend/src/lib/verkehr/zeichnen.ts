/**
 * Zeichnet die Stadt mit Pixi — alles in Metern, die Kamera skaliert.
 * Draufsicht wie im ersten GTA: Dächer mit Schlagschatten, graue Fahrbahnen,
 * helle Gehwege, rote Radwege.
 */
import { Container, Graphics, Text, Texture, TilingSprite } from "pixi.js";
import type { P } from "./geometrie";
import { bahnsteigUm, winkelVon, type Stadt } from "./stadt";
import type { SchildArt } from "./schilder";

export const FARBE = {
  boden: 0x5f7a45,
  gehweg: 0xb9b4a8,
  bordstein: 0x8f8a80,
  fahrbahn: 0x4a4a4f,
  spielstrasse: 0x7d7468,
  markierung: 0xf2f2f2,
  radweg: 0xb0503f,
  gehRad: 0xc0a090,
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

export type Ebenen = { boden: Container; oben: Container };

/**
 * Baut die feste Karte. `boden` liegt unter den Figuren, `oben` (Baumkronen,
 * Beschriftung) darüber.
 */
export function zeichneStadt(stadt: Stadt): Ebenen {
  const { karte } = stadt;
  const boden = new Container();
  const oben = new Container();

  const r = karte.radius + 40;
  const rasen = new TilingSprite({ texture: rasenTextur(), width: 2 * r, height: 2 * r });
  rasen.position.set(-r, -r);
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
    const breite = w.art === "rad" || w.art === "geh_rad" ? 2.5 : w.art === "feldweg" ? 2.5 : 2;
    const farbe = w.art === "rad" ? FARBE.radweg : w.art === "geh_rad" ? FARBE.gehRad : FARBE.fussweg;
    linie(strassen, w.linie);
    strassen.stroke({ width: breite, color: farbe, cap: "round", join: "round" });
  }
  for (const s of stadt.strassen) if (s.gehwegBreite) { linie(strassen, s.linie); strassen.stroke({ width: s.breite + 0.3, color: FARBE.bordstein, cap: "round", join: "round" }); }
  // Schmale Straßen zuerst, damit Hauptstraßen an Kreuzungen oben liegen.
  for (const s of [...stadt.strassen].sort((a, b) => a.breite - b.breite)) {
    linie(strassen, s.linie);
    strassen.stroke({ width: s.breite, color: s.art === "living_street" ? FARBE.spielstrasse : FARBE.fahrbahn, cap: "round", join: "round" });
  }
  // Leitlinie in der Mitte, nur auf breiten Straßen in beide Richtungen
  for (const s of stadt.strassen) if (!s.einbahn && s.breite >= 6.5) strichel(strassen, s.linie, 3, 6);
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

  // Haltestellenschilder
  const schilder = new Graphics();
  for (const h of stadt.halte) {
    const [x, y] = h.p;
    schilder.circle(x, y, 0.55).fill(0xf4c430).stroke({ width: 0.12, color: 0x1f7a3a });
  }
  boden.addChild(schilder);
  for (const h of stadt.halte) {
    const t = beschriftung("H", 0x1f7a3a, 1);
    t.position.set(h.p[0], h.p[1]);
    boden.addChild(t);
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
  return { boden, oben };
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
    case "spielstrasse":
      g.rect(-r * 1.2, y - r * 0.8, 2.4 * r, 1.6 * r).fill(0x1f5fbf).stroke({ width: 0.04, color: 0xffffff });
      c.addChild(g);
      bild("🏠⚽", 0xffffff, 0.3);
      return c;
  }
}
