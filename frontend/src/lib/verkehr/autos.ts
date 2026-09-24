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
import type { Halt, Stadt, Strasse } from "./stadt";
import { HALT_DAUER } from "./tueren";

export type Knoten = { p: P; aus: number[] };
export type Kante = {
  von: number; nach: number; a: P; b: P; laenge: number; winkel: number;
  strasse: Strasse; spur: number; halte: Haltepunkt[];
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
  /** Nur Busse: fährt die Linie ab und hält an ihren Haltestellen. */
  linie?: Linie;
  /** Stelle in `linie.kanten`. */
  ri?: number;
  /** Seit wann der Bus an einer Haltestelle steht; `haltRi` = an welcher. */
  haltSeit?: number | null;
  haltRi?: number;
  /** Zuletzt bediente Stelle, damit er nicht zweimal hält. */
  bedientRi?: number;
};

/** Eine Buslinie als Rundkurs über die Kanten, mit den Haltestellen darauf. */
export type Linie = { kanten: number[]; halte: Map<number, { s: number; halt: Halt }> };

/** Busmaße und Türen (Abstand der Türmitten von der Busmitte). */
export const BUS = { laenge: 12, breite: 2.55, tueren: [4.3, -0.6], farbe: 0xeeeeee } as const;

/** Was der Verkehr über jeden Menschen auf der Karte wissen muss. */
export type Fussgaenger = {
  id: string; x: number; y: number;
  /** Zeitpunkt des letzten ✋. */
  hand: number;
  /** Bis wann Autofahrer ihn nicht vorlassen (nach Beleidigungen). */
  karmaBis: number;
};

export type Unfall = { fahrzeug: number; fussgaenger: string; tempo: number };

const FAHRBAR = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street"]);
const AUTOFARBEN = [0xc0392b, 0x2e86de, 0xf1c40f, 0xecf0f1, 0x2c3e50, 0x27ae60, 0x8e44ad, 0x7f8c8d, 0xe67e22];

const BREMSEN = 4.5, NOTBREMSE = 9, ANFAHREN = 2.2;
const SICHT = 40;

export function tempoGrenze(s: Strasse): number {
  const kmh = s.tempo ?? (s.art === "living_street" ? 7 : s.art === "secondary" || s.art === "primary" ? 50 : s.art === "tertiary" ? 40 : 30);
  return kmh / 3.6;
}

export class Strassenverkehr {
  readonly knoten: Knoten[] = [];
  readonly kanten: Kante[] = [];
  fahrzeuge: Fahrzeug[] = [];
  private naechsteId = 1;

  constructor(readonly stadt: Stadt, readonly anlagen: Anlage[], readonly ziel = 28) {
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
        this.kante(a, b, s);
        if (!s.einbahn) this.kante(b, a, s);
      }
    }
    this.haltepunkteEintragen();
  }

  private kante(von: number, nach: number, strasse: Strasse) {
    const a = this.knoten[von].p, b = this.knoten[nach].p;
    const laenge = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (laenge < 0.01) return;
    this.knoten[von].aus.push(this.kanten.length);
    this.kanten.push({
      von, nach, a, b, laenge, winkel: Math.atan2(b[1] - a[1], b[0] - a[0]), strasse,
      spur: strasse.einbahn ? 0 : strasse.breite / 4, halte: [],
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

  private waehleNaechste(kante: number, f?: Fahrzeug): number | null {
    if (f?.linie) return f.linie.kanten[((f.ri ?? 0) + 1) % f.linie.kanten.length];
    const k = this.kanten[kante];
    const aus = this.knoten[k.nach].aus.filter((i) => this.kanten[i].nach !== k.von);
    if (aus.length) return aus[Math.floor(Math.random() * aus.length)];
    const zurueck = this.knoten[k.nach].aus;
    return zurueck.length ? zurueck[0] : null;
  }

  private setzeLage(f: Fahrzeug) {
    const k = this.kanten[f.kante];
    const c = Math.cos(k.winkel), s = Math.sin(k.winkel);
    f.x = k.a[0] + c * f.s - s * k.spur;
    f.y = k.a[1] + s * f.s + c * k.spur;
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
      if (laengs < 0 || laengs > SICHT) continue;
      if (Math.abs(quer) < f.breite / 2 + 1 && aufFahrbahnVor(this.stadt, m)) {
        frei = Math.min(frei, laengs - f.laenge / 2 - 1.5);
        if (m.karmaBis > t) hupen = true;
      } else if (t - m.hand < 2 && Math.abs(quer) < k.strasse.breite / 2 + 4 && laengs > 6) {
        if (m.karmaBis > t) hupen = true;
        else f.wartetBis = Math.max(f.wartetBis, t + 5);
      }
      if (f.wartetBis > t && Math.abs(quer) < k.strasse.breite / 2 + 5 && laengs > 0) frei = Math.min(frei, laengs - f.laenge / 2 - 3);
    }

    // Vorderwagen
    for (const o of this.fahrzeuge) {
      if (o === f) continue;
      const dx = o.x - f.x, dy = o.y - f.y;
      const laengs = dx * c + dy * s, quer = -dx * s + dy * c;
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

  /** `anzahl` Busse gleichmäßig auf die Linie setzen. */
  setzeBusse(linie: Linie, anzahl: number) {
    for (let i = 0; i < anzahl; i++) {
      const ri = Math.floor((i * linie.kanten.length) / anzahl);
      this.setze({
        id: this.naechsteId++, art: "bus", farbe: BUS.farbe, laenge: BUS.laenge, breite: BUS.breite,
        kante: linie.kanten[ri], s: 0, tempo: 0, naechste: linie.kanten[(ri + 1) % linie.kanten.length],
        x: 0, y: 0, winkel: 0, hupe: 0, wartetBis: 0, linie, ri, haltSeit: null,
      });
    }
  }

  /** Einen Takt weiterrechnen. Gibt Unfälle zurück (Auto trifft Menschen). */
  schritt(dt: number, t: number, menschen: Fussgaenger[], ampelTaster: (a: Anlage) => number = () => -Infinity): Unfall[] {
    this.bevoelkern(menschen);
    const unfaelle: Unfall[] = [];
    for (const f of this.fahrzeuge) {
      const k = this.kanten[f.kante];
      const grenze = tempoGrenze(k.strasse);
      if (f.haltSeit != null) {
        // Bus an der Haltestelle: stehen, bis Türen zu sind.
        f.tempo = 0;
        if (t - f.haltSeit < HALT_DAUER) continue;
        f.bedientRi = f.haltRi;
        f.haltSeit = null;
      }
      const { d: frei, hupen } = this.freieStrecke(f, t, menschen, ampelTaster);
      const halt = this.naechsterBushalt(f);
      const d = halt ? Math.min(frei, halt.d) : frei;
      if (halt && halt.d < 0.4 && f.tempo < 0.5) { f.haltSeit = t; f.haltRi = halt.ri; f.tempo = 0; continue; }
      if (hupen) f.hupe = t + 1.5;
      const halteTempo = Math.sqrt(2 * BREMSEN * Math.max(0, d));
      const soll = Math.min(grenze, halteTempo);
      if (f.tempo > soll) f.tempo = Math.max(soll, f.tempo - (d < 4 ? NOTBREMSE : BREMSEN * 1.5) * dt);
      else f.tempo = Math.min(soll, f.tempo + ANFAHREN * dt);
      if (d <= 0.05) f.tempo = 0;

      f.s += f.tempo * dt;
      while (f.s >= this.kanten[f.kante].laenge) {
        if (f.naechste === null) { f.s = this.kanten[f.kante].laenge; f.tempo = 0; break; }
        f.s -= this.kanten[f.kante].laenge;
        f.kante = f.naechste;
        if (f.linie) f.ri = ((f.ri ?? 0) + 1) % f.linie.kanten.length;
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
    return unfaelle;
  }
}

function aufFahrbahnVor(stadt: Stadt, m: Fussgaenger) {
  return stadt.untergrund(m.x, m.y).art === "fahrbahn";
}
