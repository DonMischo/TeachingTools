/**
 * Gewürfelte Aufgaben zu den Vierecken: Übungen (Umfang, Fläche, rückwärts,
 * erkennen, Einheiten, zusammengesetzt) und Sachaufgaben (Garten, Fliesen,
 * Wand, Drachen, Dach, Grundstück, Rasen, Sportplatz). Reine Rechnung; die
 * Skizzen sind Daten (lib/geometrie/skizze.ts).
 */
import { z } from "@/lib/prozent";
import { auswahl, eins, ganz, gesucht, type Art, type Sachaufgabe, type Zufall } from "@/lib/geometrie/aufgabe";
import { P, ecken, rechteck, seiten, type Pt, type Skizze, type Strecke, type Winkel } from "@/lib/geometrie/skizze";
import { SHAPES, type ShapeKey } from "@/lib/vierecke";

export type UebungsArt = "umfang" | "flaeche" | "rueckwaerts" | "erkennen" | "einheiten" | "zusammengesetzt";
export const UEBUNG_ARTEN: Art<UebungsArt>[] = [
  { id: "umfang", icon: "🚧", label: "Umfang" },
  { id: "flaeche", icon: "🧱", label: "Fläche" },
  { id: "rueckwaerts", icon: "↩️", label: "Rückwärts" },
  { id: "erkennen", icon: "🔎", label: "Erkennen" },
  { id: "einheiten", icon: "📏", label: "Einheiten" },
  { id: "zusammengesetzt", icon: "🧩", label: "Zusammengesetzt" },
];

export type AnwendungsArt = "garten" | "fliesen" | "wand" | "drachen" | "dach" | "grundstueck" | "rasen" | "sportplatz";
export const ANWENDUNG_ARTEN: Art<AnwendungsArt>[] = [
  { id: "garten", icon: "🥕", label: "Garten einzäunen" },
  { id: "fliesen", icon: "🛁", label: "Bad fliesen" },
  { id: "wand", icon: "🖌️", label: "Wand streichen" },
  { id: "drachen", icon: "🪁", label: "Drachen bauen" },
  { id: "dach", icon: "🏠", label: "Dach decken" },
  { id: "grundstueck", icon: "🏡", label: "Grundstückspreis" },
  { id: "rasen", icon: "🌱", label: "Rasen säen" },
  { id: "sportplatz", icon: "🏃", label: "Sportplatz" },
];

const NAMEN: Record<ShapeKey, string> = {
  quadrat: "Quadrat", rechteck: "Rechteck", parallelogramm: "Parallelogramm", trapez: "Trapez", raute: "Raute", drachen: "Drachen",
};
export const FORMEN: ShapeKey[] = ["quadrat", "rechteck", "parallelogramm", "trapez", "raute", "drachen"];
const FORM_NAMEN = FORMEN.map(f => NAMEN[f]);

/* ───────────────────────────────────────────────────────── Zeichnungen ── */

/** Maße eines Vierecks, aus denen sich der Umriss ergibt. */
export type Masse = { a?: number; b?: number; c?: number; h?: number; e?: number; f?: number; m?: number };

/**
 * Umriss ABCD (A unten links bzw. links) plus Hilfslinien. `texte` legt fest,
 * welche Maße beschriftet werden; die Höhe erscheint nur, wenn sie beschriftet ist (Schlüssel a, b, c, d, h, e, f, s, t).
 */
export function zeichneViereck(form: ShapeKey, m: Masse, texte: Partial<Record<string, string>> = {}): Skizze {
  let pts: Pt[] = [];
  const hilfe: Strecke[] = [];
  const winkel: Winkel[] = [];
  const t = (k: string) => texte[k];
  const art = (k: string): Strecke["art"] => (texte[k]?.includes("?") ? "gesucht" : "hilfe");
  switch (form) {
    case "quadrat":
    case "rechteck": {
      const a = m.a!, b = form === "quadrat" ? a : m.b!;
      pts = [P(0, b), P(a, b), P(a, 0), P(0, 0)];
      winkel.push({ p: pts[0], von: pts[1], bis: pts[3], recht: true });
      return { flaechen: [{ pts }], strecken: seiten(pts, [t("a"), t("b")]), winkel, marken: ecken(pts) };
    }
    case "parallelogramm": {
      const a = m.a!, h = m.h!, b = Math.max(m.b!, h), dx = Math.sqrt(b * b - h * h);
      pts = [P(0, h), P(a, h), P(a + dx, 0), P(dx, 0)];
      if (t("h")) {
        hilfe.push({ a: pts[3], b: P(dx, h), text: t("h"), art: art("h") });
        winkel.push({ p: P(dx, h), von: pts[3], bis: pts[1], recht: true });
      }
      return { flaechen: [{ pts }], strecken: [...seiten(pts, [t("a"), t("b")]), ...hilfe], winkel, marken: ecken(pts) };
    }
    case "trapez": {
      const a = m.a!, c = m.c!, h = m.h!, off = (a - c) / 2;
      pts = [P(0, h), P(a, h), P(off + c, 0), P(off, 0)];
      if (t("h")) {
        hilfe.push({ a: pts[3], b: P(off, h), text: t("h"), art: art("h") });
        winkel.push({ p: P(off, h), von: pts[3], bis: pts[1], recht: true });
      }
      return { flaechen: [{ pts }], strecken: [...seiten(pts, [t("a"), t("d"), t("c"), t("d") ? "d" : undefined]), ...hilfe], winkel, marken: ecken(pts) };
    }
    case "raute":
    case "drachen": {
      const e = m.e!, f = m.f!, mm = form === "raute" ? f / 2 : Math.min(m.m!, f - 0.5);
      // A links, B unten, C rechts, D oben
      pts = [P(0, mm), P(e / 2, f), P(e, mm), P(e / 2, 0)];
      hilfe.push({ a: pts[0], b: pts[2], text: t("e"), art: art("e") }, { a: pts[3], b: pts[1], text: t("f"), art: art("f") });
      winkel.push({ p: P(e / 2, mm), von: pts[2], bis: pts[1], recht: true });
      const st = form === "raute" ? [undefined, undefined, undefined, t("a")] : [t("t"), undefined, undefined, t("s")];
      return { flaechen: [{ pts }], strecken: [...seiten(pts, st), ...hilfe], winkel, marken: ecken(pts) };
    }
  }
}

/** Dreht eine Skizze um `grad` um ihren Mittelpunkt — fürs Erkennen in Schräglage. */
export function drehe(s: Skizze, grad: number): Skizze {
  const w = grad * Math.PI / 180, c = Math.cos(w), sn = Math.sin(w);
  const r = (p: Pt) => P(p.x * c - p.y * sn, p.x * sn + p.y * c);
  return {
    ...s,
    flaechen: s.flaechen?.map(f => ({ ...f, pts: f.pts.map(r) })),
    strecken: s.strecken?.map(x => ({ ...x, a: r(x.a), b: r(x.b) })),
    winkel: s.winkel?.map(x => ({ ...x, p: r(x.p), von: r(x.von), bis: r(x.bis) })),
    marken: s.marken?.map(x => ({ ...x, p: r(x.p) })),
  };
}

/* ─────────────────────────────────────────────────────────── Übungen ── */

const mit = (x: number, e: string) => `${z(x)} ${e}`;

/** Zufällige, zeichenbare Maße je Form, alle ganzzahlig. */
function masseFuer(form: ShapeKey, r: Zufall) {
  switch (form) {
    case "quadrat": return { a: ganz(r, 2, 15) };
    case "rechteck": { const a = ganz(r, 4, 16); return { a, b: ganz(r, 2, a - 1) }; }
    case "parallelogramm": { const h = ganz(r, 2, 8); return { a: ganz(r, 5, 14), h, b: h + ganz(r, 1, 3) }; }
    case "trapez": { const a = ganz(r, 6, 15), c = ganz(r, 2, a - 2); return { a, c, h: ganz(r, 2, 9) }; }
    case "raute": return { e: ganz(r, 4, 14), f: ganz(r, 3, 12) };
    case "drachen": { const f = ganz(r, 6, 14); return { e: ganz(r, 4, 12), f, m: ganz(r, 2, Math.floor(f / 2)) }; }
  }
}

function umfangAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const form = eins(r, FORMEN), e = eins(r, ["cm", "m", "mm", "dm"]);
  const L = (x: number) => mit(x, e);
  const s = SHAPES[form];
  const fertig = (texte: Record<string, string>, masse: Masse, u: number, rechnung: string, text: string) => ({
    art: "umfang" as const, titel: `Umfang: ${NAMEN[form]}`, text,
    gesucht: [gesucht("u", "Umfang u", e, u)],
    hinweise: [`Der Umfang ist einmal ganz außen herum: alle vier Seiten zusammen.`, `Formel für das ${NAMEN[form]}: ${s.formulaU}`],
    loesung: [s.formulaU, rechnung],
    skizze: { ...zeichneViereck(form, masse, texte), nichtMassstaeblich: true },
  });
  switch (form) {
    case "quadrat": { const { a } = masseFuer(form, r) as { a: number }; return fertig({ a: `a = ${L(a)}` }, { a }, 4 * a, `u = 4 · ${z(a)} ${e} = ${L(4 * a)}`, `Ein Quadrat hat die Seitenlänge a = ${L(a)}. Berechne den Umfang.`); }
    case "rechteck": { const { a, b } = masseFuer(form, r) as { a: number; b: number }; return fertig({ a: `a = ${L(a)}`, b: `b = ${L(b)}` }, { a, b }, 2 * (a + b), `u = 2 · (${z(a)} + ${z(b)}) ${e} = 2 · ${L(a + b)} = ${L(2 * (a + b))}`, `Ein Rechteck ist a = ${L(a)} lang und b = ${L(b)} breit. Berechne den Umfang.`); }
    case "parallelogramm": {
      const { a, b, h } = masseFuer(form, r) as { a: number; b: number; h: number };
      return fertig({ a: `a = ${L(a)}`, b: `b = ${L(b)}`, h: `h = ${L(h)}` }, { a, b, h }, 2 * (a + b),
        `u = 2 · (${z(a)} + ${z(b)}) ${e} = ${L(2 * (a + b))} — die Höhe h braucht man dafür nicht`,
        `Ein Parallelogramm hat die Seiten a = ${L(a)} und b = ${L(b)} und die Höhe h = ${L(h)}. Berechne den Umfang.`);
    }
    case "trapez": {
      const a = ganz(r, 6, 15), c = ganz(r, 2, a - 2), off = (a - c) / 2, d = Math.ceil(off) + ganz(r, 1, 4), h = Math.sqrt(d * d - off * off);
      return fertig({ a: `a = ${L(a)}`, c: `c = ${L(c)}`, d: `d = ${L(d)}` }, { a, c, h }, a + c + 2 * d,
        `u = ${z(a)} + ${z(c)} + 2 · ${z(d)} = ${L(a + c + 2 * d)}`,
        `Ein gleichschenkliges Trapez hat die parallelen Seiten a = ${L(a)} und c = ${L(c)}. Die beiden Schenkel sind je d = ${L(d)} lang. Berechne den Umfang.`);
    }
    case "raute": {
      const a = ganz(r, 3, 14);
      return fertig({ a: `a = ${L(a)}` }, { e: 1.6 * a, f: 1.2 * a }, 4 * a, `u = 4 · ${z(a)} ${e} = ${L(4 * a)}`,
        `Eine Raute hat die Seitenlänge a = ${L(a)}. Berechne den Umfang.`);
    }
    case "drachen": {
      const s1 = ganz(r, 3, 7), t = s1 + ganz(r, 2, 6), x = 0.6 * s1, mm = Math.sqrt(s1 * s1 - x * x), f = mm + Math.sqrt(t * t - x * x);
      return fertig({ s: `s = ${L(s1)}`, t: `t = ${L(t)}` }, { e: 2 * x, f, m: mm }, 2 * (s1 + t),
        `u = 2 · (${z(s1)} + ${z(t)}) ${e} = ${L(2 * (s1 + t))}`,
        `Ein Drachenviereck hat zwei kurze Seiten s = ${L(s1)} und zwei lange Seiten t = ${L(t)}. Berechne den Umfang.`);
    }
  }
}

function flaechenAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const form = eins(r, FORMEN), e = eins(r, ["cm", "m", "mm", "dm"]);
  const L = (x: number) => mit(x, e), Q = (x: number) => mit(x, e + "²");
  const m = masseFuer(form, r) as Masse;
  const s = SHAPES[form];
  const A = s.area(m as Record<string, number>);
  const texte: Record<string, string> = {};
  let text = "", rechnung = "";
  switch (form) {
    case "quadrat": texte.a = `a = ${L(m.a!)}`; text = `Ein Quadrat hat die Seitenlänge ${L(m.a!)}.`; rechnung = `A = ${z(m.a!)} · ${z(m.a!)} = ${Q(A)}`; break;
    case "rechteck": texte.a = `a = ${L(m.a!)}`; texte.b = `b = ${L(m.b!)}`; text = `Ein Rechteck ist ${L(m.a!)} lang und ${L(m.b!)} breit.`; rechnung = `A = ${z(m.a!)} · ${z(m.b!)} = ${Q(A)}`; break;
    case "parallelogramm": texte.a = `a = ${L(m.a!)}`; texte.b = `b = ${L(m.b!)}`; texte.h = `h = ${L(m.h!)}`;
      text = `Ein Parallelogramm hat die Seiten a = ${L(m.a!)} und b = ${L(m.b!)}. Die Höhe auf a ist h = ${L(m.h!)}.`;
      rechnung = `A = a · h = ${z(m.a!)} · ${z(m.h!)} = ${Q(A)} — die schräge Seite b ist nicht die Höhe!`; break;
    case "trapez": texte.a = `a = ${L(m.a!)}`; texte.c = `c = ${L(m.c!)}`; texte.h = `h = ${L(m.h!)}`;
      text = `Ein Trapez hat die parallelen Seiten a = ${L(m.a!)} und c = ${L(m.c!)} und die Höhe h = ${L(m.h!)}.`;
      rechnung = `A = (${z(m.a!)} + ${z(m.c!)}) : 2 · ${z(m.h!)} = ${z((m.a! + m.c!) / 2)} · ${z(m.h!)} = ${Q(A)}`; break;
    case "raute":
    case "drachen": texte.e = `e = ${L(m.e!)}`; texte.f = `f = ${L(m.f!)}`;
      text = `${form === "raute" ? "Eine Raute" : "Ein Drachenviereck"} hat die Diagonalen e = ${L(m.e!)} und f = ${L(m.f!)}.`;
      rechnung = `A = (${z(m.e!)} · ${z(m.f!)}) : 2 = ${z(m.e! * m.f!)} : 2 = ${Q(A)}`; break;
  }
  return {
    art: "flaeche", titel: `Fläche: ${NAMEN[form]}`, text: text + " Berechne den Flächeninhalt.",
    gesucht: [gesucht("A", "Flächeninhalt A", e + "²", A)],
    hinweise: [`Formel für das ${NAMEN[form]}: ${s.formulaA}`, form === "parallelogramm" || form === "trapez"
      ? "Die Höhe steht senkrecht — in der Skizze gestrichelt."
      : form === "raute" || form === "drachen" ? "Die Diagonalen bilden zusammen ein Rechteck, das doppelt so groß ist." : "Länge mal Breite."],
    loesung: [s.formulaA, rechnung],
    skizze: { ...zeichneViereck(form, m, texte), nichtMassstaeblich: true },
  };
}

function rueckwaertsAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, ["cm", "m"]), L = (x: number) => mit(x, e), Q = (x: number) => mit(x, e + "²");
  const fall = ganz(r, 0, 5);
  const ab = (titel: string, text: string, key: string, label: string, einheit: string, wert: number, hinweise: string[], loesung: string[], s: Skizze) =>
    ({ art: "rueckwaerts" as const, titel, text, gesucht: [gesucht(key, label, einheit, wert)], hinweise, loesung, skizze: { ...s, nichtMassstaeblich: true } });
  switch (fall) {
    case 0: { const a = ganz(r, 2, 15), u = 4 * a;
      return ab("Quadrat rückwärts", `Ein Quadrat hat den Umfang ${L(u)}. Wie lang ist eine Seite?`, "a", "Seite a", e, a,
        ["u = 4 · a — also ist a der vierte Teil von u."], [`u = 4 · a  ⇒  a = u : 4`, `a = ${z(u)} : 4 = ${L(a)}`], zeichneViereck("quadrat", { a }, { a: "a = ?" })); }
    case 1: { const a = ganz(r, 4, 16), b = ganz(r, 2, a - 1), A = a * b;
      return ab("Rechteck rückwärts", `Ein Rechteck hat den Flächeninhalt ${Q(A)} und ist ${L(a)} lang. Wie breit ist es?`, "b", "Breite b", e, b,
        ["A = a · b — welche Zahl mal a ergibt A?", "Teile den Flächeninhalt durch die Länge."], [`A = a · b  ⇒  b = A : a`, `b = ${z(A)} : ${z(a)} = ${L(b)}`], zeichneViereck("rechteck", { a, b }, { a: `a = ${L(a)}`, b: "b = ?" })); }
    case 2: { const a = ganz(r, 4, 16), b = ganz(r, 2, a - 1), u = 2 * (a + b);
      return ab("Rechteck rückwärts", `Ein Rechteck hat den Umfang ${L(u)}. Die Seite a ist ${L(a)} lang. Wie lang ist b?`, "b", "Seite b", e, b,
        ["Die Hälfte des Umfangs ist a + b.", `u : 2 = ${z(u / 2)} — davon a abziehen.`], [`u : 2 = a + b = ${L(u / 2)}`, `b = ${z(u / 2)} − ${z(a)} = ${L(b)}`], zeichneViereck("rechteck", { a, b }, { a: `a = ${L(a)}`, b: "b = ?" })); }
    case 3: { const a = ganz(r, 5, 14), h = ganz(r, 2, 8), b = h + ganz(r, 1, 3), A = a * h;
      return ab("Parallelogramm rückwärts", `Ein Parallelogramm hat den Flächeninhalt ${Q(A)}, die Seite a ist ${L(a)} lang. Wie groß ist die Höhe h auf a?`, "h", "Höhe h", e, h,
        ["A = a · h", "Teile A durch a."], [`A = a · h  ⇒  h = A : a`, `h = ${z(A)} : ${z(a)} = ${L(h)}`], zeichneViereck("parallelogramm", { a, b, h }, { a: `a = ${L(a)}`, h: "h = ?" })); }
    case 4: { const a = ganz(r, 6, 15), c = ganz(r, 2, a - 2), h = ganz(r, 2, 9), A = (a + c) / 2 * h;
      return ab("Trapez rückwärts", `Ein Trapez hat den Flächeninhalt ${Q(A)} und die parallelen Seiten a = ${L(a)} und c = ${L(c)}. Wie hoch ist es?`, "h", "Höhe h", e, h,
        ["Rechne zuerst die Mittellinie m = (a + c) : 2 aus.", "A = m · h, also h = A : m."], [`m = (${z(a)} + ${z(c)}) : 2 = ${L((a + c) / 2)}`, `h = ${z(A)} : ${z((a + c) / 2)} = ${L(h)}`],
        zeichneViereck("trapez", { a, c, h }, { a: `a = ${L(a)}`, c: `c = ${L(c)}`, h: "h = ?" })); }
    default: { const ee = ganz(r, 4, 14), f = ganz(r, 3, 12), A = ee * f / 2;
      return ab("Raute rückwärts", `Eine Raute hat den Flächeninhalt ${Q(A)}, die Diagonale e ist ${L(ee)} lang. Wie lang ist f?`, "f", "Diagonale f", e, f,
        ["A = (e · f) : 2 — verdopple zuerst A.", "Dann durch e teilen."], [`2 · A = e · f = ${Q(2 * A)}`, `f = ${z(2 * A)} : ${z(ee)} = ${L(f)}`],
        zeichneViereck("raute", { e: ee, f }, { e: `e = ${L(ee)}`, f: "f = ?" })); }
  }
}

/** Steckbriefe: welches Viereck ist gemeint? Jeder passt genau auf eine Form. */
export const STECKBRIEFE: [string, ShapeKey][] = [
  ["Alle vier Seiten sind gleich lang, aber es gibt keinen rechten Winkel.", "raute"],
  ["Alle vier Seiten sind gleich lang und alle Winkel sind rechte Winkel.", "quadrat"],
  ["Gegenüberliegende Seiten sind gleich lang, alle Winkel sind 90°, aber nicht alle Seiten sind gleich lang.", "rechteck"],
  ["Genau ein Paar Seiten ist parallel.", "trapez"],
  ["Zwei Paare benachbarter Seiten sind gleich lang, aber nicht alle vier Seiten.", "drachen"],
  ["Gegenüberliegende Seiten sind parallel und gleich lang, es gibt keinen rechten Winkel und nicht alle Seiten sind gleich lang.", "parallelogramm"],
  ["Die Diagonalen sind gleich lang, halbieren sich und stehen senkrecht aufeinander.", "quadrat"],
  ["Die Diagonalen halbieren sich, stehen aber nicht senkrecht aufeinander und sind verschieden lang.", "parallelogramm"],
  ["Genau eine Diagonale ist Symmetrieachse.", "drachen"],
  ["Es hat genau zwei Symmetrieachsen, und die gehen durch die Seitenmitten.", "rechteck"],
  ["Es hat genau zwei Symmetrieachsen, und das sind die Diagonalen.", "raute"],
  ["Es hat vier Symmetrieachsen.", "quadrat"],
];

function erkennenAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  if (r() < 0.5) {
    const [text, form] = eins(r, STECKBRIEFE);
    return {
      art: "erkennen", titel: "Steckbrief", text: `Welches Viereck ist gemeint? ${text}`,
      gesucht: [auswahl("form", "Viereck", FORM_NAMEN, NAMEN[form])],
      hinweise: ["Schau im Blatt »Formen« bei den Eigenschaften nach.", "Denk an das Haus der Vierecke: Quadrat ⊂ Rechteck, Quadrat ⊂ Raute ⊂ Parallelogramm ⊂ Trapez."],
      loesung: [`Das ist das ${NAMEN[form]}: ${SHAPES[form].properties[0]}`],
    };
  }
  const form = eins(r, FORMEN);
  const s = drehe(zeichneViereck(form, masseFuer(form, r) as Masse), ganz(r, -50, 50));
  return {
    art: "erkennen", titel: "Welches Viereck ist das?", text: "Das Viereck liegt schräg. Achte auf rechte Winkel, gleich lange Seiten und Parallelen.",
    gesucht: [auswahl("form", "Viereck", FORM_NAMEN, NAMEN[form])],
    hinweise: ["Sind Seiten parallel? Dreh den Kopf mit.", "Rechte Winkel sind markiert."],
    loesung: [`Das ist das ${NAMEN[form]}.`, ...SHAPES[form].properties.slice(0, 2)],
    skizze: { ...s, marken: [] },
  };
}

const FLAECHEN_EINHEITEN = ["mm²", "cm²", "dm²", "m²", "a", "ha", "km²"];

function einheitenAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  // Nachbarn unterscheiden sich um den Faktor 100.
  const i = ganz(r, 0, FLAECHEN_EINHEITEN.length - 2), schritte = r() < 0.7 ? 1 : 2;
  const klein = i, gross = Math.min(i + schritte, FLAECHEN_EINHEITEN.length - 1), faktor = 100 ** (gross - klein);
  const runter = r() < 0.5;
  const wert = eins(r, [ganz(r, 2, 90), ganz(r, 2, 90) / 10, ganz(r, 101, 999) / 100, ganz(r, 2, 9) * 100]);
  const von = runter ? FLAECHEN_EINHEITEN[gross] : FLAECHEN_EINHEITEN[klein], nach = runter ? FLAECHEN_EINHEITEN[klein] : FLAECHEN_EINHEITEN[gross];
  const ergebnis = runter ? wert * faktor : wert / faktor;
  return {
    art: "einheiten", titel: "Flächeneinheiten umrechnen", text: `Rechne ${z(wert, 4)} ${von} in ${nach} um.`,
    gesucht: [{ ...gesucht("x", `${z(wert, 4)} ${von} =`, nach, ergebnis, Math.abs(ergebnis) * 1e-6), nk: 6 }],
    hinweise: ["Bei Flächeneinheiten ist die Umrechnungszahl 100 (nicht 10!): 1 cm² = 10 mm · 10 mm = 100 mm².",
      `Von ${von} nach ${nach} sind es ${gross - klein} Stufe(n): ${runter ? "mal" : "geteilt durch"} ${z(faktor)}.`],
    loesung: [`${FLAECHEN_EINHEITEN.slice(klein, gross + 1).join(" → ")}: Faktor ${z(faktor)}`, `${z(wert, 4)} ${von} ${runter ? "·" : ":"} ${z(faktor)} = ${z(ergebnis, 6)} ${nach}`],
  };
}

/** L-förmige Fläche: großes Rechteck W × H, oben rechts fehlt w × h. */
export function lForm(W: number, H: number, w: number, h: number): Pt[] {
  return [P(0, 0), P(W - w, 0), P(W - w, h), P(W, h), P(W, H), P(0, H)];
}

function zusammengesetztAufgabe(r: Zufall): Sachaufgabe<UebungsArt> {
  const e = eins(r, ["cm", "m"]), L = (x: number) => mit(x, e), Q = (x: number) => mit(x, e + "²");
  if (r() < 0.6) {
    const W = ganz(r, 6, 14), H = ganz(r, 5, 10), w = ganz(r, 2, W - 3), h = ganz(r, 2, H - 2);
    const pts = lForm(W, H, w, h), A = W * H - w * h, u = 2 * (W + H);
    return {
      art: "zusammengesetzt", titel: "L-förmige Fläche", text: "Berechne Flächeninhalt und Umfang der Figur.",
      gesucht: [gesucht("A", "Flächeninhalt A", e + "²", A), gesucht("u", "Umfang u", e, u)],
      hinweise: ["Zerlege die Figur in zwei Rechtecke — oder rechne das große Rechteck und zieh die fehlende Ecke ab.",
        "Fehlende Seiten: Was oben fehlt, ergibt sich aus der unteren Seite minus der oberen.",
        "Beim Umfang: Die Stufe verschiebt nur Seiten — er ist so groß wie beim ganzen Rechteck."],
      loesung: [`Ganzes Rechteck: ${z(W)} · ${z(H)} = ${Q(W * H)}; fehlende Ecke: ${z(w)} · ${z(h)} = ${Q(w * h)}`,
        `A = ${z(W * H)} − ${z(w * h)} = ${Q(A)}`, `u = ${z(W - w)} + ${z(h)} + ${z(w)} + ${z(H - h)} + ${z(W)} + ${z(H)} = ${L(u)}`],
      skizze: { flaechen: [{ pts }], strecken: seiten(pts, [L(W - w), L(h), L(w), L(H - h), L(W), L(H)]), raster: e === "cm" && W <= 12, nichtMassstaeblich: e !== "cm" },
    };
  }
  const W = ganz(r, 7, 14), H = ganz(r, 5, 10), w = ganz(r, 2, W - 3), h = ganz(r, 2, H - 3);
  const x = ganz(r, 1, W - w - 1), y = ganz(r, 1, H - h - 1), A = W * H - w * h;
  return {
    art: "zusammengesetzt", titel: "Rahmen", text: `Aus einer Platte (${L(W)} × ${L(H)}) wird ein Rechteck (${L(w)} × ${L(h)}) ausgeschnitten. Wie groß ist die übrige Fläche?`,
    gesucht: [gesucht("A", "Restfläche A", e + "²", A)],
    hinweise: ["Fläche der ganzen Platte minus Fläche des Lochs."],
    loesung: [`Platte: ${z(W)} · ${z(H)} = ${Q(W * H)}`, `Loch: ${z(w)} · ${z(h)} = ${Q(w * h)}`, `A = ${z(W * H)} − ${z(w * h)} = ${Q(A)}`],
    skizze: {
      flaechen: [{ pts: rechteck(0, 0, W, H) }, { pts: rechteck(x, y, w, h), ausgespart: true }],
      strecken: [...seiten(rechteck(0, 0, W, H), [L(W), L(H)]), { a: P(x, y + h), b: P(x + w, y + h), text: L(w), art: "unsichtbar" }, { a: P(x + w, y), b: P(x + w, y + h), text: L(h), art: "unsichtbar" }],
      nichtMassstaeblich: true,
    },
  };
}

export function erzeugeUebung(art: UebungsArt, r: Zufall = Math.random): Sachaufgabe<UebungsArt> {
  switch (art) {
    case "umfang": return umfangAufgabe(r);
    case "flaeche": return flaechenAufgabe(r);
    case "rueckwaerts": return rueckwaertsAufgabe(r);
    case "erkennen": return erkennenAufgabe(r);
    case "einheiten": return einheitenAufgabe(r);
    case "zusammengesetzt": return zusammengesetztAufgabe(r);
  }
}

/* ───────────────────────────────────────────────────────── Sachaufgaben ── */

const NAMEN_KINDER = ["Mia", "Ben", "Lea", "Emil", "Noah", "Ida", "Paul", "Mila", "Finn", "Ella"];
const GRUEN = "#16a34a", GRAU = "#64748b";

export function erzeugeAnwendung(art: AnwendungsArt, r: Zufall = Math.random): Sachaufgabe<AnwendungsArt> {
  const wer = eins(r, NAMEN_KINDER);
  switch (art) {
    case "garten": {
      const a = ganz(r, 8, 20), b = ganz(r, 5, Math.min(15, a)), preis = ganz(r, 8, 15), zaun = 2 * (a + b) - 1;
      const pts = rechteck(0, 0, a, b);
      return {
        art, titel: "Gemüsegarten einzäunen",
        text: `${wer}s Familie legt einen rechteckigen Gemüsegarten an, ${a} m lang und ${b} m breit. Er wird ringsum eingezäunt; nur für das Tor bleibt 1 m frei. Ein Meter Zaun kostet ${preis} €. Wie viel Zaun wird gebraucht und was kostet er?`,
        gesucht: [gesucht("zaun", "Zaunlänge", "m", zaun), gesucht("kosten", "Kosten", "€", zaun * preis)],
        hinweise: ["Der Zaun läuft einmal außen herum — das ist der Umfang.", "Das Tor wird abgezogen: Umfang − 1 m.", "Kosten = Zaunlänge · Preis pro Meter."],
        loesung: [`u = 2 · (${a} + ${b}) m = ${2 * (a + b)} m`, `Zaun = ${2 * (a + b)} m − 1 m = ${zaun} m`, `Kosten = ${zaun} · ${preis} € = ${z(zaun * preis)} €`],
        skizze: {
          flaechen: [{ pts, farbe: GRUEN }], strecken: [...seiten(pts, [`${a} m`, `${b} m`]), { a: P(a / 2 - 0.5, 0), b: P(a / 2 + 0.5, 0), text: "Tor 1 m", art: "hilfe" }],
          marken: [{ p: P(a * 0.3, b * 0.5), text: "🥕🥬", groesse: 22 }, { p: P(a * 0.7, b * 0.55), text: "🍅🌽", groesse: 22 }],
        },
      };
    }
    case "fliesen": {
      const a = ganz(r, 4, 9) / 2, b = ganz(r, 4, 7) / 2, k = eins(r, [20, 25, 30, 50]);
      const A = a * b, stueck = Math.ceil(Math.round(a * 100) * Math.round(b * 100) / (k * k) - 1e-9);
      const pts = rechteck(0, 0, a, b);
      return {
        art, titel: "Badezimmer fliesen",
        text: `Der Boden von ${wer}s Bad ist rechteckig: ${z(a)} m × ${z(b)} m. Er wird mit quadratischen Fliesen (${k} cm × ${k} cm) belegt. Wie groß ist der Boden und wie viele Fliesen braucht man mindestens? (Angeschnittene Fliesen zählen ganz.)`,
        gesucht: [gesucht("A", "Bodenfläche", "m²", A), gesucht("n", "Anzahl Fliesen", "Stück", stueck, 0.4, 0)],
        hinweise: ["Fläche des Bodens: Länge · Breite.", `Eine Fliese hat ${k} cm · ${k} cm = ${k * k} cm². Rechne den Boden in cm² um (1 m² = 10 000 cm²).`, "Teile und runde auf — eine angefangene Fliese muss man ganz kaufen."],
        loesung: [`A = ${z(a)} m · ${z(b)} m = ${z(A)} m² = ${z(A * 10000)} cm²`, `Fliese: ${k * k} cm²`, `${z(A * 10000)} : ${k * k} = ${z(A * 10000 / (k * k))} → ${stueck} Fliesen`],
        skizze: { flaechen: [{ pts, farbe: "#0ea5e9" }], strecken: seiten(pts, [`${z(a)} m`, `${z(b)} m`]), marken: [{ p: P(a / 2, b / 2), text: "🛁", groesse: 34 }] },
      };
    }
    case "wand": {
      const b = ganz(r, 8, 14) / 2, h = eins(r, [2.5, 2.75, 3]), fb = eins(r, [1, 1.2, 1.5]), fh = eins(r, [1.2, 1.4, 1.5]), reicht = eins(r, [5, 6, 8, 10]);
      const A = b * h - fb * fh, liter = A / reicht;
      const fx = (b - fb) / 2, fy = 0.8;
      return {
        art, titel: "Wand streichen",
        text: `${wer} streicht eine Wand: ${z(b)} m breit, ${z(h)} m hoch. Darin ist ein Fenster (${z(fb)} m breit, ${z(fh)} m hoch), das nicht gestrichen wird. Ein Liter Farbe reicht für ${reicht} m². Wie groß ist die zu streichende Fläche, und wie viel Farbe braucht ${wer}?`,
        gesucht: [gesucht("A", "Fläche", "m²", A), { ...gesucht("l", "Farbe", "Liter", liter, 0.06), nk: 1 }],
        hinweise: ["Ganze Wand minus Fenster.", `Farbe = Fläche : ${reicht} m² pro Liter.`],
        loesung: [`Wand: ${z(b)} · ${z(h)} = ${z(b * h)} m²`, `Fenster: ${z(fb)} · ${z(fh)} = ${z(fb * fh)} m²`, `A = ${z(b * h)} − ${z(fb * fh)} = ${z(A)} m²`, `Farbe: ${z(A)} : ${reicht} ≈ ${z(liter, 1)} l`],
        skizze: {
          flaechen: [{ pts: rechteck(0, 0, b, h), farbe: "#f472b6" }, { pts: rechteck(fx, fy, fb, fh), ausgespart: true }],
          strecken: [...seiten(rechteck(0, 0, b, h), [undefined, `${z(h)} m`, `${z(b)} m`]),
            { a: P(fx, fy), b: P(fx + fb, fy), text: `${z(fb)} m`, art: "unsichtbar" }, { a: P(fx + fb, fy), b: P(fx + fb, fy + fh), text: `${z(fh)} m`, art: "unsichtbar" }],
          marken: [{ p: P(fx + fb / 2, fy + fh / 2), text: "🪟", groesse: 26 }],
        },
      };
    }
    case "drachen": {
      const e = ganz(r, 8, 14) * 5, f = ganz(r, 12, 20) * 5, m = Math.round(f / 3);
      return {
        art, titel: "Einen Drachen bauen",
        text: `${wer} baut einen Drachen. Die Querleiste ist ${e} cm lang, die Längsleiste ${f} cm. Wie viel Drachenpapier wird mindestens bespannt, und wie viel Holzleiste braucht ${wer} insgesamt?`,
        gesucht: [gesucht("A", "Papier", "cm²", e * f / 2), gesucht("l", "Holzleiste", "cm", e + f)],
        hinweise: ["Die Leisten sind die Diagonalen e und f.", "A = (e · f) : 2", "Holz: beide Leisten zusammen."],
        loesung: [`A = (${e} · ${f}) : 2 = ${z(e * f)} : 2 = ${z(e * f / 2)} cm²`, `Holz = ${e} cm + ${f} cm = ${e + f} cm`],
        skizze: { ...zeichneViereck("drachen", { e, f, m }, { e: `${e} cm`, f: `${f} cm` }), marken: [{ p: P(e / 2, f + 3), text: "〰️", groesse: 22 }] },
      };
    }
    case "dach": {
      const a = ganz(r, 8, 14), c = ganz(r, 3, a - 3), h = ganz(r, 4, 7), proM2 = eins(r, [10, 12, 15]), A = (a + c) / 2 * h, ziegel = Math.ceil(A * proM2 - 1e-9);
      return {
        art, titel: "Walmdach decken",
        text: `Eine Seite eines Walmdachs ist ein Trapez: unten ${a} m, oben (am First) ${c} m, die Höhe der Dachfläche ist ${h} m. Pro m² braucht man ${proM2} Dachziegel. Wie groß ist die Dachfläche, und wie viele Ziegel braucht man für diese Seite?`,
        gesucht: [gesucht("A", "Dachfläche", "m²", A), gesucht("n", "Ziegel", "Stück", ziegel, 1, 0)],
        hinweise: ["Trapez: A = (a + c) : 2 · h", `Ziegel = Fläche · ${proM2}`],
        loesung: [`A = (${a} + ${c}) : 2 · ${h} = ${z((a + c) / 2)} · ${h} = ${z(A)} m²`, `Ziegel = ${z(A)} · ${proM2} = ${z(A * proM2)} → ${ziegel} Stück`],
        skizze: { ...zeichneViereck("trapez", { a, c, h }, { a: `${a} m`, c: `${c} m`, h: `${h} m` }), flaechen: [{ pts: zeichneViereck("trapez", { a, c, h }).flaechen![0].pts, farbe: "#b91c1c" }] },
      };
    }
    case "grundstueck": {
      const a = ganz(r, 20, 40), h = ganz(r, 15, 30), b = h + ganz(r, 3, 8), preis = ganz(r, 12, 38) * 10, A = a * h;
      return {
        art, titel: "Was kostet das Grundstück?",
        text: `Ein Baugrundstück hat die Form eines Parallelogramms: Die Straßenseite ist ${a} m lang, die schräge Seite ${b} m, der Abstand zur gegenüberliegenden Grundstücksgrenze ${h} m. Ein Quadratmeter kostet ${preis} €. Wie groß ist das Grundstück und was kostet es?`,
        gesucht: [gesucht("A", "Fläche", "m²", A), gesucht("p", "Preis", "€", A * preis)],
        hinweise: ["Parallelogramm: A = a · h — der senkrechte Abstand ist die Höhe.", "Die schräge Seite brauchst du nicht.", "Preis = Fläche · Preis pro m²."],
        loesung: [`A = ${a} · ${h} = ${z(A)} m²`, `Preis = ${z(A)} · ${preis} € = ${z(A * preis)} €`],
        skizze: { ...zeichneViereck("parallelogramm", { a, b, h }, { a: `${a} m`, b: `${b} m`, h: `${h} m` }), marken: [{ p: P(a * 0.55, h * 0.5), text: "🏡", groesse: 30 }] },
      };
    }
    case "rasen": {
      const W = ganz(r, 10, 20), H = ganz(r, 8, 14), w = ganz(r, 3, W - 5), h = ganz(r, 3, H - 4), g = eins(r, [25, 30, 40]);
      const pts = lForm(W, H, w, h), A = W * H - w * h;
      return {
        art, titel: "Rasen säen",
        text: `Im Garten soll eine L-förmige Fläche neu eingesät werden (Maße in der Skizze; in der Ecke oben rechts steht die Terrasse). Pro m² rechnet man ${g} g Rasensamen. Wie groß ist die Fläche und wie viel Samen braucht man?`,
        gesucht: [gesucht("A", "Rasenfläche", "m²", A), gesucht("g", "Samen", "g", A * g)],
        hinweise: ["Zerlege in Rechtecke oder rechne ganzes Rechteck minus Terrasse.", `Samen = Fläche · ${g} g.`],
        loesung: [`A = ${W} · ${H} − ${w} · ${h} = ${W * H} − ${w * h} = ${A} m²`, `Samen = ${A} · ${g} g = ${z(A * g)} g = ${z(A * g / 1000, 3)} kg`],
        skizze: {
          flaechen: [{ pts, farbe: GRUEN }, { pts: rechteck(W - w, 0, w, h), farbe: GRAU, deckkraft: 0.25 }],
          strecken: seiten(pts, [`${W - w} m`, `${h} m`, `${w} m`, `${H - h} m`, `${W} m`, `${H} m`]),
          marken: [{ p: P(W - w / 2, h / 2), text: "☕", groesse: 22 }],
        },
      };
    }
    case "sportplatz": {
      const a = ganz(r, 100, 110), b = ganz(r, 64, 75), runden = ganz(r, 3, 6), u = 2 * (a + b);
      const pts = rechteck(0, 0, a, b);
      return {
        art, titel: "Runden um den Sportplatz",
        text: `Das Fußballfeld ist ${a} m lang und ${b} m breit. ${wer} läuft beim Aufwärmen ${runden} Runden genau an der Außenlinie entlang. Wie lang ist eine Runde, und wie viele Kilometer läuft ${wer}?`,
        gesucht: [gesucht("u", "Eine Runde", "m", u), { ...gesucht("km", "Gesamtstrecke", "km", u * runden / 1000, 0.006), nk: 3 }],
        hinweise: ["Eine Runde ist der Umfang des Rechtecks.", "Mal Rundenzahl, dann in km umrechnen (1 km = 1000 m)."],
        loesung: [`u = 2 · (${a} + ${b}) = ${u} m`, `${runden} · ${u} m = ${u * runden} m = ${z(u * runden / 1000, 3)} km`],
        skizze: {
          flaechen: [{ pts, farbe: GRUEN, deckkraft: 0.3 }], strecken: [...seiten(pts, [`${a} m`, `${b} m`]), { a: P(a / 2, 0), b: P(a / 2, b), art: "hilfe" }],
          kreise: [{ m: P(a / 2, b / 2), r: 9.15, farbe: "#ffffff", deckkraft: 0 }],
          marken: [{ p: P(8, b / 2), text: "🏃", groesse: 24 }],
        },
      };
    }
  }
}


/* ───────────────────────────────────────────────────────── Spiel ── */

/** Flächeninhalt eines Vielecks (Gaußsche Trapezformel). */
export function flaecheVieleck(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

/** Ein Viereck mit Ecken auf Gitterpunkten, höchstens 8 × 7 Kästchen groß. */
export function gitterViereck(r: Zufall): { form: ShapeKey; pts: Pt[]; A: number } {
  const form = eins(r, FORMEN);
  let pts: Pt[];
  switch (form) {
    case "quadrat": { const a = ganz(r, 2, 6); pts = rechteck(0, 0, a, a); break; }
    case "rechteck": { const a = ganz(r, 3, 8), b = ganz(r, 2, 6); pts = rechteck(0, 0, a, b === a ? b - 1 : b); break; }
    case "parallelogramm": { const a = ganz(r, 3, 6), h = ganz(r, 2, 6), dx = ganz(r, 1, 2); pts = [P(0, h), P(a, h), P(a + dx, 0), P(dx, 0)]; break; }
    case "trapez": { const a = ganz(r, 5, 8), h = ganz(r, 2, 6), l = ganz(r, 1, 2), c = ganz(r, 1, a - l - 1); pts = [P(0, h), P(a, h), P(l + c, 0), P(l, 0)]; break; }
    case "raute": { const e = 2 * ganz(r, 2, 4), f = 2 * ganz(r, 1, 3); pts = [P(0, f / 2), P(e / 2, f), P(e, f / 2), P(e / 2, 0)]; break; }
    case "drachen": { const e = 2 * ganz(r, 1, 3), f = ganz(r, 4, 7), m = ganz(r, 1, Math.floor((f - 1) / 2)); pts = [P(0, m), P(e / 2, f), P(e, m), P(e / 2, 0)]; break; }
  }
  return { form, pts, A: flaecheVieleck(pts) };
}

/**
 * Zwei Gitter-Vierecke mit verschiedenem Flächeninhalt. Je höher die Stufe,
 * desto näher liegen die Flächen beieinander (Stufe 0: beliebig, ab 3: höchstens
 * 25 % Unterschied).
 */
export function duellPaar(stufe: number, r: Zufall = Math.random) {
  const grenze = stufe >= 3 ? 1.25 : stufe >= 1 ? 1.6 : Infinity;
  for (let i = 0; ; i++) {
    const l = gitterViereck(r), rr = gitterViereck(r);
    const q = Math.max(l.A, rr.A) / Math.min(l.A, rr.A);
    if (l.A !== rr.A && (q <= grenze || i > 200)) return [l, rr] as const;
  }
}
