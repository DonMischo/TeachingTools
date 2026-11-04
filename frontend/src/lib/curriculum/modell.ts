/**
 * Curriculum-Abgleich: Datenmodell (Format tt-curriculum/1, wie api/curriculum_ops.py)
 * und was die Seite daraus ableitet — Konflikte, offene neue Karten, Wochensummen.
 *
 * Verknüpfung: Ein Thema nennt in `karten` die passenden Lehrplan-Karten (alte
 * und/oder neue). Der `abgleich` paart alte mit neuen Karten. Neue Karten eines
 * Themas sind also die direkt genannten plus die Partner seiner alten Karten.
 */

export const NIVEAUS = ["G", "R", "H", "LB", "GE"] as const;
export type Niveau = typeof NIVEAUS[number];
export const NIVEAU_NAME: Record<Niveau, string> = {
  G: "Gymnasialniveau", R: "Realschulniveau", H: "Hauptschulniveau", LB: "Förderschwp. LB", GE: "Förderschwp. GE",
};

export type Block = "5/6" | "7/8" | "9/10";
export const BLOECKE: Block[] = ["5/6", "7/8", "9/10"];
export const KLASSEN_JE_BLOCK: Record<Block, number[]> = { "5/6": [5, 6], "7/8": [7, 8], "9/10": [9, 10] };
export function blockVon(klasse: number): Block {
  return klasse <= 6 ? "5/6" : klasse <= 8 ? "7/8" : "9/10";
}
/** Hauptschulniveau endet mit Klasse 9 (Hauptschulabschluss). */
export function niveauGilt(n: Niveau, klasse: number): boolean {
  return !(n === "H" && klasse > 9);
}

export type Karte = {
  id: string;
  block: Block;
  klasse?: number;
  bereich?: string;
  lernbereich?: string;
  titel?: string;
  niveaus: Partial<Record<Niveau, string>>;
  seite?: number;
};

export type Lehrplan = {
  id: string;
  rolle: "alt" | "neu";
  schulart: "RS" | "GY" | string;
  titel?: string;
  fassung?: string;
  quelle?: string;
  /** Klassenstufe → Schuljahr, ab dem der Plan dort gilt (nur neue Pläne). */
  inkraft?: Record<string, string>;
  karten: Karte[];
};

export type Status = "identisch" | "geändert" | "verschoben" | "neu" | "entfallen";
export const STATUS: Status[] = ["identisch", "geändert", "verschoben", "neu", "entfallen"];

export type Paar = {
  id: string;
  alt: string[];
  neu: string[];
  status: Status;
  niveaus?: Niveau[];
  unterschied?: string;
  von?: Block;
  nach?: Block;
};

export type Thema = {
  id: string;
  titel: string;
  wochen: number | null;
  inhalte: Partial<Record<Niveau, string>>;
  karten: string[];
  notiz?: string;
};

export type Klasse = { klasse: number; wochen_verfuegbar: number; themen: Thema[] };

export type Vorlage = {
  format: "tt-curriculum/1";
  fach: string;
  niveaus: Niveau[];
  bloecke: Block[];
  lehrplaene: Lehrplan[];
  abgleich: Paar[];
  curriculum: { stand: string; klassen: Klasse[] };
};

export type KarteMitPlan = Karte & { plan: Lehrplan };

/** Nachschlagetabellen für eine Vorlage — einmal je Stand bauen. */
export function index(v: Vorlage) {
  const karten = new Map<string, KarteMitPlan>();
  for (const lp of v.lehrplaene) for (const k of lp.karten) karten.set(k.id, { ...k, plan: lp });
  const paareAlt = new Map<string, Paar[]>();
  const paareNeu = new Map<string, Paar[]>();
  for (const p of v.abgleich) {
    for (const a of p.alt) paareAlt.set(a, [...(paareAlt.get(a) ?? []), p]);
    for (const n of p.neu) paareNeu.set(n, [...(paareNeu.get(n) ?? []), p]);
  }
  return { karten, paareAlt, paareNeu };
}
export type Index = ReturnType<typeof index>;

export function istAlt(i: Index, id: string) { return i.karten.get(id)?.plan.rolle === "alt"; }

/** Status einer Karte aus Sicht ihres Plans (alte: was wird aus ihr; neue: woher kommt sie). */
export function statusVon(i: Index, id: string): Status | null {
  const k = i.karten.get(id);
  if (!k) return null;
  const paare = (k.plan.rolle === "alt" ? i.paareAlt : i.paareNeu).get(id) ?? [];
  if (paare.length === 0) return k.plan.rolle === "alt" ? "entfallen" : "neu";
  // Der »schlimmste« Status gewinnt, damit nichts untergeht.
  const rang: Status[] = ["entfallen", "verschoben", "neu", "geändert", "identisch"];
  return rang.find(s => paare.some(p => p.status === s)) ?? null;
}

/**
 * Liegt die Karte für ein Thema dieser Klasse woanders? 5/6 und 7/8 sind
 * Doppeljahrgänge; in 9/10 unterscheiden die Lehrpläne Kl. 9 und Kl. 10.
 */
export function woandersAls(k: Karte, klasse: number): string | null {
  if (k.block !== blockVon(klasse)) return `Kl. ${k.block}`;
  if (k.block === "9/10" && k.klasse && k.klasse !== klasse) return `Kl. ${k.klasse}`;
  return null;
}

export type ThemaSicht = {
  alt: KarteMitPlan[];
  /** neue Karten mit dem Paar, über das sie hierher kamen (null = direkt zugeordnet) */
  neu: { karte: KarteMitPlan; paar: Paar | null; woanders: boolean }[];
  konflikte: string[];
};

/** Was zu einem Thema links (alter Plan) und rechts (neuer Plan) steht. */
export function themaSicht(i: Index, thema: Thema, klasse: number): ThemaSicht {
  const alt: KarteMitPlan[] = [];
  const neu: ThemaSicht["neu"] = [];
  const gesehen = new Set<string>();
  const konflikte: string[] = [];
  for (const id of thema.karten) {
    const k = i.karten.get(id);
    if (!k) continue;
    if (k.plan.rolle === "alt") {
      alt.push(k);
      const paare = i.paareAlt.get(id) ?? [];
      if (paare.length === 0 || paare.every(p => p.status === "entfallen")) {
        konflikte.push(`»${k.titel ?? id}« entfällt im neuen Lehrplan (${k.plan.schulart})`);
      }
      for (const p of paare) {
        for (const nid of p.neu) {
          const nk = i.karten.get(nid);
          if (!nk || gesehen.has(nid)) continue;
          gesehen.add(nid);
          const ort = woandersAls(nk, klasse);
          neu.push({ karte: nk, paar: p, woanders: !!ort });
          if (ort) konflikte.push(`»${nk.titel ?? nid}« liegt neu in ${ort} (${nk.plan.schulart})`);
        }
      }
    } else if (!gesehen.has(id)) {
      gesehen.add(id);
      const ort = woandersAls(k, klasse);
      neu.push({ karte: k, paar: null, woanders: !!ort });
      if (ort) konflikte.push(`»${k.titel ?? id}« gehört neu in ${ort} (${k.plan.schulart})`);
    }
  }
  return { alt, neu, konflikte };
}

/**
 * Neue Karten eines Blocks, die kein Thema dieses Blocks abdeckt — weder direkt
 * noch über eine alte Karte. Das ist, was im Curriculum noch fehlt: echte neue
 * Inhalte und solche, die aus einem anderen Block hierher wandern.
 */
export function offeneKarten(v: Vorlage, i: Index, block: Block): { karte: KarteMitPlan; paar: Paar | null }[] {
  const abgedeckt = new Set<string>();
  for (const k of v.curriculum.klassen) {
    if (blockVon(k.klasse) !== block) continue;
    for (const t of k.themen) for (const n of themaSicht(i, t, k.klasse).neu) if (!n.woanders) abgedeckt.add(n.karte.id);
  }
  const out: { karte: KarteMitPlan; paar: Paar | null }[] = [];
  for (const lp of v.lehrplaene) {
    if (lp.rolle !== "neu") continue;
    for (const k of lp.karten) {
      if (k.block !== block || abgedeckt.has(k.id)) continue;
      out.push({ karte: { ...k, plan: lp }, paar: (i.paareNeu.get(k.id) ?? [])[0] ?? null });
    }
  }
  return out;
}

/** Alte Karten eines Blocks, die an keinem Thema hängen — Lücken im alten Curriculum. */
export function freieAlteKarten(v: Vorlage, block: Block): KarteMitPlan[] {
  const genutzt = new Set(v.curriculum.klassen.flatMap(k => k.themen.flatMap(t => t.karten)));
  return v.lehrplaene.filter(lp => lp.rolle === "alt")
    .flatMap(lp => lp.karten.filter(k => k.block === block && !genutzt.has(k.id)).map(k => ({ ...k, plan: lp })));
}

export function wochenSumme(k: Klasse): number {
  return k.themen.reduce((s, t) => s + (t.wochen ?? 0), 0);
}

export function neueId(v: Vorlage, klasse: number): string {
  const ids = new Set(v.curriculum.klassen.flatMap(k => k.themen.map(t => t.id)));
  let n = 1;
  while (ids.has(`k${klasse}-t${n}`)) n++;
  return `k${klasse}-t${n}`;
}

// ── Wort-Diff ────────────────────────────────────────────────────────────────

export type DiffTeil = { text: string; art: "gleich" | "weg" | "dazu" };

/** Wortweiser Vergleich (LCS) — die Lehrplan-Sätze sind kurz genug dafür. */
export function wortDiff(alt: string, neu: string): DiffTeil[] {
  const a = alt.split(/(\s+)/).filter(Boolean);
  const b = neu.split(/(\s+)/).filter(Boolean);
  const norm = (w: string) => w.toLowerCase().replace(/[.,;:()„“"]/g, "");
  const m = a.length, n = b.length;
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let x = m - 1; x >= 0; x--)
    for (let y = n - 1; y >= 0; y--)
      L[x][y] = norm(a[x]) === norm(b[y]) ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
  const out: DiffTeil[] = [];
  const push = (text: string, art: DiffTeil["art"]) => {
    const last = out[out.length - 1];
    if (last && last.art === art) last.text += text; else out.push({ text, art });
  };
  let x = 0, y = 0;
  while (x < m && y < n) {
    if (norm(a[x]) === norm(b[y])) { push(b[y], "gleich"); x++; y++; }
    else if (L[x + 1][y] >= L[x][y + 1]) push(a[x++], "weg");
    else push(b[y++], "dazu");
  }
  while (x < m) push(a[x++], "weg");
  while (y < n) push(b[y++], "dazu");
  return out;
}
