/**
 * Freizeit neben dem Handy: Serien, Familie, Verein, Freunde. Jede Aktivität
 * ist eine Folge von Schritten, die Spielzeit kosten. Wer dazwischen aufs
 * Handy schaut, wird gezählt — und manchmal bemerkt (`beiHandy`).
 * Bücher stehen in buecher.ts.
 */
import { buchNachId } from "./buecher";
import type { Stand } from "./typen";

export type AktArt = "lesen" | "serie" | "familie" | "verein" | "freunde";

export interface Schritt {
  text: string;
  minuten: number;
  /** was jemand sagt, wenn man in diesem Schritt aufs Handy geschaut hat */
  beiHandy?: string;
  /** Überschrift (Folgentitel) */
  titel?: string;
}

// ───────── Serien: jede Folge endet mit einem Cliffhanger ─────────

export interface Serie { id: string; titel: string; emoji: string; farbe: string; folgen: Schritt[] }

export const SERIEN: Serie[] = [
  {
    id: "nebelstadt", titel: "Nebelstadt", emoji: "🌫️", farbe: "#334155",
    folgen: [
      { titel: "1 · Die Nacht, in der Ella verschwand", minuten: 45, text: "Ella geht nach dem Volleyballtraining nicht nach Hause. Ihr Fahrrad steht am Bahnhof, das Handy liegt im Gebüsch — mit 47 ungelesenen Nachrichten. Ihr Bruder Tom liest sie alle. Die letzte ist von einer Nummer ohne Namen: »Komm allein.«" },
      { titel: "2 · Der Mann mit dem roten Schirm", minuten: 45, text: "Auf der Überwachungskamera am Bahnhof: Ella spricht mit einem Mann unter einem roten Schirm. Die Polizei findet ihn nicht. Tom schon — in einem alten Video auf Ellas Account, aufgenommen vor drei Jahren. Der Mann ist ihr Vater. Der, von dem alle sagen, er sei tot." },
      { titel: "3 · Was im Leuchtturm liegt", minuten: 45, text: "Tom folgt dem Vater zum stillgelegten Leuchtturm. Oben brennt Licht, obwohl es dort seit Jahren keinen Strom gibt. An der Wand hängen Fotos von Ella, Hunderte, jede Woche eins, seit sie zwölf ist. Hinter Tom fällt die Tür ins Schloss." },
      { titel: "4 · Nebelstadt", minuten: 45, text: "Ella ist da, wohlauf, und wütend: Der Vater wollte sie warnen, nicht entführen. Vor jemandem, der ihre Fotos sammelt, seit Jahren, aus ihren eigenen Posts. Die Polizei kommt rechtzeitig. Letzte Einstellung: Ein Handy leuchtet auf. »Staffel 2 – bald.«" },
    ],
  },
  {
    id: "station", titel: "Station Eis", emoji: "🧊", farbe: "#0e7490",
    folgen: [
      { titel: "1 · Funkstille", minuten: 45, text: "Sechs Forschende überwintern in der Antarktis, vier Monate Dunkelheit. Am ersten Abend bricht die Verbindung zur Außenwelt ab. Am zweiten fehlt die Chemikerin Ada. Ihre Fußspuren führen vom Eingang weg ins Eis — und hören nach zwanzig Metern einfach auf." },
      { titel: "2 · Die Stimme im Funkgerät", minuten: 45, text: "Nachts knackt das tote Funkgerät. Eine Stimme zählt Zahlen auf, immer dieselben: sieben, vier, null, null. Kapitän Nilsen sagt, es sei ein Echo. Der Bordarzt sagt, das sei Adas Stimme. Und die Zahlen sind die Koordinaten der Station." },
      { titel: "3 · Unter dem Eis", minuten: 45, text: "Unter dem Labor finden sie einen Schacht, der auf keinem Plan steht. Darin: Adas Stirnlampe, noch warm. Und ein Tagebuch einer Station, die hier 1961 stand und von der niemand zurückkam. Letzter Eintrag: »Es lernt, wie wir reden.«" },
      { titel: "4 · Polarlicht", minuten: 45, text: "Ada lebt — sie hat sich im Schacht versteckt, weil sie entdeckt hat, wer den Funk sabotiert: der Kapitän, um eine Entdeckung zu verkaufen. Am Ende sitzt die Crew unter dem Polarlicht, das Funkgerät knackt. »Sieben, vier, null, null.« Ada ist bei ihnen. Wer spricht da?" },
    ],
  },
];

// ───────── Familie: abhängig von Tag und Uhrzeit ─────────

export interface FamilienSache {
  id: string; name: string; emoji: string;
  /** eine Bitte der Familie: verfügbar nach Zusage (oder wenn sie erzwungen wird) */
  bitte?: boolean;
  /** an welchen Tagen und in welchem Zeitfenster (Spielminuten) */
  tage: number[]; von: number; bis: number;
  schritte: (tag: number) => Schritt[];
}

const ESSEN = [
  "Papa erzählt von seinem neuen Kollegen, der jeden Tag Fischbrötchen in der Mikrowelle aufwärmt. Mama lacht so sehr, dass sie sich verschluckt.",
  "Deine kleine Schwester Mila will wissen, warum der Himmel blau ist. Papa erklärt es falsch, Mama erklärt es richtig, Mila ist danach verwirrter als vorher.",
  "Es gibt Linsensuppe. Niemand mag Linsensuppe. Mama sagt, sie mag sie auch nicht, aber sie war im Angebot. Alle essen trotzdem auf.",
  "Papa fragt, wie's in der Schule läuft. Diesmal fragt er richtig, nicht nur so nebenbei. Du erzählst mehr, als du wolltest.",
  "Freitag ist Pizzatag. Mila hat Gesichter auf alle Pizzen gelegt, mit Salami als Augen. Deins schaut traurig. »Wie du, wenn du am Handy hängst«, sagt sie.",
];

export const FAMILIE: FamilienSache[] = [
  {
    id: "essen", name: "Abendessen mit der Familie", emoji: "🍝", tage: [0, 1, 2, 3, 4], von: 18 * 60 + 30, bis: 19 * 60 + 30,
    schritte: t => [
      { text: ESSEN[t], minuten: 20, beiHandy: "Mama: »Das Handy bleibt beim Essen weg. Bitte.«" },
      { text: "Danach räumst du mit Papa die Spülmaschine ein. Er summt ein Lied von früher und behauptet, er hätte damals in einer Band gespielt.", minuten: 15, beiHandy: "Papa: »Hallo? Erde an Kind?«" },
    ],
  },
  {
    id: "hund", name: "Mit Bello rausgehen", emoji: "🐕", tage: [0, 1, 2, 3, 4], von: 14 * 60, bis: 21 * 60,
    schritte: t => [
      { text: ["Bello zieht dich zum Park, weil dort die Tauben sind. Er fängt nie eine. Er glaubt trotzdem jedes Mal daran.", "Es nieselt. Bello findet eine Pfütze und legt sich hinein. Er ist sehr glücklich. Du nicht.", "Im Park triffst du die alte Frau Möller mit ihrem Dackel. Sie erzählt, dass sie früher Pilotin war. Du weißt nicht, ob das stimmt. Es ist eine gute Geschichte.", "Die Sonne geht hinter dem Wasserturm unter, alles wird orange. Bello sitzt neben dir und schnauft zufrieden.", "Bello bringt dir einen Stock, der eigentlich ein halber Baum ist. Ihr spielt, bis ihr beide außer Atem seid."][t], minuten: 30,
        beiHandy: "Bello hat sich losgerissen und rennt den Tauben hinterher. Du hast es erst gemerkt, als er schon weg war." },
    ],
  },
  {
    id: "oma", name: "Oma anrufen", emoji: "☎️", tage: [1, 3], von: 15 * 60, bis: 20 * 60,
    schritte: t => [
      { text: t === 1
        ? "Oma erzählt, dass sie jetzt einen Tablet-Kurs in der Volkshochschule macht. Sie hat schon gelernt, wie man Fotos verschickt. Sie schickt dir zwölf Bilder von ihren Tomaten."
        : "Oma fragt, ob du verliebt bist. Du sagst nein. Sie sagt: »Das hab ich in deinem Alter auch immer gesagt.« Dann erzählt sie von Opa und dem Tanzabend 1971.", minuten: 20,
        beiHandy: "Oma: »Bist du noch dran, Schatz? Du klingst so abwesend.«" },
    ],
  },
  {
    id: "spiele", name: "Spieleabend", emoji: "🎲", tage: [2], von: 19 * 60 + 30, bis: 21 * 60,
    schritte: () => [
      { text: "Mittwoch ist Spieleabend. Mila schummelt bei »Mensch ärgere dich nicht« und ist beleidigt, als sie erwischt wird. Papa ärgert sich wirklich.", minuten: 30, beiHandy: "Mila: »Du bist dran! DU BIST DRAN! Leg doch mal das Handy weg!«" },
      { text: "Dann spielt ihr Activity. Mama muss »Influencer« pantomimisch darstellen und macht ein Duckface. Du lachst, bis dir der Bauch wehtut.", minuten: 30, beiHandy: "Mama: »Ach, wir langweilen dich, oder?« Sie lächelt dabei nicht." },
    ],
  },
  {
    id: "kochen", name: "Mit Papa Pizza backen", emoji: "🍕", tage: [3], von: 17 * 60, bis: 19 * 60,
    schritte: () => [
      { text: "Papa hat ein Rezept für »echte neapolitanische Pizza« gefunden. Der Teig klebt an allem, auch an der Decke, keiner weiß wie.", minuten: 30, beiHandy: "Papa: »Kannst du kurz … ach, egal, ich mach's allein.«" },
      { text: "Die Pizza sieht aus wie eine Landkarte von Skandinavien. Sie schmeckt fantastisch. Papa macht ein Foto und sagt, das schickt er Oma.", minuten: 30 },
    ],
  },
];

FAMILIE.push(
  { id: "einkaufen", name: "Einkaufen helfen", emoji: "🛒", bitte: true, tage: [], von: 0, bis: 0, schritte: () => [
    { text: "Im Supermarkt streitet ihr, ob Ketchup ein Gemüse ist. An der Kasse ist es so voll, dass ihr anfangt, euch Geschichten über die Leute in der Schlange auszudenken.", minuten: 45, beiHandy: "»Kannst du mal tragen helfen, statt aufs Handy zu starren?«" },
  ] },
  { id: "aufraeumen", name: "Zimmer aufräumen", emoji: "🧹", bitte: true, tage: [], von: 0, bis: 0, schritte: () => [
    { text: "Unter dem Bett findest du drei Socken, einen Zettel aus der 5. Klasse und das Ladekabel, das du seit Wochen suchst.", minuten: 30, beiHandy: "Mama schaut rein: »Ah. Sehr ordentlich. Das Handy.«" },
    { text: "Am Ende sieht das Zimmer fast aus wie auf den Fotos aus dem Katalog. Fast.", minuten: 20 },
  ] },
  { id: "omaBesuch", name: "Oma besuchen (Geburtstag)", emoji: "🎂", bitte: true, tage: [], von: 0, bis: 0, schritte: () => [
    { text: "Oma hat drei Kuchen gebacken, für vier Leute. Sie fragt dich nach der Schule, nach Freunden, nach allem. Sie hört richtig zu.", minuten: 60, beiHandy: "Oma: »Was ist denn da so spannend? Zeig mal!« Du zeigst es ihr. Sie versteht es nicht. Du irgendwie auch nicht." },
    { text: "Sie holt das alte Fotoalbum. Opa mit Schlaghose. Mama als Baby. Du mit drei, voller Schokolade. Alle lachen.", minuten: 60 },
  ] },
  { id: "mila", name: "Auf Mila aufpassen", emoji: "🧸", bitte: true, tage: [], von: 0, bis: 0, schritte: () => [
    { text: "Mila will Verstecken spielen. Sie versteckt sich immer hinter dem gleichen Vorhang und ruft dann »Ich bin nicht hier!«.", minuten: 30, beiHandy: "Plötzlich ist es still. Zu still. Mila hat den Filzstift gefunden. Und die Wand." },
    { text: "Ihr baut eine Murmelbahn aus Klopapierrollen. Sie funktioniert sogar.", minuten: 30 },
  ] },
  { id: "fahrrad", name: "Fahrrad reparieren", emoji: "🚲", bitte: true, tage: [], von: 0, bis: 0, schritte: () => [
    { text: "Kette ölen, Bremsen einstellen, Reifen flicken. Deine Hände sind schwarz, Papa erklärt jeden Handgriff zweimal. Danach fährt das Rad wie neu.", minuten: 50, beiHandy: "Papa: »Halt mal fest – nein, nicht das Handy, die Kette!«" },
  ] },
);

// ───────── Vereine: feste Tage und Zeiten ─────────

export interface Verein { id: string; name: string; emoji: string; tage: number[]; um: number; trainer: string; schritte: (mal: number) => Schritt[] }

export const VEREINE: Verein[] = [
  {
    id: "fussball", name: "Fußball beim SV Blau-Weiß", emoji: "⚽", tage: [1, 3], um: 16 * 60, trainer: "Trainer Kai",
    schritte: mal => [
      { text: "Aufwärmen, dann Passübungen. Kai brüllt »Kopf hoch!« so oft, dass es zum Running Gag wird.", minuten: 30, beiHandy: "Kai: »Handys in die Kabine. Alle. Auch du.«" },
      { text: mal === 0 ? "Trainingsspiel. Du legst den Ball quer, Selin schießt — Tor. Sie zeigt auf dich, als hättest du es selbst geschossen." : "Am Ende Elfmeterschießen. Du hältst einen. Die ganze Mannschaft springt auf dich drauf.", minuten: 45 },
      { text: "Danach sitzt ihr verschwitzt auf der Bank und teilt eine Packung Kekse. Keiner hat sein Handy in der Hand.", minuten: 15 },
    ],
  },
  {
    id: "theater", name: "Theater-AG", emoji: "🎭", tage: [2], um: 15 * 60, trainer: "Frau Novak",
    schritte: () => [
      { text: "Ihr probt »Ein Sommernachtstraum«, aber in einer Schule. Du spielst den Hausmeister, der eigentlich ein Elfenkönig ist.", minuten: 30, beiHandy: "Frau Novak: »Wer am Handy ist, spielt nächste Woche den Baum. Ohne Text.«" },
      { text: "Improvisationsübung: Ihr müsst eine Szene im Aufzug spielen, der stecken bleibt. Malte bekommt einen echten Lachanfall und steckt alle an.", minuten: 30 },
      { text: "Frau Novak sagt, ihr seid die beste Gruppe seit Jahren. Sie sagt das jedes Jahr. Es fühlt sich trotzdem gut an.", minuten: 30 },
    ],
  },
  {
    id: "feuerwehr", name: "Jugendfeuerwehr", emoji: "🚒", tage: [4], um: 17 * 60, trainer: "Gruppenführer Ahmet",
    schritte: () => [
      { text: "Schläuche ausrollen, kuppeln, wieder einrollen. Auf Zeit. Euer Team ist vier Sekunden schneller als letzte Woche.", minuten: 40, beiHandy: "Ahmet: »Im Einsatz hat keiner Zeit fürs Handy. Hier auch nicht.«" },
      { text: "Erste-Hilfe-Übung an der Puppe. Ihr übt die stabile Seitenlage, bis ihr sie im Schlaf könntet.", minuten: 40 },
      { text: "Zum Schluss darf jede·r einmal mit dem großen Strahlrohr auf die Wand zielen. Es ist absurd laut und großartig.", minuten: 30 },
    ],
  },
  {
    id: "band", name: "Band im Jugendhaus", emoji: "🎸", tage: [0, 4], um: 17 * 60, trainer: "Jugendhaus-Chefin Rosa",
    schritte: mal => [
      { text: mal === 0 ? "Ihr probt euren ersten eigenen Song. Er heißt »Akku leer« und hat genau drei Akkorde." : "Rosa hat euch einen Auftritt beim Stadtteilfest besorgt. Ihr probt, als ginge es um euer Leben.", minuten: 45, beiHandy: "Lena am Schlagzeug hört auf: »Spielen wir jetzt oder chattest du?«" },
      { text: "Am Ende nehmt ihr den Song auf, einmal ganz durch, ohne Fehler. Fast ohne Fehler. Ihr hört ihn fünf Mal hintereinander.", minuten: 45 },
    ],
  },
];

// ───────── Freunde treffen: jeden Tag woanders ─────────

export const FREUNDE: Schritt[][] = [
  [
    { text: "Skatepark mit Lea und Mo. Mo versucht einen Kickflip, 23 Mal. Beim 24. klappt es, und keiner hat es gefilmt. Er ist trotzdem stolz.", minuten: 45, beiHandy: "Lea: »Bist du jetzt die ganze Zeit am Handy?«" },
    { text: "Ihr teilt euch eine Tüte Pommes auf der Rampe und redet über alles und nichts.", minuten: 30 },
  ],
  [
    { text: "Eisdiele. Lea nimmt wie immer Pistazie, Mo wie immer drei Kugeln, die nicht zusammenpassen: Zitrone, Schoko, Kaugummi.", minuten: 40, beiHandy: "Mo: »Hallo? Wir sind HIER.«" },
    { text: "Ihr spielt »Wer bin ich« mit Zetteln auf der Stirn. Mo errät nach zwanzig Fragen, dass er ein Toaster ist.", minuten: 40 },
  ],
  [
    { text: "Bei Lea im Zimmer. Ihr baut eine Höhle aus Decken, obwohl ihr eigentlich zu alt dafür seid. Ist egal.", minuten: 45, beiHandy: "Lea legt ihr Handy demonstrativ in eine Schublade. Dann schaut sie dich an." },
    { text: "Lea erzählt, dass sie manchmal Angst hat, nicht dazuzugehören. Du sagst, dass du das kennst. Es ist ganz still in der Höhle.", minuten: 30 },
  ],
  [
    { text: "Stadtpark. Ihr findet eine Bank mit Blick auf den Teich und füttert die Enten mit Haferflocken, weil Brot schlecht für sie ist (sagt Lea).", minuten: 40, beiHandy: "Lea: »Was ist denn so spannend?« Du weißt es selbst nicht genau." },
    { text: "Ihr lauft einmal um den ganzen Teich und erzählt euch peinliche Geschichten aus der Grundschule.", minuten: 40 },
  ],
  [
    { text: "Kino! Ein Animationsfilm, eigentlich für Kleinere. Ihr lacht trotzdem am lautesten im ganzen Saal.", minuten: 90, beiHandy: "Jemand hinter euch zischt: »Handy aus, das blendet!«" },
    { text: "Danach steht ihr noch lange vor dem Kino und redet über das Ende.", minuten: 20 },
  ],
];

// Samstag: Freibad
FREUNDE.push([
  { text: "Freibad! Das Wasser ist eiskalt, Lea springt trotzdem als Erste. Mo sitzt mit Gips am Rand und kommentiert jeden Sprung wie ein Sportreporter.", minuten: 90, beiHandy: "Lea, tropfnass: »Leg das Ding weg und komm rein!«" },
  { text: "Pommes auf dem Handtuch, Sonne im Gesicht. Für eine Weile denkt niemand an irgendwas.", minuten: 60 },
]);

/** Die Schritte einer Aktivität. */
export function schritteFuer(s: Stand, art: AktArt, id: string): Schritt[] {
  if (art === "lesen") return (buchNachId(id)?.seiten ?? []).map(text => ({ text, minuten: 6 }));
  if (art === "serie") return SERIEN.find(x => x.id === id)?.folgen ?? [];
  if (art === "familie") return FAMILIE.find(x => x.id === id)?.schritte(s.tag) ?? [];
  if (art === "verein") {
    const v = VEREINE.find(x => x.id === id);
    return v ? v.schritte(Number(s.flags[`vereinMal_${id}`] ?? 0)) : [];
  }
  return FREUNDE[s.tag] ?? FREUNDE[0];
}

/** Familien-Sachen, die jetzt gehen. */
export function familieJetzt(s: Stand) {
  return FAMILIE.filter(f => !s.flags[`fam_${f.id}_${s.tag}`] && (f.bitte
    ? s.famZusagen.includes(f.id) && !s.flags[`fam_${f.id}`] && s.uhr < 21 * 60
    : f.tage.includes(s.tag) && s.uhr >= f.von && s.uhr < f.bis && !(s.eltern === "arbeit" && f.id === "essen" && s.tag % 2 === 0)));
}

/** Der eigene Verein, falls heute Training ist: noch nicht angefangen, oder höchstens 15 Minuten zu spät. */
export function vereinHeute(s: Stand) {
  const basis = VEREINE.find(x => x.id === s.verein);
  if (!basis) return null;
  // Eigener Trainingsplan (Einstellungen vor der Woche) statt der Standardzeiten
  const v = { ...basis, tage: s.vereinTage ?? basis.tage, um: s.vereinUm ?? basis.um };
  if (!v.tage.includes(s.tag) || s.flags[`vereinAbgesagt_${s.tag}`]) return null;
  return { verein: v, offen: s.uhr <= v.um + 15 && !s.flags[`verein_${s.tag}`], vorbei: s.uhr > v.um + 15 };
}
