/**
 * Die Verkehrsregeln für Fußgänger — was beim Laufen geprüft wird und was
 * es bringt oder kostet. Rein aus Zuständen gerechnet, kein Pixi.
 */
import { anlageAn, fussGruen, type Anlage } from "./ampeln";
import { abstandZuStrecke } from "./geometrie";
import { winkelVon, type Stadt, type Untergrund } from "./stadt";
import { anDerTuer, imKorridor, seitlichDaneben, type Tuer, type TuerPhase } from "./tueren";

export type RegelId =
  | "rot" | "nichtGeschaut" | "umweg" | "troedeln" | "radweg" | "gleis" | "angefahren"
  | "sicherGequert" | "gruenGequert" | "zebraGequert" | "beleidigung"
  | "tuerBlockiert" | "gutEingestiegen" | "eingestiegen" | "ausgestiegen" | "verdeckt" | "weisseLinie"
  | "gruppeWand" | "gruppeSchlange" | "schildRichtig" | "schildFalsch";

export type Meldung = { id: RegelId; text: string; punkte: number; schwer?: boolean };

export const MELDUNGEN: Record<RegelId, Meldung> = {
  rot: { id: "rot", text: "Bei Rot über die Ampel! Warte auf Grün — auch wenn kein Auto kommt.", punkte: -20, schwer: true },
  nichtGeschaut: { id: "nichtGeschaut", text: "Nicht geschaut! Am Bordstein stehen bleiben, links – rechts – links schauen (Leertaste).", punkte: -5 },
  umweg: { id: "umweg", text: "Ganz in der Nähe ist ein Überweg. Den nehmen, auch wenn es ein paar Schritte mehr sind.", punkte: -5 },
  troedeln: { id: "troedeln", text: "Nicht auf der Fahrbahn bummeln — auf dem kürzesten Weg gerade hinüber.", punkte: -5 },
  radweg: { id: "radweg", text: "Das ist ein Radweg. Zu Fuß bitte auf den Gehweg.", punkte: -3 },
  gleis: { id: "gleis", text: "Gleise nur an einem Übergang überqueren — Bahnen können nicht ausweichen und haben einen langen Bremsweg.", punkte: -20, schwer: true },
  angefahren: { id: "angefahren", text: "Autsch — angefahren! Zum Glück nur im Spiel.", punkte: -30, schwer: true },
  sicherGequert: { id: "sicherGequert", text: "Gut geschaut und sicher gequert.", punkte: 5 },
  gruenGequert: { id: "gruenGequert", text: "Bei Grün über die Ampel — vorbildlich.", punkte: 10 },
  zebraGequert: { id: "zebraGequert", text: "Sauber über den Zebrastreifen.", punkte: 10 },
  tuerBlockiert: { id: "tuerBlockiert", text: "Du stehst vor der Tür! Erst aussteigen lassen — seitlich neben der Tür warten.", punkte: -10 },
  gutEingestiegen: { id: "gutEingestiegen", text: "Seitlich gewartet, erst aussteigen lassen, dann eingestiegen. Genau so!", punkte: 10 },
  eingestiegen: { id: "eingestiegen", text: "Eingestiegen. Tipp: Beim nächsten Mal seitlich neben der Tür warten, bis alle draußen sind.", punkte: 2 },
  ausgestiegen: { id: "ausgestiegen", text: "Ausgestiegen. Warte, bis das Fahrzeug abgefahren ist, bevor du über die Straße gehst.", punkte: 0 },
  verdeckt: { id: "verdeckt", text: "Nicht vor oder hinter einem haltenden Bus über die Straße — die Autofahrer sehen dich nicht. Warte, bis er weg ist.", punkte: -5 },
  weisseLinie: { id: "weisseLinie", text: "Hinter der weißen Linie bleiben, wenn eine Bahn einfährt — der Fahrtwind kann dich mitreißen.", punkte: -10 },
  gruppeWand: { id: "gruppeWand", text: "Als Wand gequert — alle nebeneinander, alle zugleich.", punkte: 15 },
  gruppeSchlange: { id: "gruppeSchlange", text: "Als Schlange gequert — nebeneinander wärt ihr schneller drüben.", punkte: 0 },
  schildRichtig: { id: "schildRichtig", text: "Richtig!", punkte: 5 },
  schildFalsch: { id: "schildFalsch", text: "Nicht ganz — lies die Erklärung.", punkte: 0 },
  beleidigung: { id: "beleidigung", text: "Schimpfen hilft niemandem. Die Polizei hat das gesehen …", punkte: -15, schwer: true },
};

/** Ein haltendes Fahrzeug, hinter dem man nicht hervortreten soll. */
export type Verdecker = { x: number; y: number; winkel: number; laenge: number };

/** Steht der Punkt kurz vor oder hinter dem Fahrzeug (bis 10 m), seitlich höchstens 6 m? */
export function verdecktVon(h: Verdecker, x: number, y: number) {
  const c = Math.cos(h.winkel), s = Math.sin(h.winkel);
  const laengs = (x - h.x) * c + (y - h.y) * s, quer = -(x - h.x) * s + (y - h.y) * c;
  return Math.abs(laengs) > h.laenge / 2 - 1 && Math.abs(laengs) < h.laenge / 2 + 10 && Math.abs(quer) < 6;
}

/** So lange gilt ein Blick nach links und rechts. */
export const BLICK_GILT = 4;
/** So lange dauert das Umschauen (Kopf links, rechts, links). */
export const UMSCHAUEN_DAUER = 1.2;
/** In diesem Umkreis zählt ein Überweg als »in der Nähe«. */
const UEBERWEG_NAH = 40;

type Querung = {
  seit: number;
  art: "ampel" | "zebra" | "frei";
  ok: boolean;
};

export class Regelwaechter {
  private vorher: Untergrund["art"] = "gehweg";
  private querung: Querung | null = null;
  private geschautUm = -Infinity;
  private radwegSeit: number | null = null;
  private zuletzt = new Map<RegelId, number>();
  private gemeldetTroedeln = false;

  constructor(private stadt: Stadt, private anlagen: Anlage[], private taster: (a: Anlage) => number = () => -Infinity) {}

  /** Umschauen ist fertig — gilt ab jetzt `BLICK_GILT` Sekunden. */
  geschaut(t: number) { this.geschautUm = t; }

  /**
   * Einen Takt prüfen; gibt die neuen Meldungen zurück. `haltende` sind
   * Busse, die gerade an einer Haltestelle stehen und die Sicht verdecken.
   */
  pruefe(x: number, y: number, t: number, haltende: Verdecker[] = []): Meldung[] {
    const aus: Meldung[] = [];
    const melde = (id: RegelId, abstand = 0) => {
      const letzte = this.zuletzt.get(id) ?? -Infinity;
      if (t - letzte < abstand) return;
      this.zuletzt.set(id, t);
      aus.push(MELDUNGEN[id]);
    };
    const u = this.stadt.untergrund(x, y);

    if (u.art === "fahrbahn" && this.vorher !== "fahrbahn") {
      const n = this.stadt.naechsteStrasse(x, y, u.strasse.breite);
      const winkel = n ? winkelVon(n.st) : 0;
      const ampel = u.querung?.art === "ampelUebergang" || !u.querung ? anlageAn(this.anlagen, x, y, winkel) : null;
      if (ampel && (u.querung?.art === "ampelUebergang" || this.naheAmpelFurt(x, y))) {
        const gruen = fussGruen(ampel.a, ampel.achse, t, this.taster(ampel.a));
        if (!gruen) melde("rot", 3);
        this.querung = { seit: t, art: "ampel", ok: gruen };
      } else {
        const geschaut = t - this.geschautUm <= BLICK_GILT;
        if (!geschaut) melde("nichtGeschaut", 3);
        const zebra = u.querung?.art === "zebra";
        let ok = geschaut;
        if (!u.querung && this.ueberwegInDerNaehe(x, y)) { melde("umweg", 10); ok = false; }
        this.querung = { seit: t, art: zebra ? "zebra" : "frei", ok };
      }
      this.gemeldetTroedeln = false;
      if (haltende.some((h) => verdecktVon(h, x, y))) { melde("verdeckt", 5); if (this.querung) this.querung.ok = false; }
    }

    if (u.art === "fahrbahn" && this.querung && !this.gemeldetTroedeln && t - this.querung.seit > u.strasse.breite / 1.2 + 6) {
      this.gemeldetTroedeln = true;
      this.querung.ok = false;
      melde("troedeln");
    }

    if (u.art !== "fahrbahn" && this.vorher === "fahrbahn" && this.querung) {
      if (this.querung.ok && (u.art === "gehweg" || u.art === "gelaende" || u.art === "bahnsteig"))
        melde(this.querung.art === "ampel" ? "gruenGequert" : this.querung.art === "zebra" ? "zebraGequert" : "sicherGequert", 5);
      this.querung = null;
    }

    if (u.art === "radweg") {
      this.radwegSeit ??= t;
      if (t - this.radwegSeit > 1.5) melde("radweg", 20);
    } else this.radwegSeit = null;

    if (u.art === "gleis" && this.vorher !== "gleis" && !this.amBahnuebergang(x, y)) melde("gleis", 5);

    if (u.art !== "haus") this.vorher = u.art;
    return aus;
  }

  /** Nach einem Unfall oder Neustart: laufende Querung vergessen. */
  zuruecksetzen() {
    this.querung = null;
    this.vorher = "gehweg";
  }

  private naheAmpelFurt(x: number, y: number) {
    return this.anlagen.some((a) => a.signale.some((s) => Math.hypot(s.p[0] - x, s.p[1] - y) < 12));
  }

  private ueberwegInDerNaehe(x: number, y: number) {
    return this.stadt.karte.punkte.some(
      (p) => (p.art === "zebra" || p.art === "ampelUebergang") && Math.hypot(p.p[0] - x, p.p[1] - y) < UEBERWEG_NAH,
    );
  }

  private amBahnuebergang(x: number, y: number) {
    if (this.stadt.karte.punkte.some((p) => p.art === "bahnuebergang" && Math.hypot(p.p[0] - x, p.p[1] - y) < 6)) return true;
    // Wo eine Straße das Gleis kreuzt, ist ein Übergang.
    const n = this.stadt.naechsteStrasse(x, y, 8);
    return !!n && abstandZuStrecke(x, y, n.st.a, n.st.b).d <= n.s.breite / 2 + n.s.gehwegBreite;
  }
}

/** Eine offene (oder sich öffnende) Tür eines haltenden Fahrzeugs. */
export type OffeneTuer = { fahrzeug: string; halt: string; phase: TuerPhase; tuer: Tuer };

/**
 * Regeln am Fahrzeug: vor der Tür stehen, während andere aussteigen, kostet;
 * seitlich warten und danach einsteigen bringt Punkte. Je Fahrzeug und Halt
 * einmal.
 */
export class Einstiegsregeln {
  private blockiert = new Set<string>();
  private gewartet = new Set<string>();

  pruefe(x: number, y: number, offene: OffeneTuer[]): { meldungen: Meldung[]; einsteigen: OffeneTuer | null } {
    const meldungen: Meldung[] = [];
    let einsteigen: OffeneTuer | null = null;
    for (const o of offene) {
      const key = `${o.fahrzeug}@${o.halt}`;
      if (o.phase === "aussteigen") {
        if (imKorridor(o.tuer, x, y) && !this.blockiert.has(key)) { this.blockiert.add(key); meldungen.push(MELDUNGEN.tuerBlockiert); }
        if (seitlichDaneben(o.tuer, x, y)) this.gewartet.add(key);
      } else if (o.phase === "einsteigen" && anDerTuer(o.tuer, x, y) && !einsteigen) {
        einsteigen = o;
        meldungen.push(this.gewartet.has(key) && !this.blockiert.has(key) ? MELDUNGEN.gutEingestiegen : MELDUNGEN.eingestiegen);
      }
    }
    return { meldungen, einsteigen };
  }
}
