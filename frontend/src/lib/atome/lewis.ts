/**
 * Das Lewis-Labor: Elementsymbole mit ihren Außenelektronen als Punkte.
 *
 * Schiebt man zwei Symbole zusammen, suchen sich die einzelnen (ungepaarten)
 * Elektronen wie Magnete: sie drehen sich zum Partner, zittern und ziehen,
 * und wenn die Atome nah genug sind, springen je eins von beiden in die Mitte
 * — ein bindendes Elektronenpaar. Freie Paare bleiben, wo sie sind, und
 * weichen den Bindungen nur aus.
 *
 * Hier steht nur die Rechnung (Kräfte, Bindungen, Zählen). Gezeichnet wird in
 * `components/atome/LewisLabor.tsx`. Alles läuft in Bildpunkten und Sekunden.
 */
import { pseElement } from "@/lib/pse/elemente";
import { ATOMFARBE, formelGesetzt, NAMEN, summenformel } from "@/lib/pse/bindung";

/** Die Elemente, die das Labor anbietet — Hauptgruppen, wie im Unterricht. */
export const LABOR_ATOME = ["H", "C", "N", "O", "F", "Cl", "Br", "I", "S", "P", "B", "Si", "He", "Ne"];

/** Abstand eines Elektrons vom Mittelpunkt seines Symbols. */
export const R_EL = 24;
/** Abstand zweier gebundener Symbole. */
export const L_BIND = 66;
/** Ab hier spüren sich zwei einzelne Elektronen. */
export const FANG = 150;
/** Ab hier springen sie zusammen. */
export const BINDE = 80;
/** Weiter auseinandergezogen, reißt die Bindung. */
export const BRUCH = 125;

export type LAtom = {
  id: number; symbol: string; farbe: string;
  /** Außenelektronen des freien Atoms. */
  valenz: number;
  /** 8 — bei H und He 2. */
  ziel: number;
  x: number; y: number; vx: number; vy: number;
  /** Wird gerade mit der Maus gezogen — dann bewegt es nur die Maus. */
  gehalten: boolean;
  /** Elektronegativität nach Pauling. */
  en: number;
};
export type LElektron = { id: number; atom: number; x: number; y: number; vx: number; vy: number };
/** Ein freies Elektron oder ein freies Paar an einem Atom. */
export type LGruppe = { id: number; atom: number; el: number[]; winkel: number };
/** Ein bindendes Paar: je ein Elektron von a und von b. */
export type LBindung = { a: number; b: number; ea: number; eb: number; reife: number };
/** Zwei einzelne Elektronen, die einander anziehen, aber noch nicht gebunden sind. */
export type LZug = { a: number; b: number; ga: number; gb: number; t: number };

/** Eine Kraft zwischen zwei Molekülen, zum Zeichnen. Bei Brücken ist a das H, b der Partner. */
export type Kontakt = { a: number; b: number; art: "bruecke" | "dipol" | "london"; t: number };

export type Optionen = {
  /** Teilladungen zeigen; die bindenden Paare rücken zum elektronegativeren Partner. */
  polar: boolean;
  /** Kräfte zwischen Molekülen: Wasserstoffbrücken, Dipol-Dipol, Van der Waals. */
  zwischen: boolean;
  /** Wärmebewegung 0–1: jedes Molekül wird als Ganzes zufällig angestoßen. */
  waerme: number;
};

export type LewisLabor = {
  W: number; H: number;
  atome: LAtom[]; el: LElektron[]; gruppen: LGruppe[]; bindungen: LBindung[]; zug: LZug[];
  kontakte: Kontakt[];
  optionen: Optionen;
  nId: number; farbe: number;
};

export const neuesLabor = (W: number, H: number): LewisLabor => ({
  W, H, atome: [], el: [], gruppen: [], bindungen: [], zug: [], kontakte: [],
  optionen: { polar: false, zwischen: false, waerme: 0 }, nId: 1, farbe: 0,
});

/** Ab diesem Unterschied der Elektronegativität gilt eine Bindung als polar (Schulregel). */
export const POLAR_AB = 0.5;
/** Nur H an diesen Atomen bildet Wasserstoffbrücken — und nur diese nehmen sie an. */
const STARK = new Set(["N", "O", "F"]);
/** Wie leicht sich die Elektronenhülle verformen lässt — Maß für die Van-der-Waals-Kraft. */
const POL: Record<string, number> = {
  H: 0.4, He: 0.2, B: 0.9, C: 1, N: 0.9, O: 0.8, F: 0.6, Ne: 0.3, Si: 1.6, P: 1.6, S: 1.7, Cl: 1.8, Br: 2.4, I: 3,
};

/** Außenelektronen und Ziel eines Elements; null, wenn es kein Hauptgruppenelement ist. */
export function lewisArt(symbol: string): { valenz: number; ziel: number } | null {
  const e = pseElement(symbol);
  if (!e || e.hauptgruppe === null) return null;
  return { valenz: e.z === 2 ? 2 : e.hauptgruppe, ziel: e.z <= 2 ? 2 : 8 };
}

/**
 * Wie die Punkte ums Symbol verteilt werden: erst eins auf jede der vier
 * Seiten, dann wird gepaart — so schreibt man es im Heft. Sauerstoff (6) hat
 * damit zwei Paare und zwei einzelne, Kohlenstoff vier einzelne.
 * Wasserstoff und Helium haben nur eine Seite.
 */
export function seitenBelegung(valenz: number, ziel: number): number[] {
  if (ziel === 2) return [valenz];
  const s = [0, 0, 0, 0];
  for (let i = 0; i < valenz; i++) s[i % 4]++;
  return s;
}

/** Oben, rechts, unten, links — die vier Seiten im Bildschirmmaß (y nach unten). */
const SEITEN = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

export function fuegeHinzu(lab: LewisLabor, symbol: string, x: number, y: number): LAtom | null {
  const art = lewisArt(symbol);
  if (!art) return null;
  const a: LAtom = {
    id: lab.nId++, symbol, farbe: ATOMFARBE[lab.farbe++ % ATOMFARBE.length],
    valenz: art.valenz, ziel: art.ziel, x, y, vx: 0, vy: 0, gehalten: false,
    en: pseElement(symbol)?.en ?? 2,
  };
  lab.atome.push(a);
  seitenBelegung(art.valenz, art.ziel).forEach((zahl, i) => {
    if (zahl === 0) return;
    const w = art.ziel === 2 ? 0 : SEITEN[i];
    const el: number[] = [];
    for (let k = 0; k < zahl; k++) {
      const e: LElektron = {
        id: lab.nId++, atom: a.id,
        x: x + R_EL * Math.cos(w), y: y + R_EL * Math.sin(w), vx: 0, vy: 0,
      };
      lab.el.push(e);
      el.push(e.id);
    }
    lab.gruppen.push({ id: lab.nId++, atom: a.id, el, winkel: w });
  });
  return a;
}

/** Löst eine Bindung: jedes Elektron geht als einzelnes an sein Atom zurück. */
function loese(lab: LewisLabor, b: LBindung): void {
  const A = lab.atome.find(a => a.id === b.a), B = lab.atome.find(a => a.id === b.b);
  lab.bindungen = lab.bindungen.filter(x => x !== b);
  if (A) lab.gruppen.push({ id: lab.nId++, atom: A.id, el: [b.ea], winkel: B ? Math.atan2(B.y - A.y, B.x - A.x) : 0 });
  if (B) lab.gruppen.push({ id: lab.nId++, atom: B.id, el: [b.eb], winkel: A ? Math.atan2(A.y - B.y, A.x - B.x) : 0 });
}

export function entferne(lab: LewisLabor, atomId: number): void {
  for (const b of lab.bindungen.filter(b => b.a === atomId || b.b === atomId)) loese(lab, b);
  lab.atome = lab.atome.filter(a => a.id !== atomId);
  lab.el = lab.el.filter(e => e.atom !== atomId);
  lab.gruppen = lab.gruppen.filter(g => g.atom !== atomId);
  lab.zug = [];
}

/** Bindungsgrad zwischen zwei Atomen: 0 bis 3. */
export const grad = (lab: LewisLabor, a: number, b: number): number =>
  lab.bindungen.filter(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)).length;

/** Elektronen, die zum Atom zählen: die eigenen plus je eins vom Partner pro Bindung. */
export const elektronenUm = (lab: LewisLabor, a: LAtom): number =>
  a.valenz + lab.bindungen.filter(b => b.a === a.id || b.b === a.id).length;

/** Winkel auf (−π, π]. */
const wickle = (w: number): number => {
  let x = (w + Math.PI) % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x - Math.PI;
};

export type Ereignis = { art: "gebunden" | "gerissen"; x: number; y: number };

/**
 * Ein Zeitschritt. `zufall` liefert Zahlen in [0, 1) — im Test fest, damit
 * das Ergebnis wiederholbar ist.
 */
export function schritt(lab: LewisLabor, dt: number, zufall: () => number = Math.random): Ereignis[] {
  const ereignisse: Ereignis[] = [];
  const atom = new Map(lab.atome.map(a => [a.id, a]));
  const abstand = (a: LAtom, b: LAtom) => Math.hypot(b.x - a.x, b.y - a.y);

  // 1. Zu weit auseinander: die Bindung reißt.
  for (const b of [...lab.bindungen]) {
    const A = atom.get(b.a)!, B = atom.get(b.b)!;
    if (abstand(A, B) > BRUCH) {
      loese(lab, b);
      ereignisse.push({ art: "gerissen", x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
    }
  }

  // 2. Einzelne Elektronen spüren einander — nah genug, springen sie zusammen.
  const einzelne = (id: number) => lab.gruppen.filter(g => g.atom === id && g.el.length === 1);
  const naechste = (gs: LGruppe[], w: number) =>
    gs.reduce((best, g) => Math.abs(wickle(g.winkel - w)) < Math.abs(wickle(best.winkel - w)) ? g : best);
  const paare: [LAtom, LAtom, number][] = [];
  for (let i = 0; i < lab.atome.length; i++) for (let j = i + 1; j < lab.atome.length; j++) {
    const d = abstand(lab.atome[i], lab.atome[j]);
    if (d < FANG) paare.push([lab.atome[i], lab.atome[j], d]);
  }
  paare.sort((p, q) => p[2] - q[2]);
  const zug: LZug[] = [];
  const belegt = new Set<number>();
  for (const [A, B, d] of paare) {
    const n = grad(lab, A.id, B.id);
    if (n >= 3) continue;
    const ea = einzelne(A.id).filter(g => !belegt.has(g.id));
    const eb = einzelne(B.id).filter(g => !belegt.has(g.id));
    if (!ea.length || !eb.length) continue;
    const w = Math.atan2(B.y - A.y, B.x - A.x);
    const ga = naechste(ea, w), gb = naechste(eb, w + Math.PI);
    // Die zweite und dritte Bindung warten, bis die vorige sitzt.
    const vorige = lab.bindungen.filter(x => (x.a === A.id && x.b === B.id) || (x.a === B.id && x.b === A.id));
    const bereit = vorige.every(x => x.reife > 0.7);
    if (d < BINDE && bereit) {
      lab.gruppen = lab.gruppen.filter(g => g !== ga && g !== gb);
      lab.bindungen.push({ a: A.id, b: B.id, ea: ga.el[0], eb: gb.el[0], reife: 0 });
      ereignisse.push({ art: "gebunden", x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
    } else {
      zug.push({ a: A.id, b: B.id, ga: ga.id, gb: gb.id, t: Math.min(1, Math.max(0, (FANG - d) / (FANG - BINDE))) });
    }
    belegt.add(ga.id); belegt.add(gb.id);
  }
  lab.zug = zug;
  for (const b of lab.bindungen) b.reife = Math.min(1, b.reife + dt * 1.6);

  // 3. Freie Gruppen weichen einander und den Bindungen aus; gezogene drehen sich zum Partner.
  const partnerWinkel = (A: LAtom): number[] => {
    const ids = new Set<number>();
    for (const b of lab.bindungen) {
      if (b.a === A.id) ids.add(b.b);
      if (b.b === A.id) ids.add(b.a);
    }
    return [...ids].map(id => { const B = atom.get(id)!; return Math.atan2(B.y - A.y, B.x - A.x); });
  };
  const gezogen = new Map<number, { ziel: number; t: number }>();
  for (const z of zug) {
    const A = atom.get(z.a)!, B = atom.get(z.b)!;
    const w = Math.atan2(B.y - A.y, B.x - A.x);
    gezogen.set(z.ga, { ziel: w, t: z.t });
    gezogen.set(z.gb, { ziel: w + Math.PI, t: z.t });
  }
  // Bei einer Wasserstoffbrücke dreht der Partner ein freies Paar zum H.
  const ausrichten = new Map<number, { ziel: number; t: number }>();
  for (const k of lab.kontakte) {
    if (k.art !== "bruecke") continue;
    const Hh = atom.get(k.a), X = atom.get(k.b);
    const paare = X ? lab.gruppen.filter(g => g.atom === X.id && g.el.length === 2) : [];
    if (!Hh || !X || !paare.length) continue;
    const w = Math.atan2(Hh.y - X.y, Hh.x - X.x);
    ausrichten.set(naechste(paare, w).id, { ziel: w, t: 0.7 * k.t });
  }
  for (const A of lab.atome) {
    const fest = partnerWinkel(A);
    const gs = lab.gruppen.filter(g => g.atom === A.id);
    for (const g of gs) {
      let dreh = 0;
      for (const w of [...fest, ...gs.filter(h => h !== g).map(h => h.winkel)]) {
        const d = wickle(g.winkel - w);
        dreh += Math.sign(d) * (Math.PI - Math.abs(d)) ** 2 * 1.4;
      }
      const z = gezogen.get(g.id) ?? ausrichten.get(g.id);
      if (z) dreh += 9 * z.t * Math.sin(wickle(z.ziel - g.winkel));
      g.winkel = wickle(g.winkel + Math.max(-6, Math.min(6, dreh)) * dt);
    }
  }

  // 4. Kräfte auf die Atome: Federn der Bindungen, Magnetzug, Abstoßung.
  const kraft = new Map(lab.atome.map(a => [a.id, { x: 0, y: 0 }]));
  const schiebe = (A: LAtom, B: LAtom, f: number) => {
    // f > 0 zieht zusammen.
    const d = Math.max(1, abstand(A, B));
    const ux = (B.x - A.x) / d, uy = (B.y - A.y) / d;
    const fa = kraft.get(A.id)!, fb = kraft.get(B.id)!;
    fa.x += ux * f; fa.y += uy * f;
    fb.x -= ux * f; fb.y -= uy * f;
  };
  const nachbarn = new Map<number, Set<number>>(lab.atome.map(a => [a.id, new Set()]));
  for (const b of lab.bindungen) { nachbarn.get(b.a)!.add(b.b); nachbarn.get(b.b)!.add(b.a); }
  for (const b of lab.bindungen) {
    const A = atom.get(b.a)!, B = atom.get(b.b)!;
    // Je Paar nur einmal federn, egal ob Einfach- oder Dreifachbindung.
    if (lab.bindungen.find(x => (x.a === b.a && x.b === b.b) || (x.a === b.b && x.b === b.a)) !== b) continue;
    schiebe(A, B, Math.max(-1400, Math.min(1400, 45 * (abstand(A, B) - L_BIND))));
  }
  for (const z of zug) schiebe(atom.get(z.a)!, atom.get(z.b)!, 320 * z.t);
  for (let i = 0; i < lab.atome.length; i++) for (let j = i + 1; j < lab.atome.length; j++) {
    const A = lab.atome[i], B = lab.atome[j];
    const d = Math.max(8, abstand(A, B));
    if (d < 52) schiebe(A, B, -60 * (52 - d));
    // Zwei Nachbarn desselben Atoms spreizen sich — so entsteht das Bild.
    const gemeinsam = [...nachbarn.get(A.id)!].some(n => nachbarn.get(B.id)!.has(n));
    if (gemeinsam) schiebe(A, B, -Math.min(800, 5e5 / (d * d)));
  }
  // Freie Paare stoßen die gebundenen Nachbarn weg (wie beim Wasser).
  for (const g of lab.gruppen) {
    const A = atom.get(g.atom)!;
    const px = A.x + L_BIND * Math.cos(g.winkel), py = A.y + L_BIND * Math.sin(g.winkel);
    for (const n of nachbarn.get(A.id)!) {
      const B = atom.get(n)!;
      const dx = B.x - px, dy = B.y - py, d = Math.max(10, Math.hypot(dx, dy));
      const f = Math.min(800, 4e5 / (d * d));
      const fb = kraft.get(B.id)!;
      fb.x += dx / d * f; fb.y += dy / d * f;
    }
  }
  // Zu welchem Molekül gehört ein Atom?
  const molId = new Map<number, number>();
  for (const A of lab.atome) {
    if (molId.has(A.id)) continue;
    const stapel = [A.id];
    molId.set(A.id, A.id);
    while (stapel.length) {
      const id = stapel.pop()!;
      for (const n of nachbarn.get(id)!) if (!molId.has(n)) { molId.set(n, A.id); stapel.push(n); }
    }
  }

  // Zwischen den Molekülen: Wasserstoffbrücken, Dipol-Dipol, Van der Waals.
  lab.kontakte = [];
  if (lab.optionen.zwischen) {
    const q = teilladungen(lab);
    const spender = (A: LAtom) => A.symbol === "H" && [...nachbarn.get(A.id)!].some(n => STARK.has(atom.get(n)!.symbol));
    const nimmt = (X: LAtom) => STARK.has(X.symbol) && lab.gruppen.some(g => g.atom === X.id && g.el.length === 2);
    const bruecke = new Map<number, number>();
    for (const A of lab.atome) {
      if (!spender(A)) continue;
      let best: LAtom | null = null, bestD = 150;
      for (const X of lab.atome) {
        if (molId.get(X.id) === molId.get(A.id) || !nimmt(X)) continue;
        const d = abstand(A, X);
        if (d < bestD) { best = X; bestD = d; }
      }
      if (!best) continue;
      bruecke.set(A.id, best.id);
      // Etwa anderthalb Bindungslängen: länger und schwächer als eine echte Bindung.
      schiebe(A, best, Math.max(-300, Math.min(300, 8 * (bestD - 95))));
      lab.kontakte.push({ a: A.id, b: best.id, art: "bruecke", t: Math.min(1, Math.max(0.2, (150 - bestD) / 55)) });
    }
    const klemme = (x: number) => Math.max(-1.2, Math.min(1.2, x));
    for (let i = 0; i < lab.atome.length; i++) for (let j = i + 1; j < lab.atome.length; j++) {
      const A = lab.atome[i], B = lab.atome[j];
      if (molId.get(A.id) === molId.get(B.id) || bruecke.get(A.id) === B.id || bruecke.get(B.id) === A.id) continue;
      const d = abstand(A, B);
      if (d > 130) continue;
      // Die Anziehung darf zwei Moleküle nicht ineinanderschieben.
      if (d < 56) schiebe(A, B, -150 * (56 - d));
      const nah = 1 - d / 130;
      const qa = q.get(A.id) ?? 0, qb = q.get(B.id) ?? 0;
      if (Math.abs(qa) >= 0.4 && Math.abs(qb) >= 0.4) {
        // Ungleiche Teilladungen ziehen sich an, gleiche stoßen sich ab.
        const f = -klemme(qa) * klemme(qb) * 60 * nah;
        schiebe(A, B, f);
        if (f > 4) lab.kontakte.push({ a: A.id, b: B.id, art: "dipol", t: Math.min(1, f / 50) });
      } else {
        const f = 30 * (POL[A.symbol] ?? 1) * (POL[B.symbol] ?? 1) * nah;
        schiebe(A, B, f);
        if (f > 5) lab.kontakte.push({ a: A.id, b: B.id, art: "london", t: Math.min(1, f / 40) });
      }
    }
  }
  // Wärmebewegung: jedes Molekül bekommt als Ganzes zufällige Stöße.
  if (lab.optionen.waerme > 0) {
    const stoss = new Map<number, { x: number; y: number }>();
    for (const A of lab.atome) {
      const m = molId.get(A.id)!;
      if (!stoss.has(m)) stoss.set(m, { x: zufall() - 0.5, y: zufall() - 0.5 });
      const st = stoss.get(m)!, f = kraft.get(A.id)!;
      f.x += st.x * lab.optionen.waerme * 50000;
      f.y += st.y * lab.optionen.waerme * 50000;
    }
  }

  const daempf = Math.exp(-6 * dt);
  for (const A of lab.atome) {
    if (A.gehalten) { A.vx = 0; A.vy = 0; continue; }
    const f = kraft.get(A.id)!;
    A.vx = (A.vx + f.x * dt) * daempf;
    A.vy = (A.vy + f.y * dt) * daempf;
    A.x = Math.max(28, Math.min(lab.W - 28, A.x + A.vx * dt));
    A.y = Math.max(28, Math.min(lab.H - 28, A.y + A.vy * dt));
  }

  // 5. Die Elektronen folgen ihrem Platz an einer Feder — mit Zittern.
  const ziel = new Map<number, { x: number; y: number; zitter: number }>();
  for (const g of lab.gruppen) {
    const A = atom.get(g.atom)!;
    const cx = Math.cos(g.winkel), cy = Math.sin(g.winkel);
    let bx = A.x + R_EL * cx, by = A.y + R_EL * cy;
    let zitter = 1;
    const z = gezogen.get(g.id);
    if (z) {
      // Zum Partner hin gestreckt, je näher, desto mehr.
      const zg = zug.find(q => q.ga === g.id || q.gb === g.id)!;
      const P = atom.get(zg.a === A.id ? zg.b : zg.a)!;
      const mx = (A.x + P.x) / 2, my = (A.y + P.y) / 2;
      const s = 0.5 * z.t;
      bx += (mx - bx) * s; by += (my - by) * s;
      zitter = 1 + 5 * z.t;
    }
    if (g.el.length === 2) {
      ziel.set(g.el[0], { x: bx - 5 * cy, y: by + 5 * cx, zitter });
      ziel.set(g.el[1], { x: bx + 5 * cy, y: by - 5 * cx, zitter });
    } else ziel.set(g.el[0], { x: bx, y: by, zitter });
  }
  const gruppenNachPaar = new Map<string, LBindung[]>();
  for (const b of lab.bindungen) {
    const k = b.a < b.b ? `${b.a}-${b.b}` : `${b.b}-${b.a}`;
    gruppenNachPaar.set(k, [...(gruppenNachPaar.get(k) ?? []), b]);
  }
  for (const liste of gruppenNachPaar.values()) {
    liste.forEach((b, k) => {
      const A = atom.get(b.a)!, B = atom.get(b.b)!;
      const d = Math.max(1, abstand(A, B));
      const ux = (B.x - A.x) / d, uy = (B.y - A.y) / d;
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      // Mehrfachbindungen liegen nebeneinander quer zur Achse, die zwei Punkte eines Paares längs.
      const quer = (k - (liste.length - 1) / 2) * 11;
      // Polar: das Paar rückt zum elektronegativeren Partner.
      const dEN = B.en - A.en;
      const ruck = lab.optionen.polar && Math.abs(dEN) >= POLAR_AB ? Math.max(-2, Math.min(2, dEN)) * 4 : 0;
      const ox = mx - uy * quer + ux * ruck, oy = my + ux * quer + uy * ruck;
      ziel.set(b.ea, { x: ox - ux * 4.5, y: oy - uy * 4.5, zitter: 0.6 });
      ziel.set(b.eb, { x: ox + ux * 4.5, y: oy + uy * 4.5, zitter: 0.6 });
    });
  }
  const dE = Math.exp(-14 * dt);
  for (const e of lab.el) {
    const z = ziel.get(e.id);
    if (!z) continue;
    const rausch = 900 * z.zitter;
    e.vx = (e.vx + (300 * (z.x - e.x) + (zufall() - 0.5) * rausch) * dt) * dE;
    e.vy = (e.vy + (300 * (z.y - e.y) + (zufall() - 0.5) * rausch) * dt) * dE;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }
  return ereignisse;
}

export type Molekuel = {
  atome: number[];
  formel: string; gesetzt: string; name: string | null;
  /** Atome ohne Oktett bzw. Duett, mit ihrer Elektronenzahl. */
  offen: { id: number; symbol: string; zahl: number; ziel: number }[];
  bindungen: number;
};

/** Zusammenhängende Teile, wie sie gerade gebunden sind. */
export function molekuele(lab: LewisLabor): Molekuel[] {
  const nachbarn = new Map<number, number[]>(lab.atome.map(a => [a.id, []]));
  for (const b of lab.bindungen) { nachbarn.get(b.a)!.push(b.b); nachbarn.get(b.b)!.push(b.a); }
  const gesehen = new Set<number>();
  const aus: Molekuel[] = [];
  for (const start of lab.atome) {
    if (gesehen.has(start.id)) continue;
    const teil: number[] = [];
    const stapel = [start.id];
    gesehen.add(start.id);
    while (stapel.length) {
      const id = stapel.pop()!;
      teil.push(id);
      for (const n of nachbarn.get(id)!) if (!gesehen.has(n)) { gesehen.add(n); stapel.push(n); }
    }
    const atome = teil.map(id => lab.atome.find(a => a.id === id)!);
    const formel = summenformel(atome.map(a => a.symbol));
    aus.push({
      atome: teil, formel, gesetzt: formelGesetzt(formel), name: atome.length > 1 ? NAMEN[formel] ?? null : null,
      offen: atome.map(a => ({ id: a.id, symbol: a.symbol, zahl: elektronenUm(lab, a), ziel: a.ziel }))
        .filter(x => x.zahl !== x.ziel),
      bindungen: lab.bindungen.filter(b => teil.includes(b.a)).length,
    });
  }
  return aus;
}

/** Ein freier Platz für ein neues Atom — möglichst weit weg von den anderen. */
export function freierPlatz(lab: LewisLabor, zufall: () => number = Math.random): { x: number; y: number } {
  let best = { x: lab.W / 2, y: lab.H / 2 }, bestD = -1;
  for (let i = 0; i < 40; i++) {
    const p = { x: 40 + zufall() * (lab.W - 80), y: 40 + zufall() * (lab.H - 80) };
    const d = Math.min(Infinity, ...lab.atome.map(a => Math.hypot(a.x - p.x, a.y - p.y)));
    if (d > bestD) { best = p; bestD = d; }
    if (d > FANG + 20) break;
  }
  return best;
}

/** Bausätze: die Atome liegen auseinander, zusammenschieben muss man selbst. */
export const BAUSAETZE: { label: string; symbole: string[] }[] = [
  { label: "H₂", symbole: ["H", "H"] },
  { label: "Cl₂", symbole: ["Cl", "Cl"] },
  { label: "O₂", symbole: ["O", "O"] },
  { label: "N₂", symbole: ["N", "N"] },
  { label: "HCl", symbole: ["H", "Cl"] },
  { label: "H₂O", symbole: ["O", "H", "H"] },
  { label: "NH₃", symbole: ["N", "H", "H", "H"] },
  { label: "CH₄", symbole: ["C", "H", "H", "H", "H"] },
  { label: "CO₂", symbole: ["C", "O", "O"] },
  { label: "BF₃", symbole: ["B", "F", "F", "F"] },
  { label: "HCN", symbole: ["H", "C", "N"] },
  { label: "C₂H₄", symbole: ["C", "C", "H", "H", "H", "H"] },
];

/**
 * Teilladungen: je polarer Bindung (ΔEN ≥ 0,5) wandert Elektronendichte zum
 * elektronegativeren Partner. Positiv = δ+, negativ = δ−. Die Zahl ist die
 * Summe der ΔEN-Werte — ein Maß zum Vergleichen, keine echte Ladung.
 */
export function teilladungen(lab: LewisLabor): Map<number, number> {
  const atom = new Map(lab.atome.map(a => [a.id, a]));
  const q = new Map<number, number>();
  for (const b of lab.bindungen) {
    const A = atom.get(b.a), B = atom.get(b.b);
    if (!A || !B) continue;
    const d = B.en - A.en;
    if (Math.abs(d) < POLAR_AB) continue;
    q.set(A.id, (q.get(A.id) ?? 0) + d);
    q.set(B.id, (q.get(B.id) ?? 0) - d);
  }
  return q;
}

/** Ein fertiges Molekül: Atome in Bindungslängen, Bindungen mit Grad. */
export type Vorlage = {
  label: string; name: string; gruppe: "Anorganisch" | "Organisch";
  /** Siedepunkt bei Normaldruck in °C — zeigt, wie stark die Moleküle zusammenhalten. */
  sdp: number;
  atome: [string, number, number][];
  bindungen: [number, number, number][];
};

/** Kohlenstoffkette mit allen H, waagerecht. */
function kette(n: number): Pick<Vorlage, "atome" | "bindungen"> {
  const atome: [string, number, number][] = [];
  const bindungen: [number, number, number][] = [];
  for (let i = 0; i < n; i++) atome.push(["C", i - (n - 1) / 2, 0]);
  for (let i = 0; i + 1 < n; i++) bindungen.push([i, i + 1, 1]);
  const h = (c: number, x: number, y: number) => { atome.push(["H", x, y]); bindungen.push([c, atome.length - 1, 1]); };
  for (let i = 0; i < n; i++) {
    const x = atome[i][1];
    h(i, x, -1); h(i, x, 1);
    if (i === 0) h(i, x - 1, 0);
    if (i === n - 1) h(i, x + 1, 0);
  }
  return { atome, bindungen };
}

export const MOLEKUELE: Vorlage[] = [
  { label: "H₂O", name: "Wasser", gruppe: "Anorganisch", sdp: 100, atome: [["O", 0, 0], ["H", -0.8, 0.6], ["H", 0.8, 0.6]], bindungen: [[0, 1, 1], [0, 2, 1]] },
  { label: "NH₃", name: "Ammoniak", gruppe: "Anorganisch", sdp: -33, atome: [["N", 0, 0], ["H", -0.95, 0.3], ["H", 0.95, 0.3], ["H", 0, 1]], bindungen: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
  { label: "HF", name: "Fluorwasserstoff", gruppe: "Anorganisch", sdp: 20, atome: [["F", 0, 0], ["H", 1, 0]], bindungen: [[0, 1, 1]] },
  { label: "HCl", name: "Chlorwasserstoff", gruppe: "Anorganisch", sdp: -85, atome: [["Cl", 0, 0], ["H", 1, 0]], bindungen: [[0, 1, 1]] },
  { label: "H₂S", name: "Schwefelwasserstoff", gruppe: "Anorganisch", sdp: -60, atome: [["S", 0, 0], ["H", -0.8, 0.6], ["H", 0.8, 0.6]], bindungen: [[0, 1, 1], [0, 2, 1]] },
  { label: "CO₂", name: "Kohlenstoffdioxid", gruppe: "Anorganisch", sdp: -78, atome: [["C", 0, 0], ["O", -1, 0], ["O", 1, 0]], bindungen: [[0, 1, 2], [0, 2, 2]] },
  { label: "N₂", name: "Stickstoff", gruppe: "Anorganisch", sdp: -196, atome: [["N", 0, 0], ["N", 1, 0]], bindungen: [[0, 1, 3]] },
  { label: "O₂", name: "Sauerstoff", gruppe: "Anorganisch", sdp: -183, atome: [["O", 0, 0], ["O", 1, 0]], bindungen: [[0, 1, 2]] },
  { label: "Cl₂", name: "Chlor", gruppe: "Anorganisch", sdp: -34, atome: [["Cl", 0, 0], ["Cl", 1, 0]], bindungen: [[0, 1, 1]] },
  { label: "CH₄", name: "Methan", gruppe: "Organisch", sdp: -162, ...kette(1) },
  { label: "C₂H₆", name: "Ethan", gruppe: "Organisch", sdp: -89, ...kette(2) },
  { label: "C₃H₈", name: "Propan", gruppe: "Organisch", sdp: -42, ...kette(3) },
  { label: "C₄H₁₀", name: "Butan", gruppe: "Organisch", sdp: -0.5, ...kette(4) },
  { label: "C₂H₄", name: "Ethen", gruppe: "Organisch", sdp: -104,
    atome: [["C", -0.5, 0], ["C", 0.5, 0], ["H", -1.2, -0.8], ["H", -1.2, 0.8], ["H", 1.2, -0.8], ["H", 1.2, 0.8]],
    bindungen: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]] },
  { label: "C₂H₂", name: "Ethin", gruppe: "Organisch", sdp: -84,
    atome: [["H", -1.5, 0], ["C", -0.5, 0], ["C", 0.5, 0], ["H", 1.5, 0]], bindungen: [[0, 1, 1], [1, 2, 3], [2, 3, 1]] },
  { label: "CH₃Cl", name: "Chlormethan", gruppe: "Organisch", sdp: -24,
    atome: [["C", 0, 0], ["Cl", 1, 0], ["H", -1, 0], ["H", 0, -1], ["H", 0, 1]], bindungen: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
  { label: "CH₃OH", name: "Methanol", gruppe: "Organisch", sdp: 65,
    atome: [["C", 0, 0], ["O", 1, 0], ["H", 1.6, 0.8], ["H", -1, 0], ["H", 0, -1], ["H", 0, 1]],
    bindungen: [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1]] },
  { label: "C₂H₅OH", name: "Ethanol", gruppe: "Organisch", sdp: 78,
    atome: [["C", -1, 0], ["C", 0, 0], ["O", 1, 0], ["H", 1.6, 0.8], ["H", -2, 0], ["H", -1, -1], ["H", -1, 1], ["H", 0, -1], ["H", 0, 1]],
    bindungen: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1], [1, 7, 1], [1, 8, 1]] },
  { label: "CH₃NH₂", name: "Methylamin", gruppe: "Organisch", sdp: -6,
    atome: [["C", 0, 0], ["N", 1, 0], ["H", 1.5, 0.85], ["H", 1.5, -0.85], ["H", -1, 0], ["H", 0, -1], ["H", 0, 1]],
    bindungen: [[0, 1, 1], [1, 2, 1], [1, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1]] },
  { label: "HCHO", name: "Methanal (Formaldehyd)", gruppe: "Organisch", sdp: -19,
    atome: [["C", 0, 0], ["O", 1, 0], ["H", -0.7, -0.8], ["H", -0.7, 0.8]], bindungen: [[0, 1, 2], [0, 2, 1], [0, 3, 1]] },
  { label: "Aceton", name: "Aceton (Propanon)", gruppe: "Organisch", sdp: 56,
    atome: [["C", -1, 0.4], ["C", 0, 0], ["C", 1, 0.4], ["O", 0, -1],
      ["H", -2, 0.4], ["H", -1, 1.4], ["H", -1.3, -0.5], ["H", 2, 0.4], ["H", 1, 1.4], ["H", 1.3, -0.5]],
    bindungen: [[0, 1, 1], [1, 2, 1], [1, 3, 2], [0, 4, 1], [0, 5, 1], [0, 6, 1], [2, 7, 1], [2, 8, 1], [2, 9, 1]] },
  { label: "Essigsäure", name: "Essigsäure (Ethansäure)", gruppe: "Organisch", sdp: 118,
    atome: [["C", -1, 0], ["C", 0, 0], ["O", 0.5, -0.9], ["O", 1, 0.4], ["H", 1.9, 0.1],
      ["H", -2, 0], ["H", -1, -1], ["H", -1, 1]],
    bindungen: [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 1], [0, 5, 1], [0, 6, 1], [0, 7, 1]] },
];

/** Setzt ein fertiges Molekül ein, um (x, y) und um `winkel` gedreht. */
export function fuegeMolekuelEin(lab: LewisLabor, m: Vorlage, x: number, y: number, winkel = 0): LAtom[] {
  const c = Math.cos(winkel), s = Math.sin(winkel);
  const atome = m.atome.map(([sym, dx, dy]) =>
    fuegeHinzu(lab, sym, x + (dx * c - dy * s) * L_BIND, y + (dx * s + dy * c) * L_BIND)!);
  const einzelne = (A: LAtom) => lab.gruppen.filter(g => g.atom === A.id && g.el.length === 1);
  const naechste = (gs: LGruppe[], w: number) =>
    gs.reduce((best, g) => Math.abs(wickle(g.winkel - w)) < Math.abs(wickle(best.winkel - w)) ? g : best);
  for (const [i, j, n] of m.bindungen) {
    const A = atome[i], B = atome[j];
    for (let k = 0; k < n; k++) {
      const w = Math.atan2(B.y - A.y, B.x - A.x);
      const ga = naechste(einzelne(A), w), gb = naechste(einzelne(B), w + Math.PI);
      lab.gruppen = lab.gruppen.filter(g => g !== ga && g !== gb);
      lab.bindungen.push({ a: A.id, b: B.id, ea: ga.el[0], eb: gb.el[0], reife: 1 });
    }
  }
  return atome;
}
