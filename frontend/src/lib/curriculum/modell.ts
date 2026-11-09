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
/** Zeilenfarben je Niveau (vom Kollegium so gewünscht: G dunkelrot, R blau, H grün). */
export const NIVEAU_FARBE: Record<Niveau, string> = {
  G: "#9b1c1c", R: "#2563eb", H: "#16a34a", LB: "#d97706", GE: "#7c3aed",
};
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
  /** Zusammengeführte Karte (RS + GY): voller Originalwortlaut je Niveau; `niveaus` enthält dann nur, was jedes Niveau über das darunter hinaus verlangt. */
  voll?: Partial<Record<Niveau, string>>;
  /** Herkunft einer zusammengeführten Karte */
  quellen?: { rs?: string[]; gy?: string[] };
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
  // Irgendwo im Curriculum zugeordnete Karten — die schlägt keine andere Einheit mehr vor.
  const vergeben = new Set((v.curriculum?.klassen ?? []).flatMap(k => k.themen.flatMap(t => [...zugeordnet(t)])));
  return { karten, paareAlt, paareNeu, vergeben };
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
        if (!nk || gesehen.has(nid) || schon.has(nid) || i.vergeben.has(nid)) continue;
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

/** Gleicher Inhalt? Vergleicht ohne Groß-/Kleinschreibung, Satzzeichen und Leerraum. */
export function gleicherText(a?: string, b?: string): boolean {
  const n = (x?: string) => (x ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return !!a && !!b && n(a) === n(b);
}

/**
 * Gilt die Karte für Niveau R bzw. G, verlangt dort aber nichts über das Niveau
 * darunter hinaus? Dann das Niveau, dem sie gleicht (»= wie H«), sonst null.
 * Gilt die Karte für das Niveau gar nicht (Regelschul-Karte und G), auch null.
 */
export function gleichWie(k: Karte, n: Niveau): Niveau | null {
  const { G: g, R: r, H: h } = k.niveaus;
  if (n === "R") {
    const gilt = !!(r || k.voll?.R);
    return gilt && h && (!r || gleicherText(r, h)) ? "H" : null;
  }
  if (n === "G") {
    const gilt = !!(g || k.voll?.G);
    const rEigen = !!r && !gleicherText(r, h);
    const darunter: Niveau | null = rEigen ? "R" : h ? "H" : r ? "R" : null;
    return gilt && darunter && (!g || gleicherText(g, r ?? h)) ? darunter : null;
  }
  return null;
}

/** Schularten einer Karte — eine zusammengeführte (»RS+GY«) gehört zu denen, deren Niveaus sie hat. */
export function schulartenVon(k: KarteMitPlan): Set<string> {
  if (k.plan.schulart !== "RS+GY") return new Set([k.plan.schulart]);
  const n = { ...k.voll, ...k.niveaus };
  return new Set([...(n.R || n.H ? ["RS"] : []), ...(n.G ? ["GY"] : [])]);
}

/**
 * Karte einer Unterrichtseinheit zuordnen. Wo sie abgelegt wird, ist egal: sie
 * verteilt sich auf G, R und H, und zwar nur so weit, wie jedes Niveau etwas
 * über das darunter hinaus verlangt — H ist die Basis, R kommt nur dazu, wenn
 * es mehr sagt als H, G nur, wenn es mehr sagt als R (bzw. H). Fehlt einer
 * einfachen Regelschul-Karte der H-Text (und die Klasse hat noch Hauptschul-
 * niveau), wird R nach H kopiert — als Text in der Karte, damit er sich für H
 * anpassen lässt. Zusammengeführte Karten sind schon ausgedünnt und werden
 * nicht kopiert. Alte Karten landen oben.
 */
export function zuordnen(i: Index, thema: Thema, karteId: string, klasse: number): {
  thema: Thema; karte?: { lehrplan: string; karte: Karte };
} {
  const k = i.karten.get(karteId);
  if (!k) return { thema };
  if (k.plan.rolle === "alt") {
    return { thema: thema.karten.includes(karteId) ? thema : { ...thema, karten: [...thema.karten, karteId] } };
  }
  const { plan, ...roh } = k;
  let karte: Karte | undefined;
  let h = k.niveaus.H;
  const r = k.niveaus.R;
  if (r && !h && !k.voll && niveauGilt("H", klasse)) {
    h = r;
    karte = { ...roh, niveaus: { ...roh.niveaus, H: r } };
  }
  const zuordnung = { ...(thema.zuordnung ?? {}) };
  for (const n of zielNiveaus({ ...roh, niveaus: { ...roh.niveaus, ...(h ? { H: h } : {}) } }, klasse)) {
    const liste = zuordnung[n] ?? [];
    if (!liste.includes(karteId)) zuordnung[n] = [...liste, karteId];
  }
  return { thema: { ...thema, zuordnung }, karte: karte && { lehrplan: plan.id, karte } };
}

/** Wohin eine Karte gehört: H als Basis, R und G nur mit eigenem Zusatz (Klasse 10 ohne H). */
export function zielNiveaus(k: Karte, klasse: number): Niveau[] {
  const { H: h, R: r, G: g } = k.niveaus;
  const ziele: Niveau[] = [
    ...(h ? ["H" as const] : []),
    ...(r && !gleicherText(r, h) ? ["R" as const] : []),
    ...(g && !gleicherText(g, r ?? h) ? ["G" as const] : []),
  ].filter(n => niveauGilt(n, klasse));
  return ziele.length ? ziele : NIVEAUS.filter(n => k.niveaus[n] && niveauGilt(n, klasse)).slice(0, 1);
}

/**
 * Karte nach einer Textänderung in einer Unterrichtseinheit neu verteilen: aus
 * G/R/H heraus und nach dem gespeicherten Text wieder hinein (LB/GE bleiben).
 * Liegt die Karte in der Einheit gar nicht auf G/R/H, bleibt die Einheit gleich.
 */
export function neuVerteilen(thema: Thema, karte: Karte, klasse: number): Thema {
  const z = thema.zuordnung ?? {};
  if (!(["G", "R", "H"] as Niveau[]).some(n => z[n]?.includes(karte.id))) return thema;
  const zuordnung: Partial<Record<Niveau, string[]>> = { ...z };
  for (const n of ["G", "R", "H"] as Niveau[]) if (zuordnung[n]) zuordnung[n] = zuordnung[n]!.filter(x => x !== karte.id);
  for (const n of zielNiveaus(karte, klasse)) zuordnung[n] = [...(zuordnung[n] ?? []), karte.id];
  return { ...thema, zuordnung };
}

/** Karte ganz aus einer Unterrichtseinheit nehmen (alte Karten oben und alle Niveau-Zeilen) — für Strg+X. */
export function entfernen(thema: Thema, karteId: string): Thema {
  const zuordnung = thema.zuordnung && Object.fromEntries(
    Object.entries(thema.zuordnung).map(([n, ids]) => [n, (ids ?? []).filter(x => x !== karteId)]));
  return { ...thema, karten: thema.karten.filter(x => x !== karteId), ...(zuordnung ? { zuordnung } : {}) };
}

type Op = Record<string, unknown>;

/**
 * Operationen, die eine Änderung rückgängig machen (für Strg+Z): jedes berührte
 * Thema, jede Karte, jedes Paar und jede Klasse kommt auf den Stand vor der
 * Änderung zurück — was es vorher nicht gab, wird gelöscht. Hochladen (import)
 * lässt sich so nicht umkehren: dann `null`.
 */
export function umkehrOps(vorher: Vorlage, ops: Op[]): Op[] | null {
  if (ops.some(o => o.op === "import")) return null;
  const themaOrt = new Map<string, { klasse: number; pos: number; thema: Thema }>();
  vorher.curriculum.klassen.forEach(k => k.themen.forEach((t, pos) => themaOrt.set(t.id, { klasse: k.klasse, pos, thema: t })));
  const kartenVorher = new Map<string, Karte>();
  vorher.lehrplaene.forEach(lp => lp.karten.forEach(k => kartenVorher.set(`${lp.id}|${k.id}`, k)));
  const themen = new Set<string>(), karten = new Map<string, { lehrplan: string; id: string }>(),
    paare = new Set<string>(), klassen = new Set<number>();
  for (const o of ops) {
    if (o.op === "thema") themen.add((o.thema as Thema).id);
    else if (o.op === "thema_loeschen") themen.add(o.id as string);
    else if (o.op === "karte") karten.set(`${o.lehrplan}|${(o.karte as Karte).id}`, { lehrplan: o.lehrplan as string, id: (o.karte as Karte).id });
    else if (o.op === "karte_loeschen") karten.set(`${o.lehrplan}|${o.id}`, { lehrplan: o.lehrplan as string, id: o.id as string });
    else if (o.op === "paar") paare.add((o.paar as Paar).id);
    else if (o.op === "paar_loeschen") paare.add(o.id as string);
    else if (o.op === "klasse") klassen.add(o.klasse as number);
  }
  const zurueck: Op[] = [];
  for (const [key, { lehrplan, id }] of karten) {
    const alt = kartenVorher.get(key);
    zurueck.push(alt ? { op: "karte", lehrplan, karte: alt } : { op: "karte_loeschen", lehrplan, id });
  }
  for (const id of paare) {
    const alt = vorher.abgleich.find(p => p.id === id);
    zurueck.push(alt ? { op: "paar", paar: alt } : { op: "paar_loeschen", id });
  }
  for (const nr of klassen) {
    const alt = vorher.curriculum.klassen.find(k => k.klasse === nr);
    if (alt) zurueck.push({ op: "klasse", klasse: nr, wochen_verfuegbar: alt.wochen_verfuegbar });
  }
  // erst entfernen, was neu war, dann die alten Einheiten an ihre Stelle (aufsteigend, damit die Positionen stimmen)
  for (const id of themen) if (!themaOrt.has(id)) zurueck.push({ op: "thema_loeschen", id });
  [...themen].map(id => themaOrt.get(id)).filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.klasse - b.klasse || a.pos - b.pos)
    .forEach(o => zurueck.push({ op: "thema", klasse: o.klasse, pos: o.pos, thema: o.thema }));
  return zurueck;
}

/** Name der Unterrichtseinheit zu einer Karte: Lernbereich ohne Unterabschnitt (»A – B« → »A«). */
export function lernbereichKopf(k: Karte): string {
  return (k.lernbereich || k.bereich || "Weitere Inhalte").split(" – ")[0].trim();
}

/**
 * Unterrichtseinheiten aus dem neuen Lehrplan: je Lernbereich eine leere
 * Einheit. Die Karten bleiben im Deck (»Offen«) — zugeordnet wird von Hand.
 * In 5/6 und 7/8 nennt der Lehrplan nur das Ende des Doppeljahrgangs: die
 * Einheit kommt in beide Klassen, überflüssige löscht die Fachschaft. In 9/10
 * gilt die Klasse der Karte. Gibt es in der Klasse schon eine Einheit gleichen
 * Namens, entsteht keine zweite — erneutes Anlegen ergänzt nur, was fehlt.
 */
export function einheitenAusLehrplan(v: Vorlage): { klasse: number; thema: Thema }[] {
  const bloecke = v.bloecke?.length ? v.bloecke : BLOECKE;
  const ziele = (k: Karte): number[] =>
    k.block === "9/10" && (k.klasse === 9 || k.klasse === 10) ? [k.klasse] : KLASSEN_JE_BLOCK[k.block] ?? [];

  // (Klasse, Lernbereich) in Lehrplan-Reihenfolge
  const gruppen = new Map<string, { klasse: number; titel: string }>();
  for (const lp of v.lehrplaene) {
    if (lp.rolle !== "neu") continue;
    for (const k of lp.karten) {
      if (!bloecke.includes(k.block)) continue;
      const titel = lernbereichKopf(k);
      for (const kl of ziele(k)) gruppen.set(`${kl}|${titel.toLowerCase()}`, { klasse: kl, titel });
    }
  }

  const vorhanden = new Set(v.curriculum.klassen.flatMap(k => k.themen.map(t => `${k.klasse}|${t.titel.trim().toLowerCase()}`)));
  const ids = new Set(v.curriculum.klassen.flatMap(k => k.themen.map(t => t.id)));
  const freieId = (kl: number) => { let n = 1; while (ids.has(`k${kl}-t${n}`)) n++; ids.add(`k${kl}-t${n}`); return `k${kl}-t${n}`; };
  return [...gruppen.entries()]
    .filter(([schluessel]) => !vorhanden.has(schluessel))
    .map(([, g]) => g)
    .sort((a, b) => a.klasse - b.klasse)
    .map(g => ({ klasse: g.klasse, thema: { id: freieId(g.klasse), titel: g.titel, wochen: null, inhalte: {}, karten: [], notiz: "" } }));
}

/**
 * Bringt die Vorlage kein Curriculum mit (Startvorlagen, reine Lehrplan-Dateien),
 * bekommt der neue Plan gleich je Lernbereich eine leere Unterrichtseinheit —
 * die Karten bleiben im Deck. Ein mitgebrachtes Curriculum bleibt unangetastet.
 */
export function mitEinheiten(daten: Partial<Vorlage>, fach: string): Partial<Vorlage> {
  if (daten.curriculum && !nurLeereEinheiten(daten.curriculum)) return daten;
  const v: Vorlage = { ...leereVorlage(fach), ...daten } as Vorlage;
  v.curriculum = { stand: v.curriculum?.stand ?? "", klassen: [...(v.curriculum?.klassen ?? [])].map(k => ({ ...k, themen: [] })) };
  for (const { klasse, thema } of einheitenAusLehrplan(v)) {
    let kl = v.curriculum.klassen.find(k => k.klasse === klasse);
    if (!kl) v.curriculum.klassen.push(kl = { klasse, wochen_verfuegbar: 36, themen: [] });
    kl.themen.push(thema);
  }
  v.curriculum.klassen.sort((a, b) => a.klasse - b.klasse);
  return { ...daten, curriculum: v.curriculum };
}

/**
 * Besteht ein Curriculum nur aus leeren Einheiten (kein Inhalt, keine Karten,
 * keine Wochen, keine Notiz)? So liefern es KI-Prompt und Lehrplan-Vorlagen;
 * es trägt nichts, was beim Hochladen verloren gehen dürfte.
 */
export function nurLeereEinheiten(c: Partial<Vorlage["curriculum"]>): boolean {
  return (c.klassen ?? []).every(k => (k.themen ?? []).every(t =>
    !Object.values(t.inhalte ?? {}).some(x => x?.trim()) && !t.karten?.length && t.wochen == null && !t.notiz?.trim()
    && !Object.values(t.zuordnung ?? {}).some(ids => ids?.length)));
}

/** Wie der Plan nach dem Hochladen von `daten` aussähe (wie _importieren in api/curriculum_ops.py). */
export function nachImport(doc: Vorlage, daten: Partial<Vorlage>): Vorlage {
  const lehrplaene = [...doc.lehrplaene];
  for (const lp of daten.lehrplaene ?? []) {
    const i = lehrplaene.findIndex(x => x.id === lp.id);
    if (i >= 0) lehrplaene[i] = { ...lp, karten: lp.karten ?? [] }; else lehrplaene.push({ ...lp, karten: lp.karten ?? [] });
  }
  return {
    ...doc, lehrplaene,
    ...(daten.abgleich ? { abgleich: daten.abgleich } : {}),
    ...(daten.curriculum ? { curriculum: { stand: daten.curriculum.stand ?? "", klassen: daten.curriculum.klassen ?? [] } } : {}),
    ...(daten.bloecke ? { bloecke: daten.bloecke } : {}),
  };
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
/** Neue Karten eines Blocks ohne Unterrichtseinheit. Eingeklappte Klassen (`zu`) behalten ihre
 *  Vorschläge nicht — die liegen dann wieder in der Kartenbank, bis die Klasse aufgeht. */
export function offeneKarten(v: Vorlage, i: Index, block: Block, zu: ReadonlySet<number> = new Set()): { karte: KarteMitPlan; paar: Paar | null }[] {
  const abgedeckt = new Set<string>();
  for (const k of v.curriculum.klassen) {
    if (blockVon(k.klasse) !== block) continue;
    for (const t of k.themen) {
      zugeordnet(t).forEach(id => abgedeckt.add(id));
      if (zu.has(k.klasse)) continue;
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
