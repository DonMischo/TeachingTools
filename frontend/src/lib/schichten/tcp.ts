/**
 * TCP bei Paketverlust — vereinfacht für das Ablaufdiagramm:
 * feste Fenstergröße (kein Slow Start), Empfänger puffert Stücke außer der
 * Reihe und bestätigt immer »bis hierhin alles« (kumulativ). Der Sender
 * wiederholt das fehlende Stück nach drei doppelten Bestätigungen (Fast
 * Retransmit) oder wenn die Wartezeit abläuft (Timeout). Bestätigungen gehen
 * hier nie verloren. Zeit in Einheiten der einfachen Laufzeit.
 */
import { zufallsquelle } from "@/lib/dla/kern";

export interface Pfeil {
  art: "daten" | "ack";
  /** Segmentnummer (ab 1) bzw. bei ack: nächstes erwartetes Segment */
  nr: number;
  von: number;
  bis: number;
  verloren: boolean;
  wiederholt?: "dreifach" | "zeit";
}

export interface TcpLauf {
  pfeile: Pfeil[];
  ende: number;
  wiederholungen: number;
  verloren: number;
  /** Zeitpunkte, zu denen der Empfänger ein Stück an die App weitergeben konnte */
  geliefert: { nr: number; t: number }[];
}

const ABSTAND = 0.12;
const RTO = 3;

export function tcpLauf(anzahl: number, verlust: number, fenster: number, seed = 1): TcpLauf {
  const rnd = zufallsquelle(seed);
  const pfeile: Pfeil[] = [];
  const geliefert: { nr: number; t: number }[] = [];
  const angekommen = new Set<number>();
  let erwartet = 1;
  let basis = 1, naechstes = 1, doppelt = 0, letzteAck = 1;
  let sendeFrei = 0, fortschritt = 0;
  let wiederholungen = 0, verloren = 0;
  // Ereignisse: Ankunft beim Empfänger bzw. Bestätigung beim Sender
  const warte: { t: number; f: () => void }[] = [];
  const plane = (t: number, f: () => void) => { warte.push({ t, f }); warte.sort((a, b) => a.t - b.t); };

  const sende = (nr: number, t: number, grund?: Pfeil["wiederholt"]) => {
    const start = Math.max(t, sendeFrei);
    sendeFrei = start + ABSTAND;
    const weg = rnd() < verlust;
    const p: Pfeil = { art: "daten", nr, von: start, bis: weg ? start + 0.5 : start + 1, verloren: weg, wiederholt: grund };
    pfeile.push(p);
    if (grund) wiederholungen++;
    if (weg) { verloren++; return; }
    plane(start + 1, () => empfange(nr, start + 1));
  };

  const empfange = (nr: number, t: number) => {
    angekommen.add(nr);
    while (angekommen.has(erwartet)) { geliefert.push({ nr: erwartet, t }); erwartet++; }
    const a = erwartet;
    pfeile.push({ art: "ack", nr: a, von: t, bis: t + 1, verloren: false });
    plane(t + 1, () => bestaetigt(a, t + 1));
  };

  const fuelle = (t: number) => {
    while (naechstes < basis + fenster && naechstes <= anzahl) sende(naechstes++, t);
  };

  const bestaetigt = (a: number, t: number) => {
    if (a > basis) {
      basis = a;
      doppelt = 0;
      fortschritt = t;
      fuelle(t);
    } else if (a === letzteAck && basis <= anzahl) {
      doppelt++;
      if (doppelt === 3) sende(basis, t, "dreifach");
    }
    letzteAck = a;
  };

  fuelle(0);
  let t = 0;
  while (basis <= anzahl && t < 500) {
    const e = warte.shift();
    const frist = Math.max(fortschritt, sendeFrei) + RTO;
    if (!e || e.t > frist) {
      // Wartezeit abgelaufen: das älteste unbestätigte Stück noch einmal
      t = frist;
      fortschritt = t;
      doppelt = 0;
      sende(basis, t, "zeit");
      if (e) warte.unshift(e);
      continue;
    }
    t = e.t;
    e.f();
  }
  const ende = Math.max(...pfeile.map(p => p.bis));
  return { pfeile, ende, wiederholungen, verloren, geliefert };
}
