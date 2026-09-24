/**
 * Als Gruppe über die Straße: »Wand« (nebeneinander, alle zugleich) statt
 * »Schlange« (einer hinter dem anderen). Bei der Schlange steht die Gruppe
 * so lange auf der Fahrbahn, wie der Erste bis zum Letzten braucht — bei der
 * Wand nur so lange, wie einer braucht.
 *
 * Jeder Browser bewertet seine eigene Querung und schaut dafür, wer mit ihm
 * zusammen auf dieselbe Fahrbahn gegangen ist.
 */
import type { P } from "./geometrie";

type Querung = { rein: number; raus: number | null; p: P };

/** Wer innerhalb dieses Abstands und dieser Zeit mit hineingeht, gehört zur Gruppe. */
const NAH = 12, ZUGLEICH = 6;
/** So dicht müssen die Eintritte beieinander liegen, damit es eine Wand ist. */
export const WAND_SPANNE = 2.5;
export const GRUPPE_MIN = 3;

export type Gruppenurteil = { wand: boolean; n: number; spanne: number; dauer: number; einzeln: number };

export class Gruppenblick {
  private jetzt = new Map<string, Querung>();
  private fertig = new Map<string, Querung>();
  private auf = new Map<string, boolean>();

  /** Jeden Takt für jeden Spieler (auch sich selbst): steht er auf der Fahrbahn? */
  melde(key: string, aufFahrbahn: boolean, t: number, p: P) {
    const vorher = this.auf.get(key) ?? false;
    this.auf.set(key, aufFahrbahn);
    if (aufFahrbahn && !vorher) this.jetzt.set(key, { rein: t, raus: null, p });
    if (!aufFahrbahn && vorher) {
      const q = this.jetzt.get(key);
      if (q) { q.raus = t; this.fertig.set(key, q); this.jetzt.delete(key); }
    }
  }

  /** Nachdem `ich` die Fahrbahn verlassen hat: War das eine Gruppenquerung, und wie? */
  urteil(ich: string, t: number): Gruppenurteil | null {
    const meine = this.fertig.get(ich);
    if (!meine || meine.raus === null) return null;
    const gruppe: Querung[] = [meine];
    for (const [key, q] of [...this.fertig, ...this.jetzt]) {
      if (key === ich) continue;
      if (Math.abs(q.rein - meine.rein) <= ZUGLEICH && Math.hypot(q.p[0] - meine.p[0], q.p[1] - meine.p[1]) <= NAH) gruppe.push(q);
    }
    if (gruppe.length < GRUPPE_MIN) return null;
    const reins = gruppe.map((q) => q.rein);
    const spanne = Math.max(...reins) - Math.min(...reins);
    const dauer = Math.max(...gruppe.map((q) => q.raus ?? t)) - Math.min(...reins);
    return { wand: spanne <= WAND_SPANNE, n: gruppe.length, spanne, dauer, einzeln: meine.raus - meine.rein };
  }
}
