/**
 * Punkte, Sterne und Erfolge der Mission — wie in der Algorithmen-Werkstatt:
 * je Stufe höchstens 1000 Punkte.
 *   Lösen        600
 *   Fehlversuche 400 − 100 je Fehlversuch (nicht unter 0)
 *   Hilfsmittel  −100 (Binär-Rechner benutzt)
 * Sterne: 3 ohne Fehlversuch und ohne Hilfsmittel, 2 bis zwei Fehlversuche, sonst 1.
 * Das Niveau zählt mit: Fortgeschritten × 1,2, Experte × 1,5.
 */
export type Niveau = "einsteiger" | "fortgeschritten" | "experte";

export const GEWERTET = ["ascii", "bits", "dns", "packen", "routing"] as const;
export type GewerteteStufe = (typeof GEWERTET)[number];

export interface Wertung { sterne: 1 | 2 | 3; punkte: number }

export const FAKTOR: Record<Niveau, number> = { einsteiger: 1, fortgeschritten: 1.2, experte: 1.5 };

export function stufenWertung(fehler: number, hilfe: boolean, niveau: Niveau): Wertung {
  const roh = 600 + Math.max(0, 400 - 100 * fehler) - (hilfe ? 100 : 0);
  const sterne: 1 | 2 | 3 = fehler === 0 && !hilfe ? 3 : fehler <= 2 ? 2 : 1;
  return { sterne, punkte: Math.round(roh * FAKTOR[niveau]) };
}

export interface MissionErgebnis {
  ziel: string;
  niveau: Niveau;
  fehler: Record<GewerteteStufe, number>;
  hilfe: Record<GewerteteStufe, boolean>;
}

export function missionWertung(e: MissionErgebnis): { punkte: number; sterne: number; stufen: Record<GewerteteStufe, Wertung> } {
  const stufen = Object.fromEntries(GEWERTET.map(s => [s, stufenWertung(e.fehler[s], e.hilfe[s], e.niveau)])) as Record<GewerteteStufe, Wertung>;
  return {
    stufen,
    punkte: GEWERTET.reduce((s, k) => s + stufen[k].punkte, 0),
    sterne: GEWERTET.reduce((s, k) => s + stufen[k].sterne, 0),
  };
}

// ── Erfolge ─────────────────────────────────────────────────────────────────

export interface ErfolgsStand {
  missionen: number;
  ziele: string[];
  punkte: number;
  bestePunkte: number;
  fehlersucheRichtig: number;
  freigeschaltet: string[];
}

export const LEER: ErfolgsStand = { missionen: 0, ziele: [], punkte: 0, bestePunkte: 0, fehlersucheRichtig: 0, freigeschaltet: [] };

export interface Erfolg {
  id: string;
  icon: string;
  name: string;
  text: string;
  /** stand = nach dem Verbuchen; e = gerade beendete Mission (falls eine) */
  geschafft: (stand: ErfolgsStand, e?: MissionErgebnis) => boolean;
}

const fehlerfrei = (e: MissionErgebnis | undefined, s: GewerteteStufe) => !!e && e.fehler[s] === 0;

export const ERFOLGE: Erfolg[] = [
  { id: "erste", icon: "🐣", name: "Erste Nachricht", text: "Die erste Mission geschafft.", geschafft: s => s.missionen >= 1 },
  { id: "ascii", icon: "🔤", name: "ASCII-Profi", text: "ASCII-Stufe ohne Fehlversuch.", geschafft: (_, e) => fehlerfrei(e, "ascii") },
  { id: "kopfrechner", icon: "🧠", name: "Kopfrechner", text: "Bits ohne Fehlversuch — und ohne Binär-Rechner.", geschafft: (_, e) => fehlerfrei(e, "bits") && !e!.hilfe.bits },
  { id: "dns", icon: "🕵️", name: "Namensdetektiv", text: "DNS-Jagd ohne einen falschen Server.", geschafft: (_, e) => fehlerfrei(e, "dns") },
  { id: "packen", icon: "📦", name: "Packprofi", text: "Alle Felder beim ersten Versuch richtig.", geschafft: (_, e) => fehlerfrei(e, "packen") },
  { id: "navi", icon: "🧭", name: "Navi", text: "Routing ohne einen Umweg.", geschafft: (_, e) => fehlerfrei(e, "routing") },
  { id: "fehlerfrei", icon: "🎯", name: "Fehlerfrei", text: "Eine ganze Mission ohne Fehlversuch.", geschafft: (_, e) => !!e && GEWERTET.every(k => e.fehler[k] === 0) },
  { id: "sterne", icon: "🌟", name: "Sternenhimmel", text: "Alle 15 Sterne in einer Mission.", geschafft: (_, e) => !!e && missionWertung(e).sterne === 15 },
  { id: "welt", icon: "🌏", name: "Um die Welt", text: "Alle vier Empfänger erreicht.", geschafft: s => s.ziele.length >= 4 },
  { id: "experte", icon: "🎓", name: "Expertenprüfung", text: "Eine Mission auf dem Niveau Experte.", geschafft: (_, e) => e?.niveau === "experte" },
  { id: "fehlerjaeger", icon: "🔧", name: "Fehlerjäger", text: "5 Fälle in der Fehlersuche richtig erkannt.", geschafft: s => s.fehlersucheRichtig >= 5 },
  { id: "netzmeister", icon: "🏆", name: "Netzmeister", text: "10 000 Punkte insgesamt gesammelt.", geschafft: s => s.punkte >= 10_000 },
];

function freischalten(stand: ErfolgsStand, e?: MissionErgebnis): { stand: ErfolgsStand; neu: Erfolg[] } {
  const neu = ERFOLGE.filter(x => !stand.freigeschaltet.includes(x.id) && x.geschafft(stand, e));
  return { stand: { ...stand, freigeschaltet: [...stand.freigeschaltet, ...neu.map(x => x.id)] }, neu };
}

/** Eine beendete Mission eintragen; liefert den neuen Stand und frisch freigeschaltete Erfolge. */
export function verbucheMission(alt: ErfolgsStand, e: MissionErgebnis): { stand: ErfolgsStand; neu: Erfolg[]; punkte: number } {
  const { punkte } = missionWertung(e);
  const stand: ErfolgsStand = {
    ...alt,
    missionen: alt.missionen + 1,
    ziele: alt.ziele.includes(e.ziel) ? alt.ziele : [...alt.ziele, e.ziel],
    punkte: alt.punkte + punkte,
    bestePunkte: Math.max(alt.bestePunkte, punkte),
  };
  return { ...freischalten(stand, e), punkte };
}

export function verbucheFehlersuche(alt: ErfolgsStand, richtig: boolean): { stand: ErfolgsStand; neu: Erfolg[] } {
  if (!richtig) return { stand: alt, neu: [] };
  return freischalten({ ...alt, fehlersucheRichtig: alt.fehlersucheRichtig + 1 });
}

/** Gespeicherten Stand prüfen und auffüllen — alte oder kaputte Einträge sollen nichts sprengen. */
export function ausSpeicher(roh: unknown): ErfolgsStand {
  if (!roh || typeof roh !== "object") return LEER;
  const r = roh as Partial<ErfolgsStand>;
  const zahl = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    missionen: zahl(r.missionen), ziele: liste(r.ziele), punkte: zahl(r.punkte), bestePunkte: zahl(r.bestePunkte),
    fehlersucheRichtig: zahl(r.fehlersucheRichtig), freigeschaltet: liste(r.freigeschaltet),
  };
}
