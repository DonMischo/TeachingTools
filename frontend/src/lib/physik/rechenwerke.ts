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
import { gesamtMasse, haltekraft, hebelMomente, lastAn, mechanikSchritt, type MechanikZustand } from "./mechanik";
import { feststoff, masseKugel, querschnitt, werkstoff } from "./material";
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
const EIGENE_RECHNUNG = ["flaschenzug", "schiefeebene", "fadenpendel", "probe"] as const;

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

    // Die Probe trägt weiter, was unter ihr hängt — sie fügt nichts hinzu.
    case "probe":
      return zugAnProbe(szene, g, mechanik);

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

/** Die Masse eines Bauteils, in Kilogramm. */
export function bauteilMasse(g: Geraet): number {
  if (g.typ === "kugel") return masseKugel(feststoff(g.werte.stoff ?? 2), g.werte.durchmesser ?? 0.02);
  return g.werte.masse ?? 0.1;
}

/**
 * Der Abschuss: was auf dem Lager liegt und wie schnell es wegfliegt.
 *
 * Die Spannkraft wirkt über den Spannweg, also ist die verrichtete Arbeit
 * W = F·s — und die steckt danach als Bewegungsenergie im Geschoss:
 * ½·m·v² = F·s, also v = √(2·F·s / m). Dieselbe Spannung schießt eine leichte
 * Murmel darum viel schneller fort als eine schwere, und *das* ist der Grund,
 * warum man beim Bogenschießen nicht einfach schwerere Pfeile nimmt.
 */
export function abschuss(szene: Szene, g: Geraet) {
  const geschoss = haengtDaran(szene, g.id, "lager").find(x => x.typ === "kugel" || x.typ === "massestueck" || x.typ === "klotz");
  const kraft = Math.max(0, g.werte.kraft ?? 40);
  const weg = Math.max(0.001, g.werte.spannweg ?? 0.3);
  const winkel = g.werte.winkel ?? Math.PI / 4;
  const arbeit = kraft * weg;
  const masse = geschoss ? bauteilMasse(geschoss) : 0;
  const tempo = masse > 0 ? Math.sqrt((2 * arbeit) / masse) : 0;
  return {
    geschoss, kraft, weg, winkel, arbeit, masse, tempo,
    vx: tempo * Math.cos(winkel),
    vy: tempo * Math.sin(winkel),
    /** Wurfweite im Schulbuchmodell: v²·sin(2α)/g. */
    weite: (tempo * tempo * Math.sin(2 * winkel)) / G,
  };
}

/** Die Kraft, die an einer Materialprobe zieht, in Newton. */
export function zugAnProbe(szene: Szene, g: Geraet, mechanik: MechanikZustand): number {
  return haengtDaran(szene, g.id, "unten", "mechanik", EIGENE_RECHNUNG)
    .reduce((summe, x) => summe + eigengewicht(szene, x, mechanik), 0);
}

/**
 * Der Zugversuch an einer Probe.
 *
 * σ = F/A ist die Spannung im Draht — deshalb reißt ein dünner Draht bei
 * weniger Kraft als ein dicker aus demselben Werkstoff, und deshalb ist die
 * Spannung und nicht die Kraft die Zahl, die über den Bruch entscheidet.
 * ε = σ/E ist das Hookesche Gesetz in seiner allgemeinen Form; die
 * Verlängerung folgt daraus mit der Ausgangslänge.
 */
export function zugversuch(szene: Szene, g: Geraet, mechanik: MechanikZustand) {
  const stoff = werkstoff(g.werte.werkstoff ?? 0);
  const flaeche = querschnitt(Math.max(1e-5, g.werte.durchmesser ?? 0.0004));
  const laenge = Math.max(0.01, g.werte.laenge ?? 0.2);
  const kraft = zugAnProbe(szene, g, mechanik);
  const spannung = kraft / flaeche;
  const dehnung = spannung / stoff.E;
  return {
    stoff, flaeche, laenge, kraft, spannung, dehnung,
    verlaengerung: dehnung * laenge,
    /** Wie weit die Probe ihrer Zugfestigkeit schon nahe ist. */
    auslastung: spannung / stoff.zugfestigkeit,
    reisst: spannung > stoff.zugfestigkeit,
  };
}

/** Welche Proben gerade überlastet sind — sie reißen im nächsten Augenblick. */
export function ueberlastet(szene: Szene, mechanik: MechanikZustand): string[] {
  return szene.geraete
    .filter(g => g.typ === "probe" && zugversuch(szene, g, mechanik).reisst)
    .map(g => g.id);
}

/**
 * Die Kraft am unteren Haken eines Kraftmessers, in Newton.
 *
 * Gelaufen wird der Verbindungsgraph: alles, was unter dem Haken hängt, zählt
 * — auch ein Massestück am Massestück. Gefolgt wird ausschließlich
 * mechanischen Verbindungen; ein Kabel trägt nichts.
 */
export function haengendeKraft(szene: Szene, kraftmesser: string, mechanik: MechanikZustand): number {
  // Am Hebelarm misst er nicht ein Gewicht, sondern die Kraft, die den Balken
  // waagerecht hält — das ist der Versuch, für den man ihn dort anhängt.
  const amBalken = hebelSeite(szene, kraftmesser);
  if (amBalken) return haltekraft(szene, amBalken.hebel, amBalken.seite, amBalken.richtung);

  return haengtDaran(szene, kraftmesser, "unten", "mechanik", EIGENE_RECHNUNG)
    .reduce((summe, g) => summe + eigengewicht(szene, g, mechanik), 0);
}

/**
 * Ob dieser Kraftmesser an einem Hebel- oder Waagebalken hängt.
 *
 * Beide Aufbauten kommen im Unterricht vor und ziehen in entgegengesetzte
 * Richtungen: hängt der Messer *über* dem Arm (sein Haken unten am Balken),
 * zieht er die Seite nach oben. Steht er *unter* dem Arm und ist mit seiner
 * Aufhängung daran befestigt, zieht man ihn nach unten — dann hält er die
 * leichtere Seite unten.
 */
export function hebelSeite(szene: Szene, kraftmesser: string):
  { hebel: Geraet; seite: "links" | "rechts"; richtung: "hoch" | "runter" } | null {
  for (const v of szene.verbindungen) {
    for (const [hier, dort] of [[v.von, v.nach], [v.nach, v.von]] as const) {
      if (hier.geraet !== kraftmesser) continue;
      if (hier.port !== "unten" && hier.port !== "oben") continue;
      if (dort.port !== "links" && dort.port !== "rechts") continue;
      const wirt = szene.geraete.find(x => x.id === dort.geraet);
      if (wirt && (wirt.typ === "hebel" || wirt.typ === "waage")) {
        return { hebel: wirt, seite: dort.port, richtung: hier.port === "unten" ? "hoch" : "runter" };
      }
    }
  }
  return null;
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

  // Die Verlängerung jeder Probe kommt als »Auslenkung« in denselben Zustand:
  // Zeichnung und Anschlusspunkt lesen sie dort, ohne dafür einen eigenen Weg
  // zu brauchen.
  for (const g of szene.geraete) {
    if (g.typ !== "probe") continue;
    mechanik[g.id] = { q: zugversuch(szene, g, mechanik).verlaengerung, v: 0, start: 0 };
  }
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

      case "probe": {
        const z = zugversuch(szene, g, mechanik);
        werte.set(signalId(g.id, "kraft"), z.kraft);
        werte.set(signalId(g.id, "spannung"), z.spannung);
        werte.set(signalId(g.id, "dehnung"), z.dehnung);
        werte.set(signalId(g.id, "verlaengerung"), z.verlaengerung);
        break;
      }

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
