/**
 * Die Mechanik — ein Schwinger je Gerät, nicht eine Physik-Engine.
 *
 * Pendel, Federpendel, Hebel und schiefe Ebene sind Systeme mit genau einem
 * Freiheitsgrad: eine Zahl `q` sagt, wie weit ausgelenkt ist, `v`, wie schnell
 * sich das ändert. Beim Fadenpendel ist `q` der Winkel im Bogenmaß, beim
 * Federpendel die Auslenkung in Metern, beim Hebel die Neigung, auf der
 * schiefen Ebene der zurückgelegte Weg — dieselbe Form, vier Bedeutungen.
 *
 * Bewusst *kein* Starrkörper-Löser: impulsbasierte Verfahren (Box2D und
 * Verwandte) verlieren sichtbar Energie. Ein Pendel, das von allein kleiner
 * wird, und ein Hebel, der nie genau balanciert, taugen zum Spielen, aber
 * nicht zum Messen — und gemessen werden soll hier die Formel, die die Klasse
 * gerade herleitet.
 *
 * Gerechnet wird die echte Gleichung θ″ = −(g/L)·sin θ, nicht ihre Näherung
 * für kleine Winkel. Dadurch stimmt 2π√(L/g) bei kleinem Ausschlag und weicht
 * bei großem ab — was kein Fehler ist, sondern der Unterrichtsstoff.
 */
import { G } from "./einheiten";
import { haengtDaran } from "./verbindungen";
import type { Geraet, Szene } from "./typen";

/** Ein Freiheitsgrad: Auslenkung, Geschwindigkeit — und womit gestartet wurde. */
export interface Schwinger {
  q: number;
  v: number;
  /** Der Startwert, mit dem dieser Schwinger losgelassen wurde. Ändert ihn
   *  jemand am Regler, wird neu losgelassen statt weiterzuschwingen. */
  start: number;
}

export type MechanikZustand = Record<string, Schwinger>;

/** Welche Gerätetypen die Mechanik rechnet, und woran ihr Start hängt. */
const SCHWINGER: Record<string, { startWert: string }> = {
  fadenpendel: { startWert: "startwinkel" },
  federpendel: { startWert: "startauslenkung" },
  hebel: { startWert: "startneigung" },
  waage: { startWert: "startneigung" },
  schiefeebene: { startWert: "startweg" },
};

export const istSchwinger = (typ: string) => typ in SCHWINGER;

/** Wie weit sich ein Hebel neigen kann, bevor er aufsitzt. */
export const HEBEL_ANSCHLAG = (25 * Math.PI) / 180;

/** Anfangszustand aus den eingestellten Werten — losgelassen, also in Ruhe. */
export function anfang(typ: string, werte: Record<string, number>): Schwinger {
  const start = werte[SCHWINGER[typ]?.startWert ?? ""] ?? 0;
  return { q: start, v: 0, start };
}

/** Die Masse aller Massestücke, die an diesem Anschluss hängen, in Kilogramm. */
export function lastAn(szene: Szene, geraetId: string, port: string): number {
  return haengtDaran(szene, geraetId, port)
    .filter(x => x.typ === "massestueck")
    .reduce((summe, x) => summe + (x.werte.masse ?? 0), 0);
}

/**
 * Die Masse, die tatsächlich mitschwingt: die eigene plus jedes Massestück,
 * das am Körper hängt.
 *
 * Damit wird der Schulversuch möglich: Gewichte anhängen und nachmessen. Beim
 * Federpendel wird die Schwingung dadurch langsamer (T = 2π√(m/D)), beim
 * Fadenpendel ändert sich gar nichts — und genau dieser Unterschied ist die
 * Stunde.
 */
export function gesamtMasse(szene: Szene, g: Geraet): number {
  return Math.max(0.001, (g.werte.masse ?? 0) + lastAn(szene, g.id, "koerper"));
}

/**
 * Die Drehmomente an beiden Hebelarmen, in Newtonmetern.
 *
 * Das Hebelgesetz zum Ablesen: ausgeglichen ist der Hebel, wenn beide gleich
 * sind — F₁·a₁ = F₂·a₂. Der Kosinus steht dabei, weil der wirksame Hebelarm
 * mit der Neigung kürzer wird; bei waagerechtem Balken ist er eins.
 */
export function hebelMomente(szene: Szene, g: Geraet, q = 0): { links: number; rechts: number } {
  const kosinus = Math.cos(q);
  return {
    links: lastAn(szene, g.id, "links") * G * (g.werte.armLinks ?? 0.3) * kosinus,
    rechts: lastAn(szene, g.id, "rechts") * G * (g.werte.armRechts ?? 0.3) * kosinus,
  };
}

/** Ob die schiefe Ebene festgehalten wird — dann misst man die Hangabtriebskraft. */
export const wirdGehalten = (szene: Szene, g: Geraet) =>
  haengtDaran(szene, g.id, "koerper").some(x => x.typ === "kraftmesser");

/**
 * Die Beschleunigung bei Auslenkung `q` und Geschwindigkeit `v`.
 *
 * Braucht die ganze Szene, weil Hebel und schiefe Ebene davon abhängen, was
 * gerade an ihnen hängt. `real` schaltet Reibung zu; ohne sie schwingt das
 * Pendel ewig und die Kiste rutscht ungebremst — das ist das Schulbuchmodell
 * und genau so gewollt.
 */
export function beschleunigung(szene: Szene, g: Geraet, q: number, v: number): number {
  const real = (g.treue ?? szene.treue) === "real";
  const reibung = real ? (g.werte.daempfung ?? 0) * v : 0;

  switch (g.typ) {
    case "fadenpendel": {
      const laenge = Math.max(0.01, g.werte.laenge ?? 1);
      return -(G / laenge) * Math.sin(q) - reibung;
    }

    case "federpendel":
      return -((g.werte.federkonstante ?? 10) / gesamtMasse(szene, g)) * q - reibung;

    case "waage":
    case "hebel": {
      const aL = g.werte.armLinks ?? 0.3, aR = g.werte.armRechts ?? 0.3;
      const mL = lastAn(szene, g.id, "links"), mR = lastAn(szene, g.id, "rechts");
      // Drehmoment: rechts schwerer heißt, die rechte Seite geht herunter.
      const moment = G * Math.cos(q) * (mR * aR - mL * aL);
      // Der Balken dreht um seine Mitte, die Lasten sitzen an ihren Armen.
      const balken = g.werte.balkenMasse ?? 0.4;
      const laenge = aL + aR;
      const traegheit = (balken * laenge * laenge) / 12 + mL * aL * aL + mR * aR * aR;
      return moment / Math.max(1e-6, traegheit) - reibung;
    }

    case "schiefeebene": {
      // Festgehalten rutscht nichts — dann zeigt der Kraftmesser die
      // Hangabtriebskraft an, statt dass die Kiste davonfährt.
      if (wirdGehalten(szene, g)) return 0;
      const winkel = g.werte.winkel ?? Math.PI / 6;
      const haftung = real ? (g.werte.reibungszahl ?? 0) * Math.cos(winkel) : 0;
      const hang = Math.sin(winkel);
      // Reibung kann höchstens bremsen, nicht rückwärts beschleunigen.
      return G * Math.max(0, hang - haftung);
    }

    default:
      return 0;
  }
}

/** Wie weit `q` gehen darf, bevor das Gerät aufsitzt. */
export function grenzen(g: Geraet): { min: number; max: number } | null {
  if (g.typ === "hebel" || g.typ === "waage") return { min: -HEBEL_ANSCHLAG, max: HEBEL_ANSCHLAG };
  if (g.typ === "schiefeebene") return { min: 0, max: Math.max(0.05, g.werte.laenge ?? 1) };
  return null;
}

/**
 * Ein Schritt nach Runge-Kutta vierter Ordnung.
 *
 * Das Eulerverfahren würde bei 240 Hz binnen Sekunden Energie dazuerfinden und
 * das Pendel immer weiter ausschlagen lassen; RK4 hält es über Minuten stabil.
 */
export function rk4(
  s: Schwinger,
  dt: number,
  a: (q: number, v: number) => number,
): { q: number; v: number } {
  const k1q = s.v,                  k1v = a(s.q, s.v);
  const k2q = s.v + (dt / 2) * k1v, k2v = a(s.q + (dt / 2) * k1q, s.v + (dt / 2) * k1v);
  const k3q = s.v + (dt / 2) * k2v, k3v = a(s.q + (dt / 2) * k2q, s.v + (dt / 2) * k2v);
  const k4q = s.v + dt * k3v,       k4v = a(s.q + dt * k3q, s.v + dt * k3v);
  return {
    q: s.q + (dt / 6) * (k1q + 2 * k2q + 2 * k3q + k4q),
    v: s.v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  };
}

/**
 * Ein Zeitschritt über alle mechanischen Geräte der Szene.
 *
 * Rein: nimmt den Zustand entgegen und gibt den neuen zurück. Geräte, die
 * weggeräumt wurden, fallen dabei heraus; neu aufgestellte fangen bei ihrer
 * Anfangsauslenkung an.
 */
export function mechanikSchritt(szene: Szene, zustand: MechanikZustand, dt: number): MechanikZustand {
  const neu: MechanikZustand = {};

  for (const g of szene.geraete) {
    if (!istSchwinger(g.typ)) continue;
    const startWert = g.werte[SCHWINGER[g.typ].startWert] ?? 0;
    const alt = zustand[g.id];

    // Kein Zustand, oder jemand hat den Startwert verstellt: neu loslassen.
    if (!alt || alt.start !== startWert) {
      neu[g.id] = anfang(g.typ, g.werte);
      continue;
    }

    const schritt = rk4(alt, dt, (q, v) => beschleunigung(szene, g, q, v));
    const grenze = grenzen(g);

    // Am Anschlag bleibt es stehen, statt weiterzudrehen oder durch den Tisch
    // zu fahren. Unelastisch: die Bewegung ist dort zu Ende.
    if (grenze && schritt.q <= grenze.min) neu[g.id] = { q: grenze.min, v: 0, start: alt.start };
    else if (grenze && schritt.q >= grenze.max) neu[g.id] = { q: grenze.max, v: 0, start: alt.start };
    else neu[g.id] = { ...schritt, start: alt.start };
  }

  return neu;
}
