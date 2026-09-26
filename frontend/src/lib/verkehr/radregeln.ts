/**
 * Regeln beim Radfahren (StVO): Radweg oder Fahrbahn statt Gehweg (bis 10
 * Jahre darf man auf dem Gehweg fahren, unter 8 muss man). Radwege mit blauem
 * Schild muss man benutzen (237 nur Rad, 240 gemeinsam mit Fußgängern, 241
 * getrennt); auf dem Gehweg mit »Radfahrer frei« nur im Schritttempo. An
 * Fußgängern mit Abstand und Klingel vorbei. Rechts fahren,
 * nicht gegen die Einbahnstraße, am Zebrastreifen absteigen und schieben,
 * rote Ampel gilt auch fürs Rad, im Dunkeln mit Licht. Wer es richtig macht,
 * sammelt Karma. Dazu: Wo darf das Rad abgestellt werden? Kein Pixi.
 */
import type { P } from "./geometrie";
import { achsenAbstand, autoLicht, type Anlage } from "./ampeln";
import { gehwegErlaubt } from "./fahrrad";
import type { RegelId } from "./regeln";
import type { Stadt } from "./stadt";

export type RadLage = {
  x: number; y: number; winkel: number; tempo: number; t: number;
  alter: number; dunkel: boolean; lichtOk: boolean;
  /** Fußgänger in der Nähe (Mitspieler und Passanten). */
  passanten?: { x: number; y: number }[];
  /** Sekunden seit dem letzten Klingeln. */
  seitKlingeln?: number;
};

/** Schritttempo: etwa 7 km/h. */
export const SCHRITT = 2;

export class RadWaechter {
  private zuletzt = new Map<RegelId, number>();
  private seit = new Map<string, number>();

  constructor(private stadt: Stadt, private anlagen: Anlage[], private taster: (a: Anlage) => number = () => -Infinity) {}

  /** Eine Bedingung, die eine Weile gelten muss (Sekunden), mit Pause zwischen den Meldungen. */
  private melde(aus: RegelId[], id: RegelId, gilt: boolean, t: number, dauer: number, pause: number, key: string = id) {
    if (!gilt) { this.seit.delete(key); return; }
    if (!this.seit.has(key)) this.seit.set(key, t);
    if (t - this.seit.get(key)! < dauer) return;
    if (t - (this.zuletzt.get(id) ?? -Infinity) < pause) return;
    this.zuletzt.set(id, t);
    aus.push(id);
  }

  pruefe(l: RadLage): { meldungen: RegelId[]; hinweis: string | null } {
    const aus: RegelId[] = [];
    let hinweis: string | null = null;
    const { t } = l;
    const u = this.stadt.untergrund(l.x, l.y);
    const faehrt = l.tempo > 0.5;

    // Gehweg: bis 10 erlaubt (unter 8 Pflicht), danach nicht — außer er ist auch fürs Rad freigegeben
    const gehwegVerboten = gehwegErlaubt(l.alter) === "nein";
    const gehRad = u.art === "gehweg" ? u.rad : undefined;
    this.melde(aus, "radGehweg", faehrt && u.art === "gehweg" && !gehRad && gehwegVerboten, t, 1.5, 20);
    if (u.art === "gehweg" && !gehRad && gehwegVerboten && faehrt) hinweis = "Mit über 10 Jahren nicht auf dem Gehweg fahren — Radweg, Fahrbahn oder absteigen und schieben (F).";
    // Radweg (237) und getrennter Geh- und Radweg (241): gut so
    this.melde(aus, "radwegGut", faehrt && (u.art === "radweg" || gehRad === "getrennt"), t, 5, 60);
    if (gehRad === "getrennt" && faehrt) hinweis ??= "Getrennter Geh- und Radweg (241): du fährst auf der roten Seite, Fußgänger auf ihrer.";
    // Gemeinsamer Geh- und Radweg (240): erlaubt, aber mit Rücksicht
    this.melde(aus, "radGemeinsamGut", faehrt && gehRad === "gemeinsam" && l.tempo <= 5, t, 6, 60);
    if (gehRad === "gemeinsam" && faehrt) hinweis ??= "Gemeinsamer Geh- und Radweg (240): Fußgänger dürfen hier auch gehen — klingeln (R) und mit Abstand vorbei.";
    // Gehweg mit »Radfahrer frei«: nur Schritttempo
    this.melde(aus, "radSchritt", gehRad === "frei" && l.tempo > SCHRITT + 0.5, t, 2, 20);
    if (gehRad === "frei" && faehrt) hinweis ??= "Gehweg, Radfahrer frei: fahren erlaubt, aber nur im Schritttempo (langsam, ohne Umschalt).";
    // Zu dicht und zu schnell an Fußgängern vorbei (auf allen Gehwegen), ohne zu klingeln
    if (u.art === "gehweg" && l.tempo > SCHRITT + 0.5 && (l.seitKlingeln ?? Infinity) > 4) {
      const dicht = (l.passanten ?? []).some((p) => Math.hypot(p.x - l.x, p.y - l.y) < 1.3);
      this.melde(aus, "radRuecksicht", dicht, t, 0, 15);
    }
    // Fahrbahn
    if (u.art === "fahrbahn") {
      // Ein Radweg mit blauem Schild, der daneben in dieselbe Richtung läuft, ist Pflicht
      const radweg = this.stadt.radwegNah(l.x, l.y, 9, l.winkel);
      // Ohne Radweg ist die Fahrbahn genau richtig
      this.melde(aus, "fahrbahnGut", faehrt && !radweg && !u.querung, t, 5, 60);
      this.melde(aus, "radBenutzungspflicht", faehrt && radweg && !u.querung, t, 4, 30);
      if (radweg && faehrt) hinweis = "Daneben ist ein Radweg mit blauem Schild — den musst du benutzen.";
      // Rechts fahren, nicht gegen die Einbahnstraße
      const n = this.stadt.naechsteStrasse(l.x, l.y, u.strasse.breite);
      if (n && faehrt) {
        const w = Math.atan2(n.st.b[1] - n.st.a[1], n.st.b[0] - n.st.a[0]);
        const laengs = Math.cos(l.winkel - w);
        if (Math.abs(laengs) > 0.7) {
          const q = -(l.x - n.st.a[0]) * Math.sin(w) + (l.y - n.st.a[1]) * Math.cos(w);
          const gegen = !!n.s.einbahn && laengs < 0;
          this.melde(aus, "radGegenEinbahn", gegen, t, 1, 20);
          this.melde(aus, "radLinks", !n.s.einbahn && q * Math.sign(laengs) < -0.3, t, 2, 20);
          if (gegen) hinweis = "Das ist eine Einbahnstraße — du fährst dagegen!";
        }
      }
      // Zebrastreifen: absteigen und schieben
      this.melde(aus, "radZebra", faehrt && u.querung?.art === "zebra", t, 0, 15);
      // Rote Ampel gilt auch fürs Rad
      for (const a of this.anlagen) {
        if (Math.hypot(a.mitte[0] - l.x, a.mitte[1] - l.y) > 9) continue;
        const achse = a.achsen.length > 1 && achsenAbstand(a.achsen[1], l.winkel) < achsenAbstand(a.achsen[0], l.winkel) ? 1 : 0;
        const rot = autoLicht(a, achse, t, this.taster(a)) === "rot";
        this.melde(aus, "radRot", faehrt && rot, t, 0, 20, `rot${a.id}`);
      }
    } else this.seit.delete("fahrbahnGut");
    // Im Dunkeln ohne Licht
    this.melde(aus, "radOhneLicht", faehrt && l.dunkel && !l.lichtOk, t, 2, 60);
    if (l.dunkel && !l.lichtOk && faehrt) hinweis ??= "Es ist dunkel und dein Licht geht nicht — absteigen und schieben, oder in der Werkstatt reparieren.";
    return { meldungen: aus, hinweis };
  }
}

/**
 * Darf das Rad hier stehen? Am Fahrradständer ist es am besten; auf freier
 * Fläche geht es, wenn es nicht im Weg steht — nicht auf Fahrbahn, Radweg,
 * Gleis, nicht am Überweg und nicht an der Haltestelle.
 */
export function abstellen(stadt: Stadt, p: P): { ok: boolean; amStaender: boolean; grund?: string } {
  const staender = stadt.karte.punkte.some((q) => q.art === "radstaender" && Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < 4);
  if (staender) return { ok: true, amStaender: true };
  const u = stadt.untergrund(p[0], p[1]);
  if (u.art === "fahrbahn" || u.art === "spielstrasse") return { ok: false, amStaender: false, grund: "Auf der Fahrbahn steht das Rad den Autos im Weg." };
  if (u.art === "radweg" || (u.art === "gehweg" && (u.rad === "gemeinsam" || u.rad === "getrennt"))) return { ok: false, amStaender: false, grund: "Auf dem Radweg stolpern andere über dein Rad." };
  if (u.art === "gleis" || u.art === "bahnsteig") return { ok: false, amStaender: false, grund: "Nicht auf Gleis oder Bahnsteig abstellen." };
  const nah = (art: string, r: number) => stadt.karte.punkte.some((q) => q.art === art && Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < r);
  if (nah("zebra", 5) || nah("ampelUebergang", 5) || nah("querung", 4)) return { ok: false, amStaender: false, grund: "Am Überweg versperrt es den Weg — auch für Rollstühle und Kinderwagen." };
  if (stadt.halte.some((h) => Math.hypot(h.p[0] - p[0], h.p[1] - p[1]) < 8)) return { ok: false, amStaender: false, grund: "An der Haltestelle stört es beim Ein- und Aussteigen." };
  return { ok: true, amStaender: false };
}
