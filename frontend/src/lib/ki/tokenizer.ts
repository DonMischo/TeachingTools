/**
 * Der Zerleger — wie ein Sprachmodell einen Satz in Stücke schneidet.
 *
 * Ein Modell liest keine Buchstaben und keine Wörter, sondern »Tokens«: Stücke
 * aus einer festen Liste, jedes mit einer Nummer. Häufige Wörter sind ein
 * einziges Stück, seltenere zerfallen in Stamm und Endung, und Leerzeichen und
 * Satzzeichen hängen am Wort *davor* — »die Katze.« ist nicht
 * »die«+»␣«+»Katze«+».«, sondern »die␣«+»Katze.«.
 *
 * Ehrlich bleiben: echte Zerleger lernen ihre Liste (BPE) aus Milliarden
 * Zeichen und haben 50 000 bis 200 000 Einträge. Hier steht eine von Hand
 * geschriebene Liste mit gut hundert Stücken — dieselbe Mechanik, ein
 * Spielzeugwortschatz. Wörter, die nicht in der Liste stehen, bleiben ein
 * Stück, statt in Buchstaben zu zerfallen.
 */

/** Häufige ganze Wörter — ohne Leerzeichen; das hängt beim Zerlegen hinten dran. */
const KLEINE_WOERTER = [
  // Satzanfänge stehen eigens in der Liste: »Die« am Satzanfang und »die«
  // mitten im Satz sind für das Modell zwei verschiedene Stücke.
  "Die", "Der", "Das", "Eine", "Ein",
  "die", "der", "das", "den", "dem", "des",
  "ein", "eine", "einen", "einem", "einer",
  "und", "aber", "oder", "denn",
  "auf", "unter", "hinter", "neben", "in", "vor", "an", "am", "im",
  "über", "durch", "gegen", "mit", "zum", "zur", "nach", "aus",
  "ist", "sind", "war", "waren", "hat", "haben", "wird",
  "sich", "nicht", "sehr", "schon", "noch", "dann", "ganz", "immer",
];

/** Nomen — nur hinter ihnen darf ein zusammengesetztes Wort aufbrechen (»Fenster« + »bank«). */
const NOMEN = [
  "Text", "Katze", "Kater", "Maus", "Sofa", "Fenster", "Sonne",
  "Nacht", "Pfote", "Milch", "Garten", "Dach", "Decke", "Vogel",
  "Kissen", "Baum", "Napf", "Schwanz", "Treppe", "Schatten",
  "Gewitter", "Blitz", "Donner", "Wolke", "Regen", "Himmel", "Wind",
  "Luft", "Straße", "Erde", "Tropfen",
  "Ball", "Tor", "Spiel", "Platz", "Pfiff", "Trainer", "Jubel",
  "Sturm", "Horizont", "Berg", "Wald", "Boden", "Hang", "Ebene",
  "Spieler", "Torwart", "Flügel", "Mittelfeld", "Kasten", "Strafraum", "Tribüne", "Linie", "Bank",
];

/** Stämme: hier bricht ein Wort auseinander, die Endung kommt aus der Liste unten. */
const STAEMME = [
  "Schreib", "Erzähl", "Beschreib",
  "kurz", "lang", "klein", "groß", "schwarz", "weiß", "müd", "warm",
  "weich", "dick", "alt", "neugierig", "leis", "laut", "nass", "hell",
  "dunkel", "schnell", "gemütlich", "plötzlich", "heimlich", "träg",
  "schläf", "spring", "schnurr", "jag", "sitz", "lieg", "träum",
  "beobacht", "wart", "gähn", "fauch", "putz", "streck", "zuck",
  "donner", "blitz", "regn", "tropf", "zieh", "weh",
  "renn", "schieß", "tref", "jubel", "pfeif", "pass",
];

/** Endungen und Fugen — die kleinen Stücke, die an Stämme andocken. */
const ENDUNGEN = [
  "e", "en", "er", "es", "em", "n", "t", "st", "te", "ten", "et",
  "chen", "lich", "ig", "ung", "ge", "ke", "kt", "ss", "ß",
];

/** Satzzeichen — für sich allein nur, wenn kein Wort davorsteht (»„«, »-«). */
const ZEICHEN = [".", ",", "!", "?", ":", ";", "-", "…", " "];

/** Später ergänzte Stämme — hinten angehängt, damit die alten Nummern bleiben. */
const NACHTRAG = ["Kätz"];

/**
 * Die ganze Liste. Die Reihenfolge legt die Nummern fest: einmal vergeben,
 * bleiben sie gleich — sonst würde derselbe Satz morgen andere Zahlen ergeben.
 */
export const VOKABULAR: readonly string[] = [
  ...KLEINE_WOERTER, ...NOMEN, ...STAEMME, ...ENDUNGEN, ...ZEICHEN, ...NACHTRAG,
];

/** Nummern beginnen bei 1000, damit sie nicht mit Zeichencodes kollidieren. */
const ID_BASIS = 1000;

const NACH_TEXT = new Map<string, number>();
VOKABULAR.forEach((t, i) => { if (!NACH_TEXT.has(t)) NACH_TEXT.set(t, ID_BASIS + i); });
/** Was vorne an einem Wort stehen darf: ganze Wörter und Stämme. */
const ANFAENGE = new Set([...KLEINE_WOERTER, ...NOMEN, ...STAEMME, ...NACHTRAG]);
const ENDUNG = new Set(ENDUNGEN);
const NOMEN_SET = new Set(NOMEN);

/**
 * Was hinten an einem Wort hängen kann. »Katze␣«, »Katze.« und »Katze,␣« sind
 * drei verschiedene Stücke mit drei Nummern — die Nummer setzt sich aus dem
 * Wort und seinem Anhang zusammen, so bleibt »Katze« in allen Formen erkennbar.
 */
const ANHAENGE = ["", " ", ".", ". ", ",", ", ", "!", "! ", "?", "? ", ":", ": ", ";", "; ", "-", "…", "… "];
const ANHANG_NR = new Map(ANHAENGE.map((a, i) => [a, i]));

export type Token = {
  /** Das Stück, wie es im Text steht — aneinandergehängt ergibt es das Original. */
  text: string;
  /** Die Nummer aus der Liste. Unbekannte Stücke bekommen eine ausgedachte, feste Nummer. */
  id: number;
  /** Wo das Stück im Text beginnt (Zeichenindex). */
  start: number;
  /** Stand das Stück in der Liste? */
  bekannt: boolean;
};

/**
 * Feste Nummer für ein Stück, das nicht in der Liste steht. Ein echter Zerleger
 * hätte »Fußballspiel« in seinen 100 000 Einträgen; hier steht eine Zahl aus
 * dem Wort selbst dafür — derselbe Text ergibt immer dieselbe Nummer.
 * Einzelne Zeichen behalten ihren Zeichencode.
 */
function fremdId(s: string): number {
  if (s.length === 1) return s.charCodeAt(0);
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return 50000 + ((h >>> 0) % 50000);
}

/**
 * Ein Wort (ohne Anhang) in Stücke: ganz, wenn es in der Liste steht; sonst
 * Stamm + Endung (»kurz« + »en«) oder Nomen + Rest (»Fenster« + »bank«); und
 * wenn nichts davon passt, bleibt es ein Stück. Einzelne Buchstaben entstehen
 * so nie — kein Zerleger schneidet ein Wort, das er oft gesehen hat, in lauter
 * Buchstaben.
 */
function zerlegeWort(wort: string): string[] {
  if (NACH_TEXT.has(wort)) return [wort];
  for (let len = wort.length - 1; len > 1; len--) {
    const vorne = wort.slice(0, len);
    const rest = wort.slice(len);
    if (!ANFAENGE.has(vorne)) continue;
    if (ENDUNG.has(rest)) return [vorne, rest];
    // Zusammengesetzte Nomen: nur hinter einem ganzen Nomen und mit einem Rest,
    // der selbst nach Wort aussieht — sonst wird »an« + »gst« daraus.
    if (NOMEN_SET.has(vorne) && rest.length >= 3) return [vorne, rest];
  }
  return [wort];
}

/** Nummer eines Stücks: Listenplatz plus Anhang, sonst eine ausgedachte. */
function nummer(kern: string, anhang: string): { id: number; bekannt: boolean } {
  const platz = NACH_TEXT.get(kern);
  const nr = ANHANG_NR.get(anhang);
  if (platz !== undefined && nr !== undefined) {
    return { id: platz + nr * VOKABULAR.length, bekannt: true };
  }
  return { id: fremdId(kern + anhang), bekannt: false };
}

/**
 * Zerlegt einen Text. Erst in Wörter — Satzzeichen und ein Leerzeichen hängen
 * am Wort davor —, dann jedes Wort nach der Liste; der Anhang geht ans letzte
 * Stück (»kurz« + »en␣«). Es gilt immer: die Stücke wieder aneinandergehängt
 * ergeben genau den Eingabetext.
 */
export function zerlege(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(/([\p{L}\p{N}]+)([^\s\p{L}\p{N}]*\s?)|[^]/gu)) {
    let start = m.index!;
    const kern = m[1] ?? m[0];
    const anhang = m[1] ? m[2] : "";
    const stuecke = zerlegeWort(kern);
    stuecke.forEach((stueck, i) => {
      const a = i === stuecke.length - 1 ? anhang : "";
      out.push({ text: stueck + a, ...nummer(stueck, a), start });
      start += stueck.length + a.length;
    });
  }
  return out;
}

/**
 * Die Schnittstellen einer Zerlegung als Zeichenindizes.
 *
 * Der Anfang und das Ende zählen nicht mit: dort schneidet niemand, das wäre
 * im Minispiel ein geschenkter Punkt.
 */
export function schnitte(tokens: readonly Token[]): number[] {
  return tokens.slice(1).map(t => t.start);
}

export type Wertung = {
  /** Schnitte, die sitzen. */
  treffer: number[];
  /** Schnitte der Maschine, die übersehen wurden. */
  verpasst: number[];
  /** Eigene Schnitte, wo die Maschine keinen setzt. */
  daneben: number[];
  /** 0–100, gerundet: Treffer gegen alles, was zusammenkommt. */
  quote: number;
};

/** Vergleicht die eigenen Schnitte mit denen der Maschine. */
export function bewerte(eigene: Iterable<number>, echte: Iterable<number>): Wertung {
  const meine = new Set(eigene);
  const ihre = new Set(echte);
  const treffer = [...ihre].filter(s => meine.has(s)).sort((a, b) => a - b);
  const verpasst = [...ihre].filter(s => !meine.has(s)).sort((a, b) => a - b);
  const daneben = [...meine].filter(s => !ihre.has(s)).sort((a, b) => a - b);
  const gesamt = treffer.length + verpasst.length + daneben.length;
  return {
    treffer, verpasst, daneben,
    quote: gesamt === 0 ? 100 : Math.round((treffer.length / gesamt) * 100),
  };
}
