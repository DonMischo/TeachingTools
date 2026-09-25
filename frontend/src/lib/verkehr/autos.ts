/**
 * Der Autoverkehr: Fahrzeuge auf dem Straßennetz aus der Karte. Rechtsverkehr,
 * Tempo nach Straßenart, Abstand halten, an roten Ampeln und Zebrastreifen
 * halten, vor Menschen auf der Fahrbahn bremsen.
 *
 * Gerechnet wird nur bei einem Rechner der Sitzung (dem Taktgeber); die
 * anderen bekommen die Stände geschickt. Deshalb darf hier `Math.random` stehen.
 */
import type { P } from "./geometrie";
import { achsenAbstand, autoLicht, type Anlage } from "./ampeln";
import { spurLagen, type Halt, type Stadt, type Strasse } from "./stadt";
import { HALT_DAUER } from "./tueren";
import { LAYOUTS, type Bustyp } from "./busszene";

export type Knoten = { p: P; aus: number[] };

/** So lange wartet ein Fahrzeug auf Querverkehr, der sich nicht rührt (Sekunden). */
const STAU_GEDULD = 6;
export type Kante = {
  von: number; nach: number; a: P; b: P; laenge: number; winkel: number;
  strasse: Strasse; spur: number; halte: Haltepunkt[];
  /** Welche Spur (0 = innen, an der Mitte) von wie vielen in dieser Richtung. */
  spurNr: number; spuren: number;
};
export type Haltepunkt = { s: number; art: "ampel" | "zebra"; anlage?: Anlage; achse?: number; p: P };

export type Fahrzeug = {
  id: number; art: "auto" | "bus"; farbe: number; laenge: number; breite: number;
  kante: number; s: number; tempo: number; naechste: number | null;
  x: number; y: number; winkel: number;
  /** Hupt bis zu diesem Zeitpunkt (Karma: will nicht halten, muss aber). */
  hupe: number;
  /** Hält für ein Handzeichen bis zu diesem Zeitpunkt. */
  wartetBis: number;
  /** Nur Busse: Stadtbus oder Gelenkbus (»Schlenky«). */
  typ?: Bustyp;
  /** Nur Busse: fährt die Linie ab und hält an ihren Haltestellen. */
  linie?: Linie;
  /** Zielanzeige des Busses, etwa »9 Nordbahnhof«. */
  anzeige?: string;
  /** Stelle in `linie.kanten`. */
  ri?: number;
  /** Seit wann der Bus an einer Haltestelle steht; `haltRi` = an welcher. */
  haltSeit?: number | null;
  haltRi?: number;
  /** Zuletzt bediente Stelle, damit er nicht zweimal hält. */
  bedientRi?: number;
  /** Nur Busse nach Fahrplan: Ende der Fahrt (Stelle am Kartenrand) und Abfahrtszeiten je Halt-Stelle. */
  fahrtBis?: number;
  planAb?: Map<number, number>;
  /** Wie lange der laufende Halt dauert (Sekunden; früh dran = länger). */
  haltDauer?: number;
  /** Wo er quer auf der Straße fährt (gleitet beim Spurwechsel zur neuen Spur). */
  quer?: number;
  /** Seit wann er steht (nicht an einer Haltestelle). */
  stehtSeit?: number;
};

/** Eine Buslinie als Rundkurs über die Kanten, mit den Haltestellen darauf. */
export type Linie = {
  kanten: number[]; halte: Map<number, { s: number; halt: Halt }>; anzeige?: string;
  /** Welcher Bustyp auf der Linie fährt (sonst gemischt). */
  bustyp?: Bustyp;
  /** Je Richtung: wo sie am Kartenrand beginnt und endet (Stellen in `kanten`). */
  abschnitte?: { ziel: string; von: number; bis: number }[];
  /** Stellen i, nach denen der Bus springt: raus am Kartenrand, woanders wieder herein (die Fahrt dazwischen liegt außerhalb). */
  spruenge?: Set<number>;
};

/** Busmaße und Türen (Abstand der Türmitten von der Busmitte): vorn beim Fahrer, Mitte, hinten — wie in der Bus-Szene. */
export const BUS = { laenge: 12, breite: 2.55, tueren: [4.85, 0.4, -3.6], farbe: 0xeeeeee } as const;

/** Welche Busse Gelenkbusse (»Schlenky«) sind: zwei von fünf, fest nach der Nummer. */
export const bustypFuer = (id: number): Bustyp => (id % 5 === 1 || id % 5 === 3 ? "gelenk" : "solo");
/** Linien mit festem Bustyp: die 9 fährt mit Gelenkbussen (»Schlenky«). */
export const BUSTYP_JE_LINIE: Record<string, Bustyp> = { "9": "gelenk", "35": "solo" };

/** Was der Verkehr über jeden Menschen auf der Karte wissen muss. */
export type Fussgaenger = {
  id: string; x: number; y: number;
  /** Zeitpunkt des letzten ✋. */
  hand: number;
  /** Bis wann Autofahrer ihn nicht vorlassen (nach Beleidigungen). */
  karmaBis: number;
  /** Warnweste oder Reflektoren: im Dunkeln früh gesehen. */
  weste?: boolean;
};

export type Unfall = { fahrzeug: number; fussgaenger: string; tempo: number };

const FAHRBAR = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street"]);
const AUTOFARBEN = [0xc0392b, 0x2e86de, 0xf1c40f, 0xecf0f1, 0x2c3e50, 0x27ae60, 0x8e44ad, 0x7f8c8d, 0xe67e22];

const BREMSEN = 4.5, NOTBREMSE = 9, ANFAHREN = 2.2;
const SICHT = 40;
/** Im Dunkeln ohne Warnweste sieht man einen Menschen erst auf diese Entfernung. */
export const SICHT_DUNKEL = 14;

export function tempoGrenze(s: Strasse): number {
  const kmh = s.tempo ?? (s.art === "living_street" ? 7 : s.art === "secondary" || s.art === "primary" ? 50 : s.art === "tertiary" ? 40 : 30);
  return kmh / 3.6;
}

export class Strassenverkehr {
  readonly knoten: Knoten[] = [];
  readonly kanten: Kante[] = [];
  fahrzeuge: Fahrzeug[] = [];
  /** Im Dunkeln sehen Autofahrer Menschen ohne Warnweste erst spät. */
  dunkel = false;
  /** Werktags 7:30–8:15: Eltern fahren ihre Kinder bis vor die Schule. */
  elternzeit = false;
  /** Spielzeit in Stunden (für Tore mit Öffnungszeiten). */
  stunde = 12;
  /** Mitte der Schule — Ziel der Elterntaxis. */
  schule: P = [0, 0];
  private naechsteId = 1;

  constructor(readonly stadt: Stadt, readonly anlagen: Anlage[], public ziel = 28) {
    const index = new Map<string, number>();
    const knoten = (p: P) => {
      const k = `${p[0]},${p[1]}`;
      let i = index.get(k);
      if (i === undefined) { i = this.knoten.length; this.knoten.push({ p, aus: [] }); index.set(k, i); }
      return i;
    };
    for (const s of stadt.strassen) {
      if (!FAHRBAR.has(s.art)) continue;
      for (let i = 0; i + 1 < s.linie.length; i++) {
        const a = knoten(s.linie[i]), b = knoten(s.linie[i + 1]);
        // Je Spur eine eigene Kante: auf zweispurigen Straßen fahren Autos nebeneinander.
        spurLagen(s, true).lagen.forEach((spur, nr, alle) => this.kante(a, b, s, spur, nr, alle.length));
        if (!s.einbahn) spurLagen(s, false).lagen.forEach((spur, nr, alle) => this.kante(b, a, s, spur, nr, alle.length));
      }
    }
    this.haltepunkteEintragen();
  }

  private kante(von: number, nach: number, strasse: Strasse, spur: number, spurNr: number, spuren: number) {
    const a = this.knoten[von].p, b = this.knoten[nach].p;
    const laenge = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (laenge < 0.01) return;
    this.knoten[von].aus.push(this.kanten.length);
    this.kanten.push({
      von, nach, a, b, laenge, winkel: Math.atan2(b[1] - a[1], b[0] - a[0]), strasse,
      spur, spurNr, spuren, halte: [],
    });
  }

  /** Ampeln und Zebrastreifen auf die Kanten projizieren, auf denen sie liegen. */
  private haltepunkteEintragen() {
    const eintragen = (p: P, h: Omit<Haltepunkt, "s" | "p">) => {
      for (const k of this.kanten) {
        const dx = k.b[0] - k.a[0], dy = k.b[1] - k.a[1];
        const t = ((p[0] - k.a[0]) * dx + (p[1] - k.a[1]) * dy) / (k.laenge * k.laenge);
        if (t < 0 || t > 1) continue;
        const qx = k.a[0] + t * dx, qy = k.a[1] + t * dy;
        if (Math.hypot(p[0] - qx, p[1] - qy) > k.strasse.breite / 2 + 4) continue;
        // Eine Ampel gilt nur für die Straße ihrer Achse, nicht für die Querstraße daneben.
        if (h.anlage && h.achse !== undefined && achsenAbstand(h.anlage.achsen[h.achse], k.winkel) > Math.PI / 5) continue;
        // Haltelinie 3 m vor dem Punkt.
        k.halte.push({ ...h, s: Math.max(0, t * k.laenge - 3), p });
      }
    };
    for (const a of this.anlagen) for (const sig of a.signale) eintragen(sig.p, { art: "ampel", anlage: a, achse: sig.achse });
    for (const p of this.stadt.karte.punkte) if (p.art === "zebra") eintragen(p.p, { art: "zebra" });
    for (const k of this.kanten) k.halte.sort((x, y) => x.s - y.s);
  }

  /** Ist die Kante gerade befahrbar (Tore geschlossen)? */
  private offen(k: Kante) {
    const t = k.strasse.tore;
    return !t || (this.stunde >= t.offenVon && this.stunde < t.offenBis);
  }

  /**
   * Wie gern ein Auto in diese Straße abbiegt. Wer von A nach B will, bleibt
   * auf den Hauptstraßen; Wohnstraßen und die Spielstraße nimmt kaum jemand —
   * außer morgens die Eltern auf dem Weg zur Schule.
   */
  private gewicht(k: Kante): number {
    const art = k.strasse.art;
    const nahSchule = Math.hypot(k.b[0] - this.schule[0], k.b[1] - this.schule[1]) < 180;
    if (art === "primary" || art === "secondary" || art === "tertiary") return 1;
    if (this.elternzeit && nahSchule) return art === "living_street" ? 0.7 : 0.9;
    return art === "living_street" ? 0.03 : 0.12;
  }

  private waehleNaechste(kante: number, f?: Fahrzeug): number | null {
    if (f?.linie) return f.linie.kanten[((f.ri ?? 0) + 1) % f.linie.kanten.length];
    const k = this.kanten[kante];
    const alleAus = this.knoten[k.nach].aus.filter((i) => this.kanten[i].nach !== k.von && this.offen(this.kanten[i]));
    if (alleAus.length) {
      // Erst die Straße wählen (parallele Spuren zählen als eine), dann die Spur.
      const aus = alleAus.filter((i) => this.kanten[i].spurNr === 0);
      const g = aus.map((i) => this.gewicht(this.kanten[i]));
      let r = Math.random() * g.reduce((a, b) => a + b, 0);
      let wahl = aus[aus.length - 1];
      for (let i = 0; i < aus.length; i++) { r -= g[i]; if (r <= 0) { wahl = aus[i]; break; } }
      const w = this.kanten[wahl];
      const spuren = alleAus.filter((i) => this.kanten[i].nach === w.nach && this.kanten[i].strasse === w.strasse);
      // In der Spur bleiben; ab und zu wechseln
      const gleich = spuren.find((i) => this.kanten[i].spurNr === Math.min(k.spurNr, w.spuren - 1));
      return Math.random() < 0.12 || gleich === undefined ? spuren[Math.floor(Math.random() * spuren.length)] : gleich;
    }
    const zurueck = this.knoten[k.nach].aus;
    return zurueck.length ? zurueck[0] : null;
  }

  private setzeLage(f: Fahrzeug) {
    const k = this.kanten[f.kante];
    const c = Math.cos(k.winkel), s = Math.sin(k.winkel);
    // Spurwechsel sanft hinübergleiten statt springen
    f.quer = f.quer === undefined ? k.spur : f.quer + (k.spur - f.quer) * 0.08;
    f.x = k.a[0] + c * f.s - s * f.quer;
    f.y = k.a[1] + s * f.s + c * f.quer;
    f.winkel = k.winkel;
  }

  /** Neue Autos in der Nähe der Menschen, alte weit weg verschwinden lassen. */
  private bevoelkern(menschen: Fussgaenger[]) {
    const nah = (x: number, y: number, r: number) => menschen.some((m) => Math.hypot(m.x - x, m.y - y) < r);
    // Ohne Menschen (etwa kurz nach einem Unfall) bleibt der Verkehr, wie er ist.
    if (!menschen.length) return;
    this.fahrzeuge = this.fahrzeuge.filter((f) => f.art === "bus" || nah(f.x, f.y, 240));
    for (let versuch = 0; versuch < 6 && this.fahrzeuge.length < this.ziel; versuch++) {
      const m = menschen[Math.floor(Math.random() * menschen.length)];
      const w = Math.random() * Math.PI * 2, r = 90 + Math.random() * 110;
      const x = m.x + Math.cos(w) * r, y = m.y + Math.sin(w) * r;
      const n = this.stadt.naechsteStrasse(x, y, 25);
      if (!n || !FAHRBAR.has(n.s.art)) continue;
      const kandidaten = this.kanten.map((k, i) => ({ k, i })).filter(({ k }) => k.strasse === n.s && (k.a === n.st.a || k.b === n.st.a));
      if (!kandidaten.length) continue;
      const { k, i } = kandidaten[Math.floor(Math.random() * kandidaten.length)];
      // Auf ruhigen Straßen entstehen selten Autos — so selten, wie sie dort abbiegen.
      if (!this.offen(k) || Math.random() > this.gewicht(k)) continue;
      if (nah(k.a[0], k.a[1], 60)) continue;
      if (this.fahrzeuge.some((f) => Math.hypot(f.x - k.a[0], f.y - k.a[1]) < 12)) continue;
      const f: Fahrzeug = {
        id: this.naechsteId++, art: "auto", farbe: AUTOFARBEN[Math.floor(Math.random() * AUTOFARBEN.length)],
        laenge: 4.4, breite: 1.8, kante: i, s: 0, tempo: tempoGrenze(k.strasse) * 0.8, naechste: this.waehleNaechste(i),
        x: 0, y: 0, winkel: 0, hupe: 0, wartetBis: 0,
      };
      this.setze(f);
    }
  }

  /** Ein Fahrzeug auf seine Kante stellen und mitfahren lassen. */
  setze(f: Fahrzeug) {
    this.setzeLage(f);
    this.fahrzeuge.push(f);
  }

  /**
   * Wie weit darf `f` noch fahren, bevor etwas im Weg ist? Schaut die eigene
   * und die nächste Kante entlang.
   */
  private freieStrecke(f: Fahrzeug, t: number, menschen: Fussgaenger[], ampelTaster: (a: Anlage) => number): { d: number; hupen: boolean } {
    let frei = SICHT, hupen = false;
    const k = this.kanten[f.kante];
    const abschnitte: { k: Kante; ab: number; vor: number }[] = [{ k, ab: f.s, vor: 0 }];
    if (f.naechste !== null) abschnitte.push({ k: this.kanten[f.naechste], ab: 0, vor: k.laenge - f.s });

    for (const { k: kk, ab, vor } of abschnitte) {
      for (const h of kk.halte) {
        if (h.s < ab) continue;
        const d = vor + h.s - ab;
        if (d > SICHT) break;
        if (h.art === "ampel" && h.anlage) {
          const licht = autoLicht(h.anlage, h.achse ?? 0, t, ampelTaster(h.anlage));
          // Bei Gelb hält, wer noch bequem halten kann.
          const halten = licht === "rot" || licht === "rotgelb" || (licht === "gelb" && d > (f.tempo * f.tempo) / (2 * BREMSEN));
          if (halten) frei = Math.min(frei, d);
        } else if (h.art === "zebra") {
          // Wer am Zebrastreifen steht oder schon drauf ist, hat Vorrang.
          for (const m of menschen) {
            if (Math.hypot(m.x - h.p[0], m.y - h.p[1]) > kk.strasse.breite / 2 + 2.5) continue;
            if (d > this.sichtAuf(m)) continue;
            if (m.karmaBis > t && !aufFahrbahnVor(this.stadt, m)) { hupen = true; continue; }
            frei = Math.min(frei, d);
          }
        }
      }
    }

    // Menschen auf der eigenen Spur voraus; Handzeichen am Rand.
    const c = Math.cos(f.winkel), s = Math.sin(f.winkel);
    for (const m of menschen) {
      const dx = m.x - f.x, dy = m.y - f.y;
      const laengs = dx * c + dy * s, quer = -dx * s + dy * c;
      if (laengs < 0 || laengs > this.sichtAuf(m)) continue;
      if (Math.abs(quer) < f.breite / 2 + 1 && aufFahrbahnVor(this.stadt, m)) {
        frei = Math.min(frei, laengs - f.laenge / 2 - 1.5);
        if (m.karmaBis > t) hupen = true;
      } else if (t - m.hand < 2 && Math.abs(quer) < k.strasse.breite / 2 + 4 && laengs > 6) {
        if (m.karmaBis > t) hupen = true;
        else f.wartetBis = Math.max(f.wartetBis, t + 5);
      }
      if (f.wartetBis > t && Math.abs(quer) < k.strasse.breite / 2 + 5 && laengs > 0) frei = Math.min(frei, laengs - f.laenge / 2 - 3);
    }

    // Vorderwagen. Wer schon lange steht, fährt an Querverkehr vorbei, der in der
    // Kreuzung festhängt — sonst blockieren sich Abbieger gegenseitig für immer.
    const ungeduldig = f.stehtSeit !== undefined && t - f.stehtSeit > STAU_GEDULD;
    for (const o of this.fahrzeuge) {
      if (o === f) continue;
      if (ungeduldig && Math.abs(Math.atan2(Math.sin(o.winkel - f.winkel), Math.cos(o.winkel - f.winkel))) > 0.8) continue;
      const dx = o.x - f.x, dy = o.y - f.y;
      const laengs = dx * c + dy * s, quer = -dx * s + dy * c;
      // Ineinander verkeilt (kaum Abstand): der Ungeduldige löst sich
      if (ungeduldig && laengs < (f.laenge + o.laenge) / 2 - 1) continue;
      if (laengs > 0 && laengs < SICHT && Math.abs(quer) < 1.6) frei = Math.min(frei, laengs - (f.laenge + o.laenge) / 2 - 2);
    }
    return { d: frei, hupen };
  }

  /** Wie weit ist es bis zur nächsten noch nicht bedienten Haltestelle (eigene oder nächste Kante)? */
  private naechsterBushalt(f: Fahrzeug): { d: number; ri: number } | null {
    if (!f.linie) return null;
    const n = f.linie.kanten.length, ri = f.ri ?? 0;
    const hier = f.linie.halte.get(ri);
    if (hier && f.bedientRi !== ri && hier.s >= f.s - 0.5) return { d: Math.max(0, hier.s - f.s), ri };
    const dort = f.linie.halte.get((ri + 1) % n);
    if (dort && f.bedientRi !== (ri + 1) % n) return { d: this.kanten[f.kante].laenge - f.s + dort.s, ri: (ri + 1) % n };
    return null;
  }

  /** Knoten, die vom größten Teil des Netzes erreichbar sind und ihn auch wieder erreichen. */
  private kern(): Set<number> {
    const rueck = new Map<number, number[]>();
    for (const k of this.kanten) (rueck.get(k.nach) ?? rueck.set(k.nach, []).get(k.nach)!).push(k.von);
    const suche = (start: number, weiter: (u: number) => number[]) => {
      const seen = new Set([start]), offen = [start];
      while (offen.length) for (const n of weiter(offen.pop()!)) if (!seen.has(n)) { seen.add(n); offen.push(n); }
      return seen;
    };
    let best = new Set<number>();
    // Ein paar Startpunkte probieren — der größte Kern gewinnt.
    for (let i = 0; i < this.knoten.length; i += Math.max(1, Math.floor(this.knoten.length / 12))) {
      const vor = suche(i, (u) => this.knoten[u].aus.map((ki) => this.kanten[ki].nach));
      const zur = suche(i, (u) => rueck.get(u) ?? []);
      const beide = new Set([...vor].filter((n) => zur.has(n)));
      if (beide.size > best.size) best = beide;
    }
    return best;
  }

  /** Kürzester Weg zwischen zwei Knoten über die Kanten (Dijkstra). */
  weg(von: number, nach: number): number[] | null {
    const dist = new Map<number, number>([[von, 0]]);
    const vorKante = new Map<number, number>();
    const offen = new Set([von]);
    while (offen.size) {
      let u = -1, du = Infinity;
      for (const k of offen) { const d = dist.get(k)!; if (d < du) { du = d; u = k; } }
      offen.delete(u);
      if (u === nach) break;
      for (const ki of this.knoten[u].aus) {
        const k = this.kanten[ki];
        const nd = du + k.laenge;
        if (nd < (dist.get(k.nach) ?? Infinity)) { dist.set(k.nach, nd); vorKante.set(k.nach, ki); offen.add(k.nach); }
      }
    }
    if (!dist.has(nach)) return null;
    const pfad: number[] = [];
    for (let k = nach; k !== von; k = this.kanten[vorKante.get(k)!].von) pfad.push(vorKante.get(k)!);
    return pfad.reverse();
  }

  /**
   * Eine Buslinie durch alle Haltestellen: jede Haltestelle auf die Kante in
   * der Fahrtrichtung, an deren rechtem Rand sie liegt, dann der Reihe nach
   * immer zur nächstgelegenen, zum Schluss zurück zur ersten.
   */
  baueBuslinie(halte: Halt[]): Linie | null {
    const plaetze: { halt: Halt; kante: number; s: number }[] = [];
    for (const h of halte) {
      let best: { kante: number; s: number; d: number } | null = null;
      for (let i = 0; i < this.kanten.length; i++) {
        const k = this.kanten[i];
        const dx = k.b[0] - k.a[0], dy = k.b[1] - k.a[1];
        const t = ((h.p[0] - k.a[0]) * dx + (h.p[1] - k.a[1]) * dy) / (k.laenge * k.laenge);
        if (t < 0 || t > 1) continue;
        const quer = (-(h.p[0] - k.a[0]) * dy + (h.p[1] - k.a[1]) * dx) / k.laenge;
        if (quer <= 0 || quer > k.strasse.breite / 2 + 7) continue;
        if (!best || quer < best.d) best = { kante: i, s: t * k.laenge, d: quer };
      }
      if (best) plaetze.push({ halt: h, kante: best.kante, s: best.s });
    }
    // Nur Haltestellen im Kern des Netzes: dort, wo man hin- und auch wieder
    // wegkommt. Am Kartenrand abgeschnittene Einbahnstraßen sind Sackgassen.
    const kern = this.kern();
    for (let i = plaetze.length - 1; i >= 0; i--) {
      const k = this.kanten[plaetze[i].kante];
      if (!kern.has(k.von) || !kern.has(k.nach)) plaetze.splice(i, 1);
    }
    if (plaetze.length < 2) return null;
    // Der Reihe nach zur nächstgelegenen erreichbaren Haltestelle; Haltestellen
    // auf abgeschnittenen Straßenstücken am Kartenrand fallen dabei heraus.
    type Platz = (typeof plaetze)[number];
    const reihe: { platz: Platz; pfad: number[] }[] = [];
    let jetzt = plaetze.shift()!;
    const erster = jetzt;
    while (plaetze.length) {
      const ende = this.kanten[jetzt.kante];
      plaetze.sort((a, b) => Math.hypot(this.kanten[a.kante].a[0] - ende.b[0], this.kanten[a.kante].a[1] - ende.b[1]) - Math.hypot(this.kanten[b.kante].a[0] - ende.b[0], this.kanten[b.kante].a[1] - ende.b[1]));
      let gefunden = -1, pfad: number[] | null = null;
      for (let i = 0; i < plaetze.length && gefunden < 0; i++) {
        pfad = this.weg(ende.nach, this.kanten[plaetze[i].kante].von);
        if (pfad) gefunden = i;
      }
      if (gefunden < 0) break;
      reihe.push({ platz: jetzt, pfad: pfad! });
      jetzt = plaetze.splice(gefunden, 1)[0];
    }
    // Zurück zur ersten; klappt das nicht, die letzten weglassen.
    let zurueck = this.weg(this.kanten[jetzt.kante].nach, this.kanten[erster.kante].von);
    while (!zurueck && reihe.length) {
      jetzt = reihe.pop()!.platz;
      zurueck = this.weg(this.kanten[jetzt.kante].nach, this.kanten[erster.kante].von);
    }
    if (!zurueck || !reihe.length) return null;
    reihe.push({ platz: jetzt, pfad: zurueck });
    const kanten: number[] = [];
    const haltAn = new Map<number, { s: number; halt: Halt }>();
    for (const { platz, pfad } of reihe) {
      haltAn.set(kanten.length, { s: platz.s, halt: platz.halt });
      kanten.push(platz.kante, ...pfad);
    }
    return { kanten, halte: haltAn };
  }

  /**
   * Eine Buslinie auf ihrem echten Fahrweg aus OSM: je Richtung die Spur
   * entlang (Kanten in Fahrtrichtung), an den Bussteigen dieser Richtung
   * halten; am Ende der einen Richtung kehrt der Bus am Kartenrand um und fährt
   * die andere. So hält er nie auf der Gegenseite.
   */
  baueLinienweg(richtungen: { ziel?: string; spur?: P[][]; steige?: { name: string; p: P }[] }[], halte: Halt[]): Linie | null {
    const kern = this.kern();
    const imKern = (i: number) => kern.has(this.kanten[i].von) && kern.has(this.kanten[i].nach);
    // Am Kartenrand: Einbahn-Fahrbahnen hinein (führen in den Kern) und hinaus (kommen aus ihm)
    const ausbreiten = (vorwaerts: boolean) => {
      const nachbarn = new Map<number, number[]>();
      for (const k of this.kanten) {
        const [a, b] = vorwaerts ? [k.von, k.nach] : [k.nach, k.von];
        (nachbarn.get(a) ?? nachbarn.set(a, []).get(a)!).push(b);
      }
      const da = new Set(kern), offen = [...kern];
      while (offen.length) for (const n of nachbarn.get(offen.pop()!) ?? []) if (!da.has(n)) { da.add(n); offen.push(n); }
      return da;
    };
    const fuehrtHinein = ausbreiten(false), kommtHeraus = ausbreiten(true);
    const amRandOk = (i: number) => fuehrtHinein.has(this.kanten[i].nach) || kommtHeraus.has(this.kanten[i].von);
    type Stelle = { kante: number; s: number; weit: number; halt?: Halt; rand?: "rein" | "raus"; r?: number };
    // Die Kante in Fahrtrichtung unter einem Punkt der Spur.
    // Für Bussteige: weiter weg (sie stehen am Gehweg) und nur rechts der Fahrtrichtung.
    const kanteBei = (p: P, rx: number, ry: number, steig = false) => {
      let best: { kante: number; s: number; d: number } | null = null;
      for (let i = 0; i < this.kanten.length; i++) {
        const k = this.kanten[i];
        const dx = (k.b[0] - k.a[0]) / k.laenge, dy = (k.b[1] - k.a[1]) / k.laenge;
        if (dx * rx + dy * ry < 0.7 || !(steig ? imKern(i) : amRandOk(i))) continue;
        const t = Math.max(0, Math.min(k.laenge, (p[0] - k.a[0]) * dx + (p[1] - k.a[1]) * dy));
        const d = Math.hypot(k.a[0] + dx * t - p[0], k.a[1] + dy * t - p[1]);
        if (steig && -(p[0] - k.a[0]) * dy + (p[1] - k.a[1]) * dx <= 0) continue;
        if (d < k.strasse.breite / 2 + (steig ? 8 : 3) && (!best || d < best.d)) best = { kante: i, s: t, d };
      }
      return best;
    };
    const stellen: Stelle[] = [];
    for (const [ri, r] of richtungen.entries()) {
      const eigene: Stelle[] = [];
      const punkte: { p: P; rx: number; ry: number; weit: number }[] = [];
      let weit = 0;
      for (const stueck of r.spur ?? []) for (let i = 0; i + 1 < stueck.length; i++) {
        const a = stueck[i], b = stueck[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (l < 0.01) continue;
        const rx = (b[0] - a[0]) / l, ry = (b[1] - a[1]) / l;
        for (let u = 0; u < l; u += 15) punkte.push({ p: [a[0] + rx * u, a[1] + ry * u], rx, ry, weit: weit + u });
        weit += l;
      }
      for (const pk of punkte) {
        const k = kanteBei(pk.p, pk.rx, pk.ry);
        if (k && eigene[eigene.length - 1]?.kante !== k.kante) eigene.push({ kante: k.kante, s: k.s, weit: pk.weit });
      }
      // Bussteige: auf die Kante dieser Richtung, an deren rechtem Rand sie liegen.
      for (const st of r.steige ?? []) {
        const halt = halte.filter((h) => h.name === st.name && Math.hypot(h.p[0] - st.p[0], h.p[1] - st.p[1]) < 10)
          .sort((a, b) => Math.hypot(a.p[0] - st.p[0], a.p[1] - st.p[1]) - Math.hypot(b.p[0] - st.p[0], b.p[1] - st.p[1]))[0];
        if (!halt) continue;
        const naechster = punkte.reduce<(typeof punkte)[number] | null>((m, pk) => !m || Math.hypot(pk.p[0] - st.p[0], pk.p[1] - st.p[1]) < Math.hypot(m.p[0] - st.p[0], m.p[1] - st.p[1]) ? pk : m, null);
        if (!naechster) continue;
        const k = kanteBei(halt.p, naechster.rx, naechster.ry, true);
        if (!k) continue;
        const vorhanden = eigene.find((e) => e.kante === k.kante);
        if (vorhanden) { vorhanden.halt = halt; vorhanden.s = k.s; } else eigene.push({ kante: k.kante, s: k.s, weit: naechster.weit, halt });
      }
      eigene.sort((a, b) => a.weit - b.weit);
      // Zwischen den Steigen der kürzeste Weg: OSM-Routen führen an Doppelfahrbahnen
      // manchmal über beide Fahrbahnen (hin und zurück) — die Spur zählt nur für
      // Ein- und Ausfahrt am Kartenrand.
      const mitHalt = eigene.filter((e) => e.halt);
      const ohne = eigene.filter((e) => !e.halt && (e.weit < (mitHalt[0]?.weit ?? Infinity) ? fuehrtHinein.has(this.kanten[e.kante].nach) : kommtHeraus.has(this.kanten[e.kante].von)));
      const vorn = ohne.length && (!mitHalt.length || ohne[0].weit < mitHalt[0].weit) ? [ohne[0]] : [];
      const hinten = ohne.length && (!mitHalt.length || ohne[ohne.length - 1].weit > mitHalt[mitHalt.length - 1].weit) ? [ohne[ohne.length - 1]] : [];
      stellen.push(...vorn.map((e) => ({ ...e, rand: "rein" as const, r: ri })), ...mitHalt.map((e) => ({ ...e, r: ri })), ...hinten.map((e) => ({ ...e, rand: "raus" as const, r: ri })));
    }
    if (stellen.filter((x) => x.halt).length < 1 || stellen.length < 2) return null;
    // Von Stelle zu Stelle der kürzeste Weg — die Stellen liegen dicht, also ist das die Spur.
    const kanten: number[] = [];
    const haltAn = new Map<number, { s: number; halt: Halt }>();
    const spruenge = new Set<number>();
    const abschnitte: { ziel: string; von: number; bis: number }[] = [];
    const n = stellen.length;
    for (let i = 0; i < n; i++) {
      const jetzt = stellen[i], dann = stellen[(i + 1) % n];
      if (jetzt.halt) haltAn.set(kanten.length, { s: jetzt.s, halt: jetzt.halt });
      if (jetzt.rand && jetzt.r !== undefined) {
        const a = (abschnitte[jetzt.r] ??= { ziel: richtungen[jetzt.r].ziel ?? "", von: -1, bis: -1 });
        if (jetzt.rand === "rein") a.von = kanten.length; else a.bis = kanten.length;
      }
      kanten.push(jetzt.kante);
      if (dann.kante === jetzt.kante) continue;
      // Am Kartenrand hinaus, woanders wieder herein: springen statt sichtbar zurückfahren
      if (jetzt.rand === "raus" && dann.rand === "rein") { spruenge.add(kanten.length - 1); continue; }
      const pfad = this.weg(this.kanten[jetzt.kante].nach, this.kanten[dann.kante].von);
      if (!pfad) return null;
      kanten.push(...pfad);
    }
    // Nur Richtungen, die am Rand beginnen und enden, lassen sich nach Fahrplan fahren
    return { kanten, halte: haltAn, spruenge, abschnitte: abschnitte.filter((a) => a && a.von >= 0 && a.bis > a.von) };
  }

  /** Wie weit ein Autofahrer diesen Menschen sieht (m). */
  private sichtAuf(m: Fussgaenger) {
    return this.dunkel && !m.weste ? SICHT_DUNKEL : SICHT;
  }

  /** `anzahl` Busse gleichmäßig auf die Linie setzen. */
  setzeBusse(linie: Linie, anzahl: number) {
    for (let i = 0; i < anzahl; i++) this.neuerBus(linie, Math.floor((i * linie.kanten.length) / anzahl));
  }

  private neuerBus(linie: Linie, ri: number, fahrt?: { bis: number; plan: Map<number, number> }) {
    this.setze({
      ...(fahrt ? { fahrtBis: fahrt.bis, planAb: fahrt.plan } : {}),
      id: this.naechsteId++, art: "bus", typ: linie.bustyp ?? bustypFuer(this.naechsteId - 1), farbe: BUS.farbe,
      laenge: LAYOUTS[linie.bustyp ?? bustypFuer(this.naechsteId - 1)].laenge, breite: BUS.breite,
      kante: linie.kanten[ri], s: 0, tempo: 0, naechste: linie.kanten[(ri + 1) % linie.kanten.length],
      x: 0, y: 0, winkel: 0, hupe: 0, wartetBis: 0, linie, ri, haltSeit: null, anzeige: linie.anzeige,
    });
  }

  /**
   * Die Zahl der Busse einer Linie an den Takt anpassen: ein neuer Bus kommt
   * dort auf die Linie, wo der Abstand zu den anderen am größten ist; weg
   * fällt einer, der gerade nicht an einer Haltestelle steht.
   */
  /** `schonen`: diese Busse nicht wegnehmen (etwa: jemand sieht ihn oder fährt mit) — dann später. */
  busseAnpassen(linie: Linie, soll: number, schonen: (f: Fahrzeug) => boolean = () => false) {
    const eigene = () => this.fahrzeuge.filter((f) => f.linie === linie);
    while (eigene().length < soll) {
      const n = linie.kanten.length;
      const belegt = eigene().map((f) => f.ri ?? 0).sort((a, b) => a - b);
      let ri = 0;
      if (belegt.length) {
        let luecke = -1;
        belegt.forEach((r, i) => {
          const weiter = (belegt[(i + 1) % belegt.length] - r + n) % n || n;
          if (weiter > luecke) { luecke = weiter; ri = (r + Math.floor(weiter / 2)) % n; }
        });
      }
      this.neuerBus(linie, ri);
    }
    while (eigene().length > soll) {
      const frei = eigene().filter((f) => !schonen(f));
      const weg = frei.find((f) => f.haltSeit == null) ?? frei[0];
      if (!weg) break;
      this.fahrzeuge = this.fahrzeuge.filter((f) => f !== weg);
    }
  }

  /** Schon losgeschickte Fahrten (Abschnitt|Tag|Minute), damit keine doppelt fährt. */
  private gestartet = new Set<string>();
  /** Busse, die nicht verschwinden dürfen (jemand fährt mit). */
  behalten?: (f: Fahrzeug) => boolean;

  /**
   * Busse nach Fahrplan: Je Richtung (vom Kartenrand zum Kartenrand) startet
   * eine Fahrt so, dass sie zur Abfahrtszeit am ersten Halt im Viertel ist.
   * `abfahrten(halt, ziel)` liefert die nächsten Abfahrten in Spielsekunden.
   * Wer früh dran ist, wartet am Halt; am Kartenrand endet die Fahrt.
   */
  fahrplan(linie: Linie, t: number, tag: number, abfahrten: (halt: string, ziel: string) => number[]) {
    const V = 8; // Schnitt mit Anfahren, Ampeln und Abbiegen (m/s)
    const laenge = (von: number, bis: number) => { let l = 0; for (let i = von; i < bis; i++) l += this.kanten[linie.kanten[i]].laenge; return l; };
    (linie.abschnitte ?? []).forEach((a, ai) => {
      const halteIdx = [...linie.halte.keys()].filter((i) => i >= a.von && i <= a.bis).sort((x, y) => x - y);
      if (!halteIdx.length) return;
      const ref = halteIdx[0];
      const anfahrt = laenge(a.von, ref) / V;
      for (const D of abfahrten(linie.halte.get(ref)!.halt.name, a.ziel)) {
        const key = `${ai}|${tag}|${Math.round(D / 60)}`;
        if (this.gestartet.has(key) || t < D - anfahrt) continue;
        this.gestartet.add(key);
        // Zu spät für diese Fahrt (etwa gerade erst geladen): nur, wenn noch genug Zeit bleibt
        if (D - t < 15) continue;
        // Schon unterwegs sein müssen? Dann weiter vorn einsetzen — pünktlich am Halt
        let ri = a.von, vorlauf = laenge(a.von, ref) - (D - t) * V;
        while (vorlauf > 0 && ri < ref) { vorlauf -= this.kanten[linie.kanten[ri]].laenge; ri++; }
        // Abfahrtszeiten an allen Halten dieser Richtung: am ersten der Fahrplan, danach Fahrzeit plus Halte
        const plan = new Map<number, number>();
        let zeit = D, vorige = ref;
        for (const hi of halteIdx) {
          if (hi !== ref) zeit += laenge(vorige, hi) / V + HALT_DAUER;
          // Auf den Fahrplan an diesem Halt einrasten, wenn es eine passende Abfahrt gibt
          const passend = abfahrten(linie.halte.get(hi)!.halt.name, a.ziel).find((x) => Math.abs(x - zeit) < 150);
          if (passend !== undefined) zeit = passend;
          plan.set(hi, zeit);
          vorige = hi;
        }
        this.neuerBus(linie, ri, { bis: a.bis, plan });
      }
    });
  }

  /** Einen Takt weiterrechnen. Gibt Unfälle zurück (Auto trifft Menschen). */
  schritt(dt: number, t: number, menschen: Fussgaenger[], ampelTaster: (a: Anlage) => number = () => -Infinity): Unfall[] {
    this.bevoelkern(menschen);
    const unfaelle: Unfall[] = [];
    const fertig = new Set<Fahrzeug>();
    for (const f of this.fahrzeuge) {
      const k = this.kanten[f.kante];
      const grenze = tempoGrenze(k.strasse);
      if (f.haltSeit != null) {
        // Bus an der Haltestelle: stehen, bis Türen zu sind.
        f.tempo = 0;
        if (t - f.haltSeit < (f.haltDauer ?? HALT_DAUER)) continue;
        f.bedientRi = f.haltRi;
        f.haltSeit = null;
        f.haltDauer = undefined;
      }
      const { d: frei, hupen } = this.freieStrecke(f, t, menschen, ampelTaster);
      const halt = this.naechsterBushalt(f);
      const d = halt ? Math.min(frei, halt.d) : frei;
      if (halt && halt.d < 0.4 && f.tempo < 0.5) {
        f.haltSeit = t; f.haltRi = halt.ri; f.tempo = 0;
        // Zu früh dran? Mit offenen Türen bis zur Abfahrtszeit warten (höchstens 5 Minuten)
        const ab = f.planAb?.get(halt.ri);
        f.haltDauer = ab !== undefined ? Math.min(300, Math.max(HALT_DAUER, ab - t)) : HALT_DAUER;
        continue;
      }
      if (hupen) f.hupe = t + 1.5;
      const halteTempo = Math.sqrt(2 * BREMSEN * Math.max(0, d));
      const soll = Math.min(grenze, halteTempo);
      if (f.tempo > soll) f.tempo = Math.max(soll, f.tempo - (d < 4 ? NOTBREMSE : BREMSEN * 1.5) * dt);
      else f.tempo = Math.min(soll, f.tempo + ANFAHREN * dt);
      if (d <= 0.05) f.tempo = 0;
      // Kriechen zählt als Stehen: erst richtig Fahren setzt die Geduld zurück.
      if (f.tempo < 1) f.stehtSeit ??= t;
      else if (f.tempo > 2) f.stehtSeit = undefined;

      f.s += f.tempo * dt;
      while (f.s >= this.kanten[f.kante].laenge) {
        if (f.naechste === null) { f.s = this.kanten[f.kante].laenge; f.tempo = 0; break; }
        f.s -= this.kanten[f.kante].laenge;
        // Sprung am Kartenrand: ohne seitliches Hinübergleiten neu ansetzen
        if (f.linie?.spruenge?.has(f.ri ?? 0)) f.quer = undefined;
        f.kante = f.naechste;
        if (f.linie) f.ri = ((f.ri ?? 0) + 1) % f.linie.kanten.length;
        // Fahrt nach Fahrplan am Kartenrand zu Ende
        if (f.fahrtBis !== undefined && f.ri === f.fahrtBis) {
          // Sitzt noch jemand drin, wendet er wie an einer Endhaltestelle und fährt zurück
          if (this.behalten?.(f)) { f.fahrtBis = undefined; f.planAb = undefined; } else { fertig.add(f); break; }
        }
        f.naechste = this.waehleNaechste(f.kante, f);
      }
      this.setzeLage(f);

      // Treffer: Mensch im Rechteck des Autos (plus Schulter).
      if (f.tempo > 1.5) {
        const c = Math.cos(f.winkel), s = Math.sin(f.winkel);
        for (const m of menschen) {
          const dx = m.x - f.x, dy = m.y - f.y;
          if (Math.abs(dx * c + dy * s) < f.laenge / 2 + 0.3 && Math.abs(-dx * s + dy * c) < f.breite / 2 + 0.3)
            unfaelle.push({ fahrzeug: f.id, fussgaenger: m.id, tempo: f.tempo });
        }
      }
    }
    if (fertig.size) this.fahrzeuge = this.fahrzeuge.filter((f) => !fertig.has(f));
    return unfaelle;
  }
}

function aufFahrbahnVor(stadt: Stadt, m: Fussgaenger) {
  const art = stadt.untergrund(m.x, m.y).art;
  return art === "fahrbahn" || art === "spielstrasse";
}
