/**
 * Vom IUPAC-Namen zum Molekül.
 *
 * Abgedeckt ist der Schulstoff der Organik: Alkane, Alkene, Alkine, Ringe,
 * Halogene, Alkohole, Aldehyde, Ketone, Carbonsäuren, Ester und Amine, dazu
 * die üblichen Alkyl-Reste und eine Handvoll Trivialnamen.
 *
 * Gelesen wird von links nach rechts:
 *   [Positionen]-[Vervielfacher][Rest]…  [cyclo]  [Stamm]  [an/en/in]  [Endung]
 * also etwa »2,3-Dimethylbutan«, »Prop-2-en«, »3-Methylbut-1-in«,
 * »2-Butanol«, »Cyclopenta-1,3-dien«, »Butansäurepropylester«.
 *
 * Was nicht geht, gibt einen Fehlertext zurück — nie ein halbes Molekül.
 */
import { addAtom, bind, leer, type Molekuel } from "./molekuel";

export type Ergebnis =
  | { ok: true; m: Molekuel; name: string }
  | { ok: false; fehler: string };

/** Stammnamen: wie viele Kohlenstoffatome die Hauptkette hat. */
const STAMM: Record<string, number> = {
  meth: 1, eth: 2, prop: 3, but: 4, pent: 5, hex: 6, hept: 7, oct: 8,
  non: 9, dec: 10, undec: 11, dodec: 12,
};

const VIELFACH: Record<string, number> = { di: 2, tri: 3, tetra: 4, penta: 5, hexa: 6 };

/** Reste, die als Vorsilbe an der Kette hängen. */
type Rest =
  | { art: "alkyl"; c: number }
  | { art: "atom"; el: string }
  | { art: "gruppe"; bau: "hydroxy" | "amino" | "nitro" | "oxo" | "phenyl" };

const RESTE: Record<string, Rest> = {
  methyl: { art: "alkyl", c: 1 },
  ethyl: { art: "alkyl", c: 2 },
  propyl: { art: "alkyl", c: 3 },
  butyl: { art: "alkyl", c: 4 },
  pentyl: { art: "alkyl", c: 5 },
  hexyl: { art: "alkyl", c: 6 },
  fluor: { art: "atom", el: "F" },
  chlor: { art: "atom", el: "Cl" },
  brom: { art: "atom", el: "Br" },
  iod: { art: "atom", el: "I" },
  jod: { art: "atom", el: "I" },
  hydroxy: { art: "gruppe", bau: "hydroxy" },
  amino: { art: "gruppe", bau: "amino" },
  nitro: { art: "gruppe", bau: "nitro" },
  oxo: { art: "gruppe", bau: "oxo" },
  phenyl: { art: "gruppe", bau: "phenyl" },
};

/** Trivialnamen, die im Unterricht vorkommen — als fertiger IUPAC-Name. */
export const TRIVIAL: Record<string, string> = {
  benzol: "@benzol",
  benzen: "@benzol",
  phenol: "@phenol",
  toluol: "@toluol",
  ameisensäure: "methansäure",
  essigsäure: "ethansäure",
  propionsäure: "propansäure",
  buttersäure: "butansäure",
  aceton: "propan-2-on",
  formaldehyd: "methanal",
  acetaldehyd: "ethanal",
  glycerin: "propan-1,2,3-triol",
  isopropanol: "propan-2-ol",
  isopropylalkohol: "propan-2-ol",
  weingeist: "ethanol",
};

/** Ein Treffer der Vorsilben-Schleife. */
type Vorsilbe = { stellen: number[]; rest: Rest; name: string };

const zahlen = (s: string | undefined): number[] =>
  s ? s.split(",").map(n => Number(n)) : [];

/**
 * Zerlegt den Namen. Gearbeitet wird auf Kleinbuchstaben ohne Leerzeichen;
 * Bindestriche trennen nur und dürfen auch fehlen.
 */
function zerlege(roh: string): {
  vorsilben: Vorsilbe[]; ring: boolean; c: number;
  doppel: number[]; dreifach: number[];
  endung: string; endungStellen: number[]; esterRest: number | null;
} | { fehler: string } {
  let s = roh.toLowerCase().replace(/\s+/g, "").replace(/^n-/, "");
  const vorsilben: Vorsilbe[] = [];

  // Vorsilben: [Stellen-][Vervielfacher]Rest, beliebig oft.
  const restNamen = Object.keys(RESTE).sort((a, b) => b.length - a.length).join("|");
  const reVor = new RegExp(`^(?:(\\d+(?:,\\d+)*)-?)?(di|tri|tetra|penta|hexa)?(${restNamen})-?`);
  for (;;) {
    const t = reVor.exec(s);
    // »propyl« am Ende eines Esters gehört nicht hierher, »propan« ist kein Rest.
    if (!t || /^(an|en|in|yl)?(säure|ester)/.test(s.slice(t[0].length))) break;
    const anzahl = t[2] ? VIELFACH[t[2]] : 1;
    const stellen = zahlen(t[1]);
    if (stellen.length && stellen.length !== anzahl) {
      return { fehler: `»${t[3]}«: ${stellen.length} Stellen, aber ${anzahl} Reste.` };
    }
    for (let i = 0; i < anzahl; i++) {
      vorsilben.push({ stellen: [stellen[i] ?? 1], rest: RESTE[t[3]], name: t[3] });
    }
    s = s.slice(t[0].length);
  }

  // Eine Stelle, die jetzt noch vorn steht, gehoert nicht zu einem Rest,
  // sondern zur Mehrfachbindung oder zur Endung: »2-Butanol«, »2-Pentin«.
  let vorne: number[] = [];
  const fuehrend = /^(\d+(?:,\d+)*)-/.exec(s);
  if (fuehrend) { vorne = zahlen(fuehrend[1]); s = s.slice(fuehrend[0].length); }

  // Ring?
  const ring = s.startsWith("cyclo");
  if (ring) s = s.slice(5);

  // Stamm.
  const stamm = Object.keys(STAMM).sort((a, b) => b.length - a.length).find(k => s.startsWith(k));
  if (!stamm) return { fehler: `Kein Stammname erkannt (meth…dodec) in »${s || roh}«.` };
  const c = STAMM[stamm];
  s = s.slice(stamm.length);

  // Bindungen: »an« gesättigt, »en« Doppel-, »in« Dreifachbindung,
  // mit Stellen davor und Vervielfacher (dien, trien …).
  const doppel: number[] = [];
  const dreifach: number[] = [];
  s = s.replace(/^a(?=-)/, ""); // »cyclopenta-1,3-dien«
  for (;;) {
    const t = /^-?(\d+(?:,\d+)*)?-?(di|tri|tetra)?(en|in|an)-?/.exec(s);
    if (!t || !t[0]) break;
    const anzahl = t[2] ? VIELFACH[t[2]] : 1;
    let stellen = zahlen(t[1]);
    if (!stellen.length && vorne.length && (t[3] === "en" || t[3] === "in")) {
      stellen = vorne;
      vorne = [];
    }
    if (t[3] === "en" || t[3] === "in") {
      const ziel = t[3] === "en" ? doppel : dreifach;
      for (let i = 0; i < anzahl; i++) ziel.push(stellen[i] ?? 1);
    }
    s = s.slice(t[0].length);
    if (t[3] === "an") break; // nach »an« kommt nur noch die Endung
  }

  // Ester: »…säure<rest>ester«
  let esterRest: number | null = null;
  const ester = /^säure([a-zäöü]+)ylester$/.exec(s);
  if (ester) {
    const r = RESTE[`${ester[1]}yl`];
    if (!r || r.art !== "alkyl") return { fehler: `Unbekannter Ester-Rest »${ester[1]}yl«.` };
    esterRest = r.c;
    s = "säure";
  }

  // Endung.
  const t = /^-?(\d+(?:,\d+)*)?-?(di|tri)?(säure|ol|al|on|amin|säureamid)?$/.exec(s);
  if (!t) return { fehler: `Endung »${s}« nicht verstanden.` };
  const endung = t[3] ?? "";
  const anzahl = t[2] ? VIELFACH[t[2]] : 1;
  let endungStellen = zahlen(t[1]);
  if (!endungStellen.length) endungStellen = vorne;
  if (endungStellen.length < anzahl) {
    endungStellen = Array.from({ length: anzahl }, (_, i) => endungStellen[i] ?? 1);
  }

  return { vorsilben, ring, c, doppel, dreifach, endung, endungStellen, esterRest };
}

/** Hängt einen Rest an das Kettenatom `an`. */
function restAnbauen(m: Molekuel, an: number, rest: Rest): void {
  if (rest.art === "atom") {
    bind(m, an, addAtom(m, rest.el));
    return;
  }
  if (rest.art === "alkyl") {
    let vorher = an;
    for (let i = 0; i < rest.c; i++) {
      const neu = addAtom(m, "C");
      bind(m, vorher, neu);
      vorher = neu;
    }
    return;
  }
  switch (rest.bau) {
    case "hydroxy": bind(m, an, addAtom(m, "O")); break;
    case "amino": bind(m, an, addAtom(m, "N")); break;
    case "oxo": bind(m, an, addAtom(m, "O"), 2); break;
    case "nitro": {
      // Formal getrennte Ladungen: der Stickstoff ist positiv, das einfach
      // gebundene Sauerstoffatom negativ — und trägt deshalb kein H.
      const n = addAtom(m, "N");
      m.atome[n].ladung = 1;
      bind(m, an, n);
      bind(m, n, addAtom(m, "O"), 2);
      const o = addAtom(m, "O");
      m.atome[o].ladung = -1;
      m.atome[o].hFest = 0;
      bind(m, n, o);
      break;
    }
    case "phenyl": {
      const erste = m.atome.length;
      for (let i = 0; i < 6; i++) addAtom(m, "C");
      for (let i = 0; i < 6; i++) bind(m, erste + i, erste + ((i + 1) % 6), i % 2 ? 1 : 2);
      bind(m, an, erste);
      break;
    }
  }
}

/** Benzol und seine zwei Ableger — als Ring gebaut, nicht über den Stamm. */
function ringMolekuel(was: "benzol" | "phenol" | "toluol"): Molekuel {
  const m = leer();
  for (let i = 0; i < 6; i++) addAtom(m, "C", i + 1);
  for (let i = 0; i < 6; i++) bind(m, i, (i + 1) % 6, i % 2 ? 1 : 2);
  m.ring = [0, 1, 2, 3, 4, 5];
  if (was === "phenol") bind(m, 0, addAtom(m, "O"));
  if (was === "toluol") bind(m, 0, addAtom(m, "C"));
  return m;
}

/** Liest den Namen und baut das Molekül. */
export function ausName(eingabe: string): Ergebnis {
  const roh = eingabe.trim();
  if (!roh) return { ok: false, fehler: "Gib einen Namen ein." };

  const trivial = TRIVIAL[roh.toLowerCase().replace(/\s+/g, "")];
  if (trivial?.startsWith("@")) {
    return { ok: true, m: ringMolekuel(trivial.slice(1) as "benzol"), name: roh };
  }

  const z = zerlege(trivial ?? roh);
  if ("fehler" in z) return { ok: false, fehler: z.fehler };

  const m = leer();
  for (let i = 0; i < z.c; i++) addAtom(m, "C", i + 1);
  for (let i = 0; i < z.c - 1; i++) bind(m, i, i + 1);
  if (z.ring) {
    if (z.c < 3) return { ok: false, fehler: "Ein Ring braucht mindestens drei C-Atome." };
    bind(m, z.c - 1, 0);
    m.ring = m.atome.map((_, i) => i).slice(0, z.c);
  }

  const kettenBindung = (von: number, grad: 1 | 2 | 3): string | null => {
    // Die Stelle k meint die Bindung zwischen Ck und Ck+1 (im Ring auch n→1).
    const a = von - 1, b = von % z.c;
    if (von < 1 || von > (z.ring ? z.c : z.c - 1)) return `Stelle ${von} gibt es in der Kette nicht.`;
    const bi = m.bindungen.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!bi) return `Zwischen C${von} und C${von + 1} ist keine Bindung.`;
    bi.grad = grad;
    return null;
  };
  for (const d of z.doppel) { const f = kettenBindung(d, 2); if (f) return { ok: false, fehler: f }; }
  for (const d of z.dreifach) { const f = kettenBindung(d, 3); if (f) return { ok: false, fehler: f }; }

  // Endung: die Hauptfunktion sitzt an der angegebenen Stelle.
  for (const stelle of z.endungStellen) {
    const c = stelle - 1;
    if (z.endung && (c < 0 || c >= z.c)) return { ok: false, fehler: `Stelle ${stelle} gibt es nicht.` };
    switch (z.endung) {
      case "ol": bind(m, c, addAtom(m, "O")); break;
      case "amin": bind(m, c, addAtom(m, "N")); break;
      case "on": bind(m, c, addAtom(m, "O"), 2); break;
      case "al": bind(m, 0, addAtom(m, "O"), 2); break;
      case "säure": {
        bind(m, 0, addAtom(m, "O"), 2);
        const o = addAtom(m, "O");
        bind(m, 0, o);
        if (z.esterRest !== null) {
          let vorher = o;
          for (let i = 0; i < z.esterRest; i++) {
            const neu = addAtom(m, "C");
            bind(m, vorher, neu);
            vorher = neu;
          }
        }
        break;
      }
    }
    if (z.endung === "al" || z.endung === "säure") break; // sitzt immer an C1
  }

  for (const v of z.vorsilben) {
    const c = v.stellen[0] - 1;
    if (c < 0 || c >= z.c) return { ok: false, fehler: `»${v.name}« an Stelle ${v.stellen[0]}: die gibt es nicht.` };
    restAnbauen(m, c, v.rest);
  }

  // Zu viele Bindungen an einem Atom? Dann stimmt der Name nicht.
  for (let i = 0; i < m.atome.length; i++) {
    const summe = m.bindungen.reduce((s, b) => s + (b.a === i || b.b === i ? b.grad : 0), 0);
    // Stickstoff mit vier Bindungen gibt es wirklich — so zeichnet man die
    // Nitrogruppe im Schulbuch (ohne die Ladungen auszuschreiben).
    const max = { C: 4, N: 4, O: 2, F: 1, Cl: 1, Br: 1, I: 1 }[m.atome[i].el] ?? 4;
    if (summe > max) {
      return { ok: false, fehler: `Am ${i + 1}. Atom (${m.atome[i].el}) treffen zu viele Bindungen zusammen.` };
    }
  }

  return { ok: true, m, name: roh };
}
