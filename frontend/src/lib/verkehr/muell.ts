/**
 * Müll aufheben und in den Eimer werfen — für Punkte und gutes Karma. Eimer
 * stehen an der Schule, an Supermärkten, an Bushaltestellen und in Parks.
 * Der Müll liegt auf Gehwegen und Wiesen, ein wenig auch am Fahrbahnrand:
 * dort bückt man sich NICHT (Lektion — wer sich auf der Straße bückt, sieht
 * die Autos nicht).
 *
 * Jeder Spieler hat seinen eigenen Müll (fester Zufall je Spiel), damit
 * nichts über die Leitung muss.
 */
import type { P } from "./geometrie";
import { schulStart, type Stadt } from "./stadt";

export const MUELL_ARTEN = ["🥤", "🍌", "📰", "🧃", "🍫", "🥫", "🧻"] as const;
/** So viel kann man auf einmal tragen. */
export const TRAGEN = 3;
/** Nah genug zum Aufheben bzw. Einwerfen (m). */
export const GREIFEN = 1.6;
export const EIMER_NAH = 2.2;

export type Stueck = { id: number; p: P; art: string; aufFahrbahn: boolean };

function mitte(umriss: P[]): P {
  return [umriss.reduce((a, p) => a + p[0], 0) / umriss.length, umriss.reduce((a, p) => a + p[1], 0) / umriss.length];
}

/** Wo Mülleimer stehen. */
export function baueEimer(stadt: Stadt): P[] {
  const orte: P[] = [];
  // Schule: gleich am Start vor dem Eingang. Läden: die Punkte liegen im
  // Gebäude — der Eimer steht auf dem nächsten Gehweg (ein Innenhof wäre
  // womöglich nicht erreichbar).
  const [sx, sy] = schulStart(stadt);
  orte.push([sx + 1.5, sy]);
  const aufGehweg = (p: P): P | null => {
    for (let r = 0; r <= 60; r += 1.5)
      for (let i = 0; i < 24; i++) {
        const w = (i / 24) * Math.PI * 2, x = p[0] + Math.cos(w) * r, y = p[1] + Math.sin(w) * r;
        if (stadt.untergrund(x, y).art === "gehweg") return [x, y];
      }
    return null;
  };
  for (const p of stadt.karte.punkte.filter((p) => p.shop === "supermarket")) {
    const d = aufGehweg(p.p);
    if (d) orte.push(d);
  }
  for (const w of stadt.wartebereiche) { const [x, y] = mitte(w); orte.push([x + (w[1][0] - w[0][0]) * 0.35, y + (w[1][1] - w[0][1]) * 0.35]); }
  for (const f of stadt.karte.flaechen)
    if ((f.art === "spielplatz" || f.art === "gruen" || f.art === "sportplatz") && f.umriss.length >= 3) orte.push(mitte(f.umriss));
  // Nur Orte, die man erreicht (nicht im Haus), und keine doppelten.
  return orte.filter((p, i) => stadt.untergrund(p[0], p[1]).art !== "haus"
    && !orte.slice(0, i).some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 15));
}

/** Kleiner fester Zufallsgenerator (Park–Miller). */
function zufall(saat: number) {
  let z = (saat % 2147483646) + 1;
  return () => ((z = (z * 16807) % 2147483647) - 1) / 2147483646;
}

export class Muell {
  stuecke: Stueck[] = [];
  private naechsteId = 1;
  private z: () => number;

  constructor(private stadt: Stadt, saat = 42, anzahl = 600) {
    this.z = zufall(saat);
    const r = stadt.karte.radius;
    let versuche = 0;
    while (this.stuecke.length < anzahl && versuche++ < anzahl * 40) {
      const p: P = [(this.z() * 2 - 1) * r, (this.z() * 2 - 1) * r];
      this.lege(p);
    }
  }

  /** Legt ein Stück hin, wenn der Ort passt; ein Zehntel darf am Fahrbahnrand liegen. */
  private lege(p: P): boolean {
    const u = this.stadt.untergrund(p[0], p[1]).art;
    const aufFahrbahn = u === "fahrbahn";
    if (u !== "gehweg" && u !== "gelaende" && !(aufFahrbahn && this.z() < 0.12)) return false;
    this.stuecke.push({ id: this.naechsteId++, p, art: MUELL_ARTEN[Math.floor(this.z() * MUELL_ARTEN.length)], aufFahrbahn });
    return true;
  }

  /** Nachschub in der Nähe (15–50 m), damit es nie ganz sauber bleibt. */
  nachschub(x: number, y: number) {
    for (let i = 0; i < 20; i++) {
      const w = this.z() * Math.PI * 2, d = 15 + this.z() * 35;
      if (this.lege([x + Math.cos(w) * d, y + Math.sin(w) * d])) return;
    }
  }

  naechstes(x: number, y: number, r = GREIFEN): Stueck | null {
    let best: Stueck | null = null, bd = r;
    for (const s of this.stuecke) {
      const d = Math.hypot(s.p[0] - x, s.p[1] - y);
      if (d <= bd) { bd = d; best = s; }
    }
    return best;
  }

  nimm(id: number) {
    this.stuecke = this.stuecke.filter((s) => s.id !== id);
  }
}
