/** Spiellogik der Turmverteidigung (rein, ohne React): Wellen, Türme, Gold. Gegner laufen entlang eines Pfades (Index als Kommazahl). */

export type TurmArt = "pfeil" | "kanone" | "magie";
export type Gegner = { id: number; t: number; hp: number; max: number; tempo: number; bremse: number; anfuehrer?: string; art?: GegnerArt };
export type GegnerArt = "schwarm" | "schnell" | "panzer";
export type Turm = { platz: number; art: TurmArt; stufe: number; kuehl: number };
export type Schuss = { von: [number, number]; nach: [number, number]; art: TurmArt; ttl: number };
type Eintrag = { at: number; hp: number; tempo: number; anfuehrer?: string; art?: GegnerArt };
export type Zustand = {
  gegner: Gegner[]; tuerme: Turm[]; schuesse: Schuss[]; gold: number; verdient: number; abschuesse: number;
  welle: number; burg: number; burgMax: number; uhr: number; warteschlange: Eintrag[]; naechsteId: number; meldung: string;
  /** Schwächung künftiger Schwärme (0 bis SCHWAECHE_MAX); blitz = Sekunden Trefferblitz nach einem gefallenen Anführer */
  schwaeche: number; blitz: number;
};

export const TURM_DATEN: Record<TurmArt, { name: string; emoji: string; preis: number; reichweite: number; schaden: number; tempo: number; farbe: string }> = {
  pfeil: { name: "Pfeilturm", emoji: "🏹", preis: 50, reichweite: 2.4, schaden: 1, tempo: 2, farbe: "#f5e6a8" },
  kanone: { name: "Kanone", emoji: "💣", preis: 90, reichweite: 1.9, schaden: 4, tempo: 0.6, farbe: "#ff9f43" },
  magie: { name: "Magierturm", emoji: "🔮", preis: 120, reichweite: 2.9, schaden: 2, tempo: 1.1, farbe: "#c77dff" },
};
export const MAX_STUFE = 3;
export const KILL_GOLD = 6;
export const BONUS_GOLD = 40;
/** Tempo der Simulation, solange eine Anführer-Frage offen ist */
export const ZEITSCHLEIFE = 0.25;
export const SCHWAECHE_JE_ANFUEHRER = 0.15;
export const SCHWAECHE_MAX = 0.6;
export const SOFORT_SCHADEN = 0.4;

/** Zeitfaktor der Simulation: Frage offen = Zeitschleife (bei reduzierter Bewegung: Stillstand), sonst 1. */
export const zeitFaktor = (frageOffen: boolean, reduziert: boolean) => (!frageOffen ? 1 : reduziert ? 0 : ZEITSCHLEIFE);

/** Stärke der Welle (reine Spielschicht): Leben ×1,15 je Welle (bis ×4), Tempo +3 % je Welle (bis +60 %), Anzahl +1 alle 2 Wellen (bis 14). */
export const welleHp = (welle: number) => Math.min(4, 1.15 ** Math.max(0, welle - 1));
export const welleTempo = (welle: number) => Math.min(1.6, 1 + 0.03 * Math.max(0, welle - 1));
export const welleAnzahl = (welle: number) => Math.min(14, 6 + Math.floor(Math.max(0, welle - 1) / 2));

export const neuerZustand = (): Zustand => ({
  gegner: [], tuerme: [], schuesse: [], gold: 150, verdient: 0, abschuesse: 0, welle: 0, burg: 10, burgMax: 10,
  uhr: 0, warteschlange: [], naechsteId: 1, meldung: "", schwaeche: 0, blitz: 0,
});

export const ausbauPreis = (t: Turm) => 40 + 30 * t.stufe;
export const schadenVon = (t: Turm) => TURM_DATEN[t.art].schaden * (1 + 0.6 * (t.stufe - 1));

export function kaufe(z: Zustand, platz: number, art: TurmArt): boolean {
  const p = TURM_DATEN[art].preis;
  if (z.gold < p || z.tuerme.some((t) => t.platz === platz)) return false;
  z.gold -= p;
  z.tuerme.push({ platz, art, stufe: 1, kuehl: 0 });
  return true;
}

export function verbessere(z: Zustand, platz: number): boolean {
  const t = z.tuerme.find((x) => x.platz === platz);
  if (!t || t.stufe >= MAX_STUFE || z.gold < ausbauPreis(t)) return false;
  z.gold -= ausbauPreis(t);
  t.stufe += 1;
  return true;
}

/** Startet die nächste Welle; `anfuehrer` = Challenge-Ids, deren gepanzerte Anführer jetzt mitmarschieren. */
export function startWelle(z: Zustand, anfuehrer: string[] = []): void {
  z.welle += 1;
  z.burg = z.burgMax;
  z.uhr = 0;
  const n = welleAnzahl(z.welle);
  const hp0 = 2 * welleHp(z.welle) * (1 - z.schwaeche), tf = welleTempo(z.welle);
  for (let i = 0; i < n; i++) {
    // ab Welle 3: jeder 4. ein Schneller (halbes Leben, +40 % Tempo), jeder 5. ein Gepanzerter (doppeltes Leben, langsamer)
    const art: GegnerArt = z.welle >= 3 && i % 4 === 3 ? "schnell" : z.welle >= 3 && i % 5 === 4 ? "panzer" : "schwarm";
    const hp = Math.max(0.5, hp0 * (art === "schnell" ? 0.5 : art === "panzer" ? 2 : 1));
    const tempo = (0.9 + (i % 3) * 0.08) * tf * (art === "schnell" ? 1.4 : art === "panzer" ? 0.8 : 1);
    z.warteschlange.push({ at: i * 0.9, hp, tempo, art });
  }
  anfuehrer.forEach((id, k) => z.warteschlange.push({ at: 1.5 + k * 3, hp: 1, tempo: 0.28, anfuehrer: id }));
  z.warteschlange.sort((a, b) => a.at - b.at);
  z.meldung = `Welle ${z.welle}`;
}

/** Kann eine neue Welle gestartet werden? (Keine Gegner mehr in der Warteschlange.) */
export const welleMoeglich = (z: Zustand) => z.warteschlange.length === 0;

export function punkt(pfad: [number, number][], t: number): [number, number] {
  const i = Math.max(0, Math.min(pfad.length - 1, Math.floor(t)));
  const a = pfad[i], b = pfad[Math.min(pfad.length - 1, i + 1)];
  const f = Math.max(0, Math.min(1, t - i));
  return [a[0] + (b[0] - a[0]) * f + 0.5, a[1] + (b[1] - a[1]) * f + 0.5];
}

/** Ein Zeitschritt `dt` Sekunden. Anführer bleiben vor der Burg stehen und sind für Türme unverwundbar. */
export function schritt(z: Zustand, pfad: [number, number][], plaetze: [number, number][], dt: number): void {
  z.uhr += dt;
  z.blitz = Math.max(0, z.blitz - dt);
  while (z.warteschlange.length && z.warteschlange[0].at <= z.uhr) {
    const e = z.warteschlange.shift()!;
    z.gegner.push({ id: z.naechsteId++, t: 0, hp: e.hp, max: e.hp, tempo: e.tempo, bremse: 0, anfuehrer: e.anfuehrer, art: e.art });
  }
  const ende = pfad.length - 1;
  for (const g of z.gegner) {
    g.bremse = Math.max(0, g.bremse - dt);
    g.t = Math.min(ende, g.t + g.tempo * dt * (g.bremse > 0 ? 0.5 : 1));
  }
  // Durchbrüche: kosten etwas Gold, nie Wissenspunkte
  const durch = z.gegner.filter((g) => !g.anfuehrer && g.t >= ende);
  if (durch.length) {
    z.gegner = z.gegner.filter((g) => !durch.includes(g));
    z.gold = Math.max(0, z.gold - 5 * durch.length);
    z.burg = Math.max(0, z.burg - durch.length);
  }
  z.schuesse = z.schuesse.map((s) => ({ ...s, ttl: s.ttl - dt })).filter((s) => s.ttl > 0);
  for (const turm of z.tuerme) {
    turm.kuehl -= dt;
    if (turm.kuehl > 0) continue;
    const d = TURM_DATEN[turm.art];
    const pl = plaetze[turm.platz];
    if (!pl) continue;
    const mitte: [number, number] = [pl[0] + 0.5, pl[1] + 0.5];
    // das am weitesten gekommene Ziel in Reichweite
    let ziel: Gegner | null = null;
    for (const g of z.gegner) {
      if (g.anfuehrer || g.hp <= 0) continue;
      const p = punkt(pfad, g.t);
      if (Math.hypot(p[0] - mitte[0], p[1] - mitte[1]) <= d.reichweite && (!ziel || g.t > ziel.t)) ziel = g;
    }
    if (!ziel) continue;
    turm.kuehl = 1 / d.tempo;
    const zp = punkt(pfad, ziel.t);
    z.schuesse.push({ von: mitte, nach: zp, art: turm.art, ttl: 0.18 });
    const sch = schadenVon(turm);
    const treffer = turm.art === "kanone"
      ? z.gegner.filter((g) => !g.anfuehrer && Math.hypot(punkt(pfad, g.t)[0] - zp[0], punkt(pfad, g.t)[1] - zp[1]) <= 0.9)
      : [ziel];
    for (const g of treffer) {
      g.hp -= sch;
      if (turm.art === "magie") g.bremse = 1.5;
    }
  }
  const tot = z.gegner.filter((g) => !g.anfuehrer && g.hp <= 0);
  if (tot.length) {
    z.gegner = z.gegner.filter((g) => !tot.includes(g));
    z.gold += KILL_GOLD * tot.length;
    z.verdient += KILL_GOLD * tot.length;
    z.abschuesse += tot.length;
  }
}

/** Ein Anführer wurde durch Wissen gebrochen: er fällt, Bonusgold. */
export function anfuehrerFaellt(z: Zustand, challengeId: string): void {
  z.gegner = z.gegner.filter((g) => g.anfuehrer !== challengeId);
  z.warteschlange = z.warteschlange.filter((e) => e.anfuehrer !== challengeId);
  z.gold += BONUS_GOLD;
  z.verdient += BONUS_GOLD;
  schwaecheAnwenden(z);
}

/** Gefallener Anführer schwächt den Schwarm: Gegner im Feld verlieren 40 % ihres aktuellen Lebens, künftige −15 % (gestapelt, höchstens −60 %). */
export function schwaecheAnwenden(z: Zustand): void {
  for (const g of z.gegner) if (!g.anfuehrer) g.hp *= 1 - SOFORT_SCHADEN;
  z.schwaeche = Math.min(SCHWAECHE_MAX, z.schwaeche + SCHWAECHE_JE_ANFUEHRER);
  z.blitz = 1.2;
  z.meldung = "Schwarm geschwächt!";
}

export const SPIELWERT_MAX = 300;
/** Spielpunkte (gedeckelt): verdientes Gold. */
export const spielpunkte = (z: Zustand) => Math.min(SPIELWERT_MAX, z.verdient);
