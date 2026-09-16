/**
 * Orte ohne Körper: die Lagrangepunkte.
 *
 * An fünf Stellen heben sich die Anziehung zweier Körper und die Fliehkraft
 * so auf, dass ein drittes, leichtes Ding mitläuft, ohne zurückzufallen. Man
 * sieht dort nichts — und trotzdem parken genau dort die teuersten Teleskope,
 * die wir haben. Deshalb stehen sie im Flug als Marken im All.
 *
 * Gerechnet wird mit der Näherung für kleine Massenverhältnisse:
 *   L1/L2   auf der Verbindungslinie, um r · (µ/3)^(1/3) versetzt
 *   L3      fast genau gegenüber, hinter der Sonne
 *   L4/L5   60° voraus und 60° hinterher, auf derselben Bahn
 * Für Erde (µ = 3,0·10⁻⁶) und Jupiter (µ = 9,5·10⁻⁴) reicht das auf ein
 * Prozent genau — mehr braucht die Anzeige nicht.
 */
import { heliozentrisch, type Vec3 } from "./bahnen";
import { KM_JE_AE, KOERPER_NACH_ID } from "./daten";

export interface Ort {
  id: string;
  name: string;
  /** Kurzzeichen für die Marke im Bild. */
  kurz: string;
  /** Zusatz auf der Marke, wo ein Kurzzeichen allein rätselhaft bliebe. */
  zusatz?: string;
  /** Um welchen Planeten es geht. */
  planet: string;
  /** Welcher der fünf Punkte. */
  punkt: 1 | 2 | 3 | 4 | 5;
  farbe: string;
  /** Wie weit er vom Planeten entfernt liegt, als Text. */
  entfernung: string;
  /** Wer dort parkt oder liegt. */
  bewohner: string;
  intro: string;
  fakten: string[];
}

/** Massenverhältnis Planet (mit Monden) zur Sonne. */
const MASSENANTEIL: Record<string, number> = {
  erde: 3.0034e-6,
  jupiter: 9.5458e-4,
};

export const ORTE: Ort[] = [
  {
    id: "ort-erde-l1", name: "L1 — Sonne-Erde", kurz: "L1", planet: "erde", punkt: 1, farbe: "#ffd27f",
    entfernung: "1,5 Mio. km sonnenwärts — viermal so weit weg wie der Mond",
    bewohner: "SOHO, DSCOVR und ACE beobachten von hier die Sonne",
    intro: "Der Wachposten zur Sonne hin. Wer hier steht, sieht die Sonne ohne Unterbrechung und merkt als Erster, wenn sie einen Sturm losschickt.",
    fakten: [
      "Die Erde zieht hier gegen die Sonne. Beides zusammen lässt eine Sonde langsamer kreisen, als es in dieser Entfernung allein möglich wäre — gerade langsam genug, um mit der Erde Schritt zu halten.",
      "SOHO sieht jeden Sonnensturm rund eine Stunde, bevor er bei uns ankommt. Diese Stunde reicht, um Satelliten in einen Schutzmodus zu schalten.",
      "L1 ist ein Sattel: eine Kugel bliebe nicht liegen. Die Sonden müssen alle paar Monate kurz nachschieben.",
    ],
  },
  {
    id: "ort-erde-l2", name: "L2 — Sonne-Erde", kurz: "L2", planet: "erde", punkt: 2, farbe: "#9fd8ff",
    entfernung: "1,5 Mio. km von der Sonne weg, im Schatten der Erde",
    bewohner: "James-Webb-Weltraumteleskop, Gaia und Euclid",
    intro: "Die kälteste Adresse in Erdnähe: Sonne, Erde und Mond stehen von hier aus alle in derselben Richtung. Ein einziges Schild hält sie alle ab.",
    fakten: [
      "Das James-Webb-Teleskop entfaltet dort einen tennisplatzgroßen Sonnenschirm. Davor sind es +85 °C, dahinter −233 °C.",
      "Ein Infrarotteleskop muss so kalt sein, sonst sieht es nur sein eigenes Wärmeleuchten — wie eine Kamera, die im Dunkeln ihr eigenes Blitzlicht fotografiert.",
      "Gaia hat von hier aus fast zwei Milliarden Sterne vermessen und daraus die erste echte 3D-Karte unserer Milchstraße gemacht.",
      "Hinfliegen dauert einen Monat. Reparieren kann man dort nichts mehr — Webb musste beim ersten Versuch funktionieren.",
    ],
  },
  {
    id: "ort-erde-l3", name: "L3 — Sonne-Erde", kurz: "L3", planet: "erde", punkt: 3, farbe: "#c9a0ff",
    entfernung: "auf der anderen Seite der Sonne, knapp 300 Mio. km entfernt",
    bewohner: "niemand — von der Erde aus verdeckt die Sonne diesen Punkt immer",
    intro: "Der Punkt hinter der Sonne. In alten Science-Fiction-Geschichten steht hier die »Gegenerde«, ein Zwillingsplanet, den wir nie zu Gesicht bekommen.",
    fakten: [
      "Es gibt dort nichts. Sonden, die um die Sonne fliegen, haben längst nachgesehen.",
      "Auch L3 ist instabil: alles, was sich dort sammeln würde, driftet nach ein paar Umläufen weg.",
      "Ein Funkspruch von dort bräuchte über 16 Minuten zu uns — und die Sonne funkt so laut dazwischen, dass kaum etwas ankäme.",
    ],
  },
  {
    id: "ort-erde-l4", name: "L4 — Sonne-Erde", kurz: "L4", planet: "erde", punkt: 4, farbe: "#8ef0c0",
    entfernung: "60° vor der Erde auf derselben Bahn, 150 Mio. km entfernt",
    bewohner: "der Asteroid 2010 TK7 — der erste bekannte Erd-Trojaner",
    intro: "Hier ist es stabil: Was hierher gerät, bleibt. Deshalb sammeln sich an L4 und L5 Staub und Gesteinsbrocken an.",
    fakten: [
      "Erde, Sonne und L4 bilden ein gleichseitiges Dreieck. Diese beiden Punkte hat Joseph-Louis Lagrange 1772 ausgerechnet — Jahrzehnte bevor jemand etwas dort fand.",
      "2010 TK7 ist rund 300 m groß und läuft der Erde ewig voraus, ohne je näher zu kommen.",
      "An L4 und L5 des Erde-Mond-Systems stehen die Kordylewski-Wolken: schwache Staubschwaden, die man nur bei perfekter Nacht ahnen kann.",
    ],
  },
  {
    id: "ort-erde-l5", name: "L5 — Sonne-Erde", kurz: "L5", planet: "erde", punkt: 5, farbe: "#8ef0c0",
    entfernung: "60° hinter der Erde auf derselben Bahn",
    bewohner: "Staub, und in vielen Zukunftsplänen die erste große Raumstation",
    intro: "Der Zwilling von L4, nur hinter der Erde. Weil hier nichts wegdriftet, gilt L5 seit den 1970ern als bester Bauplatz für eine Weltraumkolonie.",
    fakten: [
      "Die NASA entwarf 1975 den O'Neill-Zylinder für genau diesen Ort: eine rotierende Röhre mit Feldern, Seen und künstlicher Schwerkraft.",
      "Stabil ist L5 nur, weil der Planet viel leichter ist als der Stern — unter dem 25-fachen Massenunterschied kippt auch das.",
      "Wer von L5 aus zur Erde funkt, wartet gut acht Minuten auf die Antwort.",
    ],
  },
  {
    id: "ort-jupiter-l4", name: "L4 — Sonne-Jupiter: die Griechen", kurz: "L4", zusatz: "Trojaner", planet: "jupiter", punkt: 4, farbe: "#ffb36b",
    entfernung: "60° vor Jupiter, gut 780 Mio. km von der Sonne",
    bewohner: "über 7 000 Asteroiden, nach griechischen Helden benannt",
    intro: "Jupiters Vorhut. Hier fliegt ein ganzer Schwarm von Asteroiden mit dem Planeten mit — festgehalten von nichts als der Form des Kraftfeldes.",
    fakten: [
      "Insgesamt kennt man an Jupiters L4 und L5 über 13 000 dieser Trojaner. Geschätzt sind es so viele wie im ganzen Asteroidengürtel.",
      "Sie sind fast schwarz und rötlich — vermutlich Überreste aus der Zeit, als sich die Planeten bildeten. Deshalb sind sie so interessant.",
      "Die Sonde Lucy ist seit 2021 unterwegs und besucht bis 2033 acht von ihnen.",
      "Tradition: Was an L4 liegt, bekommt den Namen eines Griechen, was an L5 liegt, den eines Trojaners. Zwei Brocken wurden vertauscht einsortiert — sie heißen die »Spione«.",
    ],
  },
  {
    id: "ort-jupiter-l5", name: "L5 — Sonne-Jupiter: die Trojaner", kurz: "L5", zusatz: "Trojaner", planet: "jupiter", punkt: 5, farbe: "#ffb36b",
    entfernung: "60° hinter Jupiter",
    bewohner: "über 4 000 Asteroiden mit Namen aus Homers Ilias",
    intro: "Jupiters Nachhut. Seit 1906 der erste entdeckt wurde, heißen alle Asteroiden an solchen Punkten »Trojaner« — auch die von Mars, Neptun und der Erde.",
    fakten: [
      "Der größte heißt 617 Patroclus und ist in Wahrheit ein Doppelasteroid: zwei Brocken von je 100 km, die einander umkreisen.",
      "Auch Neptun hat Trojaner, und der Mars ebenfalls. Saturn dagegen nicht — Jupiter räumt sie ihm weg.",
      "Ein Trojaner fällt nicht einfach in den Punkt hinein: er pendelt in einer weit ausholenden Bohnenform darum herum, über Jahrhunderte.",
    ],
  },
];

export const ORTE_NACH_ID: Record<string, Ort> = Object.fromEntries(ORTE.map(o => [o.id, o]));

export const orteVon = (planetId: string) => ORTE.filter(o => o.planet === planetId);

/**
 * Nur L1 und L2: wie weit sie vom Planeten weg liegen und in welche Richtung.
 *
 * Der Flug braucht das getrennt, weil er planetennahe Abstände anders staucht
 * als die zwischen den Planeten (siehe massstab.ts): so bleiben L1 und L2
 * dort, wo sie hingehören — deutlich außerhalb der Mondbahn.
 */
export function ortAmPlaneten(o: Ort, jd: number): { km: number; nachAussen: boolean } | null {
  if (o.punkt > 2) return null;
  const p = heliozentrisch(KOERPER_NACH_ID[o.planet].bahn!, jd);
  const r = Math.hypot(...p);
  return { km: r * Math.cbrt(MASSENANTEIL[o.planet] / 3) * KM_JE_AE, nachAussen: o.punkt === 2 };
}

/** Wo der Ort gerade liegt: heliozentrisch in AE, auf ein Prozent genau. */
export function ortHeliozentrisch(o: Ort, jd: number): Vec3 {
  const p = heliozentrisch(KOERPER_NACH_ID[o.planet].bahn!, jd);
  if (o.punkt === 3) {
    const f = 1 + (5 * MASSENANTEIL[o.planet]) / 12;
    return [-p[0] * f, -p[1] * f, -p[2] * f];
  }
  if (o.punkt === 1 || o.punkt === 2) {
    const f = 1 + (o.punkt === 2 ? 1 : -1) * Math.cbrt(MASSENANTEIL[o.planet] / 3);
    return [p[0] * f, p[1] * f, p[2] * f];
  }
  // L4 und L5: derselbe Abstand, nur 60° voraus beziehungsweise hinterher.
  // Gedreht wird um die Bahnnormale, damit auch geneigte Bahnen stimmen.
  const spaeter = heliozentrisch(KOERPER_NACH_ID[o.planet].bahn!, jd + 1);
  const n = kreuz(p, spaeter);
  const l = Math.hypot(...n);
  const achse: Vec3 = [n[0] / l, n[1] / l, n[2] / l];
  return dreheUm(p, achse, ((o.punkt === 4 ? 60 : -60) * Math.PI) / 180);
}

const kreuz = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Rodrigues-Formel: Vektor v um die Einheitsachse k, Winkel w. */
function dreheUm(v: Vec3, k: Vec3, w: number): Vec3 {
  const c = Math.cos(w), s = Math.sin(w);
  const kv = kreuz(k, v);
  const skalar = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  return [
    v[0] * c + kv[0] * s + k[0] * skalar * (1 - c),
    v[1] * c + kv[1] * s + k[1] * skalar * (1 - c),
    v[2] * c + kv[2] * s + k[2] * skalar * (1 - c),
  ];
}
