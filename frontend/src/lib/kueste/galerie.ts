/**
 * Galerie »Echte Küsten«: Fotos von Wikimedia Commons mit Erklärung.
 * Die Bilddateien und Lizenzen holt scripts/fetch-kueste.mjs nach
 * public/kueste/galerie/ bzw. bilder.json — hier stehen nur die Texte.
 */
import nachweise from "./bilder.json";
import type { KliffTyp } from "./kliff";

export interface Nachweis { datei: string; titel: string; seite: string; lizenz: string; lizenzUrl?: string; urheber: string }

export type Bereich = "ruegen" | "moen" | "steil" | "flach" | "schutz";

export const BEREICHE: { id: Bereich; name: string; icon: string }[] = [
  { id: "ruegen", name: "Rügens Steilküste", icon: "⬜" },
  { id: "moen", name: "Møns Klint und GeoCenter", icon: "🇩🇰" },
  { id: "steil", name: "Weitere Steilufer", icon: "🟫" },
  { id: "flach", name: "Flachküste, Watt und Haken", icon: "🏖️" },
  { id: "schutz", name: "Küstenschutz", icon: "🛡️" },
];

export interface GalerieBild {
  id: string;
  bereich: Bereich;
  titel: string;
  text: string;
  /** Zu welchem Kliff im Querschnitt das Bild passt */
  kliff?: KliffTyp;
  /** Begriffe, die man im Bild entdecken kann */
  begriffe?: string[];
}

export const GALERIE: GalerieBild[] = [
  // ── Rügens Steilküste ──
  { id: "koenigsstuhl", bereich: "ruegen", kliff: "kreide", titel: "Kreideküste am Königsstuhl",
    text: "Die Kreideküste von Jasmund: weiße Wände aus rund 70 Millionen Jahre alter Kreide, oben Buchenwald bis an die Kante.", begriffe: ["Kliff", "Abbruchkante"] },
  { id: "koenigsstuhl-aussicht", bereich: "ruegen", kliff: "kreide", titel: "Blick vom Königsstuhl",
    text: "Die Wand ist nicht glatt: Rinnen, Rippen und bewachsene Schuttkegel zeigen, wo immer wieder Material abgebrochen ist.", begriffe: ["Kliffhalde"] },
  { id: "stubbenkammer", bereich: "ruegen", kliff: "kreide", titel: "Stubbenkammer",
    text: "Kreidefelsen zwischen Buchenwald. Wo der Wald bis zur Kante reicht, stürzen bei Abbrüchen die Bäume mit ab." },
  { id: "jasmund-findlinge", bereich: "ruegen", kliff: "kreide", titel: "Findlinge vor der Kreide",
    text: "Große Findlinge liegen im flachen Wasser vor der Kreideküste. Sie sind übrig geblieben, als das Kliff zurückwich — der flache Grund darunter ist die Abrasionsplattform.",
    begriffe: ["Blockstrand", "Abrasionsplattform"] },
  { id: "jasmund-feuersteinstrand", bereich: "ruegen", kliff: "kreide", titel: "Strand aus Feuersteinen",
    text: "Die Brandung hat die weiche Kreide fortgespült, die harten Feuersteinknollen bleiben liegen und werden rund geschliffen.", begriffe: ["Blockstrand"] },
  { id: "wissow-schutthang", bereich: "ruegen", kliff: "kreide", titel: "Schutthang an den Wissower Klinken",
    text: "Ein Hang aus Kreideschutt lehnt an der Wand — die Kliffhalde. Solange sie liegt, erreicht die Brandung die Wand nicht.", begriffe: ["Kliffhalde"] },
  { id: "wissow-schuttkegel", bereich: "ruegen", kliff: "kreide", titel: "Schuttkegel mit umgestürzten Bäumen",
    text: "Bei einem Abbruch sind Boden und Wald von der Kante mit abgestürzt. Die Stämme liegen im Schutt, bis sie verrotten oder die See sie holt." },
  { id: "kreideabbruch-2007", bereich: "ruegen", kliff: "kreide", titel: "Kreideabbruch auf Jasmund (2007)",
    text: "Ein Abbruch an der Kreideküste, fotografiert im Juni 2007. Solche Abbrüche kommen meist im Winter und Frühjahr, nach Frost, Regen und Sturm." },
  { id: "jasmund-hohlkehle", bereich: "ruegen", kliff: "kreide", titel: "Hohlkehle im Nationalpark Jasmund",
    text: "Die Brandung hat den Fuß der Wand ausgehöhlt, darüber hängt das Material frei. Wird der Überhang zu schwer, bricht er ab.",
    begriffe: ["Brandungshohlkehle", "Überhang"] },
  { id: "arkona", bereich: "ruegen", kliff: "mergel", titel: "Steilküste am Kap Arkona",
    text: "Am Kap Arkona liegt über der Kreide Geschiebemergel. Rinnen und helle Abrissflächen zeigen, wo Material abgerutscht ist." },
  { id: "arkona-rutschung", bereich: "ruegen", kliff: "mergel", titel: "Rutschung südlich von Kap Arkona",
    text: "Hier ist Geschiebemergel abgerutscht: oben die steile Abrissnische, darunter die lockere Rutschmasse.", begriffe: ["Abrissnische"] },
  { id: "arkona-blockstrand", bereich: "ruegen", kliff: "mergel", titel: "Blockstrand bei Kap Arkona",
    text: "Vor dem Mergelkliff liegen Findlinge. Das Eis hat sie aus Skandinavien mitgebracht, die Brandung hat sie aus dem Kliff gewaschen.", begriffe: ["Blockstrand"] },

  // ── Møns Klint und GeoCenter ──
  { id: "moen-1", bereich: "moen", kliff: "moen", titel: "Møns Klint",
    text: "Bis 128 m hohe Kreidewände auf der dänischen Insel Møn, davor ein schmaler Strand." },
  { id: "moen-3", bereich: "moen", kliff: "moen", titel: "Treppe hinab zum Kliffuß",
    text: "Treppen führen vom Wald hinunter an den Strand. Unten sieht man, wie steil und wie hoch die Wand wirklich ist." },
  { id: "moen-klippen", bereich: "moen", kliff: "moen", titel: "Kreidewand von unten",
    text: "Rinnen und Nischen in der Wand zeigen, wo Stücke abgebrochen sind. Oben wächst der Buchenwald bis an die Kante.", begriffe: ["Abbruchkante"] },
  { id: "moen-store-taler", bereich: "moen", kliff: "moen", titel: "Store Taler",
    text: "An der Store Taler rutschten im Januar 2007 über 100 000 m³ Kreide, Sand und Ton auf einer alten Überschiebungsfläche ab und bildeten eine Halbinsel mit umgestürzten Bäumen." },
  { id: "moen-feuerstein", bereich: "moen", kliff: "moen", titel: "Feuersteinbänder",
    text: "Dunkle Feuersteinknollen in Reihen: Das war einmal waagerechter Meeresboden. Das Eis hat die Kreide später schräg gestellt.", begriffe: ["Kreide mit Feuerstein"] },
  { id: "moen-schuttrinne", bereich: "moen", kliff: "moen", titel: "Schuttrinne",
    text: "Aus einer Kerbe in der Wand fließt Kreideschutt bis an den Strand — hier arbeiten Regen, Frost und Rutschungen zusammen.", begriffe: ["Kliffhalde"] },
  { id: "moen-dronningestolen", bereich: "moen", kliff: "moen", titel: "Dronningestolen (historisch)",
    text: "Historisches Foto von Peter Elfelt: Kinder am Strand vor dem Dronningestolen, dem höchsten Punkt des Møns Klint." },
  { id: "geocenter", bereich: "moen", titel: "GeoCenter Møns Klint",
    text: "Das Museum am Kliff erklärt, wie die Kreide im Meer entstand und wie das Eis die Klippen aufgeschoben hat." },
  { id: "geocenter-innen", bereich: "moen", titel: "In der Ausstellung",
    text: "Die Ausstellung im GeoCenter zeigt die Erdgeschichte von Møn — von der Kreidezeit bis zur Eiszeit." },
  { id: "geocenter-mosasaurier", bereich: "moen", titel: "Mosasaurier",
    text: "Ein Meeresreptil aus der Kreidezeit. Es lebte in dem Meer, an dessen Grund sich die Kreide ablagerte." },

  // ── Weitere Steilufer ──
  { id: "brodten", bereich: "steil", kliff: "mergel", titel: "Brodtener Steilufer",
    text: "Das Brodtener Ufer bei Travemünde besteht aus Geschiebemergel. Es weicht im Mittel 50 cm bis 1 m im Jahr zurück.", begriffe: ["Geschiebemergel"] },
  { id: "brodten-luft", bereich: "steil", kliff: "mergel", titel: "Brodtener Ufer von oben",
    text: "Kliff, schmaler Strand und davor das flache Wasser mit Steinen — die Abrasionsplattform.", begriffe: ["Abrasionsplattform"] },
  { id: "fischland", bereich: "steil", kliff: "mergel", titel: "Hohes Ufer am Fischland",
    text: "Zwischen Ahrenshoop und Wustrow: ein Steilufer aus Geschiebemergel und Sand. Betonreste in der Brandung zeigen, wie weit das Ufer schon zurückgewichen ist." },
  { id: "hiddensee", bereich: "steil", kliff: "mergel", titel: "Steilufer auf Hiddensee",
    text: "An der Swantevitschlucht zerfällt der Geschiebemergel in Rinnen und kleine Rutschungen." },
  { id: "rotes-kliff", bereich: "steil", kliff: "sand", titel: "Rotes Kliff von oben",
    text: "Das Rote Kliff bei Kampen auf Sylt: rote Kliffwand, davor ein breiter Sandstrand — seit den 1970er-Jahren immer wieder aufgespült." },
  { id: "rotes-kliff-1980", bereich: "steil", kliff: "sand", titel: "Rotes Kliff 1980",
    text: "Eine frische Abbruchkante im Sand: Die Brandung hat den Fuß des Kliffs weggespült, der Sand darüber ist nachgebrochen.", begriffe: ["Abbruchkante"] },
  { id: "rotes-kliff-treppe", bereich: "steil", kliff: "sand", titel: "Treppe über das Rote Kliff",
    text: "Treppen und Stege führen über das Kliff. Trampelpfade würden die Kante zertreten und Rinnen für den Regen öffnen." },
  { id: "kampener-findling", bereich: "steil", kliff: "sand", titel: "Findling vom Roten Kliff",
    text: "Dieser Findling stammt aus dem Roten Kliff. Das Eis hat ihn aus Skandinavien nach Sylt getragen." },
  { id: "morsum-kliff", bereich: "steil", kliff: "sand", titel: "Morsum-Kliff",
    text: "Das Morsum-Kliff im Osten von Sylt: ein altes Kliff mit Dünen und Salzwiese davor." },

  // ── Flachküste, Watt und Haken ──
  { id: "strandhafer", bereich: "flach", titel: "Dünen mit Strandhafer",
    text: "Auf Spiekeroog: Die Halme bremsen den Wind, der Sand fällt heraus — die Düne wächst. Strandhafer wächst mit, wenn er zugeweht wird.", begriffe: ["Düne"] },
  { id: "sturmflut-sylt-1985", bereich: "flach", titel: "Sturmflut auf Sylt (1985)",
    text: "Die Wellen schlagen gegen den Dünenfuß und reißen eine steile Abbruchkante in die Düne." },
  { id: "watt-priel", bereich: "flach", titel: "Watt und Priel",
    text: "Watt bei Ebbe an der Elbmündung: Durch die Priele fließt das Wasser ab — und bei Flut zuerst wieder herein.", begriffe: ["Watt", "Priel"] },
  { id: "watt-queller", bereich: "flach", titel: "Watt vor Friedrichskoog",
    text: "Die grünen Flecken sind Queller und Schlickgras: die ersten Pflanzen, aus denen eine Salzwiese wird." },
  { id: "salzwiese", bereich: "flach", titel: "Salzwiese auf Amrum",
    text: "Salzwiesen stehen nur bei hohen Fluten unter Wasser. Sie bremsen die Wellen, bevor sie den Deich erreichen.", begriffe: ["Vorland (Salzwiese)"] },
  { id: "landunter", bereich: "flach", titel: "Landunter auf Hallig Hooge (2013)",
    text: "Bei Sturmflut steht die Hallig unter Wasser; nur die Warften mit den Häusern ragen heraus." },
  { id: "darsser-ort", bereich: "flach", titel: "Darßer Ort",
    text: "Am Darßer Ort wächst das Land: Die Strömung trägt Sand an der Küste entlang und baut einen Haken ins Meer." },
  { id: "darsser-ort-kernzone", bereich: "flach", titel: "Kernzone am Darßer Ort",
    text: "In der Kernzone des Nationalparks darf sich die Küste frei verändern. Betreten ist verboten, Küstenschutz gibt es hier nicht." },

  // ── Küstenschutz ──
  { id: "vorspuelung", bereich: "schutz", titel: "Sandvorspülung bei Westerland (2012)",
    text: "Durch Rohre wird Sand vom Schiff an den Strand gepumpt, Raupen verteilen ihn. Auf Sylt passiert das seit 1972 jedes Jahr." },
  { id: "vorspuelung-rohr", bereich: "schutz", titel: "Das Ende der Spülleitung",
    text: "Aus diesem Rohr strömt ein Gemisch aus Wasser und Sand. Das Wasser läuft ab, der Sand bleibt liegen." },
  { id: "vorspuelung-hoernum-1983", bereich: "schutz", titel: "Vorspülung vor Hörnum (1983)",
    text: "Aus der Luft: Der neu aufgespülte Sand liegt als heller Keil vor dem Strand." },
  { id: "tetrapoden", bereich: "schutz", titel: "Tetrapoden in Hörnum",
    text: "Vierbeinige Betonklötze, die sich ineinander verhaken und die Wellen brechen.", begriffe: ["Deckwerk"] },
  { id: "tetrapoden-2", bereich: "schutz", titel: "Tetrapoden am Strand",
    text: "Tetrapoden halten die Küste an der Stelle fest. Vor ihnen fehlt aber der Sand — die Wellen prallen zurück und spülen ihn fort.", begriffe: ["Deckwerk"] },
  { id: "buhnen", bereich: "schutz", titel: "Buhnen an der Ostsee",
    text: "Pfahlreihen quer zum Strand bremsen die Strömung entlang der Küste und halten den Sand fest." },
  { id: "sandfangzaun-1976", bereich: "schutz", titel: "Sandfangzäune auf Sylt (1976)",
    text: "Vor dem Dünenfuß: Hinter dem Zaun lagert sich Flugsand ab, die Düne wächst nach vorn." },
  { id: "sandfangzaun", bereich: "schutz", titel: "Sandfangzaun in Cuxhaven",
    text: "Ein Zaun aus Reisig bremst den Wind. Der Sand fällt heraus und bleibt liegen." },
  { id: "lahnungen", bereich: "schutz", titel: "Lahnungen im Wattenmeer",
    text: "Pfahlreihen mit Reisig beruhigen das Wasser. Zwischen ihnen setzt sich Schlick ab — einige Zentimeter im Jahr.", begriffe: ["Lahnungen"] },
  { id: "lahnungen-hallig", bereich: "schutz", titel: "Lahnungsfelder vor einer Hallig",
    text: "Vor Hallig Nordstrandischmoor wächst das Watt in den Lahnungsfeldern langsam in die Höhe." },
  { id: "deich-schafe", bereich: "schutz", titel: "Schafe auf dem Deich",
    text: "Schafe halten das Gras kurz und treten den Boden fest. So bleibt die Grasdecke dicht und der Deich stabil." },
  { id: "deich-nordstrand", bereich: "schutz", titel: "Seedeich auf Nordstrand",
    text: "Die flache Außenböschung zeigt zum Watt, auf der Deichkrone führt ein Weg entlang.", begriffe: ["Außenböschung", "Deichkrone mit Fahrweg"] },
  { id: "deich-innen", bereich: "schutz", titel: "Binnenseite des Deichs in Büsum",
    text: "Auf der Landseite ist der Deich steiler als zur See hin; am Fuß verläuft der Verteidigungsweg.", begriffe: ["Binnenböschung"] },
  { id: "deich-sturmflutmarken", bereich: "schutz", titel: "Sturmflutmarken in Harlesiel",
    text: "An diesem Pfahl am Seedeich ist markiert, wie hoch das Wasser bei früheren Sturmfluten stand." },
];

const alle = nachweise as Record<string, Nachweis>;
export const nachweisFuer = (id: string): Nachweis | undefined => alle[id];

/** Die Bilder, die zu einem Kliff im Querschnitt passen */
export const bilderZuKliff = (typ: KliffTyp) => GALERIE.filter(b => b.kliff === typ);
