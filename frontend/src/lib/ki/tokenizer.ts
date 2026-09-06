/**
 * Der Zerleger — wie ein Sprachmodell einen Satz in Stücke schneidet.
 *
 * Ein Modell liest keine Buchstaben und keine Wörter, sondern »Tokens«: Stücke
 * aus einer festen Liste, jedes mit einer Nummer. Häufige Wörter sind ein
 * einziges Stück, seltenere zerfallen in Stamm und Endung, und das Leerzeichen
 * gehört zum Stück *danach* — »die Katze« ist nicht »die«+»Katze«, sondern
 * »die«+»␣Katze«.
 *
 * Ehrlich bleiben: echte Zerleger lernen ihre Liste (BPE) aus Milliarden
 * Zeichen und haben 50 000 bis 200 000 Einträge. Hier steht eine von Hand
 * geschriebene Liste mit gut hundert Stücken — dieselbe Mechanik, ein
 * Spielzeugwortschatz. Die Regel dahinter ist dieselbe: immer das *längste*
 * Stück nehmen, das gerade passt.
 */

/** Häufige ganze Wörter — mit ihrem Leerzeichen davor, wie im Original. */
const GANZE_WOERTER = [
  // Satzanfänge stehen eigens in der Liste: »Die« am Satzanfang und » die«
  // mitten im Satz sind für das Modell zwei verschiedene Stücke.
  "Die", "Der", "Das", "Eine", "Ein",
  " die", " der", " das", " den", " dem", " des",
  " ein", " eine", " einen", " einem", " einer",
  " und", " aber", " oder", " denn",
  " auf", " unter", " hinter", " neben", " in", " vor", " an", " am", " im",
  " über", " durch", " gegen", " mit", " zum", " zur", " nach", " aus",
  " ist", " sind", " war", " waren", " hat", " haben", " wird",
  " sich", " nicht", " sehr", " schon", " noch", " dann", " ganz", " immer",
  " Text", " Katze", " Kater", " Maus", " Sofa", " Fenster", " Sonne",
  " Nacht", " Pfote", " Milch", " Garten", " Dach", " Decke", " Vogel",
  " Kissen", " Baum", " Napf", " Schwanz", " Treppe", " Schatten",
  " Gewitter", " Blitz", " Donner", " Wolke", " Regen", " Himmel", " Wind",
  " Luft", " Straße", " Erde", " Tropfen",
  " Ball", " Tor", " Spiel", " Platz", " Pfiff", " Trainer", " Jubel",
  " Sturm", " Horizont", " Berg", " Wald", " Boden", " Hang", " Ebene",
  " Spieler", " Torwart", " Flügel", " Mittelfeld", " Kasten", " Strafraum", " Tribüne", " Linie", " Bank",
];

/** Stämme: hier bricht ein Wort auseinander, die Endung kommt aus der Liste unten. */
const STAEMME = [
  "Schreib", "Erzähl", "Beschreib",
  " kurz", " lang", " klein", " groß", " schwarz", " weiß", " müd", " warm",
  " weich", " dick", " alt", " neugierig", " leis", " laut", " nass", " hell",
  " dunkel", " schnell", " gemütlich", " plötzlich", " heimlich", " träg",
  " schläf", " spring", " schnurr", " jag", " sitz", " lieg", " träum",
  " beobacht", " wart", " gähn", " fauch", " putz", " streck", " zuck",
  " donner", " blitz", " regn", " tropf", " zieh", " weh",
  " renn", " schieß", " tref", " jubel", " pfeif", " pass",
];

/** Endungen und Fugen — die kleinen Stücke, die an Stämme andocken. */
const ENDUNGEN = [
  "e", "en", "er", "es", "em", "n", "t", "st", "te", "ten", "et",
  "chen", "lich", "ig", "ung", "ge", "ke", "kt", "ss", "ß",
];

/** Satzzeichen und Ziffern — sie stehen immer für sich allein. */
const ZEICHEN = [".", ",", "!", "?", ":", ";", "-", "…", " "];

/**
 * Die ganze Liste. Die Reihenfolge legt die Nummern fest: einmal vergeben,
 * bleiben sie gleich — sonst würde derselbe Satz morgen andere Zahlen ergeben.
 */
export const VOKABULAR: readonly string[] = [
  ...GANZE_WOERTER, ...STAEMME, ...ENDUNGEN, ...ZEICHEN,
];

/** Nummern beginnen bei 1000, damit sie nicht mit Zeichencodes kollidieren. */
const ID_BASIS = 1000;

const NACH_TEXT = new Map<string, number>();
VOKABULAR.forEach((t, i) => { if (!NACH_TEXT.has(t)) NACH_TEXT.set(t, ID_BASIS + i); });
const MAX_LAENGE = Math.max(...VOKABULAR.map(t => t.length));

export type Token = {
  /** Das Stück, wie es im Text steht — aneinandergehängt ergibt es das Original. */
  text: string;
  /** Die Nummer aus der Liste. Unbekannte Zeichen bekommen ihren Zeichencode. */
  id: number;
  /** Wo das Stück im Text beginnt (Zeichenindex). */
  start: number;
  /** Stand das Stück in der Liste, oder ist es nur ein einzelnes Zeichen? */
  bekannt: boolean;
};

/**
 * Zerlegt einen Text — an jeder Stelle das längste passende Stück.
 *
 * Was nicht in der Liste steht, wird Zeichen für Zeichen durchgereicht. Damit
 * gilt immer: die Stücke wieder aneinandergehängt ergeben genau den Eingabetext.
 */
export function zerlege(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    let treffer: string | null = null;
    for (let len = Math.min(MAX_LAENGE, text.length - i); len > 0; len--) {
      const stueck = text.slice(i, i + len);
      if (NACH_TEXT.has(stueck)) { treffer = stueck; break; }
    }
    if (treffer) {
      out.push({ text: treffer, id: NACH_TEXT.get(treffer)!, start: i, bekannt: true });
      i += treffer.length;
    } else {
      const c = text[i];
      out.push({ text: c, id: c.charCodeAt(0), start: i, bekannt: false });
      i += 1;
    }
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
