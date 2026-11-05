/**
 * Spiel »Füllen«: Behälter mit Wasser oder Luft füllen. Erst schätzen
 * (Auswahl), dann genau rechnen, dann der Härtetest: Beim Becken springt
 * jemand hinein — zu wenig Wasser tut weh —, beim Ballon wird gepumpt, bis
 * es knallt oder passt. Reine Rechnung; das Spiel steht in
 * components/koerper/Fuellen.tsx.
 */
import { z } from "@/lib/prozent";
import { eins, ganz, type Zufall } from "@/lib/geometrie/aufgabe";
import { ist, liegendesPrisma, type V3 } from "@/lib/koerper";
import { skizzeKoerper, skizzePoly } from "@/lib/koerper-skizze";
import type { Skizze } from "@/lib/geometrie/skizze";

export type BehaelterArt = "pool" | "rundpool" | "sprungbecken" | "ballon" | "matratze";
export const BEHAELTER_REIHE: BehaelterArt[] = ["pool", "rundpool", "sprungbecken", "ballon", "matratze"];

/**
 * Ein gewürfelter Behälter. Wasser: `volumen(h)` in Litern bis zur
 * Wasserhöhe h (m), `H` ist der Rand, `T` die Mindesttiefe zum Springen.
 * Luft: `hub` Liter je Pumpstoß.
 */
export type Behaelter = {
  art: BehaelterArt; name: string; icon: string; stoff: "wasser" | "luft";
  text: string;
  /** Fassungsvermögen in Litern */
  V: number;
  rechnung: string[];
  hinweise: string[];
  skizze: Skizze;
  H: number; T: number;
  volumen: (h: number) => number;
  /** Seitenansicht fürs Springen: Bodenhöhe über x (0 = Sprungseite, 1 = andere Seite), in m */
  boden?: (x: number) => number;
  laenge?: number;
  hub?: number;
};

const π = Math.PI;
const kante = (von: V3, bis: V3, text: string) => ({ von, bis, text, art: "kante" as const });

export function behaelter(art: BehaelterArt, r: Zufall = Math.random): Behaelter {
  switch (art) {
    case "pool": {
      const L = ganz(r, 6, 12), B = ganz(r, 3, 6), H = eins(r, [1.8, 2, 2.2, 2.5]), T = H - eins(r, [0.2, 0.3]);
      const V = L * B * H * 1000;
      return {
        art, name: "Pool", icon: "🏊", stoff: "wasser", H, T, V, laenge: L,
        text: `Ein rechteckiger Pool ist ${L} m lang, ${B} m breit und ${z(H)} m tief.`,
        rechnung: [`V = ${L} · ${B} · ${z(H)} ${ist(L * B * H, "m³")}`, `${z(L * B * H)} m³ = ${z(V)} l`],
        hinweise: ["Quader: V = a · b · c", "1 m³ = 1000 l"],
        skizze: skizzeKoerper("quader", { a: L, b: B, c: H }, { a: `${L} m`, b: `${B} m`, c: `${z(H)} m` }),
        volumen: h => L * B * Math.max(0, h) * 1000,
        boden: () => 0,
      };
    }
    case "rundpool": {
      const d = eins(r, [3, 3.6, 4, 4.5, 5.5]), H = eins(r, [1.2, 1.35, 1.5]), T = H - 0.15;
      const G = π * (d / 2) ** 2, V = G * H * 1000;
      return {
        art, name: "Runder Gartenpool", icon: "🛟", stoff: "wasser", H, T, V, laenge: d,
        text: `Ein runder Gartenpool hat ${z(d)} m Durchmesser und ist ${z(H)} m hoch.`,
        rechnung: [`r = ${z(d)} : 2 = ${z(d / 2)} m`, `V = π · ${z(d / 2)}² · ${z(H)} ${ist(G * H, "m³")}`, `${z(G * H)} m³ ${ist(V, "l")}`],
        hinweise: ["Zylinder: V = π · r² · h", "Der Radius ist der halbe Durchmesser.", "1 m³ = 1000 l"],
        skizze: skizzeKoerper("zylinder", { r: d / 2, h: H }, { d: `d = ${z(d)} m`, h: `${z(H)} m` }),
        volumen: h => G * Math.max(0, h) * 1000,
        boden: () => 0,
      };
    }
    case "sprungbecken": {
      // Boden fällt vom Nichtschwimmer- (t1) zum Sprungbereich (t2) gleichmäßig ab: liegendes Prisma mit Trapez-Querschnitt.
      const L = eins(r, [12, 15, 20]), B = eins(r, [6, 8, 10]), t1 = eins(r, [1, 1.2]), t2 = eins(r, [3.4, 3.8, 4]);
      const D = t2 - t1, H = t2, T = t2 - eins(r, [0.4, 0.5, 0.6]);
      const Vm3 = B * L * (t1 + t2) / 2, V = Vm3 * 1000;
      const volumen = (h: number) => {
        const x = Math.max(0, Math.min(h, H));
        return 1000 * B * L * (x <= D ? x * x / (2 * D) : D / 2 + x - D);
      };
      // Querschnitt (Länge, Höhe): tief links (Boden 0), flach rechts (Boden t2 − t1), Rand oben bei t2.
      const poly = liegendesPrisma([[-L / 2, t2], [-L / 2, 0], [L / 2, D], [L / 2, t2]], B);
      // liegendesPrisma zieht entlang x; um die y-Achse gedreht liegt das Profil vorne.
      const gedreht = { ...poly, ecken: poly.ecken.map(([x, y, zz]): V3 => [zz, y, -x]) };
      return {
        art, name: "Sprungbecken", icon: "🤿", stoff: "wasser", H, T, V, laenge: L,
        text: `Ein Freibadbecken ist ${L} m lang und ${B} m breit. Am Nichtschwimmerende ist es ${z(t1)} m tief, zum Sprungturm hin fällt der Boden gleichmäßig auf ${z(t2)} m ab.`,
        rechnung: [`Grundfläche (Trapez): (${z(t1)} + ${z(t2)}) : 2 · ${L} ${ist((t1 + t2) / 2 * L, "m²")}`, `V = ${z((t1 + t2) / 2 * L)} · ${B} ${ist(Vm3, "m³")}`, `${z(Vm3)} m³ = ${z(V)} l`],
        hinweise: ["Das Becken ist ein liegendes Prisma: Die Seitenansicht ist ein Trapez.", "Trapez: A = (a + c) : 2 · h, dann V = A · Breite", "1 m³ = 1000 l"],
        skizze: skizzePoly(gedreht, [
          kante([-L / 2, 0, B / 2], [-L / 2, t2, B / 2], `${z(t2)} m`),
          kante([L / 2, D, B / 2], [L / 2, t2, B / 2], `${z(t1)} m`),
          kante([-L / 2, t2, B / 2], [L / 2, t2, B / 2], `${L} m`),
          kante([L / 2, t2, B / 2], [L / 2, t2, -B / 2], `${B} m`),
        ]),
        volumen,
        boden: x => D * x,
      };
    }
    case "ballon": {
      const d = eins(r, [25, 30, 36, 40]), hub = eins(r, [0.25, 0.3, 0.4, 0.5]);
      const rr = d / 2, V = 4 / 3 * π * rr ** 3 / 1000;
      return {
        art, name: "Luftballon", icon: "🎈", stoff: "luft", H: 0, T: 0, V, hub,
        text: `Ein Luftballon wird zu einer Kugel mit ${d} cm Durchmesser aufgeblasen. Die Handpumpe schafft ${z(hub)} l pro Stoß.`,
        rechnung: [`r = ${d} : 2 = ${z(rr)} cm`, `V = 4 : 3 · π · ${z(rr)}³ ${ist(V * 1000, "cm³")}`, `${z(V * 1000)} cm³ ${ist(V, "l")}`],
        hinweise: ["Kugel: V = ⁴⁄₃ · π · r³", "1000 cm³ = 1 l"],
        skizze: skizzeKoerper("kugel", { r: rr }, { d: `d = ${d} cm` }),
        volumen: () => V,
      };
    }
    case "matratze": {
      const a = eins(r, [180, 190, 200]), b = eins(r, [70, 80, 90]), c = eins(r, [12, 15, 20]), hub = eins(r, [1.5, 2, 2.5]);
      const V = a * b * c / 1000;
      return {
        art, name: "Luftmatratze", icon: "🛏️", stoff: "luft", H: 0, T: 0, V, hub,
        text: `Eine Luftmatratze ist aufgepumpt ${a} cm lang, ${b} cm breit und ${c} cm dick. Der Blasebalg schafft ${z(hub)} l pro Tritt.`,
        rechnung: [`V = ${a} · ${b} · ${c} = ${z(a * b * c)} cm³`, `${z(a * b * c)} cm³ ${ist(V, "l")}`],
        hinweise: ["Quader: V = a · b · c", "1000 cm³ = 1 l"],
        skizze: skizzeKoerper("quader", { a: a / 10, b: b / 10, c: c / 10 }, { a: `${a} cm`, b: `${b} cm`, c: `${c} cm` }),
        volumen: () => V,
      };
    }
  }
}

/** Wasserhöhe bei `liter` Litern (Bisektion; volumen(h) steigt mit h). Über dem Rand: H + Überlauf als Kennzeichen. */
export function hoeheBei(b: Behaelter, liter: number): number {
  if (liter >= b.volumen(b.H)) return b.H + (liter - b.volumen(b.H)) / Math.max(1, b.volumen(b.H)) * b.H;
  let lo = 0, hi = b.H;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (b.volumen(m) < liter) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Schätzfrage: die richtige Größenordnung und drei Ablenker (×10, ÷10, ×3 bzw. ÷3), auf zwei Stellen gerundet. */
export function schaetzOptionen(V: number, r: Zufall = Math.random): { optionen: number[]; richtig: number } {
  const rund = (x: number) => { const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };
  const echt = rund(V);
  const faktoren = [10, 0.1, r() < 0.5 ? 3 : 1 / 3];
  const optionen = [echt, ...faktoren.map(f => rund(V * f))];
  const sortiert = [...new Set(optionen)].sort((a, b) => a - b);
  return { optionen: sortiert, richtig: sortiert.indexOf(echt) };
}

export type Sprung = { stufe: "flach" | "gut" | "ueber"; h: number; text: string };

const SPRUECHE: Record<Sprung["stufe"], string[]> = {
  flach: ["Flachköpper macht Laune! 🤕", "Kopf: 0 – Beckenboden: 1.", "Das war eher ein Pfützensprung. Die Beule wächst.", "Der Bademeister schüttelt nur den Kopf.", "Aua! Wer hat das Wasser vergessen?"],
  gut: ["Traumsprung! Die Jury zückt die 10. 🏅", "Eintauchen wie ein Messer — kaum ein Spritzer!", "Perfekt! Tief genug, und der Rasen bleibt trocken."],
  ueber: ["Land unter! 🌊 Der Nachbar freut sich gar nicht.", "Das Becken läuft über — die Wasserrechnung auch.", "Platsch! Halb Wasser, halb Liegewiese."],
};
const LUFT: Record<"schlapp" | "prall" | "peng", string[]> = {
  schlapp: ["Hängt schlapp wie ein nasser Socken.", "Noch ein paar Stöße — so schwimmt das nicht.", "Da ist ja noch Platz für ein Picknick drin."],
  prall: ["Prall und rund — perfekt! 🎈", "Genau richtig aufgepumpt. Applaus!"],
  peng: ["PENG! 💥 Der war schon voll.", "Knall! Alle Gäste erschrecken.", "Zu viel des Guten — jetzt ist es ein Gummifetzen."],
};

/** Wie der Sprung ausgeht, wenn `liter` eingelassen wurden. */
export function springe(b: Behaelter, liter: number, wurf = 0): Sprung {
  const h = hoeheBei(b, liter);
  const stufe = h < b.T - 1e-9 ? "flach" : liter > b.V * (1 + 1e-9) ? "ueber" : "gut";
  return { stufe, h, text: SPRUECHE[stufe][wurf % SPRUECHE[stufe].length] };
}

/** Pumpen: unter 90 % schlapp, über 100 % knallt es. */
export function pumpe(b: Behaelter, stoesse: number, wurf = 0) {
  const anteil = stoesse * (b.hub ?? 1) / b.V;
  const stufe = anteil < 0.9 ? "schlapp" : anteil > 1 + 1e-9 ? "peng" : "prall";
  return { stufe, anteil, text: LUFT[stufe][wurf % LUFT[stufe].length] } as const;
}

/** Die Zielmenge für den Härtetest als Rechnung (für die Lösung). */
export function zielRechnung(b: Behaelter): string[] {
  if (b.stoff === "luft") {
    const n0 = Math.ceil(0.9 * b.V / b.hub!), n1 = Math.floor(b.V / b.hub! + 1e-9);
    return [`${z(b.V)} l : ${z(b.hub!)} l ${ist(b.V / b.hub!, "Stöße")}`, `prall ab 90 %: ${n0} bis ${n1} Stöße`];
  }
  return [`mindestens ${z(b.T)} m tief: V(${z(b.T)} m) ${ist(b.volumen(b.T), "l")}`, `höchstens bis zum Rand (${z(b.H)} m): V ${ist(b.V, "l")}`];
}
