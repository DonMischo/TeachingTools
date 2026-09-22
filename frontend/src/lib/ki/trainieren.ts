/**
 * Trainieren — ein Netz aus einem Text zählen.
 *
 * Hier steckt die Antwort auf die Frage, die das kuratierte Netz offen lässt:
 * **woher kommen die Zahlen?** Niemand trägt sie ein. Man liest einen Text und
 * zählt mit, welches Wort auf welches folgt. Mehr ist es nicht — und genau so
 * ist auch das erste Sprachmodell entstanden, das je gebaut wurde.
 *
 * Der ehrliche Unterschied zu heutigen Modellen ist nicht die Idee, sondern
 * die Menge: wir zählen ein paar hundert Wörter, GPT & Co. haben Billionen
 * gesehen und speichern das Gezählte nicht als Liste, sondern in Gewichten
 * eines neuronalen Netzes. Das Prinzip — häufig Gesehenes wird wahrscheinlich —
 * ist dasselbe.
 *
 * Was man an einem selbst gezählten Netz sofort sieht:
 *   • Zu wenig Text → das Netz plappert den Korpus auswendig nach.
 *   • Anderer Text → andere »Persönlichkeit«, ohne eine Zeile Programm.
 *   • Ein Satz, der nur einmal vorkam, kommt wörtlich wieder — das ist das
 *     Thema »Was hat das Modell auswendig gelernt?« zum Anfassen.
 */
import type { Kandidat, Netz, Wort } from "./wortnetz";

/** Satzzeichen, die einen Satz beenden — alle drei werden zum Wort ».«. */
const SATZENDE = /[.!?]+$/;

/**
 * Text in Wörter zerlegen.
 *
 * Kein Tokenizer im Sinne von Station 2: dort ging es um die Stücke *unter*
 * dem Wort. Hier zählt das Wort selbst, weil das Netz Wörter verbindet.
 * Satzzeichen am Wortende werden zu einem eigenen ».«, damit das Netz weiß,
 * wo ein Satz aufhört.
 */
export function woerterAus(text: string): string[] {
  const out: string[] = [];
  for (const roh of text.split(/\s+/)) {
    if (!roh) continue;
    // Erst das Satzende abtrennen, dann den Rest putzen: sonst bliebe bei
    // »(leise).« die Klammer am Wort kleben, weil sie nicht mehr am Ende steht.
    const ende = SATZENDE.test(roh);
    // Anführungszeichen und Klammern fallen weg: sie verdoppelten sonst jedes
    // Wort (»Katze« und Katze wären zwei verschiedene).
    const kern = roh
      .replace(SATZENDE, "")
      .replace(/^[«»"„“‚‘(\[]+/, "")
      .replace(/[«»"„“‚‘)\],;:]+$/, "");
    if (kern) out.push(kern);
    if (ende) out.push(".");
  }
  return out;
}

export type Korpus = {
  slug: string;
  titel: string;
  icon: string;
  /** Worum es geht — ohne das raet man beim Ratespiel ins Blaue. */
  beschreibung: string;
  text: string;
};

/**
 * Zählt die Übergänge und baut daraus ein Netz.
 *
 * `n` ist der Rückblick: 1 zählt nur, wie häufig ein Wort überhaupt ist
 * (Wortsalat), 2 zählt Paare (Bigramm), 3 zählt Dreiergruppen (Trigramm).
 */
export function trainiere(text: string, n: number, quelle = "eigener Text"): Netz {
  const folge = woerterAus(text);
  const woerter: Wort[] = [];
  const nach = new Map<string, Wort>();
  const hole = (t: string): Wort => {
    let w = nach.get(t);
    if (!w) {
      w = { id: woerter.length, text: t, art: t === "." ? "punkt" : "unbekannt", merkmale: [] };
      woerter.push(w);
      nach.set(t, w);
    }
    return w;
  };

  // Jedes Wort bekommt seine Id, sobald es zum ersten Mal auftaucht.
  const ids = folge.map(t => hole(t).id);

  // Startliste: das erste Wort des Textes und jedes Wort nach einem Punkt.
  const start = new Map<number, number>();
  const zaehle = (m: Map<number, number>, id: number) => m.set(id, (m.get(id) ?? 0) + 1);
  if (ids.length) zaehle(start, ids[0]);
  for (let i = 0; i < ids.length - 1; i++) {
    if (woerter[ids[i]].art === "punkt") zaehle(start, ids[i + 1]);
  }

  // Übergänge für *jeden* Rückblick bis n zählen, nicht nur für n selbst: die
  // kürzeren sind die Rückfallebene, wenn eine lange Kombination fehlt.
  const roh = new Map<string, Map<number, number>>();
  for (let rueckblick = 1; rueckblick <= n; rueckblick++) {
    // Der Schlüssel besteht aus den letzten rueckblick−1 Wörtern vor der
    // Vorhersage; bei rueckblick = 1 ist er leer (»zähl einfach die Wörter«).
    const kontext = rueckblick - 1;
    for (let i = Math.max(kontext - 1, 0); i < ids.length - 1; i++) {
      // Über einen Punkt hinweg wird nicht gezählt — der nächste Satz hängt
      // nicht am letzten Wort des vorigen, dafür gibt es die Startliste.
      if (woerter[ids[i]].art === "punkt") continue;
      const teil = ids.slice(i - kontext + 1, i + 1);
      if (teil.some(id => woerter[id].art === "punkt")) continue;
      const key = kontext === 0 ? "" : teil.join(",");
      const eintrag = roh.get(key) ?? new Map<number, number>();
      zaehle(eintrag, ids[i + 1]);
      roh.set(key, eintrag);
    }
  }

  const normiere = (m: Map<number, number>): Kandidat[] => {
    const summe = [...m.values()].reduce((a, b) => a + b, 0);
    return [...m.entries()]
      .map(([id, anzahl]) => ({ wort: woerter[id], p: anzahl / summe }))
      .sort((a, b) => b.p - a.p || a.wort.id - b.wort.id);
  };

  const folgt = new Map<string, Kandidat[]>();
  for (const [key, m] of roh) folgt.set(key, normiere(m));

  return {
    slug: `gelernt-${n}`,
    titel: quelle,
    icon: "🧪",
    prompt: `Schreibe weiter wie in »${quelle}«.`,
    art: "gelernt",
    n,
    woerter,
    start: start.size ? normiere(start) : [],
    folgt,
    quelle,
    statistik: {
      woerter: folge.length,
      verschiedene: woerter.length,
      uebergaenge: [...roh.values()].reduce((s, m) => s + m.size, 0),
    },
  };
}

/**
 * Wie viele verschiedene Texte einer bestimmten Länge das Netz schreiben kann.
 *
 * Gezählt werden die Wege durch das Netz — bei jedem Wort verzweigt es sich so
 * oft, wie es Fortsetzungen gibt. Die Zahl wächst deshalb wie eine Potenz und
 * ist nach wenigen Wörtern größer als alles, was man sich vorstellen kann. Das
 * ist die Antwort auf »würfelt das nicht immer dasselbe?«.
 *
 * Gerechnet wird mit gewöhnlichen Kommazahlen: Die Zahl soll staunen machen,
 * nicht bis zur letzten Stelle stimmen — und eine Zahl mit 40 Nullen liest
 * ohnehin niemand Ziffer für Ziffer.
 */
export function wegeAnzahl(netz: Netz, laenge: number): number {
  // wege[id] = wie viele Texte von diesem Wort aus noch möglich sind.
  let wege = new Map<number, number>(netz.woerter.map(w => [w.id, 1]));
  for (let schritt = 0; schritt < laenge; schritt++) {
    const naechste = new Map<number, number>();
    for (const w of netz.woerter) {
      // Ein Wort Rückblick genügt hier — die Größenordnung stimmt auch so.
      const ks = netz.folgt.get(String(w.id)) ?? [];
      let summe = 0;
      for (const k of ks) summe += wege.get(k.wort.id) ?? 1;
      naechste.set(w.id, summe || 1);
    }
    wege = naechste;
  }
  let gesamt = 0;
  for (const k of netz.start) gesamt += wege.get(k.wort.id) ?? 1;
  return gesamt;
}

/** Große Zahlen lesbar machen: »ungefähr 4 Billionen« statt 17 Ziffern. */
export function zahlwort(n: number): string {
  const stufen: [number, string][] = [
    [1e18, "Trillionen"], [1e15, "Billiarden"], [1e12, "Billionen"],
    [1e9, "Milliarden"], [1e6, "Millionen"], [1e3, "Tausend"],
  ];
  if (!Number.isFinite(n)) return "mehr, als sich zählen lässt";
  // Jenseits der Trillionen hört auch die Sprache auf — dann die Zehnerpotenz.
  if (n >= 1e21) return `10 hoch ${Math.floor(Math.log10(n))}`;
  for (const [wert, name] of stufen) {
    if (n >= wert) return `${(n / wert).toFixed(1).replace(".", ",")} ${name}`;
  }
  return String(Math.round(n));
}
