/**
 * Zeichnet die Stadt mit Pixi — alles in Metern, die Kamera skaliert.
 * Draufsicht wie im ersten GTA: Dächer mit Schlagschatten, graue Fahrbahnen,
 * helle Gehwege, rote Radwege.
 */
import { Container, Graphics, Text } from "pixi.js";
import type { P } from "./geometrie";
import { bahnsteigUm, winkelVon, type Stadt } from "./stadt";

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

  const grund = new Graphics();
  const r = karte.radius + 40;
  grund.rect(-r, -r, 2 * r, 2 * r).fill(FARBE.boden);
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

  // Bahnsteige der ausgedachten Halte (die echten kommen als Fläche)
  const steige = new Graphics();
  for (const h of stadt.halte) if (h.fiktiv) steige.poly(flach(bahnsteigUm(h))).fill(FLAECHE.bahnsteig).stroke({ width: 0.2, color: 0xeeeeee });
  boden.addChild(steige);

  // Häuser: Schlagschatten, dann Dach
  const haeuser = new Graphics();
  for (const h of karte.gebaeude) if (h.umriss.length >= 3) haeuser.poly(flach(h.umriss.map(([x, y]) => [x + 1.2, y + 1.2] as P))).fill({ color: FARBE.schatten, alpha: 0.35 });
  for (const h of karte.gebaeude) {
    if (h.umriss.length < 3) continue;
    const farbe = DACH[h.art ?? ""] ?? 0x8e6e5e;
    haeuser.poly(flach(h.umriss)).fill(farbe).stroke({ width: 0.25, color: dunkler(farbe), join: "round" });
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
    baeume.circle(p.p[0] + 0.8, p.p[1] + 0.8, 2.4).fill({ color: FARBE.schatten, alpha: 0.3 });
    baeume.circle(p.p[0], p.p[1], 2.4).fill(FARBE.baumkrone);
    baeume.circle(p.p[0] - 0.6, p.p[1] - 0.6, 1.2).fill(FARBE.baumlicht);
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

/** Eine Figur von oben: Schultern, Arme, Kopf. Blickrichtung nach +x. */
export function zeichneFigur(farbe: number): Container {
  const c = new Container();
  const g = new Graphics();
  g.ellipse(0.12, 0.12, 0.32, 0.38).fill({ color: FARBE.schatten, alpha: 0.3 });
  g.ellipse(0, 0, 0.2, 0.34).fill(farbe).stroke({ width: 0.04, color: dunkler(farbe) });
  g.circle(0.02, 0, 0.15).fill(0x5a3a22);
  g.circle(0.08, 0, 0.1).fill(0xe8b98f);
  c.addChild(g);
  return c;
}
