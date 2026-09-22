/**
 * Das Wortnetz — ein Sprachmodell im Kleinformat.
 *
 * Jedes Wort ist ein Knoten, jede Kante sagt: »auf mich folgt jenes Wort so
 * oft«. Mehr steckt nicht dahinter. Wer daran entlangläuft und immer eines
 * der angebotenen Wörter nimmt, schreibt einen Text — und merkt dabei, dass
 * die Maschine nie *versteht*, sondern nur zählt, was üblich ist.
 *
 * Ehrlich bleiben (die Grenzen gehören zum Lehrstoff):
 *   • Hier zählt nur das **letzte** Wort. Ein echtes Modell sieht Tausende
 *     Wörter Zusammenhang und kann deshalb den Faden halten.
 *   • Hier stehen ein paar hundert Zahlen. Ein echtes Modell hat Milliarden.
 *   • Hier sind die Wahrscheinlichkeiten von Hand eingetragen, dort sind sie
 *     aus riesigen Textmengen gelernt.
 * Gleich ist das Entscheidende: Wahrscheinlichkeiten, eine Auswahl daraus,
 * ein Würfel.
 *
 * Die Grammatik steckt in den Kanten selbst: eine Kante gibt es nur, wo die
 * Fortsetzung deutsch ist. `ERLAUBT` schreibt das als Regel auf — zum Prüfen
 * der Daten und um erklären zu können, *warum* ein Wort nicht angeboten wird.
 */

export type Wortart =
  | "artikel" | "adjektiv" | "nomen" | "verb"
  | "adverb" | "praeposition" | "konjunktion" | "punkt"
  // Gelernte Netze (aus einem Korpus gezählt) kennen keine Wortarten: niemand
  // hat sie eingetragen, und raten würde die Sache nur verfälschen. Für sie
  // steht jedes Wort außer dem Punkt auf »unbekannt«.
  | "unbekannt";

export const ART_LABEL: Record<Wortart, string> = {
  artikel: "Artikel",
  adjektiv: "Adjektiv",
  nomen: "Nomen",
  verb: "Verb",
  adverb: "Adverb",
  praeposition: "Präposition",
  konjunktion: "Bindewort",
  punkt: "Satzzeichen",
  unbekannt: "Wort",
};

/**
 * Welche Wortart nach welcher stehen darf — die Satzbaupläne einfacher
 * Hauptsätze. Bewusst knapp gehalten: Nebensätze mit Verb am Ende sind hier
 * nicht vorgesehen, sonst müsste das Netz zwei Wortstellungen können.
 */
export const ERLAUBT: Record<Wortart, Wortart[]> = {
  // »die kleine Katze«, »die Katze«
  artikel: ["adjektiv", "nomen"],
  // »kleine schwarze Katze«
  adjektiv: ["adjektiv", "nomen"],
  // »die Katze schläft«, »… auf dem Sofa.«, »die Katze und …«
  nomen: ["verb", "praeposition", "konjunktion", "punkt"],
  // »schläft gemütlich«, »springt auf …«, »sieht die Maus«, »schläft.«
  verb: ["adverb", "praeposition", "artikel", "punkt"],
  // »leise auf …«, »gemütlich und …«, »schläft leise.«, »zieht langsam näher«
  adverb: ["verb", "praeposition", "artikel", "adjektiv", "adverb", "konjunktion", "punkt"],
  // »auf dem Sofa«, »im warmen Garten« — die verschmolzenen Präpositionen
  // (im, am, vom) tragen den Artikel schon in sich und gehen direkt weiter.
  praeposition: ["artikel", "adjektiv", "nomen"],
  // »und die Katze«, »aber plötzlich«
  konjunktion: ["artikel", "adverb", "nomen"],
  // Nach dem Punkt fängt ein neuer Satz an — der kommt aus der Startliste.
  punkt: [],
  // Gezählte Netze prüft der Satzbauplan nicht: was im Korpus stand, steht im
  // Netz. Die Grammatik kommt dort aus dem Text, nicht aus einer Regel.
  unbekannt: ["unbekannt", "punkt"],
};

/**
 * Fall und Geschlecht eines Wortes — »nom.f«, »dat.m«, »akk.n« und so weiter.
 *
 * Ein Wort darf mehrere tragen: »dem« passt zu Maskulinum *und* Neutrum. Eine
 * Kante ist erlaubt, wenn beide Seiten mindestens ein Merkmal teilen — oder
 * wenn eine Seite gar keines hat (Verben, Adverbien, das Bindewort).
 *
 * Das ist die Prüfung, die der Satzbauplan allein nicht leisten kann: »die«
 * und »Blitz« sind beide Nominativ und trotzdem falsch zusammen. Ohne sie
 * entstehen Sätze, die jeden Test bestehen und trotzdem kein Deutsch sind
 * (»Die schnelle Blitz heult«, »Die gute Torwart fängt«).
 */
export type Merkmal = string;

export type Wort = { id: number; text: string; art: Wortart; merkmale: Merkmal[] };
export type Kandidat = { wort: Wort; p: number };

/** Das Netz, wie es die Oberfläche benutzt: fertig geprüft und normiert. */
export type Netz = {
  slug: string;
  titel: string;
  icon: string;
  prompt: string;
  /**
   * Woher die Zahlen kommen — und das ist der ganze Unterschied:
   *
   *   »kuratiert«  von Hand eingetragen (netze.ts), auf Grammatik geprüft.
   *   »gelernt«    aus einem Text gezählt (trainieren.ts). Niemand hat die
   *                Wahrscheinlichkeiten festgelegt, sie *sind* die Häufigkeiten
   *                im Korpus. So entsteht auch ein echtes Sprachmodell — nur
   *                mit sehr viel mehr Text.
   */
  art: "kuratiert" | "gelernt";
  /**
   * Rückblick: auf wie viele Wörter zugleich geschaut wird (1, 2 oder 3).
   * 1 = gar kein Zusammenhang (Wortsalat), 2 = das letzte Wort (Bigramm),
   * 3 = die letzten zwei (Trigramm).
   */
  n: number;
  woerter: Wort[];
  /** Womit ein Satz anfangen darf. */
  start: Kandidat[];
  /**
   * Was folgen darf. Der Schlüssel ist der Rückblick: die letzten n−1 Wort-Ids
   * mit Komma verbunden (bei n = 1 der leere Schlüssel). Ein Bigramm hat also
   * »17«, ein Trigramm »17,42«.
   */
  folgt: Map<string, Kandidat[]>;
  /** Bei gelernten Netzen: woraus gezählt wurde, und wie viel. */
  quelle?: string;
  statistik?: { woerter: number; verschiedene: number; uebergaenge: number };
};

/** Der Nachschlage-Schlüssel für einen Rückblick von n Wörtern. */
export function schluessel(verlauf: readonly Wort[], n: number): string {
  if (n <= 1) return "";
  return verlauf.slice(-(n - 1)).map(w => w.id).join(",");
}

/** Die Schreibweise der Inhaltsdatei — Gewichte als ganze Zahlen. */
export type NetzRoh = {
  slug: string;
  titel: string;
  icon: string;
  prompt: string;
  woerter: Partial<Record<Wortart, string[]>>;
  /** Fall und Geschlecht je Wort. Wörter ohne Eintrag werden nicht geprüft. */
  merkmale?: Record<string, Merkmal[]>;
  start: Record<string, number>;
  folgt: Record<string, Record<string, number>>;
};

export class NetzFehler extends Error {}

function normiere(roh: Record<string, number>, nach: Map<string, Wort>, wo: string): Kandidat[] {
  const eintraege = Object.entries(roh);
  if (eintraege.length === 0) throw new NetzFehler(`${wo}: keine Fortsetzung angegeben.`);
  let summe = 0;
  for (const [text, gewicht] of eintraege) {
    if (!nach.has(text)) throw new NetzFehler(`${wo}: »${text}« steht in keiner Wortliste.`);
    if (!(gewicht > 0)) throw new NetzFehler(`${wo} → »${text}«: Gewicht muss größer als 0 sein.`);
    summe += gewicht;
  }
  return eintraege
    .map(([text, gewicht]) => ({ wort: nach.get(text)!, p: gewicht / summe }))
    .sort((a, b) => b.p - a.p || a.wort.id - b.wort.id);
}

/**
 * Baut ein Netz aus der Inhaltsdatei — und prüft es dabei streng.
 *
 * Die Prüfung ist der Grund, warum weitere Themen gefahrlos dazukommen
 * können: ein Tippfehler, eine Sackgasse oder eine ungrammatische Kante
 * fliegt beim Bauen auf, nicht erst vor der Klasse.
 */
export function baueNetz(roh: NetzRoh): Netz {
  const woerter: Wort[] = [];
  const nach = new Map<string, Wort>();
  for (const [art, liste] of Object.entries(roh.woerter) as [Wortart, string[]][]) {
    for (const text of liste) {
      if (nach.has(text)) throw new NetzFehler(`${roh.slug}: »${text}« steht doppelt in den Wortlisten.`);
      const wort = { id: woerter.length, text, art, merkmale: roh.merkmale?.[text] ?? [] };
      woerter.push(wort);
      nach.set(text, wort);
    }
  }
  for (const text of Object.keys(roh.merkmale ?? {})) {
    if (!nach.has(text)) throw new NetzFehler(`${roh.slug}/merkmale: »${text}« steht in keiner Wortliste.`);
  }

  const start = normiere(roh.start, nach, `${roh.slug}/start`);
  const folgt = new Map<string, Kandidat[]>();
  for (const [text, ziele] of Object.entries(roh.folgt)) {
    const von = nach.get(text);
    if (!von) throw new NetzFehler(`${roh.slug}/folgt: »${text}« steht in keiner Wortliste.`);
    const kandidaten = normiere(ziele, nach, `${roh.slug}/folgt/${text}`);
    for (const k of kandidaten) {
      if (!ERLAUBT[von.art].includes(k.wort.art)) {
        throw new NetzFehler(
          `${roh.slug}: »${text}« (${ART_LABEL[von.art]}) → »${k.wort.text}« (${ART_LABEL[k.wort.art]}) ` +
          `verstößt gegen den Satzbauplan.`);
      }
      if (von.merkmale.length && k.wort.merkmale.length
          && !von.merkmale.some(m => k.wort.merkmale.includes(m))) {
        throw new NetzFehler(
          `${roh.slug}: »${text}« [${von.merkmale.join(" ")}] → »${k.wort.text}« ` +
          `[${k.wort.merkmale.join(" ")}] passt in Fall oder Geschlecht nicht zusammen.`);
      }
    }
    folgt.set(String(von.id), kandidaten);
  }

  // Keine Sackgassen: nur der Punkt darf ohne Fortsetzung dastehen.
  for (const w of woerter) {
    if (w.art !== "punkt" && !folgt.has(String(w.id))) {
      throw new NetzFehler(`${roh.slug}: »${w.text}« hat keine Fortsetzung — der Text bliebe dort stecken.`);
    }
  }

  // Keine Waisen: was nie erreichbar ist, ist ein Tippfehler.
  const erreicht = new Set<number>(start.map(k => k.wort.id));
  const rand = [...erreicht];
  while (rand.length) {
    const id = rand.pop()!;
    for (const k of folgt.get(String(id)) ?? []) {
      if (!erreicht.has(k.wort.id)) { erreicht.add(k.wort.id); rand.push(k.wort.id); }
    }
  }
  const waisen = woerter.filter(w => !erreicht.has(w.id));
  if (waisen.length) {
    throw new NetzFehler(`${roh.slug}: unerreichbar — ${waisen.map(w => `»${w.text}«`).join(", ")}.`);
  }

  return {
    slug: roh.slug, titel: roh.titel, icon: roh.icon, prompt: roh.prompt,
    art: "kuratiert", n: 2, woerter, start, folgt,
  };
}

/** Wie viele Vorschläge der Regler »Auswahl« zeigt (top-k, 1 bis 6). */
export function anzahlAuswahl(mut: number): number {
  return Math.min(6, Math.max(1, Math.round(mut) + 1));
}

/**
 * Alle Fortsetzungen zu einem Verlauf — mit Rückfallebene.
 *
 * Gefragt wird zuerst mit dem vollen Rückblick (bei einem Trigramm: die
 * letzten zwei Wörter). Steht diese Kombination nicht im Netz, weil sie so im
 * Korpus nie vorkam, wird der Rückblick um ein Wort gekürzt und erneut
 * gefragt — bis notfalls nur noch gezählt wird, wie häufig ein Wort überhaupt
 * ist. Fachleute nennen das Backoff; im Werkzeug ist es der ehrliche Satz
 * »diese Kombination kenne ich nicht, ich schaue kürzer zurück«.
 */
export function fortsetzungen(netz: Netz, verlauf: readonly Wort[]): {
  kandidaten: Kandidat[];
  /** Mit wie vielen Wörtern Rückblick die Antwort kam (≤ netz.n). */
  rueckblick: number;
} {
  const letztes = verlauf[verlauf.length - 1] ?? null;
  // Am Anfang und nach jedem Punkt: ein neuer Satz fängt nicht mitten im alten
  // an, die Startliste ist dafür da.
  if (!letztes || letztes.art === "punkt") return { kandidaten: netz.start, rueckblick: netz.n };
  for (let n = netz.n; n >= 1; n--) {
    const treffer = netz.folgt.get(schluessel(verlauf, n));
    if (treffer?.length) return { kandidaten: treffer, rueckblick: n };
  }
  return { kandidaten: [], rueckblick: 1 };
}

/**
 * Die angebotenen nächsten Wörter — gekürzt auf das, was der Regler zulässt.
 *
 * `verlauf` ist der ganze bisherige Text, nicht nur das letzte Wort: ein
 * Trigramm schaut zwei Wörter zurück, und nur der Verlauf weiß, welche.
 */
export function kandidaten(netz: Netz, verlauf: readonly Wort[], mut: number): Kandidat[] {
  return fortsetzungen(netz, verlauf).kandidaten.slice(0, anzahlAuswahl(mut));
}

/**
 * Wörter, die hier *nicht* stehen dürfen — mit dem Grund.
 *
 * Sie werden blass mit angezeigt, statt weggelassen zu werden: so sieht man
 * die Regel, statt sie zu ahnen. Die Auswahl ist fest (nicht gewürfelt),
 * damit zwei Geräte dasselbe zeigen.
 */
export function lockvoegel(netz: Netz, von: Wort | null, anzahl = 2): { wort: Wort; grund: string }[] {
  // Gelernte Netze haben keine Wortarten — dort gäbe es nichts zu begründen,
  // und ein geratener Grund wäre schlimmer als keiner.
  if (netz.art === "gelernt") return [];
  const erlaubt: readonly Wortart[] = von && von.art !== "punkt"
    ? ERLAUBT[von.art]
    : ["artikel", "adverb", "nomen"];
  const verboten = netz.woerter.filter(w => !erlaubt.includes(w.art) && w.art !== "punkt");
  if (!verboten.length) return [];
  const out: { wort: Wort; grund: string }[] = [];
  const schritt = Math.max(1, Math.floor(verboten.length / anzahl));
  for (let i = 0; i < anzahl; i++) {
    const wort = verboten[((von?.id ?? 0) * 7 + i * schritt) % verboten.length];
    if (out.some(o => o.wort.id === wort.id)) continue;
    const grund = von && von.art !== "punkt"
      ? `Nach »${von.text}« (${ART_LABEL[von.art]}) kann kein ${ART_LABEL[wort.art]} stehen.`
      : `Ein Satz fängt nicht mit einem ${ART_LABEL[wort.art]} an.`;
    out.push({ wort, grund });
  }
  return out;
}

/** Die Maschine würfelt — aber mit gezinkten Würfeln: häufiger heißt öfter. */
export function maschinenwahl(kands: readonly Kandidat[], wuerfel: () => number): Kandidat {
  const summe = kands.reduce((s, k) => s + k.p, 0);
  let z = wuerfel() * summe;
  for (const k of kands) {
    z -= k.p;
    if (z <= 0) return k;
  }
  return kands[kands.length - 1];
}

/**
 * Wie erwartbar ein Text war: das geometrische Mittel der gewählten
 * Wahrscheinlichkeiten (0–1).
 *
 * Nicht das Produkt: das wird mit jedem Wort kleiner, ein langer Text wäre
 * damit automatisch »überraschender« als ein kurzer. Das Mittel ist fair —
 * und es ist genau der Kehrwert dessen, was Fachleute Perplexität nennen.
 */
export function erwartbarkeit(ps: readonly number[]): number {
  if (!ps.length) return 0;
  const logs = ps.reduce((s, p) => s + Math.log(p), 0);
  return Math.exp(logs / ps.length);
}

/** Aus den gewählten Wörtern wird ein Text: Satzanfänge groß, kein Leerzeichen vor dem Punkt. */
export function textAus(gewaehlt: readonly Wort[]): string {
  let out = "";
  let satzanfang = true;
  for (const w of gewaehlt) {
    if (w.art === "punkt") {
      out += w.text;
      satzanfang = true;
      continue;
    }
    if (out) out += " ";
    out += satzanfang ? w.text.charAt(0).toUpperCase() + w.text.slice(1) : w.text;
    satzanfang = false;
  }
  return out;
}
