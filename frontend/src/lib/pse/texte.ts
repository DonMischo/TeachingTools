/**
 * Kurztexte für den Steckbrief: wo das Element vorkommt und wofür es
 * gebraucht wird.
 *
 * Geschrieben für Klasse 7–10. Nur Elemente, die im Unterricht oder im Alltag
 * eine Rolle spielen, haben einen Text — bei den übrigen zeigt der Steckbrief
 * allein die Kenndaten. Lieber kein Text als ein ausgedachter.
 */
export type Steckbrieftext = {
  /** Ein bis zwei Sätze: was ist das für ein Stoff? */
  wesen: string;
  /** Wo es vorkommt oder woraus es gewonnen wird. */
  vorkommen?: string;
  /** Wofür es gebraucht wird. */
  verwendung?: string;
  /** Eine Merkwürdigkeit zum Behalten. */
  merk?: string;
};

export const TEXTE: Record<string, Steckbrieftext> = {
  H: {
    wesen: "Das leichteste und häufigste Element des Universums. Ein farbloses Gas, das mit Sauerstoff zu Wasser verbrennt.",
    vorkommen: "Auf der Erde fast nur gebunden — in Wasser und in jedem Stoff, der von Lebewesen stammt.",
    verwendung: "Dünger (Ammoniak), Raffinerien, Brennstoffzellen in Bussen und Zügen.",
    merk: "Drei Viertel der Masse der Sonne sind Wasserstoff.",
  },
  He: {
    wesen: "Ein Edelgas, das mit nichts reagiert. Zweitleichtestes Element.",
    vorkommen: "Aus Erdgasfeldern; auf der Erde entsteht es beim radioaktiven Zerfall im Gestein.",
    verwendung: "Ballons, Kühlung von Kernspintomografen (flüssig bei −269 °C).",
    merk: "Wurde zuerst in der Sonne entdeckt — im Sonnenlicht, nicht im Labor.",
  },
  Li: {
    wesen: "Das leichteste Metall — so leicht, dass es auf Wasser schwimmt, während es damit reagiert.",
    verwendung: "Akkus in Handy, Laptop und Elektroauto.",
  },
  C: {
    wesen: "Das Element des Lebens. Kohlenstoffatome binden sich an sich selbst — daraus entstehen Millionen verschiedener Moleküle.",
    vorkommen: "Kohle, Erdöl, Erdgas, Kalkstein; und in jedem Lebewesen.",
    verwendung: "Stahl, Kunststoffe, Kraftstoffe, Bleistiftminen (Graphit).",
    merk: "Diamant und Graphit bestehen aus demselben Element — nur anders angeordnet.",
  },
  N: {
    wesen: "Ein farbloses, reaktionsträges Gas. Vier Fünftel der Luft bestehen daraus.",
    verwendung: "Dünger, Schutzgas in Verpackungen; flüssig (−196 °C) zum Kühlen.",
    merk: "Pflanzen können den Stickstoff der Luft nicht nutzen — nur Bakterien an ihren Wurzeln.",
  },
  O: {
    wesen: "Das Gas, von dem wir leben. Reagiert mit fast allen anderen Elementen — das nennt man Oxidation.",
    vorkommen: "Ein Fünftel der Luft; gebunden in Wasser und in fast jedem Gestein.",
    merk: "Häufigstes Element der Erdkruste — fast die Hälfte ihrer Masse.",
  },
  F: {
    wesen: "Ein blassgelbes Gas und das reaktionsfreudigste Element überhaupt.",
    verwendung: "Zahnpasta (als Fluorid), Teflonpfannen.",
  },
  Ne: { wesen: "Edelgas, das in einer Gasentladung orangerot leuchtet.", verwendung: "Leuchtreklame — daher »Neonröhre«." },
  Na: {
    wesen: "Ein weiches, silbriges Metall, das man mit dem Messer schneiden kann. In Wasser reagiert es heftig.",
    vorkommen: "Nie als Metall, immer gebunden — vor allem als Kochsalz im Meer und im Salzstock.",
    merk: "Natriumdampflampen geben das gelbe Licht alter Straßenlaternen.",
  },
  Mg: {
    wesen: "Ein leichtes Metall, das mit grellem weißem Licht verbrennt.",
    vorkommen: "Im Meerwasser und im Blattgrün jeder Pflanze.",
    verwendung: "Leichtbau in Fahrzeugen, Feuerwerk.",
  },
  Al: {
    wesen: "Leichtes, silbriges Metall. Eine hauchdünne Oxidschicht schützt es vor dem Rosten.",
    vorkommen: "Häufigstes Metall der Erdkruste, gewonnen aus Bauxit.",
    verwendung: "Getränkedosen, Folie, Fahrräder, Flugzeuge.",
    merk: "Die Herstellung braucht sehr viel Strom — Recycling spart 95 % davon.",
  },
  Si: {
    wesen: "Ein grauglänzendes Halbmetall: leitet Strom nur, wenn man es dazu bringt.",
    vorkommen: "Als Quarz in Sand und Glas; zweithäufigstes Element der Erdkruste.",
    verwendung: "Computerchips, Solarzellen, Glas.",
  },
  P: {
    wesen: "Kommt in mehreren Formen vor: weißer Phosphor entzündet sich an der Luft von selbst, roter ist harmlos.",
    verwendung: "Streichholzreibefläche, Dünger.",
    merk: "Steckt in jedem Knochen und in der DNA.",
  },
  S: {
    wesen: "Ein gelber, geruchloser Feststoff. Erst seine Verbindungen stinken.",
    vorkommen: "An Vulkanen rein; sonst in Erdöl und Erzen.",
    verwendung: "Schwefelsäure — die meistproduzierte Chemikalie der Welt.",
  },
  Cl: {
    wesen: "Ein gelbgrünes, giftiges Gas mit stechendem Geruch.",
    verwendung: "Trinkwasser keimfrei machen, PVC, Bleichmittel.",
    merk: "Natrium ist gefährlich, Chlor ist giftig — zusammen sind sie Kochsalz.",
  },
  K: {
    wesen: "Weiches Metall, das in Wasser noch heftiger reagiert als Natrium.",
    verwendung: "Dünger; im Körper steuert es die Nerven.",
    vorkommen: "In Bananen, Kartoffeln und im Kalisalz unter Thüringen.",
  },
  Ca: {
    wesen: "Ein unedles Metall, das man selten als solches sieht — meist als Kalk.",
    vorkommen: "Kalkstein, Marmor, Kreide; Knochen und Zähne.",
    verwendung: "Zement, Mörtel, Glas.",
  },
  Ti: { wesen: "So fest wie Stahl, aber viel leichter, und es rostet nicht.", verwendung: "Implantate, Brillengestelle, Flugzeugteile." },
  Cr: { wesen: "Hartes, glänzendes Metall.", verwendung: "Verchromte Oberflächen, Edelstahl." },
  Fe: {
    wesen: "Das wichtigste Gebrauchsmetall. An feuchter Luft rostet es.",
    vorkommen: "Als Erz im Boden; der Erdkern besteht fast ganz daraus.",
    verwendung: "Stahl — Bauwerke, Fahrzeuge, Werkzeuge.",
    merk: "Im Blut transportiert Eisen den Sauerstoff; deshalb ist es rot.",
  },
  Cu: {
    wesen: "Rötliches Metall, das Strom und Wärme sehr gut leitet.",
    verwendung: "Kabel, Rohre, Münzen.",
    merk: "An der Luft wird es grün — die Patina alter Kirchendächer.",
  },
  Zn: { wesen: "Unedles Metall, das sich für Eisen opfert.", verwendung: "Verzinkte Bleche rosten nicht, Batterien, Dachrinnen." },
  Br: { wesen: "Das einzige Nichtmetall, das bei Zimmertemperatur flüssig ist — rotbraun und stechend.", vorkommen: "Im Meerwasser." },
  Ag: { wesen: "Edelmetall mit der besten elektrischen Leitfähigkeit überhaupt.", verwendung: "Schmuck, Kontakte, früher Fotofilme." },
  Sn: { wesen: "Weiches Metall mit niedrigem Schmelzpunkt.", verwendung: "Lötzinn, Konservendosen (Weißblech)." },
  I: { wesen: "Violett-schwarze Kristalle, die beim Erhitzen direkt zu violettem Dampf werden.", verwendung: "Desinfektion; im Speisesalz gegen Schilddrüsenkrankheiten." },
  W: { wesen: "Hat den höchsten Schmelzpunkt aller Metalle: 3422 °C.", verwendung: "Glühwendel, Bohrer, Schweißelektroden." },
  Pt: { wesen: "Edelmetall, das Reaktionen beschleunigt, ohne sich zu verbrauchen.", verwendung: "Autokatalysator, Schmuck." },
  Au: {
    wesen: "Das Metall, das nicht anläuft — Gold aus Pharaonengräbern glänzt heute noch.",
    verwendung: "Schmuck, Wertanlage, Kontakte in der Elektronik.",
    merk: "So dehnbar, dass aus einem Gramm ein Faden von zwei Kilometern wird.",
  },
  Hg: { wesen: "Das einzige Metall, das bei Zimmertemperatur flüssig ist. Giftig, auch der Dampf.", verwendung: "Früher Thermometer, heute weitgehend verboten." },
  Pb: { wesen: "Schweres, weiches Metall. Giftig, auch in kleinen Mengen.", verwendung: "Autobatterien, Strahlenschutz; früher Wasserrohre." },
  U: { wesen: "Schwerstes natürlich vorkommendes Element, radioaktiv.", verwendung: "Brennstoff in Kernkraftwerken." },
};

export const textZu = (symbol: string): Steckbrieftext | undefined => TEXTE[symbol];
