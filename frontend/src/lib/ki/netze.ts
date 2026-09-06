/**
 * Die Wortnetze — der Inhalt zum Motor in `wortnetz.ts`.
 *
 * ───────────────────────── Bauanleitung für neue Themen ─────────────────────
 *
 * Das Netz kennt immer nur **das letzte Wort**. Es kann sich also nichts
 * merken — nicht das Geschlecht, nicht den Fall, nicht die Satzstellung. Damit
 * trotzdem jeder mögliche Weg deutsch bleibt, gilt eine einzige Regel:
 *
 *   **Ein Wort hat genau eine Rolle.** Wo dieselbe Form zwei Rollen hätte,
 *   nimmt man sie nur in einer davon auf.
 *
 * Daraus folgt für den Bau:
 *
 *   1. **Artikelwege trennen.** Nominativ (»die, der, das, eine«) und Dativ
 *      (»dem, einem, einer«) sind getrennte Wege. »der« wird hier *nur* als
 *      Nominativ Maskulinum benutzt, der Dativ Femininum heißt deshalb immer
 *      »einer« — sonst hinge an »der« beides und »auf der Kater« wäre möglich.
 *   2. **Adjektive gehören zu einem Weg.** Nach »die/eine« steht die Endung
 *      -e, nach »dem/einem« die Endung -en. Beide Listen sind verschieden
 *      geschrieben und werden nie gemischt.
 *   3. **Adjektive tragen das Geschlecht nicht weiter.** »die kleine« darf nur
 *      zu femininen Nomen führen. Wo ein Weg das nicht einhalten könnte
 *      (»der«, »das«), führt er ohne Adjektiv direkt zum Nomen — Adjektive
 *      bekommt im Nominativ deshalb nur der feminine Weg.
 *   4. **Nomen haben eine Rolle.** Subjektnomen führen zu Verben, Ortsnomen
 *      zum Punkt (oder zu einer weiteren Ortsangabe). Ein Nomen in beiden
 *      Rollen erlaubte »schläft auf dem Sofa schnurrt«.
 *   5. **Keine Umstellung.** Sätze fangen mit dem Subjekt an. »Plötzlich
 *      springt die Katze« bräuchte ein Modell, das weiter zurückschaut als bis
 *      zum letzten Wort — genau das ist der ehrliche Unterschied zu einem
 *      echten Sprachmodell, und er steht auch so im Hilfetext.
 *   6. **Verschmolzene Präpositionen** (»im, am, vom«) gehen direkt zum Nomen,
 *      nicht zum Artikel.
 *   7. **Jedes Verb hängt an seinem Subjekt.** `folgt` steht je Wort, also darf
 *      »Blitz« zu »zuckt« führen und »Regen« zu »prasselt«, ohne dass »Der
 *      Regen zuckt« möglich wird. Nur so bleiben die Sätze auch inhaltlich
 *      brauchbar — Grammatik prüft die Maschine, Sinn nicht.
 *   8. **Nur Präpositionen mit Dativ** (auf, über, unter, hinter, neben, vor,
 *      an, im, am, vom). »gegen« und »durch« verlangen den Akkusativ und
 *      bräuchten einen eigenen Artikelweg.
 *   9. **Von »dem/einem« aus nur Orte, die mit jeder Präposition davor Sinn
 *      ergeben.** Was nur zu »im«/»am« passt (»im Wald«, »am Himmel«), hängt
 *      ausschließlich dort — »unter dem Himmel« wäre tadellos und trotzdem
 *      Unsinn.
 *
 * **`merkmale` ist Pflicht für Artikel, Adjektive, Nomen und Präpositionen.**
 * Dort stehen Fall und Geschlecht (»nom.f«, »dat.m«, …); `baueNetz` lässt eine
 * Kante nur zu, wenn beide Seiten mindestens ein Merkmal teilen. Das ist die
 * einzige Prüfung, die »Die schnelle Blitz« oder »Die gute Torwart« abfängt —
 * der Satzbauplan allein hält beides für richtig. Ein Nomen kann außerdem
 * nicht zugleich Subjekt (nom.*) und Ort (dat.*) sein, damit prüft sich
 * Regel 4 von selbst mit.
 *
 * Was die Prüfung *nicht* kann, ist Sinn: »Der Blitz heult« besteht jeden
 * Test. Deshalb nach jeder Änderung ein paar Dutzend Proben lesen.
 */
import { baueNetz, type Netz, type NetzRoh } from "./wortnetz";

const KATZE: NetzRoh = {
  slug: "katze",
  titel: "Katze",
  icon: "🐈",
  prompt: "Schreibe einen kurzen Text über eine Katze.",
  woerter: {
    artikel: ["die", "der", "das", "eine", "dem", "einem", "einer"],
    adjektiv: [
      // Nominativ, nur auf dem femininen Weg (nach »die/eine«) …
      "kleine", "schwarze", "müde", "neugierige", "dicke", "junge", "wilde",
      // … und Dativ (nach »dem/einem«).
      "kleinen", "warmen", "weichen", "alten", "sonnigen", "dunklen",
    ],
    nomen: [
      // Subjekte …
      "Katze", "Maus", "Kätzchen", "Kater", "Vogel",
      // … Orte (maskulin/neutrum) …
      "Sofa", "Kissen", "Fenster", "Dach", "Baum", "Garten", "Napf", "Schatten", "Teppich",
      // … und Orte (feminin, immer ohne Adjektiv).
      "Decke", "Treppe", "Fensterbank",
    ],
    verb: ["schläft", "schnurrt", "sitzt", "liegt", "träumt", "gähnt", "wartet"],
    adverb: ["gemütlich", "leise", "zufrieden", "stundenlang", "träge", "heimlich", "geduldig"],
    praeposition: ["auf", "unter", "hinter", "neben", "vor", "im", "am", "vom"],
    konjunktion: ["und"],
    punkt: ["."],
  },
  merkmale: {
    die: ["nom.f"], eine: ["nom.f"], der: ["nom.m"], das: ["nom.n"],
    dem: ["dat.m", "dat.n"], einem: ["dat.m", "dat.n"], einer: ["dat.f"],

    kleine: ["nom.f"], schwarze: ["nom.f"], müde: ["nom.f"], neugierige: ["nom.f"],
    dicke: ["nom.f"], junge: ["nom.f"], wilde: ["nom.f"],
    kleinen: ["dat.m", "dat.n"], warmen: ["dat.m", "dat.n"], weichen: ["dat.m", "dat.n"],
    alten: ["dat.m", "dat.n"], sonnigen: ["dat.m", "dat.n"], dunklen: ["dat.m", "dat.n"],

    Katze: ["nom.f"], Maus: ["nom.f"], Kätzchen: ["nom.n"], Kater: ["nom.m"], Vogel: ["nom.m"],
    Sofa: ["dat.n"], Kissen: ["dat.n"], Fenster: ["dat.n"], Dach: ["dat.n"],
    Baum: ["dat.m"], Garten: ["dat.m"], Napf: ["dat.m"], Schatten: ["dat.m"], Teppich: ["dat.m"],
    Decke: ["dat.f"], Treppe: ["dat.f"], Fensterbank: ["dat.f"],

    auf: ["dat.m", "dat.n", "dat.f"], unter: ["dat.m", "dat.n", "dat.f"],
    hinter: ["dat.m", "dat.n", "dat.f"], neben: ["dat.m", "dat.n", "dat.f"],
    vor: ["dat.m", "dat.n", "dat.f"],
    im: ["dat.m", "dat.n"], am: ["dat.m", "dat.n"], vom: ["dat.m", "dat.n"],
  },
  start: { die: 6, eine: 3, der: 3, das: 2 },
  folgt: {
    // ── Artikel ───────────────────────────────────────────────────────────
    die: { Katze: 6, Maus: 2, kleine: 4, schwarze: 3, müde: 2, neugierige: 2, dicke: 1, junge: 1, wilde: 1 },
    eine: { Katze: 4, Maus: 3, kleine: 3, schwarze: 2, neugierige: 2, junge: 2, wilde: 1, dicke: 1, müde: 1 },
    der: { Kater: 6, Vogel: 2 },
    das: { Kätzchen: 6 },
    // »dem/einem« führen nur zu Orten, die mit *jeder* Präposition davor Sinn
    // ergeben. Garten, Schatten und Fenster stehen deshalb nicht dabei: »unter
    // dem Garten« wäre grammatisch tadellos und trotzdem Unsinn. Sie hängen
    // weiter unten an »im« und »am«.
    dem: { warmen: 4, weichen: 3, alten: 2, sonnigen: 2, dunklen: 2, kleinen: 1, Sofa: 4, Kissen: 3, Dach: 2, Baum: 2, Teppich: 1, Napf: 1 },
    einem: { warmen: 4, weichen: 3, sonnigen: 2, dunklen: 2, alten: 1, kleinen: 1, Kissen: 3, Baum: 2, Dach: 2, Napf: 2, Teppich: 1, Sofa: 2 },
    einer: { Decke: 4, Treppe: 2, Fensterbank: 2 },

    // ── Adjektive, Nominativ ──────────────────────────────────────────────
    kleine: { Katze: 6, Maus: 3, schwarze: 2, müde: 1, wilde: 1 },
    schwarze: { Katze: 6, Maus: 2, kleine: 2, müde: 1 },
    müde: { Katze: 6, Maus: 2, kleine: 1 },
    neugierige: { Katze: 5, Maus: 3, kleine: 1, schwarze: 1 },
    dicke: { Katze: 5, Maus: 2, schwarze: 1 },
    junge: { Katze: 5, Maus: 2, wilde: 1, schwarze: 1 },
    wilde: { Katze: 4, Maus: 3, kleine: 1 },

    // ── Adjektive, Dativ ──────────────────────────────────────────────────
    warmen: { Kissen: 4, Sofa: 3, Teppich: 2, Dach: 2, Napf: 1 },
    weichen: { Kissen: 5, Sofa: 3, Teppich: 2 },
    kleinen: { Napf: 3, Kissen: 2, Teppich: 2, Baum: 1 },
    alten: { Sofa: 4, Baum: 3, Teppich: 2, Dach: 2 },
    sonnigen: { Dach: 3, Sofa: 2, Kissen: 2, Baum: 1 },
    dunklen: { Baum: 3, Dach: 2, Sofa: 2, Teppich: 1 },

    // ── Subjektnomen ──────────────────────────────────────────────────────
    // Kein »und« hinter dem Subjekt: »die Maus und die Katze träumt« wäre
    // grammatisch daneben (zwei Subjekte, ein Verb in der Einzahl). Das »und«
    // hängt deshalb erst hinter dem fertigen Satzteil.
    Katze: { schläft: 5, schnurrt: 4, sitzt: 3, liegt: 3, träumt: 2, gähnt: 2, wartet: 2 },
    Maus: { wartet: 4, sitzt: 3, schläft: 2, träumt: 2 },
    Kätzchen: { schläft: 4, schnurrt: 4, gähnt: 3, träumt: 2, liegt: 2 },
    Kater: { schnurrt: 4, schläft: 4, gähnt: 3, sitzt: 2, liegt: 2, träumt: 2 },
    Vogel: { sitzt: 4, wartet: 3, schläft: 2 },

    // ── Verben ────────────────────────────────────────────────────────────
    schläft: { auf: 5, ".": 3, gemütlich: 3, im: 2, stundenlang: 2, zufrieden: 2, unter: 2, am: 1, träge: 1, neben: 1 },
    schnurrt: { leise: 4, zufrieden: 3, ".": 3, auf: 3, gemütlich: 2, im: 1, neben: 1 },
    sitzt: { auf: 4, am: 3, ".": 2, unter: 2, vor: 2, hinter: 2, neben: 1, im: 1, geduldig: 1 },
    liegt: { auf: 5, im: 3, ".": 2, unter: 2, gemütlich: 2, träge: 1, neben: 1 },
    träumt: { vom: 3, stundenlang: 3, ".": 3, leise: 2, auf: 2, im: 1 },
    gähnt: { ".": 4, leise: 3, träge: 3, zufrieden: 2 },
    wartet: { geduldig: 3, vor: 3, ".": 3, unter: 2, hinter: 2, leise: 2, heimlich: 2, am: 1 },

    // ── Adverbien ─────────────────────────────────────────────────────────
    gemütlich: { ".": 5, auf: 3, im: 2, und: 2, unter: 1, neben: 1 },
    leise: { ".": 4, auf: 2, im: 2, und: 2, hinter: 1, neben: 1 },
    zufrieden: { ".": 5, auf: 2, im: 2, und: 2 },
    stundenlang: { ".": 4, auf: 3, im: 2, und: 1, vor: 1 },
    träge: { ".": 4, auf: 2, im: 2, und: 1 },
    heimlich: { ".": 3, hinter: 3, unter: 2, und: 1 },
    geduldig: { ".": 4, vor: 3, unter: 2, und: 1 },

    // ── Präpositionen ─────────────────────────────────────────────────────
    auf: { dem: 6, einem: 3, einer: 2 },
    unter: { dem: 6, einem: 3, einer: 2 },
    hinter: { dem: 5, einem: 3, einer: 2 },
    neben: { dem: 5, einem: 3, einer: 2 },
    vor: { dem: 5, einem: 3, einer: 2 },
    // Die verschmolzenen Präpositionen gehen ohne Artikel weiter: sie haben je
    // nur eine Handvoll Orte, die zu ihnen passen.
    im: { Garten: 5, Schatten: 3 },
    am: { Fenster: 5, Baum: 2, Napf: 1 },
    vom: { Napf: 3, Kissen: 3, Garten: 2, Baum: 1 },

    // ── Bindewort und Ortsnomen ───────────────────────────────────────────
    und: { die: 6, der: 3, das: 2, eine: 2 },
    Sofa: { ".": 6, und: 2, unter: 1, neben: 1 },
    Kissen: { ".": 6, und: 2, neben: 1 },
    Fenster: { ".": 6, und: 2, im: 1 },
    Dach: { ".": 6, und: 2, im: 1 },
    Baum: { ".": 6, und: 2, im: 1 },
    Garten: { ".": 6, und: 2, unter: 1, neben: 1 },
    Napf: { ".": 6, und: 2, neben: 1 },
    Schatten: { ".": 6, und: 2, neben: 1 },
    Teppich: { ".": 6, und: 2, neben: 1 },
    Decke: { ".": 6, und: 2, neben: 1 },
    Treppe: { ".": 6, und: 2, neben: 1 },
    Fensterbank: { ".": 6, und: 2, neben: 1 },
  },
};

const GEWITTER: NetzRoh = {
  slug: "gewitter",
  titel: "Gewitter",
  icon: "⛈️",
  prompt: "Schreibe einen kurzen Text über ein Gewitter.",
  woerter: {
    artikel: ["die", "der", "das", "eine", "dem", "einem", "einer"],
    adjektiv: [
      "dunkle", "schwere", "kalte", "wilde", "ferne",
      "dunklen", "schweren", "kalten", "weiten", "fernen",
    ],
    nomen: [
      // Subjekte …
      "Wolke", "Luft", "Nacht", "Sturm", "Blitz", "Donner", "Regen", "Wind", "Gewitter",
      // … Orte (maskulin/neutrum) …
      "Feld", "Dach", "Meer", "Wald", "Berg", "Turm", "Boden", "Himmel", "Horizont", "Fenster",
      // … und Orte (feminin).
      "Stadt", "Straße", "Wiese",
    ],
    verb: [
      "zieht", "wächst", "flimmert", "steht", "kommt", "naht", "tobt", "heult", "zuckt",
      "kracht", "grollt", "rollt", "prasselt", "rauscht", "pfeift", "weht",
    ],
    adverb: ["laut", "heftig", "langsam", "plötzlich", "unaufhörlich", "näher", "kalt"],
    praeposition: ["über", "hinter", "vor", "auf", "im", "am", "vom"],
    konjunktion: ["und"],
    punkt: ["."],
  },
  merkmale: {
    die: ["nom.f"], eine: ["nom.f"], der: ["nom.m"], das: ["nom.n"],
    dem: ["dat.m", "dat.n"], einem: ["dat.m", "dat.n"], einer: ["dat.f"],

    dunkle: ["nom.f"], schwere: ["nom.f"], kalte: ["nom.f"], wilde: ["nom.f"], ferne: ["nom.f"],
    dunklen: ["dat.m", "dat.n"], schweren: ["dat.m", "dat.n"], kalten: ["dat.m", "dat.n"],
    weiten: ["dat.m", "dat.n"], fernen: ["dat.m", "dat.n"],

    Wolke: ["nom.f"], Luft: ["nom.f"], Nacht: ["nom.f"],
    Sturm: ["nom.m"], Blitz: ["nom.m"], Donner: ["nom.m"], Regen: ["nom.m"], Wind: ["nom.m"],
    Gewitter: ["nom.n"],
    Feld: ["dat.n"], Dach: ["dat.n"], Meer: ["dat.n"], Fenster: ["dat.n"],
    Wald: ["dat.m"], Berg: ["dat.m"], Turm: ["dat.m"], Boden: ["dat.m"],
    Himmel: ["dat.m"], Horizont: ["dat.m"],
    Stadt: ["dat.f"], Straße: ["dat.f"], Wiese: ["dat.f"],

    über: ["dat.m", "dat.n", "dat.f"], hinter: ["dat.m", "dat.n", "dat.f"],
    vor: ["dat.m", "dat.n", "dat.f"], auf: ["dat.m", "dat.n", "dat.f"],
    im: ["dat.m", "dat.n"], am: ["dat.m", "dat.n"], vom: ["dat.m", "dat.n"],
  },
  start: { das: 5, der: 5, die: 4, eine: 2 },
  folgt: {
    // ── Artikel ───────────────────────────────────────────────────────────
    die: { Wolke: 5, Nacht: 3, Luft: 2, dunkle: 4, schwere: 3, wilde: 2, kalte: 2, ferne: 1 },
    eine: { Wolke: 5, dunkle: 3, schwere: 2, ferne: 2, wilde: 1 },
    der: { Sturm: 5, Blitz: 5, Donner: 4, Regen: 4, Wind: 3 },
    das: { Gewitter: 6 },
    dem: { dunklen: 3, schweren: 2, weiten: 2, fernen: 2, kalten: 1, Feld: 4, Wald: 3, Dach: 3, Berg: 2, Meer: 2, Turm: 2, Boden: 2 },
    einem: { dunklen: 3, schweren: 2, weiten: 2, kalten: 1, fernen: 1, Feld: 3, Wald: 3, Berg: 2, Dach: 2, Turm: 1, Meer: 1 },
    einer: { Stadt: 3, Wiese: 3, Straße: 2 },

    // ── Adjektive ─────────────────────────────────────────────────────────
    dunkle: { Wolke: 5, Nacht: 3, Luft: 1 },
    schwere: { Wolke: 5, Luft: 2 },
    kalte: { Luft: 4, Nacht: 3, Wolke: 1 },
    wilde: { Wolke: 3, Nacht: 3 },
    ferne: { Wolke: 3, Nacht: 2 },
    dunklen: { Wald: 4, Feld: 3, Berg: 2, Meer: 2, Turm: 1, Boden: 1 },
    schweren: { Boden: 3, Dach: 2, Feld: 2 },
    kalten: { Boden: 3, Meer: 2, Feld: 2, Wald: 1 },
    weiten: { Feld: 4, Meer: 3, Wald: 1 },
    fernen: { Berg: 3, Wald: 2, Meer: 2, Turm: 1 },

    // ── Subjektnomen, jedes mit seinen eigenen Verben ─────────────────────
    Wolke: { zieht: 5, wächst: 3, kommt: 2 },
    Luft: { flimmert: 4, steht: 3 },
    Nacht: { kommt: 4, zieht: 2 },
    Sturm: { tobt: 5, heult: 4, naht: 3, rauscht: 2, kommt: 2 },
    Blitz: { zuckt: 5, kracht: 3 },
    Donner: { grollt: 5, rollt: 3, kracht: 3 },
    Regen: { prasselt: 5, rauscht: 3, kommt: 2 },
    Wind: { heult: 4, pfeift: 3, weht: 3, kommt: 2 },
    Gewitter: { naht: 5, zieht: 4, tobt: 3, kommt: 2 },

    // ── Verben ────────────────────────────────────────────────────────────
    zieht: { über: 4, ".": 3, langsam: 3, näher: 3, vom: 1 },
    wächst: { ".": 4, langsam: 3, über: 2, am: 2 },
    flimmert: { ".": 4, über: 2, am: 2, heftig: 1 },
    steht: { ".": 4, über: 3, am: 2 },
    kommt: { näher: 4, ".": 3, langsam: 2, über: 2, vom: 2, plötzlich: 1 },
    naht: { ".": 3, langsam: 3, über: 3, vom: 2, plötzlich: 2, unaufhörlich: 1 },
    tobt: { über: 4, ".": 3, laut: 3, heftig: 3, unaufhörlich: 2, im: 2, am: 1 },
    heult: { ".": 3, laut: 3, über: 3, im: 2, unaufhörlich: 2, am: 1 },
    zuckt: { über: 4, ".": 3, plötzlich: 3, am: 3, hinter: 2, vor: 1 },
    kracht: { ".": 4, laut: 4, über: 2, im: 1 },
    grollt: { ".": 3, laut: 3, hinter: 3, über: 2, am: 2, unaufhörlich: 1 },
    rollt: { über: 4, ".": 3, laut: 2, hinter: 2 },
    prasselt: { auf: 5, ".": 3, unaufhörlich: 3, laut: 2, im: 1 },
    rauscht: { ".": 3, im: 3, über: 3, laut: 2, unaufhörlich: 1 },
    pfeift: { ".": 3, laut: 3, über: 2, im: 2, am: 2 },
    weht: { kalt: 3, ".": 3, über: 3, im: 2, am: 1 },

    // ── Adverbien ─────────────────────────────────────────────────────────
    laut: { ".": 5, über: 3, im: 2, und: 2, am: 1 },
    heftig: { ".": 4, über: 3, auf: 2, und: 2, im: 1 },
    langsam: { ".": 4, über: 3, näher: 2, und: 2, vom: 1 },
    plötzlich: { ".": 4, über: 2, am: 2, und: 2 },
    unaufhörlich: { ".": 4, auf: 3, über: 2, und: 1 },
    näher: { ".": 5, und: 2 },
    kalt: { ".": 4, über: 3, und: 2, im: 1 },

    // ── Präpositionen ─────────────────────────────────────────────────────
    über: { dem: 6, einem: 3, einer: 3 },
    hinter: { dem: 5, einem: 3, einer: 2 },
    vor: { dem: 5, einem: 3, einer: 2 },
    auf: { dem: 5, einem: 3, einer: 2 },
    im: { Wald: 5, Turm: 2, Meer: 2 },
    am: { Himmel: 5, Horizont: 3, Fenster: 2, Meer: 1 },
    vom: { Berg: 4, Horizont: 3, Meer: 2, Wald: 1 },

    // ── Bindewort und Ortsnomen ───────────────────────────────────────────
    und: { der: 6, das: 4, die: 3, eine: 1 },
    Feld: { ".": 6, und: 2, hinter: 1 },
    Dach: { ".": 6, und: 2, über: 1 },
    Wald: { ".": 6, und: 2, hinter: 1 },
    Berg: { ".": 6, und: 2, hinter: 1 },
    Turm: { ".": 6, und: 2, über: 1 },
    Meer: { ".": 6, und: 2, über: 1 },
    Boden: { ".": 6, und: 2 },
    Himmel: { ".": 6, und: 2, über: 1 },
    Horizont: { ".": 6, und: 2 },
    Fenster: { ".": 6, und: 2 },
    Stadt: { ".": 6, und: 2, hinter: 1 },
    Straße: { ".": 6, und: 2 },
    Wiese: { ".": 6, und: 2, hinter: 1 },
  },
};

const FUSSBALL: NetzRoh = {
  slug: "fussball",
  titel: "Fußballspiel",
  icon: "⚽",
  prompt: "Schreibe einen kurzen Text über ein Fußballspiel.",
  woerter: {
    artikel: ["die", "der", "das", "eine", "dem", "einem", "einer"],
    adjektiv: [
      "junge", "starke", "ganze", "müde", "schnelle",
      "nassen", "harten", "weiten", "grünen", "schnellen",
    ],
    nomen: [
      // Subjekte …
      "Mannschaft", "Abwehr", "Ball", "Torwart", "Stürmer", "Trainer", "Schiedsrichter",
      "Spiel", "Tor",
      // … Orte (maskulin/neutrum) …
      "Platz", "Rasen", "Strafraum", "Boden", "Spielfeld", "Mittelfeld",
      // … und Orte (feminin).
      "Tribüne", "Bank", "Eckfahne",
    ],
    verb: [
      "rollt", "fliegt", "springt", "hält", "wartet", "rennt", "jubelt", "schießt",
      "ruft", "klatscht", "pfeift", "läuft", "gewinnt", "kämpft", "beginnt", "endet", "fällt",
    ],
    adverb: ["laut", "schnell", "endlich", "ruhig", "knapp", "lange", "hoch"],
    praeposition: ["auf", "über", "neben", "vor", "hinter", "im", "vom"],
    konjunktion: ["und"],
    punkt: ["."],
  },
  merkmale: {
    die: ["nom.f"], eine: ["nom.f"], der: ["nom.m"], das: ["nom.n"],
    dem: ["dat.m", "dat.n"], einem: ["dat.m", "dat.n"], einer: ["dat.f"],

    junge: ["nom.f"], starke: ["nom.f"], ganze: ["nom.f"], müde: ["nom.f"], schnelle: ["nom.f"],
    nassen: ["dat.m", "dat.n"], harten: ["dat.m", "dat.n"], weiten: ["dat.m", "dat.n"],
    grünen: ["dat.m", "dat.n"], schnellen: ["dat.m", "dat.n"],

    Mannschaft: ["nom.f"], Abwehr: ["nom.f"],
    Ball: ["nom.m"], Torwart: ["nom.m"], Stürmer: ["nom.m"], Trainer: ["nom.m"],
    Schiedsrichter: ["nom.m"],
    Spiel: ["nom.n"], Tor: ["nom.n"],
    Platz: ["dat.m"], Rasen: ["dat.m"], Strafraum: ["dat.m"], Boden: ["dat.m"],
    Spielfeld: ["dat.n"], Mittelfeld: ["dat.n"],
    Tribüne: ["dat.f"], Bank: ["dat.f"], Eckfahne: ["dat.f"],

    auf: ["dat.m", "dat.n", "dat.f"], über: ["dat.m", "dat.n", "dat.f"],
    neben: ["dat.m", "dat.n", "dat.f"], vor: ["dat.m", "dat.n", "dat.f"],
    hinter: ["dat.m", "dat.n", "dat.f"],
    im: ["dat.m", "dat.n"], vom: ["dat.m", "dat.n"],
  },
  start: { der: 5, die: 5, das: 4, eine: 2 },
  folgt: {
    // ── Artikel ───────────────────────────────────────────────────────────
    die: { Mannschaft: 5, Abwehr: 3, junge: 3, starke: 3, ganze: 2, müde: 2, schnelle: 2 },
    eine: { Mannschaft: 4, junge: 3, starke: 2, schnelle: 2, müde: 1 },
    der: { Ball: 5, Torwart: 4, Stürmer: 4, Trainer: 3, Schiedsrichter: 3 },
    das: { Spiel: 5, Tor: 4 },
    dem: { grünen: 3, nassen: 2, harten: 2, weiten: 2, schnellen: 1, Platz: 5, Rasen: 4, Spielfeld: 3, Mittelfeld: 2, Boden: 2, Strafraum: 2 },
    einem: { nassen: 3, harten: 2, grünen: 2, weiten: 2, schnellen: 1, Platz: 4, Rasen: 3, Spielfeld: 2, Boden: 1 },
    einer: { Tribüne: 3, Bank: 3, Eckfahne: 2 },

    // ── Adjektive ─────────────────────────────────────────────────────────
    junge: { Mannschaft: 5, Abwehr: 2, starke: 1 },
    starke: { Mannschaft: 5, Abwehr: 3, junge: 1 },
    ganze: { Mannschaft: 5, Abwehr: 2 },
    müde: { Mannschaft: 4, Abwehr: 3 },
    schnelle: { Mannschaft: 4, Abwehr: 3, junge: 1 },
    nassen: { Rasen: 4, Platz: 3, Boden: 2, Spielfeld: 2 },
    harten: { Boden: 3, Platz: 3, Rasen: 2 },
    weiten: { Spielfeld: 3, Platz: 3, Mittelfeld: 2 },
    grünen: { Rasen: 5, Platz: 3, Spielfeld: 2 },
    schnellen: { Rasen: 3, Platz: 2, Mittelfeld: 2 },

    // ── Subjektnomen, jedes mit seinen eigenen Verben ─────────────────────
    Mannschaft: { jubelt: 4, kämpft: 4, gewinnt: 3, wartet: 2, läuft: 2 },
    Abwehr: { hält: 4, kämpft: 3, wartet: 2 },
    Ball: { rollt: 5, fliegt: 4, springt: 3 },
    Torwart: { hält: 4, springt: 3, wartet: 3, läuft: 2 },
    Stürmer: { rennt: 4, schießt: 4, jubelt: 3, wartet: 2, läuft: 2 },
    Trainer: { ruft: 4, klatscht: 3, wartet: 3 },
    Schiedsrichter: { pfeift: 5, läuft: 3, wartet: 2 },
    Spiel: { beginnt: 4, läuft: 4, endet: 3 },
    Tor: { fällt: 6 },

    // ── Verben ────────────────────────────────────────────────────────────
    rollt: { über: 4, ".": 3, im: 2, schnell: 2, neben: 1 },
    fliegt: { über: 4, ".": 3, hoch: 3, hinter: 2, neben: 2, im: 1 },
    springt: { hoch: 4, ".": 3, im: 2, über: 2, vor: 1 },
    hält: { ".": 4, ruhig: 2, im: 2, lange: 1 },
    wartet: { ".": 3, ruhig: 3, neben: 2, lange: 2, vor: 2, auf: 1 },
    rennt: { schnell: 4, ".": 3, über: 3, im: 2 },
    jubelt: { laut: 5, ".": 3, auf: 3, lange: 1 },
    schießt: { ".": 4, hoch: 2, endlich: 2, knapp: 2, im: 2, vom: 1 },
    ruft: { laut: 5, ".": 3, neben: 2, vor: 1 },
    klatscht: { laut: 4, ".": 3, neben: 1 },
    pfeift: { laut: 4, ".": 4, endlich: 2, im: 1 },
    läuft: { schnell: 3, ".": 3, ruhig: 2, über: 3, im: 2 },
    gewinnt: { knapp: 4, ".": 4, endlich: 3 },
    kämpft: { ".": 3, lange: 3, auf: 3, im: 2, vor: 1 },
    beginnt: { ".": 4, endlich: 3, ruhig: 2, auf: 2 },
    endet: { ".": 5, endlich: 2, knapp: 2 },
    fällt: { ".": 5, endlich: 3, knapp: 2, im: 2, vor: 1 },

    // ── Adverbien ─────────────────────────────────────────────────────────
    laut: { ".": 5, auf: 3, und: 2, neben: 1 },
    schnell: { ".": 4, über: 3, und: 2, im: 2 },
    endlich: { ".": 5, und: 2, im: 1 },
    ruhig: { ".": 5, auf: 2, und: 2, im: 1 },
    knapp: { ".": 5, vor: 2, und: 2 },
    lange: { ".": 4, auf: 2, und: 2, im: 1 },
    hoch: { ".": 4, über: 3, und: 2, im: 1 },

    // ── Präpositionen ─────────────────────────────────────────────────────
    auf: { dem: 6, einem: 3, einer: 2 },
    über: { dem: 5, einem: 3, einer: 1 },
    neben: { dem: 4, einer: 3, einem: 2 },
    vor: { dem: 5, einem: 2, einer: 2 },
    hinter: { dem: 5, einem: 2, einer: 2 },
    im: { Strafraum: 4, Mittelfeld: 4 },
    vom: { Platz: 4, Rasen: 2 },

    // ── Bindewort und Ortsnomen ───────────────────────────────────────────
    und: { der: 6, die: 4, das: 3, eine: 1 },
    Platz: { ".": 6, und: 2, vor: 1 },
    Rasen: { ".": 6, und: 2, vor: 1 },
    Strafraum: { ".": 6, und: 2, vor: 1 },
    Spielfeld: { ".": 6, und: 2, vor: 1 },
    Mittelfeld: { ".": 6, und: 2, vor: 1 },
    Boden: { ".": 6, und: 2 },
    Tribüne: { ".": 6, und: 2, neben: 1 },
    Bank: { ".": 6, und: 2, neben: 1 },
    Eckfahne: { ".": 6, und: 2, neben: 1 },
  },
};

/** Alle Themen. Weitere kommen als eigene `NetzRoh`-Blöcke dazu. */
export const NETZE: Netz[] = [KATZE, GEWITTER, FUSSBALL].map(baueNetz);

export function netzMit(slug: string): Netz {
  return NETZE.find(n => n.slug === slug) ?? NETZE[0];
}
