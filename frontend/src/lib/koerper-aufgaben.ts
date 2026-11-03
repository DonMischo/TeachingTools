/**
 * Gewürfelte Aufgaben zu den Körpern: Übungen (Volumen, Oberfläche,
 * rückwärts, Euler, Einheiten, erkennen, Diagonalen, zusammengesetzt) und
 * Sachaufgaben (Aquarium, Dose, Zelt, Eistüte, Pool, Schwimmbecken, Paket,
 * Kerze), dazu die Paare fürs Spiel »Wer fasst mehr?«. Reine Rechnung; die
 * Schrägbilder kommen aus lib/koerper-skizze.ts.
 */
import { z } from "@/lib/prozent";
import { auswahl, eins, ganz, gesucht, type Art, type Sachaufgabe, type Zufall } from "@/lib/geometrie/aufgabe";
import { KOERPER, KOERPER_REIHE, ist, liegendesPrisma, prismaAus, pyramideAus, type KoerperKey, type Masse } from "@/lib/koerper";
import { skizzeKoerper, skizzeNetz, skizzePoly } from "@/lib/koerper-skizze";
import { ZUSAMMEN, Z_REIHE, skizzeZusammen } from "@/lib/koerper-zusammen";
import type { Skizze } from "@/lib/geometrie/skizze";

export type UebungsArt = "volumen" | "oberflaeche" | "rueckwaerts" | "euler" | "einheiten" | "erkennen" | "diagonale" | "zusammengesetzt";
export const UEBUNG_ARTEN: Art<UebungsArt>[] = [
  { id: "volumen", icon: "🧊", label: "Volumen" },
  { id: "oberflaeche", icon: "🎁", label: "Oberfläche" },
  { id: "rueckwaerts", icon: "↩️", label: "Rückwärts" },
  { id: "euler", icon: "🔢", label: "Ecken, Flächen, Kanten" },
  { id: "einheiten", icon: "📏", label: "Raumeinheiten" },
  { id: "erkennen", icon: "🔎", label: "Erkennen" },
  { id: "diagonale", icon: "📐", label: "Pythagoras im Körper" },
  { id: "zusammengesetzt", icon: "🧩", label: "Zusammengesetzt" },
];

export type AnwendungsArt = "aquarium" | "dose" | "zelt" | "eistuete" | "pool" | "schwimmbecken" | "paket" | "kerze";
export const ANWENDUNG_ARTEN: Art<AnwendungsArt>[] = [
  { id: "aquarium", icon: "🐠", label: "Aquarium füllen" },
  { id: "dose", icon: "🥫", label: "Dose etikettieren" },
  { id: "zelt", icon: "⛺", label: "Zelt nähen" },
  { id: "eistuete", icon: "🍦", label: "Eistüte" },
  { id: "pool", icon: "🏊", label: "Pool füllen" },
  { id: "schwimmbecken", icon: "🏊‍♀️", label: "Schwimmbecken fliesen" },
  { id: "paket", icon: "🎁", label: "Paket packen" },
  { id: "kerze", icon: "🕯️", label: "Kerze gießen" },
];

/** »des Quaders«, »der Kugel« … */
export const GENITIV: Record<KoerperKey, string> = {
  wuerfel: "des Würfels", quader: "des Quaders", prisma3: "des dreiseitigen Prismas", prisma6: "des sechsseitigen Prismas",
  zylinder: "des Zylinders", pyramide4: "der quadratischen Pyramide", pyramide_r: "der rechteckigen Pyramide", kegel: "des Kegels",
  kugel: "der Kugel", halbkugel: "der Halbkugel", pstumpf: "des Pyramidenstumpfs", kstumpf: "des Kegelstumpfs",
};

/** Zufällige ganzzahlige Maße in cm. */
export function zufallsMasse(key: KoerperKey, r: Zufall): Masse {
  switch (key) {
    case "wuerfel": return { a: ganz(r, 2, 10) };
    case "quader": return { a: ganz(r, 3, 12), b: ganz(r, 2, 10), c: ganz(r, 2, 10) };
    case "prisma3": return { g: ganz(r, 3, 10), hg: ganz(r, 2, 8), h: ganz(r, 3, 12) };
    case "prisma6": return { a: ganz(r, 2, 6), h: ganz(r, 3, 12) };
    case "zylinder": return { r: ganz(r, 2, 8), h: ganz(r, 3, 15) };
    case "pyramide4": return { a: ganz(r, 3, 10), h: ganz(r, 3, 12) };
    case "pyramide_r": return { a: ganz(r, 4, 12), b: ganz(r, 3, 10), h: ganz(r, 3, 12) };
    case "kegel": return { r: ganz(r, 2, 8), h: ganz(r, 3, 15) };
    case "kugel": return { r: ganz(r, 2, 10) };
    case "halbkugel": return { r: ganz(r, 2, 10) };
    case "pstumpf": { const a = ganz(r, 5, 12); return { a, a2: ganz(r, 2, a - 2), h: ganz(r, 3, 10) }; }
    case "kstumpf": { const r1 = ganz(r, 4, 10); return { r1, r2: ganz(r, 2, r1 - 1), h: ganz(r, 3, 10) }; }
  }
}

/** Die gegebenen Maße als Satz (»a = 4 cm, b = 3 cm und c = 2 cm«) und als Beschriftung fürs Schrägbild. */
export function gegeben(key: KoerperKey, m: Masse, e = "cm") {
  const linien = KOERPER[key].rechne(m).linien;
  const teile: string[] = [];
  const texte: Record<string, string> = {};
  for (const f of KOERPER[key].felder) {
    const l = linien.find(x => x.id === f.key);
    const zeichen = l?.zeichen ?? f.key;
    teile.push(`${zeichen} = ${z(m[f.key])} ${e}`);
    texte[f.key] = `${zeichen} = ${z(m[f.key])} ${e}`;
  }
  const satz = teile.length > 1 ? `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}` : teile[0];
  return { satz, texte };
}

const zeilen = (...xs: (string | undefined)[]) => xs.filter((x): x is string => !!x).flatMap(x => x.split("; "));
const VOLUMEN_KOERPER: KoerperKey[] = ["wuerfel", "quader", "prisma3", "prisma6", "zylinder", "pyramide4", "pyramide_r", "kegel", "kugel", "halbkugel", "pstumpf", "kstumpf"];
const OBERFLAECHE_KOERPER: KoerperKey[] = ["wuerfel", "quader", "prisma3", "zylinder", "pyramide4", "pyramide_r", "kegel", "kugel", "halbkugel", "kstumpf"];

/** Regelmäßiges n-Eck mit Umkreisradius `r`, eine Kante vorne parallel zur x-Achse. */
const nEck = (n: number, r: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const w = Math.PI / 2 + Math.PI / n + i * 2 * Math.PI / n;
    return [r * Math.cos(w), r * Math.sin(w)];
  });

/* ─────────────────────────────────────────────────────────── Übungen ── */

export function erzeugeUebung(art: UebungsArt, r: Zufall = Math.random): Sachaufgabe<UebungsArt> {
  switch (art) {
    case "volumen": {
      const key = eins(r, VOLUMEN_KOERPER), m = zufallsMasse(key, r), d = KOERPER[key].rechne(m), g = gegeben(key, m);
      const mitG = /G/.test(d.V.formel);
      return {
        art, titel: `Volumen ${GENITIV[key]}`,
        text: `Berechne das Volumen ${GENITIV[key]} mit ${g.satz}.`,
        gesucht: [gesucht("V", "Volumen V", "cm³", d.V.wert)],
        hinweise: [`Formel: ${d.V.formel}`, ...(mitG && d.G ? [`Grundfläche zuerst: ${d.G.formel}`] : []), "Runde auf zwei Nachkommastellen."],
        loesung: zeilen(mitG ? d.G?.rechnung : undefined, d.V.rechnung),
        skizze: skizzeKoerper(key, m, g.texte),
      };
    }
    case "oberflaeche": {
      const key = eins(r, OBERFLAECHE_KOERPER), m = zufallsMasse(key, r), d = KOERPER[key].rechne(m), g = gegeben(key, m);
      const einfach = key === "wuerfel" || key === "quader" || key === "kugel";
      return {
        art, titel: `Oberfläche ${GENITIV[key]}`,
        text: `Berechne die Oberfläche ${GENITIV[key]} mit ${g.satz}.`,
        gesucht: [gesucht("O", "Oberfläche O", "cm²", d.O.wert)],
        hinweise: [
          `Formel: ${d.O.formel}`,
          ...(key.startsWith("pyramide") ? ["Die Seitenhöhe h_s bekommst du mit dem Satz des Pythagoras."] : []),
          ...(key === "kegel" || key === "kstumpf" ? ["Die Mantellinie s bekommst du mit dem Satz des Pythagoras."] : []),
          "Zeichne dir das Netz: Jede Fläche kommt genau einmal vor.",
        ],
        loesung: einfach ? zeilen(d.O.rechnung) : zeilen(d.G?.rechnung, d.D?.rechnung, d.M.rechnung, d.O.rechnung),
        skizze: skizzeKoerper(key, m, g.texte),
      };
    }
    case "rueckwaerts": {
      const fall = ganz(r, 0, 4);
      if (fall === 0) {
        const a = ganz(r, 2, 9), b = ganz(r, 2, 9), c = ganz(r, 2, 12), V = a * b * c;
        return {
          art, titel: "Quader: Höhe gesucht",
          text: `Ein Quader hat das Volumen V = ${z(V)} cm³, die Länge a = ${a} cm und die Breite b = ${b} cm. Wie hoch ist er?`,
          gesucht: [gesucht("c", "Höhe c", "cm", c)],
          hinweise: ["V = a · b · c", "Stelle nach c um: c = V : (a · b)"],
          loesung: [`c = V : (a · b)`, `c = ${z(V)} : (${a} · ${b}) = ${z(V)} : ${a * b} = ${z(c)} cm`],
          skizze: skizzeKoerper("quader", { a, b, c }, { a: `${a} cm`, b: `${b} cm`, c: "c = ?" }),
        };
      }
      if (fall === 1) {
        const a = ganz(r, 2, 10);
        const nachO = r() < 0.5;
        return {
          art, titel: "Würfel: Kante gesucht",
          text: nachO ? `Ein Würfel hat die Oberfläche O = ${z(6 * a * a)} cm². Wie lang ist eine Kante?` : `Ein Würfel hat das Volumen V = ${z(a ** 3)} cm³. Wie lang ist eine Kante?`,
          gesucht: [gesucht("a", "Kante a", "cm", a)],
          hinweise: nachO ? ["O = 6 · a²", "Eine Fläche: O : 6. Dann die Wurzel ziehen."] : ["V = a³", "Welche Zahl hoch drei ergibt das Volumen?"],
          loesung: nachO
            ? [`a² = O : 6 = ${z(6 * a * a)} : 6 = ${a * a} cm²`, `a = √${a * a} = ${a} cm`]
            : [`a = ∛V = ∛${z(a ** 3)}`, `a = ${a} cm, denn ${a} · ${a} · ${a} = ${z(a ** 3)}`],
          skizze: skizzeKoerper("wuerfel", { a }, { a: "a = ?" }),
        };
      }
      if (fall === 2) {
        const rr = ganz(r, 2, 6), h = ganz(r, 3, 12), V = Math.PI * rr * rr * h;
        return {
          art, titel: "Zylinder: Höhe gesucht",
          text: `Ein Zylinder mit dem Radius r = ${rr} cm fasst V ≈ ${z(V)} cm³. Wie hoch ist er?`,
          gesucht: [gesucht("h", "Höhe h", "cm", h, 0.1)],
          hinweise: ["V = π · r² · h", "h = V : (π · r²)"],
          loesung: [`G = π · ${rr}² ${ist(Math.PI * rr * rr, "cm²")}`, `h = V : G = ${z(V)} : ${z(Math.PI * rr * rr)} ≈ ${z(h)} cm`],
          skizze: skizzeKoerper("zylinder", { r: rr, h }, { r: `${rr} cm`, h: "h = ?" }),
        };
      }
      if (fall === 3) {
        const a = ganz(r, 3, 10), h = 3 * ganz(r, 1, 4), V = a * a * h / 3;
        return {
          art, titel: "Pyramide: Höhe gesucht",
          text: `Eine quadratische Pyramide hat das Volumen V = ${z(V)} cm³ und die Grundkante a = ${a} cm. Wie hoch ist sie?`,
          gesucht: [gesucht("h", "Höhe h", "cm", h)],
          hinweise: ["V = ⅓ · a² · h", "h = 3 · V : a²"],
          loesung: [`h = 3 · V : a²`, `h = 3 · ${z(V)} : ${a * a} = ${z(h)} cm`],
          skizze: skizzeKoerper("pyramide4", { a, h }, { a: `${a} cm`, h: "h = ?" }),
        };
      }
      const g = ganz(r, 3, 10), hg = 2 * ganz(r, 1, 4), h = ganz(r, 3, 12), G = g * hg / 2;
      return {
        art, titel: "Prisma: Höhe gesucht",
        text: `Ein dreiseitiges Prisma hat ein Dreieck mit g = ${g} cm und h_g = ${hg} cm als Grundfläche. Es fasst V = ${z(G * h)} cm³. Wie hoch ist es?`,
        gesucht: [gesucht("h", "Körperhöhe h", "cm", h)],
        hinweise: ["V = G · h", "Erst G = ½ · g · h_g, dann h = V : G"],
        loesung: [`G = ½ · ${g} · ${hg} = ${z(G)} cm²`, `h = V : G = ${z(G * h)} : ${z(G)} = ${h} cm`],
        skizze: skizzeKoerper("prisma3", { g, hg, h }, { g: `${g} cm`, hg: `${hg} cm`, h: "h = ?" }),
      };
    }
    case "euler": {
      const n = ganz(r, 3, 8), pyr = r() < 0.5;
      const e = pyr ? n + 1 : 2 * n, f = pyr ? n + 1 : n + 2, k = pyr ? 2 * n : 3 * n;
      const koerper = pyr ? `eine Pyramide mit einem ${n}-Eck als Grundfläche` : `ein Prisma mit einem ${n}-Eck als Grundfläche`;
      const p = pyr ? pyramideAus(nEck(n, 3), 5) : prismaAus(nEck(n, 3), 4);
      const skizze = skizzePoly(p);
      if (r() < 0.5) {
        return {
          art, titel: "Ecken, Flächen, Kanten zählen",
          text: `Wie viele Ecken, Flächen und Kanten hat ${koerper}?`,
          gesucht: [gesucht("e", "Ecken e", "", e, 0), gesucht("f", "Flächen f", "", f, 0), gesucht("k", "Kanten k", "", k, 0)],
          hinweise: pyr
            ? [`Die Grundfläche hat ${n} Ecken, dazu kommt die Spitze.`, `Flächen: die Grundfläche und ${n} Dreiecke.`, "Prüfe mit Euler: e + f − k = 2"]
            : [`Grund- und Deckfläche haben je ${n} Ecken.`, `Flächen: zwei ${n}-Ecke und ${n} Rechtecke.`, "Prüfe mit Euler: e + f − k = 2"],
          loesung: [
            pyr ? `e = ${n} + 1 = ${e}` : `e = 2 · ${n} = ${e}`,
            pyr ? `f = 1 + ${n} = ${f}` : `f = 2 + ${n} = ${f}`,
            pyr ? `k = ${n} + ${n} = ${k}` : `k = 3 · ${n} = ${k}`,
            `Probe: ${e} + ${f} − ${k} = 2`,
          ],
          skizze,
        };
      }
      const welche = eins(r, ["e", "f", "k"] as const);
      const wert = { e, f, k }[welche];
      const name = { e: "Ecken", f: "Flächen", k: "Kanten" }[welche];
      const bekannt = (["e", "f", "k"] as const).filter(x => x !== welche).map(x => `${{ e, f, k }[x]} ${{ e: "Ecken", f: "Flächen", k: "Kanten" }[x]}`);
      const formel = welche === "e" ? `e = 2 − f + k = 2 − ${f} + ${k}` : welche === "f" ? `f = 2 − e + k = 2 − ${e} + ${k}` : `k = e + f − 2 = ${e} + ${f} − 2`;
      return {
        art, titel: "Eulerscher Polyedersatz",
        text: `Ein Polyeder hat ${bekannt.join(" und ")}. Wie viele ${name} hat es?`,
        gesucht: [gesucht(welche, `${name} ${welche}`, "", wert, 0)],
        hinweise: ["Für jeden Körper mit ebenen Flächen gilt: e + f − k = 2", "Stelle die Gleichung nach der gesuchten Zahl um."],
        loesung: [formel + ` = ${wert}`, `Zum Beispiel ${koerper}.`],
        skizze,
      };
    }
    case "einheiten": {
      const paare: [string, string, number][] = [
        ["cm³", "mm³", 1000], ["dm³", "cm³", 1000], ["m³", "dm³", 1000], ["m³", "cm³", 1e6],
        ["mm³", "cm³", 1e-3], ["cm³", "dm³", 1e-3], ["dm³", "m³", 1e-3], ["cm³", "m³", 1e-6],
        ["l", "ml", 1000], ["ml", "l", 1e-3], ["dm³", "l", 1], ["cm³", "ml", 1], ["m³", "l", 1000], ["l", "m³", 1e-3], ["l", "cm³", 1000],
      ];
      const [von, nach, f] = eins(r, paare);
      const x = f >= 1 ? ganz(r, 1, 99) / eins(r, [1, 10]) : ganz(r, 1, 999) * 10 / (f * 1000);
      const y = x * f;
      const schritt = f === 1 ? "gleich groß" : f > 1 ? `· ${z(f, 0)}` : `: ${z(1 / f, 0)}`;
      return {
        art, titel: "Raumeinheiten umrechnen",
        text: `Rechne um: ${z(x, 3)} ${von} = ? ${nach}`,
        gesucht: [gesucht("y", `${z(x, 3)} ${von} in ${nach}`, nach, y, Math.max(1e-6, y * 1e-6), 3)],
        hinweise: ["Bei Raumeinheiten ist die Umrechnungszahl 1000: 1 m³ = 1000 dm³, 1 dm³ = 1000 cm³, 1 cm³ = 1000 mm³.", "1 l = 1 dm³ und 1 ml = 1 cm³"],
        loesung: [f === 1 ? `1 ${von} = 1 ${nach}` : `in ${nach}: ${schritt}`, `${z(x, 3)} ${von} = ${z(y, 3)} ${nach}`],
      };
    }
    case "erkennen": {
      if (r() < 0.5) {
        const [text, key] = eins(r, STECKBRIEFE);
        const optionen = optionenMit(key, r);
        return {
          art, titel: "Welcher Körper ist das?",
          text: `Steckbrief: ${text}`,
          gesucht: [auswahl("k", "Körper", optionen, KOERPER[key].name)],
          hinweise: ["Zähle die Flächen und überlege, welche Formen sie haben.", "Gekrümmte Flächen gibt es nur bei Zylinder, Kegel und Kugel."],
          loesung: [`Gesucht ist: ${KOERPER[key].name}.`],
        };
      }
      const key = eins(r, ["wuerfel", "quader", "prisma3", "prisma6", "zylinder", "pyramide4", "kegel", "pstumpf", "kstumpf"] as KoerperKey[]);
      const m = zufallsMasse(key, r);
      return {
        art, titel: "Welcher Körper entsteht aus dem Netz?",
        text: "Das Netz wird entlang der Kanten zugeklappt. Welcher Körper entsteht?",
        gesucht: [auswahl("k", "Körper", optionenMit(key, r), KOERPER[key].name)],
        hinweise: ["Die blaue Fläche ist die Grundfläche, die grüne die Deckfläche.", "Zähle die Seitenflächen am Rand der Grundfläche."],
        loesung: [`Aus dem Netz entsteht: ${KOERPER[key].name}.`],
        skizze: skizzeNetz(key, m)!,
      };
    }
    case "diagonale": {
      const fall = ganz(r, 0, 3);
      if (fall === 0) {
        const a = ganz(r, 2, 10), b = ganz(r, 2, 10), c = ganz(r, 2, 10), df = Math.hypot(a, b), d = Math.hypot(a, b, c);
        return {
          art, titel: "Raumdiagonale im Quader",
          text: `Ein Quader ist a = ${a} cm lang, b = ${b} cm breit und c = ${c} cm hoch. Wie lang ist die Raumdiagonale d?`,
          gesucht: [gesucht("d", "Raumdiagonale d", "cm", d)],
          hinweise: ["Erst die Diagonale der Grundfläche: d_f = √(a² + b²)", "Dann ein rechtwinkliges Dreieck aus d_f, c und d: d = √(d_f² + c²)"],
          loesung: [`d_f = √(${a}² + ${b}²) ${ist(df, "cm")}`, `d = √(${a}² + ${b}² + ${c}²) = √${a * a + b * b + c * c} ${ist(d, "cm")}`],
          skizze: skizzeKoerper("quader", { a, b, c }, { a: `${a} cm`, b: `${b} cm`, c: `${c} cm`, d: "d = ?" }),
        };
      }
      if (fall === 1) {
        const a = 2 * ganz(r, 2, 6), h = ganz(r, 3, 12), hs = Math.hypot(h, a / 2);
        return {
          art, titel: "Seitenhöhe einer Pyramide",
          text: `Eine quadratische Pyramide hat die Grundkante a = ${a} cm und die Höhe h = ${h} cm. Wie groß ist die Seitenhöhe h_s?`,
          gesucht: [gesucht("hs", "Seitenhöhe h_s", "cm", hs)],
          hinweise: ["Höhe h, die halbe Grundkante und h_s bilden ein rechtwinkliges Dreieck.", "h_s = √(h² + (a : 2)²)"],
          loesung: [`h_s = √(${h}² + ${a / 2}²) = √${h * h + a * a / 4} ${ist(hs, "cm")}`],
          skizze: skizzeKoerper("pyramide4", { a, h }, { a: `${a} cm`, h: `${h} cm`, hs: "h_s = ?" }),
        };
      }
      // Pythagoreische Tripel, damit auch rückwärts glatte Zahlen herauskommen
      const [x, y, s] = eins(r, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 6, 10], [4, 3, 5]] as const);
      if (fall === 2) {
        return {
          art, titel: "Mantellinie eines Kegels",
          text: `Ein Kegel hat den Radius r = ${x} cm und die Höhe h = ${y} cm. Wie lang ist die Mantellinie s?`,
          gesucht: [gesucht("s", "Mantellinie s", "cm", s)],
          hinweise: ["Radius, Höhe und Mantellinie bilden ein rechtwinkliges Dreieck.", "s = √(r² + h²)"],
          loesung: [`s = √(${x}² + ${y}²) = √${x * x + y * y} = ${s} cm`],
          skizze: skizzeKoerper("kegel", { r: x, h: y }, { r: `${x} cm`, h: `${y} cm`, s: "s = ?" }),
        };
      }
      return {
        art, titel: "Höhe eines Kegels",
        text: `Ein Kegel hat den Radius r = ${x} cm und die Mantellinie s = ${s} cm. Wie hoch ist er?`,
        gesucht: [gesucht("h", "Höhe h", "cm", y)],
        hinweise: ["s ist die Hypotenuse.", "h = √(s² − r²)"],
        loesung: [`h = √(${s}² − ${x}²) = √${s * s - x * x} = ${y} cm`],
        skizze: skizzeKoerper("kegel", { r: x, h: y }, { r: `${x} cm`, s: `${s} cm`, h: "h = ?" }),
      };
    }
    case "zusammengesetzt": {
      const key = eins(r, Z_REIHE), k = ZUSAMMEN[key];
      const m: Masse = {};
      for (const f of k.felder) m[f.key] = ganz(r, Math.ceil(f.min), Math.floor(f.max));
      const d = k.rechne(m);
      const nachO = r() < 0.4;
      const satz = k.felder.map(f => `${f.label} = ${z(m[f.key])} cm`).join(", ");
      const texte = Object.fromEntries(k.felder.map(f => [f.key, `${z(m[f.key])} cm`]));
      const zs = nachO ? d.oZeilen : d.vZeilen;
      return {
        art, titel: `${k.name}: ${nachO ? "Oberfläche" : "Volumen"}`,
        text: `Der Körper »${k.name}« besteht aus ${k.aus}. Gegeben: ${satz}. Berechne ${nachO ? "die Oberfläche" : "das Volumen"}.`,
        gesucht: [nachO ? gesucht("O", "Oberfläche O", "cm²", d.O) : gesucht("V", "Volumen V", "cm³", d.V)],
        hinweise: nachO
          ? ["Rechne jede außen liegende Fläche einzeln.", d.verdeckt]
          : [k.key === "werkstueck" ? "Die Bohrung wird vom Quader abgezogen." : "Berechne die Teilkörper einzeln und addiere."],
        loesung: [
          ...zs.flatMap(x => `${x.minus ? "− " : "+ "}${x.text}: ${x.rechnung}`.split("; ")),
          `${nachO ? "O" : "V"} ${ist(nachO ? d.O : d.V, nachO ? "cm²" : "cm³")}`,
        ],
        skizze: skizzeZusammen(key, m, texte),
      };
    }
  }
}

export const STECKBRIEFE: [string, KoerperKey][] = [
  ["Ich habe sechs gleich große Quadrate als Flächen.", "wuerfel"],
  ["Ich habe sechs Rechtecke, acht Ecken und zwölf Kanten; gegenüberliegende Flächen sind gleich groß.", "quader"],
  ["Ich habe zwei Dreiecke und drei Rechtecke als Flächen, sechs Ecken und neun Kanten.", "prisma3"],
  ["Ich habe zwei Sechsecke und sechs Rechtecke als Flächen.", "prisma6"],
  ["Ich habe zwei gleich große Kreise und eine gekrümmte Fläche, die abgerollt ein Rechteck ist.", "zylinder"],
  ["Ich habe ein Quadrat und vier gleiche Dreiecke, die sich in einer Spitze treffen.", "pyramide4"],
  ["Ich habe ein Rechteck und vier Dreiecke; je zwei gegenüberliegende sind gleich.", "pyramide_r"],
  ["Ich habe einen Kreis und eine gekrümmte Fläche mit einer Spitze; abgerollt ist sie ein Kreisausschnitt.", "kegel"],
  ["Ich habe nur eine gekrümmte Fläche, und jeder Punkt darauf ist gleich weit vom Mittelpunkt entfernt.", "kugel"],
  ["Ich habe eine Kreisfläche und eine gekrümmte Fläche, halb so groß wie eine Kugelfläche.", "halbkugel"],
  ["Ich habe zwei verschieden große, parallele Quadrate und vier Trapeze.", "pstumpf"],
  ["Ich habe zwei verschieden große, parallele Kreise und eine gekrümmte Fläche dazwischen.", "kstumpf"],
];

function optionenMit(key: KoerperKey, r: Zufall): string[] {
  const andere = KOERPER_REIHE.filter(k => k !== key).sort(() => r() - 0.5).slice(0, 3);
  return [key, ...andere].sort(() => r() - 0.5).map(k => KOERPER[k].name);
}

/* ─────────────────────────────────────────────────────── Anwendungen ── */

export function erzeugeAnwendung(art: AnwendungsArt, r: Zufall = Math.random): Sachaufgabe<AnwendungsArt> {
  switch (art) {
    case "aquarium": {
      const a = eins(r, [40, 50, 60, 80, 100, 120]), b = eins(r, [25, 30, 35, 40, 50]), c = eins(r, [30, 35, 40, 50, 60]), u = ganz(r, 2, 6);
      const liter = a * b * (c - u) / 1000;
      return {
        art, titel: "Aquarium füllen",
        text: `Ein Aquarium ist ${a} cm lang, ${b} cm breit und ${c} cm hoch. Es wird bis ${u} cm unter den Rand mit Wasser gefüllt. Wie viele Liter Wasser sind das? Wie oft muss man einen 10-Liter-Eimer dafür füllen?`,
        gesucht: [gesucht("l", "Wasser", "l", liter), gesucht("eimer", "Eimer", "", Math.ceil(liter / 10), 0)],
        hinweise: [`Die Wasserhöhe ist ${c} cm − ${u} cm = ${c - u} cm.`, "V = a · b · c in cm³; 1000 cm³ = 1 l", "Der letzte Eimer darf auch halb voll sein — zählt aber mit."],
        loesung: [`V = ${a} · ${b} · ${c - u} = ${z(a * b * (c - u))} cm³`, `${z(a * b * (c - u))} cm³ = ${z(liter)} l`, `${z(liter)} : 10 = ${z(liter / 10)} → ${Math.ceil(liter / 10)} Eimer`],
        skizze: skizzeKoerper("quader", { a, b, c }, { a: `${a} cm`, b: `${b} cm`, c: `${c} cm` }),
      };
    }
    case "dose": {
      const d = eins(r, [6, 7, 7.5, 8, 10]), h = eins(r, [8, 10, 11, 12, 15]);
      const M = Math.PI * d * h, V = Math.PI * (d / 2) ** 2 * h;
      return {
        art, titel: "Dose etikettieren",
        text: `Eine Konservendose hat den Durchmesser ${z(d)} cm und ist ${h} cm hoch. Das Etikett bedeckt den ganzen Mantel. Wie groß ist das Etikett, und wie viel passt in die Dose?`,
        gesucht: [gesucht("M", "Etikett", "cm²", M), gesucht("V", "Inhalt", "ml", V)],
        hinweise: ["Das Etikett ist abgerollt ein Rechteck: Umfang u = π · d mal Höhe h.", `r = d : 2 = ${z(d / 2)} cm`, "1 cm³ = 1 ml"],
        loesung: [`M = π · ${z(d)} · ${h} ${ist(M, "cm²")}`, `V = π · ${z(d / 2)}² · ${h} ${ist(V, "cm³")} = ${z(V)} ml`],
        skizze: skizzeKoerper("zylinder", { r: d / 2, h }, { d: `d = ${z(d)} cm`, h: `${h} cm` }),
      };
    }
    case "zelt": {
      const L = eins(r, [2, 2.2, 2.5, 3]), b = eins(r, [1.4, 1.6, 1.8, 2]), hz = eins(r, [1.2, 1.4, 1.5, 1.6]);
      const s = Math.hypot(b / 2, hz), stoff = b * hz + 2 * L * s + L * b, luft = b * hz / 2 * L;
      return {
        art, titel: "Zelt nähen",
        text: `Ein Zelt hat die Form eines liegenden dreiseitigen Prismas: ${z(L)} m lang, ${z(b)} m breit und ${z(hz)} m hoch. Wie viel Stoff braucht man mit Boden? Wie viel Luft ist darin?`,
        gesucht: [gesucht("stoff", "Stoff", "m²", stoff), gesucht("luft", "Luft", "m³", luft)],
        hinweise: [
          "Stoff: zwei Dreiecke vorne und hinten, zwei schräge Dachflächen und der Boden.",
          `Die Dachfläche ist so breit wie die schräge Seite s = √((b : 2)² + h²) ${ist(s, "m")}.`,
          "Luft = Dreiecksfläche · Länge",
        ],
        loesung: [
          `Dreiecke: 2 · ½ · ${z(b)} · ${z(hz)} ${ist(b * hz, "m²")}`,
          `s = √(${z(b / 2)}² + ${z(hz)}²) ${ist(s, "m")}`,
          `Dachflächen: 2 · ${z(L)} · ${z(s)} ${ist(2 * L * s, "m²")}`,
          `Boden: ${z(L)} · ${z(b)} ${ist(L * b, "m²")}`,
          `Stoff ${ist(stoff, "m²")}`,
          `Luft: ½ · ${z(b)} · ${z(hz)} · ${z(L)} ${ist(luft, "m³")}`,
        ],
        skizze: skizzePoly(liegendesPrisma([[b / 2, 0], [-b / 2, 0], [0, hz]], L), [
          { von: [-L / 2, 0, b / 2], bis: [L / 2, 0, b / 2], text: `${z(L)} m`, art: "kante" },
          { von: [L / 2, 0, b / 2], bis: [L / 2, 0, -b / 2], text: `${z(b)} m`, art: "kante" },
          { von: [L / 2, 0, 0], bis: [L / 2, hz, 0], text: `${z(hz)} m`, art: "hilfe" },
        ]),
      };
    }
    case "eistuete": {
      const rr = eins(r, [2, 2.5, 3]), h = eins(r, [9, 10, 11, 12]);
      const d = ZUSAMMEN.eistuete.rechne({ r: rr, h });
      return {
        art, titel: "Eistüte",
        text: `Eine Waffeltüte ist ${h} cm hoch und oben ${z(2 * rr)} cm breit. Sie wird randvoll mit Eis gefüllt, oben drauf sitzt eine Halbkugel Eis. Wie viel Eis ist das insgesamt?`,
        gesucht: [gesucht("V", "Eis", "ml", d.V)],
        hinweise: [`r = ${z(2 * rr)} cm : 2 = ${z(rr)} cm`, "Kegel: V = ⅓ · π · r² · h; Halbkugel: V = ⅔ · π · r³", "1 cm³ = 1 ml"],
        loesung: [...d.vZeilen.map(x => `${x.text}: ${x.rechnung}`), `Eis ${ist(d.V, "cm³")} = ${z(d.V)} ml`],
        skizze: skizzeZusammen("eistuete", { r: rr, h }, { r: `${z(rr)} cm`, h: `${h} cm` }),
      };
    }
    case "pool": {
      const d = eins(r, [2.4, 3, 3.6, 4.5]), t = eins(r, [0.6, 0.75, 0.9, 1.05]), q = eins(r, [12, 15, 20, 25]);
      const liter = Math.PI * (d / 2) ** 2 * t * 1000, stunden = liter / q / 60;
      return {
        art, titel: "Pool füllen",
        text: `Ein runder Aufstellpool hat ${z(d)} m Durchmesser. Er wird ${z(t)} m hoch mit Wasser gefüllt; aus dem Gartenschlauch kommen ${q} Liter pro Minute. Wie viel Wasser braucht man, und wie lange dauert das Füllen?`,
        gesucht: [gesucht("l", "Wasser", "l", liter), gesucht("t", "Zeit", "h", stunden, Math.max(0.05, stunden * 0.02), 1)],
        hinweise: ["V = π · r² · h", "1 m³ = 1000 l", "Minuten : 60 = Stunden"],
        loesung: [
          `V = π · ${z(d / 2)}² · ${z(t)} ${ist(liter / 1000, "m³")} = ${z(liter)} l`,
          `${z(liter)} l : ${q} l/min ${ist(liter / q, "min")}`,
          `${z(liter / q)} min : 60 ≈ ${z(stunden, 1)} h`,
        ],
        skizze: skizzeKoerper("zylinder", { r: d / 2, h: t * 2.5 }, { d: `d = ${z(d)} m`, h: `${z(t)} m` }),
      };
    }
    case "schwimmbecken": {
      const L = eins(r, [25, 50]), B = eins(r, [10, 12.5, 15, 21]), T = eins(r, [1.8, 2, 2.2]);
      const fliesen = L * B + 2 * L * T + 2 * B * T;
      return {
        art, titel: "Schwimmbecken fliesen",
        text: `Ein Schwimmbecken ist ${L} m lang, ${z(B)} m breit und ${z(T)} m tief. Boden und Wände werden gefliest. Wie viele Quadratmeter Fliesen braucht man? Wie viel Wasser passt randvoll hinein?`,
        gesucht: [gesucht("A", "Fliesen", "m²", fliesen), gesucht("V", "Wasser", "m³", L * B * T)],
        hinweise: ["Gefliest wird alles außer der offenen Oberseite: Boden + 2 lange + 2 kurze Wände.", "V = a · b · c"],
        loesung: [
          `Boden: ${L} · ${z(B)} ${ist(L * B, "m²")}`,
          `lange Wände: 2 · ${L} · ${z(T)} ${ist(2 * L * T, "m²")}`,
          `kurze Wände: 2 · ${z(B)} · ${z(T)} ${ist(2 * B * T, "m²")}`,
          `Fliesen ${ist(fliesen, "m²")}`,
          `V = ${L} · ${z(B)} · ${z(T)} ${ist(L * B * T, "m³")}`,
        ],
        skizze: skizzeKoerper("quader", { a: L, b: B, c: T * 3 }, { a: `${L} m`, b: `${z(B)} m`, c: `${z(T)} m` }),
      };
    }
    case "paket": {
      const a = eins(r, [30, 35, 40, 50, 60]), b = eins(r, [20, 25, 30]), c = eins(r, [10, 15, 20, 25]);
      const O = 2 * (a * b + a * c + b * c), papier = O * 1.1 / 100, kordel = 2 * a + 2 * b + 4 * c + 25;
      return {
        art, titel: "Paket packen",
        text: `Ein Paket ist ${a} cm lang, ${b} cm breit und ${c} cm hoch. Für das Geschenkpapier rechnet man 10 % Zugabe zum Überlappen. Die Kordel läuft einmal längs und einmal quer herum, dazu 25 cm für die Schleife. Wie viel Papier (in dm²) und wie viel Kordel braucht man?`,
        gesucht: [gesucht("p", "Papier", "dm²", papier), gesucht("k", "Kordel", "cm", kordel)],
        hinweise: ["O = 2 · (a · b + a · c + b · c); dann mal 1,1", "100 cm² = 1 dm²", "Längs herum: 2 · a + 2 · c, quer herum: 2 · b + 2 · c"],
        loesung: [
          `O = 2 · (${a * b} + ${a * c} + ${b * c}) = ${z(O)} cm²`,
          `mit Zugabe: ${z(O)} · 1,1 = ${z(O * 1.1)} cm² = ${z(papier)} dm²`,
          `Kordel: 2 · ${a} + 2 · ${b} + 4 · ${c} + 25 = ${kordel} cm`,
        ],
        skizze: skizzeKoerper("quader", { a, b, c }, { a: `${a} cm`, b: `${b} cm`, c: `${c} cm` }),
      };
    }
    case "kerze": {
      const kegel = r() < 0.5;
      const a = eins(r, [6, 8, 10]), h = eins(r, [9, 12, 15]);
      const V = kegel ? Math.PI * (a / 2) ** 2 * h / 3 : a * a * h / 3, g = V * 0.9;
      return {
        art, titel: "Kerze gießen",
        text: kegel
          ? `Eine Kerze hat die Form eines Kegels: unten ${a} cm Durchmesser, ${h} cm hoch. Wachs wiegt 0,9 g pro cm³. Wie schwer ist die Kerze?`
          : `Eine Kerze hat die Form einer quadratischen Pyramide: Grundkante ${a} cm, Höhe ${h} cm. Wachs wiegt 0,9 g pro cm³. Wie schwer ist die Kerze?`,
        gesucht: [gesucht("m", "Masse", "g", g)],
        hinweise: [kegel ? "V = ⅓ · π · r² · h" : "V = ⅓ · a² · h", "Masse = Volumen · 0,9 g/cm³"],
        loesung: [
          kegel ? `V = ⅓ · π · ${z(a / 2)}² · ${h} ${ist(V, "cm³")}` : `V = ⅓ · ${a}² · ${h} ${ist(V, "cm³")}`,
          `m = ${z(V)} · 0,9 ${ist(g, "g")}`,
        ],
        skizze: kegel
          ? skizzeKoerper("kegel", { r: a / 2, h }, { r: `${z(a / 2)} cm`, h: `${h} cm` })
          : skizzeKoerper("pyramide4", { a, h }, { a: `${a} cm`, h: `${h} cm` }),
      };
    }
  }
}

/* ─────────────────────────────────────────────────────── Spiel ── */

export type Gefaess = { key: KoerperKey; m: Masse; V: number; skizze: Skizze };
const SPIEL_KOERPER: KoerperKey[] = ["wuerfel", "quader", "zylinder", "kegel", "kugel", "pyramide4", "prisma3", "halbkugel", "prisma6"];
/** Wie weit die Volumen höchstens auseinanderliegen — je höher die Stufe, desto knapper. */
const FENSTER: [number, number][] = [[1.3, 2.5], [1.15, 1.5], [1.07, 1.3], [1.03, 1.15]];

export function gefaess(key: KoerperKey, r: Zufall): Gefaess {
  const m = zufallsMasse(key, r);
  return { key, m, V: KOERPER[key].rechne(m).V.wert, skizze: skizzeKoerper(key, m, gegeben(key, m).texte) };
}

/** Zwei verschiedene Körper, deren Volumen im Fenster der Stufe auseinanderliegen. */
export function fassPaar(stufe: number, r: Zufall = Math.random): [Gefaess, Gefaess] {
  const [lo, hi] = FENSTER[Math.min(stufe, FENSTER.length - 1)];
  for (let i = 0; i < 400; i++) {
    const a = gefaess(eins(r, SPIEL_KOERPER), r);
    const b = gefaess(eins(r, SPIEL_KOERPER.filter(k => k !== a.key)), r);
    const q = Math.max(a.V, b.V) / Math.min(a.V, b.V);
    if (q >= lo && q <= hi) return r() < 0.5 ? [a, b] : [b, a];
  }
  // Kommt praktisch nie vor: Würfel mit 2 cm gegen Würfel mit 3 cm.
  return [gefaess("wuerfel", () => 0), gefaess("wuerfel", () => 0.15)];
}
