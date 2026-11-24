/**
 * Handel und stillgelegte Betriebe im Aufbau.
 *
 * Handel: Daueraufträge je Ware (+ kaufen, − verkaufen, Menge je Schritt). Dafür braucht die Stadt ein Kontor
 * (Hafenkontor oder Zollhaus) — das ist die Infrastruktur für Ein- und Ausfuhr. Ein Kontor schafft mit
 * Fuhrwerken wenig; jeder Verladehafen, der über den Fluss mit einem Kontor verbunden ist, bringt Kähne dazu.
 * Einkaufen kostet das Doppelte des Grundpreises (teurer als selbst herstellen), Verkaufen bringt 80 %.
 *
 * Stilllegen: Ein Betrieb ohne Personal und ohne Unterhalt verfällt — nach 500 Schritten ist er eine Ruine.
 * Wieder in Betrieb nehmen kostet den Anteil der Baukosten und Baustoffe, der schon verfallen ist.
 */
import type { Gelaende } from "@/lib/gelaende/gelaende";
import { BAUTEN, type BauTyp } from "./modell";
import { baustoffe, kosten, LAGER_MAX, WAREN, type Ware } from "./aufbauRegeln";
import { besetzung, type AufBau, type Welt } from "./aufbau";

/** Grundpreis je Ware in Talern */
export const PREIS: Record<Ware, number> = {
  holz: 1, bretter: 2, lehm: 1, ziegel: 3, kohle: 2, wolle: 2, tuch: 5, stein: 2, hopfen: 2, bier: 4,
};
export const HANDEL = { kauf: 2, verkauf: 0.8, jeKontor: 4, jeHafen: 12, maxAuftrag: 20 } as const;
/** Gebäude, die als Kontor gelten */
export const KONTORE: BauTyp[] = ["hafenkontor", "zollhaus"];
export const VERFALL_SCHRITTE = 500;

export interface HandelStand {
  kapazitaet: number;
  menge: number;
  erloes: number;
  kosten: number;
  /** je Ware: tatsächlich gehandelt (+ gekauft, − verkauft) */
  je: Partial<Record<Ware, number>>;
  /** Kontor da? Häfen mit Wasserweg? */
  kontore: number;
  haefen: number;
}

export const stillgelegt = (b: AufBau) => b.still !== undefined;
export const ruine = (b: AufBau) => (b.still ?? 0) >= 1;
const laeuft = (w: Welt, b: AufBau) => !stillgelegt(b) && (besetzung(w).quote.get(b.id) ?? 1) >= 0.5;

// ---------------------------------------------------------------- Wasserwege

export interface Wasserweg { hafen: number; kontor: number; pfad: number[] }

/** Wasserfelder rund um ein Gebäude (Fußabdruck plus `r` Felder Rand) */
function wasserAm(g: Gelaende, w: Welt, b: { i: number; j: number; w: number; h: number }, r = 2): number[] {
  const aus: number[] = [];
  for (let y = b.j - r; y < b.j + b.h + r; y++) for (let x = b.i - r; x < b.i + b.w + r; x++) {
    if (x < 0 || y < 0 || x >= w.n || y >= w.n) continue;
    const k = y * w.n + x;
    if (g.wasser[k]) aus.push(k);
  }
  return aus;
}

/** Steht das Gebäude am Wasser? (für Verladehafen und Kontor) */
export const amWasser = (g: Gelaende, w: Welt, b: { i: number; j: number; w: number; h: number }) => wasserAm(g, w, b, 2).length > 0;

const wegeCache = new WeakMap<Welt, { v: number; wege: Wasserweg[] }>();
/** Wasserwege von jedem Verladehafen zum nächsten Kontor am selben Gewässer (Breitensuche über Wasserfelder) */
export function wasserwege(g: Gelaende, w: Welt): Wasserweg[] {
  const c = wegeCache.get(w);
  if (c && c.v === w.version.bauten) return c.wege;
  const n = w.n, wege: Wasserweg[] = [];
  const kontorFeld = new Map<number, number>();
  for (const b of w.bauten) if (KONTORE.includes(b.bau)) for (const k of wasserAm(g, w, b)) if (!kontorFeld.has(k)) kontorFeld.set(k, b.id);
  if (kontorFeld.size) {
    for (const h of w.bauten.filter(b => b.bau === "verladehafen")) {
      const start = wasserAm(g, w, h);
      if (!start.length) continue;
      const vor = new Int32Array(n * n).fill(-2), schlange: number[] = [];
      for (const k of start) { vor[k] = -1; schlange.push(k); }
      let ziel = -1;
      for (let q = 0; q < schlange.length && ziel < 0; q++) {
        const k = schlange[q], i = k % n;
        if (kontorFeld.has(k)) { ziel = k; break; }
        for (const nb of [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, k - n, k + n]) {
          if (nb < 0 || nb >= n * n || vor[nb] !== -2 || !g.wasser[nb]) continue;
          vor[nb] = k; schlange.push(nb);
        }
      }
      if (ziel < 0) continue;
      const pfad: number[] = [];
      for (let k = ziel; k >= 0; k = vor[k]) pfad.push(k);
      wege.push({ hafen: h.id, kontor: kontorFeld.get(ziel)!, pfad: pfad.reverse() });
    }
  }
  wegeCache.set(w, { v: w.version.bauten, wege });
  return wege;
}

/** Wie viele Waren je Schritt über Kontore und Häfen gehen können */
export function kapazitaet(g: Gelaende, w: Welt): { menge: number; kontore: number; haefen: number } {
  const kontore = w.bauten.filter(b => KONTORE.includes(b.bau) && laeuft(w, b));
  if (!kontore.length) return { menge: 0, kontore: 0, haefen: 0 };
  const offen = new Set(kontore.map(b => b.id));
  const haefen = wasserwege(g, w).filter(x => offen.has(x.kontor) && laeuft(w, w.bauten.find(b => b.id === x.hafen)!)).length;
  return { menge: kontore.length * HANDEL.jeKontor + haefen * HANDEL.jeHafen, kontore: kontore.length, haefen };
}

export const kaufpreis = (wa: Ware) => PREIS[wa] * HANDEL.kauf;
export const verkaufspreis = (wa: Ware) => PREIS[wa] * HANDEL.verkauf;

/** Daueraufträge für einen Schritt ausführen (im Rahmen der Kapazität, des Geldes und des Lagers) */
export function handle(g: Gelaende, w: Welt): HandelStand {
  const kap = kapazitaet(g, w);
  const stand: HandelStand = { kapazitaet: kap.menge, menge: 0, erloes: 0, kosten: 0, je: {}, kontore: kap.kontore, haefen: kap.haefen };
  let rest = kap.menge;
  for (const wa of Object.keys(WAREN) as Ware[]) {
    const auftrag = w.handel[wa] ?? 0;
    if (!auftrag || rest <= 0) continue;
    let menge = Math.min(Math.abs(auftrag), rest);
    if (auftrag > 0) {
      menge = Math.min(menge, LAGER_MAX - w.lager[wa], Math.max(0, w.taler) / kaufpreis(wa));
      if (menge <= 0.01) continue;
      w.lager[wa] += menge; w.taler -= menge * kaufpreis(wa); stand.kosten += menge * kaufpreis(wa);
      if (w.fluss) w.fluss[wa].plus += menge;
      stand.je[wa] = menge;
    } else {
      menge = Math.min(menge, w.lager[wa]);
      if (menge <= 0.01) continue;
      w.lager[wa] -= menge; w.taler += menge * verkaufspreis(wa); stand.erloes += menge * verkaufspreis(wa);
      if (w.fluss) w.fluss[wa].minus += menge;
      stand.je[wa] = -menge;
    }
    rest -= menge; stand.menge += menge;
  }
  w.handelStand = stand;
  return stand;
}

/** Auftrag setzen: + kaufen, − verkaufen (je Schritt), auf ±maxAuftrag begrenzt */
export function setzeAuftrag(w: Welt, wa: Ware, menge: number) {
  const m = Math.max(-HANDEL.maxAuftrag, Math.min(HANDEL.maxAuftrag, Math.round(menge)));
  if (m) w.handel[wa] = m; else delete w.handel[wa];
}

// ---------------------------------------------------------------- Stilllegen und Verfall

/** Betrieb einstellen: kein Personal, kein Unterhalt, Verfall beginnt */
export function stilllegen(w: Welt, id: number): boolean {
  const b = w.bauten.find(x => x.id === id);
  if (!b || b.dorf || stillgelegt(b)) return false;
  b.still = 0;
  w.version.bauten++;
  return true;
}

/** Was es kostet, den Betrieb wieder aufzunehmen: Anteil der Baukosten und Baustoffe, der verfallen ist */
export function wiederKosten(w: Welt, b: AufBau): { taler: number; stoffe: Partial<Record<Ware, number>>; anteil: number } {
  const anteil = Math.min(1, b.still ?? 0);
  const stoffe: Partial<Record<Ware, number>> = {};
  for (const [wa, x] of Object.entries(baustoffe(w.stil, b.bau)) as [Ware, number][]) { const t = Math.ceil(x * anteil - 1e-9); if (t) stoffe[wa] = t; }
  return { taler: Math.ceil(kosten(b.bau) * anteil - 1e-9), stoffe, anteil };
}

/** Wieder in Betrieb nehmen; liefert einen Grund, wenn es nicht geht */
export function inBetrieb(w: Welt, id: number): string | null {
  const b = w.bauten.find(x => x.id === id);
  if (!b || !stillgelegt(b)) return "läuft schon";
  const k = wiederKosten(w, b);
  if (w.taler < k.taler) return `zu teuer: ${k.taler} Taler`;
  const fehlt = (Object.entries(k.stoffe) as [Ware, number][]).filter(([wa, x]) => w.lager[wa] < x);
  if (fehlt.length) return `es fehlen ${fehlt.map(([wa, x]) => `${Math.ceil(x - w.lager[wa])} ${WAREN[wa].label}`).join(", ")}`;
  w.taler -= k.taler;
  for (const [wa, x] of Object.entries(k.stoffe) as [Ware, number][]) w.lager[wa] -= x;
  delete b.still;
  w.version.bauten++;
  return null;
}

/** ein Schritt Verfall; wird ein Betrieb zur Ruine, zeichnet die Ansicht ihn neu */
export function verfallen(w: Welt) {
  for (const b of w.bauten) {
    if (b.still === undefined || b.still >= 1) continue;
    b.still = Math.min(1, Math.round((b.still + 1 / VERFALL_SCHRITTE) * 1e6) / 1e6);
    if (b.still >= 1) w.version.bauten++;
  }
}

/** kurzer Zustandstext für Kärtchen und Übersicht */
export function zustandText(b: AufBau): string | null {
  if (!stillgelegt(b)) return null;
  return ruine(b) ? `🏚️ Ruine — ${BAUTEN[b.bau].label} ganz verfallen` : `⏸ stillgelegt · ${Math.round((b.still ?? 0) * 100)} % verfallen`;
}
