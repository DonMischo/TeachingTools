/**
 * Was gerade passiert — als Zahl, Formel und eingesetzte Rechnung.
 *
 * Der Unterschied zwischen einer Anzeige und einem Unterrichtsmittel ist, dass
 * man sieht, *woher* die Zahl kommt. »0,26 J« sagt nichts; »E_pot = m·g·h =
 * 0,2 · 9,81 · 0,13 = 0,26 J« kann man an die Tafel schreiben.
 *
 * Dieselben Berichte benutzen der Inspektor (angehalten ein Gerät antippen)
 * und die Phänomen-Marker (💥 an der Stelle, wo etwas passiert ist) — beim
 * Marker als Momentaufnahme festgehalten, beim Inspektor laufend.
 */
import { formatiere, G, grad, type AnzeigeEinheit, type Einheit } from "./einheiten";
import { hebelMomente, gesamtMasse } from "./mechanik";
import type { LaborZustand } from "./rechenwerke";
import { bauteilSpannung } from "./stromkreis";
import type { Geraet, Punkt, Szene } from "./typen";

/** Eine Größe mit ihrer Herkunft. */
export interface Groesse {
  name: string;
  /** Die Formel in Buchstaben, z. B. "E_pot = m · g · h". */
  formel?: string;
  /** Dieselbe Formel mit eingesetzten Zahlen. */
  rechnung?: string;
  wert: number;
  einheit: Einheit;
  anzeige?: AnzeigeEinheit;
}

/** Die Höhe, aus der ein Körper mit dieser Geschwindigkeit gefallen wäre. */
export const fallhoehe = (tempo: number) => (tempo * tempo) / (2 * G);

/** Eine Zahl, wie man sie in eine Rechnung schreibt. */
const z = (x: number, stellen = 3) =>
  String(Number(x.toPrecision(stellen))).replace(".", ",");

function groesse(
  name: string, wert: number, einheit: Einheit,
  formel?: string, rechnung?: string, anzeige?: AnzeigeEinheit,
): Groesse {
  return { name, wert, einheit, formel, rechnung, anzeige };
}

/**
 * Der Bericht über ein Gerät im Augenblick.
 *
 * Leer, wenn über dieses Gerät gerade nichts Interessantes zu sagen ist.
 */
export function bericht(szene: Szene, g: Geraet, zustand: LaborZustand): Groesse[] {
  const s = zustand.mechanik[g.id];
  const koerper = zustand.welt[g.id];

  switch (g.typ) {
    case "fadenpendel": {
      const laenge = Math.max(0.01, g.werte.laenge ?? 1);
      const masse = gesamtMasse(szene, g);
      const winkel = s?.q ?? 0;
      const tempo = Math.abs((s?.v ?? 0) * laenge);
      // Höhe über der Ruhelage — daher kommt die Lageenergie.
      const hoehe = laenge * (1 - Math.cos(winkel));
      const epot = masse * G * hoehe;
      const ekin = 0.5 * masse * tempo * tempo;
      const dauer = 2 * Math.PI * Math.sqrt(laenge / G);
      return [
        groesse("Auslenkung", winkel, "rad", "θ", `${z(grad(winkel))}°`, "grad"),
        groesse("Höhe über Ruhelage", hoehe, "m", "h = L · (1 − cos θ)",
          `${z(laenge)} · (1 − cos ${z(grad(winkel))}°)`),
        groesse("Geschwindigkeit", tempo, "m/s", "v = L · ω", `${z(laenge)} · ${z(Math.abs(s?.v ?? 0))}`),
        groesse("Lageenergie", epot, "J", "E_pot = m · g · h", `${z(masse)} · ${z(G)} · ${z(hoehe)}`),
        groesse("Bewegungsenergie", ekin, "J", "E_kin = ½ · m · v²", `0,5 · ${z(masse)} · ${z(tempo)}²`),
        groesse("Gesamtenergie", epot + ekin, "J", "E = E_pot + E_kin", `${z(epot)} + ${z(ekin)}`),
        groesse("Schwingungsdauer", dauer, "s", "T = 2π · √(L / g)", `2π · √(${z(laenge)} / ${z(G)})`),
      ];
    }

    case "federpendel": {
      const härte = g.werte.federkonstante ?? 10;
      const masse = gesamtMasse(szene, g);
      const auslenkung = s?.q ?? 0;
      const tempo = Math.abs(s?.v ?? 0);
      const espann = 0.5 * härte * auslenkung * auslenkung;
      const ekin = 0.5 * masse * tempo * tempo;
      return [
        groesse("Auslenkung", auslenkung, "m", "y", `${z(auslenkung)} m`),
        groesse("Federkraft", -härte * auslenkung, "N", "F = −D · y", `−${z(härte)} · ${z(auslenkung)}`),
        groesse("Spannenergie", espann, "J", "E_spann = ½ · D · y²", `0,5 · ${z(härte)} · ${z(auslenkung)}²`),
        groesse("Bewegungsenergie", ekin, "J", "E_kin = ½ · m · v²", `0,5 · ${z(masse)} · ${z(tempo)}²`),
        groesse("Gesamtenergie", espann + ekin, "J", "E = E_spann + E_kin", `${z(espann)} + ${z(ekin)}`),
        groesse("Schwingungsdauer", 2 * Math.PI * Math.sqrt(masse / Math.max(1e-6, härte)), "s",
          "T = 2π · √(m / D)", `2π · √(${z(masse)} / ${z(härte)})`),
      ];
    }

    case "massestueck": {
      const masse = g.werte.masse ?? 0;
      const hoehe = koerper ? koerper.y : g.pos.y;
      const tempo = koerper ? Math.hypot(koerper.vx, koerper.vy) : 0;
      const epot = masse * G * Math.max(0, hoehe);
      const ekin = 0.5 * masse * tempo * tempo;
      return [
        groesse("Masse", masse, "kg"),
        groesse("Höhe", hoehe, "m", "h", `${z(hoehe)} m`),
        groesse("Geschwindigkeit", tempo, "m/s", "v = √(vₓ² + v_y²)",
          koerper ? `√(${z(koerper.vx)}² + ${z(koerper.vy)}²)` : undefined),
        groesse("Gewichtskraft", masse * G, "N", "F_G = m · g", `${z(masse)} · ${z(G)}`),
        groesse("Lageenergie", epot, "J", "E_pot = m · g · h", `${z(masse)} · ${z(G)} · ${z(Math.max(0, hoehe))}`),
        groesse("Bewegungsenergie", ekin, "J", "E_kin = ½ · m · v²", `0,5 · ${z(masse)} · ${z(tempo)}²`),
        groesse("Impuls", masse * tempo, "Nm", "p = m · v", `${z(masse)} · ${z(tempo)}`),
      ];
    }

    case "schiefeebene": {
      const masse = g.werte.masse ?? 0;
      const winkel = g.werte.winkel ?? 0;
      const gewicht = masse * G;
      return [
        groesse("Neigung", winkel, "rad", "α", `${z(grad(winkel))}°`, "grad"),
        groesse("Gewichtskraft", gewicht, "N", "F_G = m · g", `${z(masse)} · ${z(G)}`),
        groesse("Hangabtriebskraft", gewicht * Math.sin(winkel), "N", "F_H = F_G · sin α",
          `${z(gewicht)} · sin ${z(grad(winkel))}°`),
        groesse("Normalkraft", gewicht * Math.cos(winkel), "N", "F_N = F_G · cos α",
          `${z(gewicht)} · cos ${z(grad(winkel))}°`),
        groesse("Weg", s?.q ?? 0, "m"),
        groesse("Geschwindigkeit", Math.abs(s?.v ?? 0), "m/s"),
      ];
    }

    case "hebel": {
      const winkel = s?.q ?? 0;
      const m = hebelMomente(szene, g, winkel);
      return [
        groesse("Neigung", winkel, "rad", "", `${z(grad(winkel))}°`, "grad"),
        groesse("Moment links", m.links, "Nm", "M₁ = F₁ · a₁"),
        groesse("Moment rechts", m.rechts, "Nm", "M₂ = F₂ · a₂"),
        groesse("Unterschied", m.rechts - m.links, "Nm", "M₂ − M₁",
          `${z(m.rechts)} − ${z(m.links)}`),
      ];
    }

    case "lampe":
    case "widerstand":
    case "batterie": {
      if (!zustand.kreis) return [];
      const u = bauteilSpannung(zustand.kreis, g);
      const i = zustand.kreis.strom.get(g.id) ?? 0;
      return [
        groesse("Spannung", u, "V"),
        groesse("Stromstärke", i, "A", "I = U / R", `${z(u)} / ${z(g.werte.widerstand ?? 0)}`),
        groesse("Leistung", Math.abs(u * i), "W", "P = U · I", `${z(u)} · ${z(i)}`),
      ];
    }

    default:
      return [];
  }
}

/** Ein festgehaltener Punkt im Aufbau: hier ist etwas passiert. */
export interface Marker {
  id: string;
  /** Vom Löser gemeldet oder von Hand gesetzt. */
  art: "stoss" | "gesetzt";
  ort: Punkt;
  /** Laborzeit des Ereignisses. */
  t: number;
  titel: string;
  erklaerung: string;
  /** Bei einem Stoß die Momentaufnahme; bei gesetzten Markern leer, weil sie
   *  ihren Bericht laufend neu holen. */
  bericht: Groesse[];
  /** Woran der Marker hängt — ein gesetzter folgt seinem Gerät. */
  geraet?: string;
}

/** Ein deutsch geschriebener Wert mit Einheit. */
export const alsText = (x: Groesse) => formatiere(x.wert, x.einheit, x.anzeige);


/**
 * Der Bericht zu einem Zusammenstoß.
 *
 * Beim Stoß wird Bewegungsenergie in Verformung und Wärme umgesetzt — das ist
 * der Grund, warum es diesen Vorgang im Schulbuchmodell gar nicht gibt: dort
 * sind die Geräte ideal und gehen hindurch.
 */
export function stossBericht(
  szene: Szene,
  zustand: LaborZustand,
  beteiligte: string[],
  wucht: number,
): Groesse[] {
  const liste: Groesse[] = [
    groesse("Aufprallgeschwindigkeit", wucht, "m/s", "v_rel = |v₁ − v₂|"),
    groesse("entspricht Fallhöhe", fallhoehe(wucht), "m", "h = v² / (2 · g)",
      `${z(wucht)}² / (2 · ${z(G)})`),
  ];

  for (const id of beteiligte) {
    const g = szene.geraete.find(x => x.id === id);
    const k = zustand.welt[id];
    if (!g || !k) continue;
    const masse = g.werte.masse ?? 0;
    const tempo = Math.hypot(k.vx, k.vy);
    liste.push(groesse(
      `Bewegungsenergie ${id}`, 0.5 * masse * tempo * tempo, "J",
      "E_kin = ½ · m · v²", `0,5 · ${z(masse)} · ${z(tempo)}²`));
  }

  return liste;
}
