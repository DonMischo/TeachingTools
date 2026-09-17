/**
 * Die Rechenwerke — was in einem Zeitschritt passiert.
 *
 * Jeder Bereich rechnet für sich (Mechanik als Differentialgleichung, der
 * Stromkreis als Knotengleichung, die Optik ganz ohne Zeit) und legt sein
 * Ergebnis als Signal auf den Messbus. Ein gemeinsamer Löser wäre weder
 * möglich noch nötig: zusammen kommen die Bereiche über Ports und Signale.
 *
 * `schritt` ist eine reine Funktion: Zustand rein, neuer Zustand plus
 * Messwerte raus. Damit lässt sich eine Minute Pendelschwingung im Test
 * durchrechnen, ohne Uhr, ohne Bus und ohne Bildschirm — und genau das
 * braucht es, um Messung gegen Formel zu prüfen.
 */
import { G } from "./einheiten";
import { geraetTyp } from "./katalog";
import { gesamtMasse, hebelMomente, lastAn, mechanikSchritt, type MechanikZustand } from "./mechanik";
import { signalId, type SignalId } from "./messbus";
import { bauteilSpannung, loeseStromkreis, stromPorts, type Stromkreis } from "./stromkreis";
import type { WeltZustand } from "./welt";
import { haengtDaran } from "./verbindungen";
import type { Geraet, Szene } from "./typen";

/** Kurvenformen des Funktionsgenerators — im Aufbau als Zahl gespeichert. */
export const SINUS = 0;
export const RECHTECK = 1;
export const DREIECK = 2;

/** Zeitschritt der Simulation. 240 Hz trägt auch ein kurzes, schnelles Pendel. */
export const DT = 1 / 240;

/** Alles, was die Simulation zwischen zwei Schritten behalten muss. */
export interface LaborZustand {
  t: number;
  mechanik: MechanikZustand;
  /** Der zuletzt gelöste Stromkreis — die Werkbank zeichnet daraus, ob eine
   *  Lampe leuchtet. Null, solange nichts Elektrisches dasteht. */
  kreis: Stromkreis | null;
  /** Lage der freien Körper. Kommt vom Starrkörperlöser, nicht von hier —
   *  »schritt« reicht ihn nur weiter, damit alles an einer Stelle steht. */
  welt: WeltZustand;
}

export const leererZustand = (): LaborZustand => ({ t: 0, mechanik: {}, kreis: null, welt: {} });

/** Momentanwert des Funktionsgenerators. */
export function generatorWert(form: number, frequenz: number, amplitude: number, t: number): number {
  const phase = 2 * Math.PI * frequenz * t;
  if (form === RECHTECK) return Math.sin(phase) >= 0 ? amplitude : -amplitude;
  // Das Dreieck über den Arkussinus: stetig, ohne Fallunterscheidung und
  // ohne Sprung an den Spitzen.
  if (form === DREIECK) return amplitude * (2 / Math.PI) * Math.asin(Math.sin(phase));
  return amplitude * Math.sin(phase);
}

/**
 * Geräte, die ihre eigene Last selbst verrechnen. Hinter ihnen hört der Lauf
 * durch den Verbindungsgraphen auf — sonst zählte man dieselben Gewichte
 * zweimal, einmal roh und einmal übersetzt.
 */
const EIGENE_RECHNUNG = ["flaschenzug", "schiefeebene", "fadenpendel"] as const;

/**
 * Was ein einzelnes Gerät nach unten zieht, in Newton.
 *
 * Ein Massestück zieht mit seinem Gewicht. Beim Federpendel ist es die
 * Spannung der Feder: im Gleichgewicht genau m·g, beim Schwingen darum herum
 * pendelnd (D·q). Beim Fadenpendel zieht die Fadenspannung — am tiefsten
 * Punkt am größten, weil dort zur Gewichtskraft noch die Zentripetalkraft
 * kommt. Der Flaschenzug gibt die Last geteilt durch die Zahl der tragenden
 * Seile weiter, die schiefe Ebene nur ihren Hangabtrieb.
 */
function eigengewicht(szene: Szene, g: Geraet, mechanik: MechanikZustand): number {
  void szene;
  const s = mechanik[g.id];
  const masse = g.werte.masse ?? 0;

  switch (g.typ) {
    case "massestueck":
      return masse * G;

    case "federpendel":
      return masse * G + (g.werte.federkonstante ?? 0) * (s?.q ?? 0);

    case "fadenpendel": {
      // Das Pendel hat keine eigene Masse — es zieht mit dem, was daran hängt.
      // Deshalb steht es auch in EIGENE_RECHNUNG: die angehängten Gewichte
      // dürfen nicht noch einmal einzeln gezählt werden.
      const laenge = Math.max(0.01, g.werte.laenge ?? 1);
      const winkel = s?.q ?? 0;
      const winkelTempo = s?.v ?? 0;
      const schwingend = gesamtMasse(szene, g);
      return schwingend * (G * Math.cos(winkel) + laenge * winkelTempo * winkelTempo);
    }

    case "flaschenzug":
      // Die goldene Regel der Mechanik: Kraft durch n, Weg mal n.
      return lastAmFlaschenzug(szene, g, mechanik) / tragendeSeile(g);

    case "schiefeebene":
      return masse * G * Math.sin(g.werte.winkel ?? 0);

    default:
      return 0;
  }
}

/** Wie viele Seile die Last tragen — eins heißt feste Rolle. */
export const tragendeSeile = (g: Geraet) => Math.max(1, Math.round(g.werte.rollen ?? 1));

/** Die Kraft, die unten am Flaschenzug hängt, in Newton. */
export function lastAmFlaschenzug(szene: Szene, g: Geraet, mechanik: MechanikZustand): number {
  return haengtDaran(szene, g.id, "last", "mechanik", EIGENE_RECHNUNG)
    .reduce((summe, x) => summe + eigengewicht(szene, x, mechanik), 0);
}

/**
 * Die Kraft am unteren Haken eines Kraftmessers, in Newton.
 *
 * Gelaufen wird der Verbindungsgraph: alles, was unter dem Haken hängt, zählt
 * — auch ein Massestück am Massestück. Gefolgt wird ausschließlich
 * mechanischen Verbindungen; ein Kabel trägt nichts.
 */
export function haengendeKraft(szene: Szene, kraftmesser: string, mechanik: MechanikZustand): number {
  return haengtDaran(szene, kraftmesser, "unten", "mechanik", EIGENE_RECHNUNG)
    .reduce((summe, g) => summe + eigengewicht(szene, g, mechanik), 0);
}

/**
 * Ein Zeitschritt über die ganze Szene.
 *
 * Die Messwerte beschreiben den Zustand *nach* dem Schritt, also zum
 * Zeitpunkt `zustand.t` des Rückgabewerts.
 */
export function schritt(
  szene: Szene,
  zustand: LaborZustand,
  dt: number,
  welt: WeltZustand = zustand.welt,
): {
  zustand: LaborZustand;
  werte: Map<SignalId, number>;
} {
  const t = zustand.t + dt;
  const mechanik = mechanikSchritt(szene, zustand.mechanik, dt);
  const werte = new Map<SignalId, number>();

  // Ein Stromkreis laesst sich nicht Bauteil fuer Bauteil rechnen: durch eine
  // Reihenschaltung fliesst ueberall derselbe Strom. Also einmal je Schritt
  // das ganze Netz loesen — und nur, wenn ueberhaupt etwas Elektrisches
  // dasteht.
  const elektrisch = szene.geraete.some(g => stromPorts(g.typ));
  const kreis = elektrisch ? loeseStromkreis(szene) : null;

  for (const g of szene.geraete) {
    if (!geraetTyp(g.typ)?.signale.length) continue;

    switch (g.typ) {
      case "signalgeber":
        werte.set(signalId(g.id, "spannung"), generatorWert(
          g.werte.form ?? SINUS,
          g.werte.frequenz ?? 1,
          g.werte.amplitude ?? 1,
          t,
        ));
        break;

      case "kraftmesser":
        werte.set(signalId(g.id, "kraft"), haengendeKraft(szene, g.id, mechanik));
        break;

      case "fadenpendel": {
        const s = mechanik[g.id];
        if (!s) break;
        werte.set(signalId(g.id, "winkel"), s.q);
        // Bahngeschwindigkeit: der Winkel ändert sich, der Körper legt dabei
        // den Weg L·Δθ zurück.
        werte.set(signalId(g.id, "geschwindigkeit"), s.v * (g.werte.laenge ?? 1));
        break;
      }

      case "federpendel": {
        const s = mechanik[g.id];
        if (!s) break;
        werte.set(signalId(g.id, "auslenkung"), s.q);
        // Hooke: die Feder zieht entgegen der Auslenkung.
        werte.set(signalId(g.id, "kraft"), -(g.werte.federkonstante ?? 10) * s.q);
        break;
      }

      case "waage": {
        const winkel = mechanik[g.id]?.q ?? 0;
        werte.set(signalId(g.id, "masseLinks"), lastAn(szene, g.id, "links"));
        werte.set(signalId(g.id, "masseRechts"), lastAn(szene, g.id, "rechts"));
        werte.set(signalId(g.id, "winkel"), winkel);
        break;
      }

      case "hebel": {
        const winkel = mechanik[g.id]?.q ?? 0;
        const momente = hebelMomente(szene, g, winkel);
        werte.set(signalId(g.id, "winkel"), winkel);
        werte.set(signalId(g.id, "momentLinks"), momente.links);
        werte.set(signalId(g.id, "momentRechts"), momente.rechts);
        break;
      }

      case "flaschenzug": {
        const last = lastAmFlaschenzug(szene, g, mechanik);
        werte.set(signalId(g.id, "last"), last);
        werte.set(signalId(g.id, "zugkraft"), last / tragendeSeile(g));
        break;
      }

      case "lampe":
      case "widerstand":
      case "batterie": {
        if (!kreis) break;
        const spannung = bauteilSpannung(kreis, g);
        const strom = kreis.strom.get(g.id) ?? 0;
        werte.set(signalId(g.id, "spannung"), spannung);
        werte.set(signalId(g.id, "strom"), strom);
        // Nur das Laempchen meldet Leistung — daran sieht man, ob es leuchtet.
        if (g.typ === "lampe") werte.set(signalId(g.id, "leistung"), Math.abs(spannung * strom));
        break;
      }

      case "voltmeter":
        if (kreis) werte.set(signalId(g.id, "spannung"), bauteilSpannung(kreis, g));
        break;

      case "amperemeter":
        if (kreis) werte.set(signalId(g.id, "strom"), kreis.strom.get(g.id) ?? 0);
        break;

      case "schiefeebene": {
        const s = mechanik[g.id];
        const winkel = g.werte.winkel ?? 0;
        const gewicht = (g.werte.masse ?? 0) * G;
        werte.set(signalId(g.id, "hangabtrieb"), gewicht * Math.sin(winkel));
        werte.set(signalId(g.id, "normalkraft"), gewicht * Math.cos(winkel));
        werte.set(signalId(g.id, "weg"), s?.q ?? 0);
        werte.set(signalId(g.id, "geschwindigkeit"), s?.v ?? 0);
        break;
      }
    }
  }

  return { zustand: { t, mechanik, kreis, welt }, werte };
}
