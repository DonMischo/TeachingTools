/**
 * Curriculum-Abgleich: Datenmodell (Format tt-curriculum/1, wie api/curriculum_ops.py)
 * und was die Seite daraus ableitet — Konflikte, offene neue Karten, Wochensummen.
 *
 * Verknüpfung: Eine Unterrichtseinheit (im JSON `thema`) nennt in `karten` die
 * passenden Karten des alten Lehrplans; neue Karten ordnet man ihr je Niveau zu
 * (`zuordnung`). Der `abgleich` paart alte mit neuen Karten — die Partner der
 * alten Karten erscheinen als Vorschläge, bis sie zugeordnet sind.
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
  /** passende Karten des ALTEN Lehrplans (Abgleich-Grundlage) */
  karten: string[];
  /** Karten des NEUEN Lehrplans je Kompetenzniveau */
  zuordnung?: Partial<Record<Niveau, string[]>>;
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

/** Leere Vorlage (wie leer() in api/curriculum_ops.py), z. B. für den KI-Prompt vor dem Anlegen. */
export function leereVorlage(fach: string): Vorlage {
  return {
    format: "tt-curriculum/1", fach, niveaus: [...NIVEAUS], bloecke: [...BLOECKE],
    lehrplaene: [], abgleich: [], curriculum: { stand: "", klassen: [] },
  };
}

export type KarteMitPlan = Karte & { plan: Lehrplan };

export const OHNE_BEREICH = "ohne Bereich";

/** Bereiche (Mechanik, Optik … bzw. Zahl & Algebra …) in der Reihenfolge, in der die Lehrpläne sie nennen. */
export function bereicheVon(v: Vorlage): string[] {
  const out: string[] = [];
  for (const lp of v.lehrplaene) for (const k of lp.karten) {
    const b = k.bereich || OHNE_BEREICH;
    if (!out.includes(b)) out.push(b);
  }
  return out;
}

/** Liste nach Bereich gruppieren, Gruppen in der Reihenfolge von `reihenfolge`. */
export function nachBereich<T>(liste: T[], karte: (x: T) => Karte, reihenfolge: string[]): { bereich: string; eintraege: T[] }[] {
  const gruppen = new Map<string, T[]>();
  for (const x of liste) {
    const b = karte(x).bereich || OHNE_BEREICH;
    gruppen.set(b, [...(gruppen.get(b) ?? []), x]);
  }
  const rang = (b: string) => (reihenfolge.includes(b) ? reihenfolge.indexOf(b) : reihenfolge.length);
  return [...gruppen.entries()].sort(([a], [b]) => rang(a) - rang(b)).map(([bereich, eintraege]) => ({ bereich, eintraege }));
}

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
 * Liegt die Karte für eine Unterrichtseinheit dieser Klasse woanders? 5/6 und 7/8 sind
 * Doppeljahrgänge; in 9/10 unterscheiden die Lehrpläne Kl. 9 und Kl. 10.
 */
export function woandersAls(k: Karte, klasse: number): string | null {
  if (k.block !== blockVon(klasse)) return `Kl. ${k.block}`;
  if (k.block === "9/10" && k.klasse && k.klasse !== klasse) return `Kl. ${k.klasse}`;
  return null;
}

/** Neue Karten, die einer Unterrichtseinheit je Niveau zugeordnet sind. */
export function zugeordnet(t: Thema): Set<string> {
  return new Set(Object.values(t.zuordnung ?? {}).flat());
}

export type ThemaSicht = {
  alt: KarteMitPlan[];
  /** neue Karten je Niveau, die der UE zugeordnet sind */
  niveau: Partial<Record<Niveau, KarteMitPlan[]>>;
  /** Vorschläge: Partner der alten Karten, noch nicht zugeordnet */
  vorschlaege: { karte: KarteMitPlan; paar: Paar; woanders: boolean }[];
  konflikte: string[];
};

/** Was zu einer Unterrichtseinheit oben (alter Plan), in den Niveau-Zeilen und unten (Vorschläge) steht. */
export function themaSicht(i: Index, thema: Thema, klasse: number): ThemaSicht {
  const alt: KarteMitPlan[] = [];
  const vorschlaege: ThemaSicht["vorschlaege"] = [];
  const konflikte: string[] = [];
  const schon = zugeordnet(thema);
  const gesehen = new Set<string>();
  for (const id of thema.karten) {
    const k = i.karten.get(id);
    if (!k || k.plan.rolle !== "alt") continue;
    alt.push(k);
    const paare = i.paareAlt.get(id) ?? [];
    if (paare.length === 0 || paare.every(p => p.status === "entfallen")) {
      konflikte.push(`»${k.titel ?? id}« entfällt im neuen Lehrplan (${k.plan.schulart})`);
    }
    for (const p of paare) {
      for (const nid of p.neu) {
        const nk = i.karten.get(nid);
        if (!nk || gesehen.has(nid) || schon.has(nid)) continue;
        gesehen.add(nid);
        const ort = woandersAls(nk, klasse);
        vorschlaege.push({ karte: nk, paar: p, woanders: !!ort });
        if (ort) konflikte.push(`»${nk.titel ?? nid}« liegt neu in ${ort} (${nk.plan.schulart})`);
      }
    }
  }
  const niveau: ThemaSicht["niveau"] = {};
  for (const n of NIVEAUS) {
    const liste = (thema.zuordnung?.[n] ?? []).map(id => i.karten.get(id)).filter((k): k is KarteMitPlan => !!k);
    if (liste.length) niveau[n] = liste;
    for (const k of liste) {
      const ort = woandersAls(k, klasse);
      if (ort) konflikte.push(`»${k.titel ?? k.id}« (${n}) gehört neu in ${ort}`);
    }
  }
  return { alt, niveau, vorschlaege, konflikte: [...new Set(konflikte)] };
}

/** Text einer Karte für ein Niveau; H übernimmt R, wenn der Lehrplan nichts Eigenes sagt. */
export function karteText(k: Karte, n: Niveau): string | undefined {
  return k.niveaus[n] ?? (n === "H" ? k.niveaus.R : undefined) ?? (n === "LB" || n === "GE" ? k.niveaus.H ?? k.niveaus.R : undefined);
}

/**
 * Karte einer Unterrichtseinheit zuordnen. Ohne `nur` verteilt sie sich auf
 * ihre eigenen Niveaus: GY → G, RS → R und H. Fehlt der H-Text (und die Klasse
 * hat noch Hauptschulniveau), wird R nach H kopiert — als Text in der Karte,
 * damit er sich danach für H anpassen lässt. Alte Karten landen oben.
 */
export function zuordnen(i: Index, thema: Thema, karteId: string, klasse: number, nur?: Niveau): {
  thema: Thema; karte?: { lehrplan: string; karte: Karte };
} {
  const k = i.karten.get(karteId);
  if (!k) return { thema };
  if (k.plan.rolle === "alt") {
    return { thema: thema.karten.includes(karteId) ? thema : { ...thema, karten: [...thema.karten, karteId] } };
  }
  const { plan, ...roh } = k;
  let karte: Karte | undefined;
  let ziele: Niveau[];
  if (nur) ziele = [nur];
  else {
    ziele = NIVEAUS.filter(n => (n === "G" || n === "R" || n === "H") && k.niveaus[n]);
    if (k.niveaus.R && !k.niveaus.H && niveauGilt("H", klasse)) {
      ziele.push("H");
      karte = { ...roh, niveaus: { ...roh.niveaus, H: k.niveaus.R } };
    }
    if (!ziele.length) ziele = ["R"];
  }
  ziele = ziele.filter(n => niveauGilt(n, klasse));
  const zuordnung = { ...(thema.zuordnung ?? {}) };
  for (const n of ziele) {
    const liste = zuordnung[n] ?? [];
    if (!liste.includes(karteId)) zuordnung[n] = [...liste, karteId];
  }
  return { thema: { ...thema, zuordnung }, karte: karte && { lehrplan: plan.id, karte } };
}

/** Karte aus einer Niveau-Zeile (oder oben aus den alten) wieder lösen. */
export function loesen(thema: Thema, karteId: string, n?: Niveau): Thema {
  if (!n) return { ...thema, karten: thema.karten.filter(x => x !== karteId) };
  return { ...thema, zuordnung: { ...thema.zuordnung, [n]: (thema.zuordnung?.[n] ?? []).filter(x => x !== karteId) } };
}

/**
 * Neue Karten eines Blocks, die keine Unterrichtseinheit des Blocks hat —
 * weder zugeordnet noch als Vorschlag über eine alte Karte. Das ist, was im
 * Curriculum noch fehlt: echte neue Inhalte und solche, die hierher wandern.
 */
export function offeneKarten(v: Vorlage, i: Index, block: Block): { karte: KarteMitPlan; paar: Paar | null }[] {
  const abgedeckt = new Set<string>();
  for (const k of v.curriculum.klassen) {
    if (blockVon(k.klasse) !== block) continue;
    for (const t of k.themen) {
      zugeordnet(t).forEach(id => abgedeckt.add(id));
      for (const n of themaSicht(i, t, k.klasse).vorschlaege) if (!n.woanders) abgedeckt.add(n.karte.id);
    }
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

/** Alte Karten eines Blocks, die an keiner Unterrichtseinheit hängen — Lücken im alten Curriculum. */
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
