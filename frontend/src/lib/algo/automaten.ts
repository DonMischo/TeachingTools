/**
 * Einstieg »Tu was du tun musst — aber tu's richtig!«: Automaten bedienen.
 *
 * Jeder Automat hat Handlungskarten. Ein Ausführer, der alles wörtlich nimmt,
 * arbeitet sie der Reihe nach ab. Eine Karte braucht Tatsachen (`braucht`),
 * schafft neue (`setzt`) und verbraucht welche (`nimmt`). Unscharfe Karten
 * scheitern immer (`fehler`), zu spezielle nur am anderen Automaten
 * (Variante `ersetze`). So zeigt jeder Fehlversuch eine Eigenschaft von
 * Algorithmen: eindeutig, ausführbar, endlich, allgemein gültig.
 */
export type AutomatFehlerArt = "eindeutig" | "ausfuehrbar" | "endlich" | "allgemein" | "reihenfolge";

export interface AutomatFehler { art: AutomatFehlerArt; text: string }

export interface Handlung {
  id: string;
  text: string;
  /** was der Ausführer dabei sagt */
  sagt: string;
  teil?: string;
  braucht?: string[];
  /** Begründung, wenn eine Tatsache fehlt (sonst ein allgemeiner Satz) */
  ohne?: Record<string, AutomatFehler>;
  setzt?: string[];
  nimmt?: string[];
  fehler?: AutomatFehler;
  /** nimmt eine Münze dieses Werts (Cent) in die Hand; "preis" = passend zum Automaten */
  muenze?: number | "preis";
  /** wirft die Münze in der Hand ein — der Automat prüft ihren Wert gegen seinen Preis */
  prueftMuenze?: boolean;
}

export interface Variante {
  id: string;
  name: string;
  text: string;
  /** Preis in Cent, falls der Automat Münzen prüft */
  preis?: number;
  ersetze?: Record<string, Partial<Handlung>>;
}

export interface Teil { id: string; label: string; x: number; y: number; w: number; h: number; rund?: boolean }

export interface Automat {
  id: string;
  name: string;
  icon: string;
  geschichte: string;
  /** Tatsache → Anzeige im Inventar */
  tatsachen: Record<string, string>;
  ziel: string[];
  /** Hinweis, wenn am Ende ein Ziel fehlt */
  zielFehlt: Record<string, string>;
  handlungen: Handlung[];
  varianten: Variante[];
  teile: Teil[];
  /** »Was macht eigentlich der Automat?« — in richtiger Reihenfolge */
  innen: string[];
  /** Id des passenden Beispiels im Flussdiagramm-Reiter */
  fluss: string;
}

export const MERKMAL: Record<AutomatFehlerArt, string> = {
  eindeutig: "nicht eindeutig",
  ausfuehrbar: "nicht ausführbar",
  endlich: "nicht endlich",
  allgemein: "nicht allgemein gültig",
  reihenfolge: "falsche Reihenfolge",
};

const eindeutig = (text: string): AutomatFehler => ({ art: "eindeutig", text });
const ausfuehrbar = (text: string): AutomatFehler => ({ art: "ausfuehrbar", text });

export const AUTOMATEN: Automat[] = [
  {
    id: "kaugummi",
    name: "Kaugummiautomat",
    icon: "🍬",
    geschichte: "Auf dem Heimweg kommst du an einem Kaugummiautomaten vorbei. Du hast noch Taschengeld übrig und willst etwas zum Naschen mitnehmen.",
    tatsachen: { muenze: "🪙 Münze in der Hand", drin: "🪙 Münze im Schlitz", fach: "🍬 Kaugummi im Fach", klappe: "🚪 Klappe offen", hand: "🍬 Kaugummi in der Hand" },
    ziel: ["hand"],
    zielFehlt: { hand: "Der Kaugummi ist noch nicht in deiner Hand." },
    handlungen: [
      { id: "k-muenze", text: "Nimm eine 20-Cent-Münze aus dem Portemonnaie.", sagt: "Ich nehme eine 20-Cent-Münze heraus.", setzt: ["muenze"], muenze: 20 },
      { id: "k-m50", text: "Nimm eine 50-Cent-Münze aus dem Portemonnaie.", sagt: "Ich nehme eine 50-Cent-Münze heraus.", setzt: ["muenze"], muenze: 50 },
      { id: "k-m10", text: "Nimm eine 10-Cent-Münze aus dem Portemonnaie.", sagt: "Ich nehme eine 10-Cent-Münze heraus.", setzt: ["muenze"], muenze: 10 },
      { id: "k-m100", text: "Nimm eine 1-Euro-Münze aus dem Portemonnaie.", sagt: "Ich nehme eine 1-Euro-Münze heraus.", setzt: ["muenze"], muenze: 100 },
      { id: "k-m200", text: "Nimm eine 2-Euro-Münze aus dem Portemonnaie.", sagt: "Ich nehme eine 2-Euro-Münze heraus.", setzt: ["muenze"], muenze: 200 },
      { id: "k-preis", text: "Lies den Preis ab und nimm eine passende Münze aus dem Portemonnaie.", sagt: "Auf dem Schild steht der Preis — ich nehme genau die passende Münze.", teil: "schild", setzt: ["muenze"], muenze: "preis" },
      {
        id: "k-einwerfen", text: "Steck die Münze in den Münzschlitz.", sagt: "Ich stecke die Münze in den Schlitz. Klick!", teil: "schlitz",
        braucht: ["muenze"], nimmt: ["muenze"], setzt: ["drin"], prueftMuenze: true,
        ohne: { muenze: ausfuehrbar("Ich habe gar keine Münze in der Hand!") },
      },
      {
        id: "k-drehen", text: "Dreh den Drehgriff einmal ganz herum.", sagt: "Ich drehe den Griff einmal herum. Rrrratsch — da fällt etwas!", teil: "griff",
        braucht: ["drin"], nimmt: ["drin"], setzt: ["fach"],
        ohne: { drin: ausfuehrbar("Der Griff klemmt — es steckt ja keine Münze drin.") },
      },
      { id: "k-klappe", text: "Öffne die Klappe am Ausgabefach.", sagt: "Ich klappe das Ausgabefach auf.", teil: "fach", setzt: ["klappe"] },
      {
        id: "k-nehmen", text: "Nimm den Kaugummi aus dem Fach.", sagt: "Ich greife ins Fach und nehme den Kaugummi.", teil: "fach",
        braucht: ["klappe", "fach"], nimmt: ["fach"], setzt: ["hand"],
        ohne: { klappe: ausfuehrbar("Die Klappe ist zu — ich komme nicht ans Fach."), fach: ausfuehrbar("Das Fach ist leer.") },
      },
      { id: "k-hol", text: "Hol dir einen Kaugummi.", sagt: "Holen? Wie denn?", fehler: eindeutig("Das ist kein genauer Einzelschritt. Ich weiß nicht, was ich tun soll.") },
      { id: "k-dreh-bisschen", text: "Dreh am Griff.", sagt: "Ich drehe … ein kleines Stück. Wie weit denn? In welche Richtung?", teil: "griff", fehler: eindeutig("Wie weit und in welche Richtung? Der Schritt ist nicht präzise.") },
      {
        id: "k-dreh-bis", text: "Dreh so lange am Griff, bis ein Kaugummi herauskommt.", sagt: "Ich drehe den Griff, bis etwas kommt …", teil: "griff",
        braucht: ["drin"], nimmt: ["drin"], setzt: ["fach"],
        ohne: { drin: { art: "endlich", text: "Ohne Münze kommt nie ein Kaugummi. Ich drehe … und drehe … und drehe … für immer." } },
      },
      { id: "k-schuetteln", text: "Schüttle den Automaten kräftig.", sagt: "Ich rüttle am Automaten …", fehler: ausfuehrbar("Der Automat hängt fest an der Wand — so geht das nicht.") },
    ],
    varianten: [
      { id: "a", name: "Automat A (20 Cent)", text: "Ein Kaugummi kostet 20 Cent. Der Schlitz nimmt nur 20-Cent-Münzen.", preis: 20 },
      {
        id: "b", name: "Automat B (50 Cent)", text: "Ein anderer Automat: Hier kostet ein Kaugummi 50 Cent, der Schlitz nimmt nur 50-Cent-Münzen.", preis: 50,
      },
    ],
    teile: [
      { id: "schild", label: "Preisschild", x: 60, y: 30, w: 80, h: 28 },
      { id: "schlitz", label: "Münzschlitz", x: 80, y: 120, w: 40, h: 12 },
      { id: "griff", label: "Drehgriff", x: 85, y: 150, w: 30, h: 30, rund: true },
      { id: "fach", label: "Ausgabefach", x: 70, y: 200, w: 60, h: 34 },
    ],
    innen: [
      "Warte, bis eine Münze eingeworfen wird.",
      "Prüfe, ob die Münze echt ist und genug wert.",
      "Gib den Drehgriff frei.",
      "Lass beim Drehen einen Kaugummi ins Fach fallen.",
      "Sperre den Drehgriff wieder.",
    ],
    fluss: "kaugummi",
  },
  {
    id: "pfand",
    name: "Pfandautomat",
    icon: "♻️",
    geschichte: "Du hast eine Tasche voller leerer Pfandflaschen. Im Supermarkt steht der Pfandautomat — am Ende willst du den Bon in der Hand halten.",
    tatsachen: { flasche: "🍾 Flasche in der Hand", eine: "✅ eine Flasche abgegeben", alle: "✅ alle Flaschen abgegeben", bon: "🧾 Bon im Schlitz", hand: "🧾 Bon in der Hand" },
    ziel: ["alle", "hand"],
    zielFehlt: { alle: "In der Tasche sind noch Flaschen.", hand: "Du hast noch keinen Bon in der Hand." },
    handlungen: [
      { id: "p-nehmen", text: "Nimm eine Flasche aus der Tasche.", sagt: "Ich nehme eine Flasche aus der Tasche.", setzt: ["flasche"] },
      {
        id: "p-einlegen", text: "Leg die Flasche mit dem Boden voran in die Öffnung und warte, bis das Band sie einzieht.",
        sagt: "Boden voran hinein … surr … weg ist sie.", teil: "oeffnung",
        braucht: ["flasche"], nimmt: ["flasche"], setzt: ["eine"],
        ohne: { flasche: ausfuehrbar("Ich habe keine Flasche in der Hand.") },
      },
      {
        id: "p-wiederhole", text: "Wiederhole die beiden Schritte davor, bis die Tasche leer ist.", sagt: "Nächste Flasche … und die nächste … Tasche leer!", teil: "oeffnung",
        braucht: ["eine"], setzt: ["alle"],
        ohne: { eine: ausfuehrbar("Welche »Schritte davor«? Ich habe noch gar keine Flasche abgegeben.") },
      },
      {
        id: "p-taste", text: "Drück die grüne Taste »Bon«.", sagt: "Ich drücke die grüne Taste — der Drucker rattert.", teil: "taste",
        braucht: ["alle"], setzt: ["bon"],
        ohne: { alle: { art: "reihenfolge", text: "Der Bon ist schon gedruckt, aber in der Tasche sind noch Flaschen. Die zählen jetzt nicht mehr mit." } },
      },
      {
        id: "p-fertig", text: "Fordere den Bon an — so, wie es der Automat anzeigt.", sagt: "Ich schaue, was der Automat anbietet, und fordere den Bon an.", teil: "taste",
        braucht: ["alle"], setzt: ["bon"],
        ohne: { alle: { art: "reihenfolge", text: "Der Bon ist schon gedruckt, aber in der Tasche sind noch Flaschen. Die zählen jetzt nicht mehr mit." } },
      },
      {
        id: "p-bon", text: "Nimm den Bon aus dem Ausgabeschlitz.", sagt: "Ich ziehe den Bon heraus.", teil: "drucker",
        braucht: ["bon"], nimmt: ["bon"], setzt: ["hand"],
        ohne: { bon: ausfuehrbar("Da ist kein Bon.") },
      },
      { id: "p-abgeben", text: "Gib die Flaschen ab.", sagt: "Abgeben? An wen? Wo?", fehler: eindeutig("Ich weiß nicht, wie das genau gehen soll — das sind viele Schritte in einem.") },
      { id: "p-irgendwie", text: "Steck die Flasche irgendwie rein.", sagt: "Ich stecke sie mit dem Deckel voran hinein … sie kommt zurück.", teil: "oeffnung", fehler: eindeutig("»Irgendwie« ist nicht präzise. Der Automat erkennt die Flasche nur mit dem Boden voran.") },
      { id: "p-werfen", text: "Wirf alle Flaschen auf einmal in die Öffnung.", sagt: "Ich werfe … klirr!", teil: "oeffnung", fehler: ausfuehrbar("Die Öffnung nimmt immer nur eine Flasche. Das geht so nicht.") },
      {
        id: "p-geld", text: "Drück so lange auf »Bon«, bis Geld herauskommt.", sagt: "Ich drücke … und drücke … und drücke …", teil: "taste",
        fehler: { art: "endlich", text: "Der Pfandautomat gibt nie Geld aus, nur einen Bon. Ich würde für immer drücken." },
      },
    ],
    varianten: [
      { id: "a", name: "Automat A (mit Taste)", text: "Nach der letzten Flasche drückt man die grüne Taste »Bon«." },
      {
        id: "b", name: "Automat B (Touchscreen)", text: "Ein neuerer Automat: Statt einer Taste gibt es einen Bildschirm mit »Fertig«.",
        ersetze: { "p-taste": { fehler: { art: "allgemein", text: "Hier gibt es keine grüne Taste, nur einen Bildschirm. Der Schritt passt nur zu einem Automaten." } } },
      },
    ],
    teile: [
      { id: "oeffnung", label: "Flaschenöffnung", x: 65, y: 70, w: 70, h: 70, rund: true },
      { id: "taste", label: "Taste »Bon«", x: 80, y: 160, w: 40, h: 20 },
      { id: "drucker", label: "Bonschlitz", x: 70, y: 200, w: 60, h: 10 },
    ],
    innen: [
      "Warte, bis eine Flasche aufs Band gelegt wird.",
      "Ziehe die Flasche ein und lies den Strichcode.",
      "Ist es eine Pfandflasche? Wenn nein: Gib sie zurück.",
      "Zähle den Pfandbetrag zur Summe dazu.",
      "Wenn »Bon« gedrückt wird: Drucke die Summe auf einen Bon.",
    ],
    fluss: "pfand",
  },
  {
    id: "fahrkarte",
    name: "Fahrkartenautomat",
    icon: "🎫",
    geschichte: "Du willst mit der Straßenbahn in die Stadt fahren. An der Haltestelle steht ein Fahrkartenautomat mit Bildschirm.",
    tatsachen: { gewaehlt: "📱 Einzelfahrt gewählt", preis: "💶 Preis bekannt", bezahlt: "🪙 bezahlt", fach: "🎫 Fahrkarte im Fach", hand: "🎫 Fahrkarte in der Hand", entwertet: "✅ Fahrkarte entwertet" },
    ziel: ["entwertet"],
    zielFehlt: { entwertet: "Die Fahrkarte ist noch nicht entwertet — so gilt sie nicht." },
    handlungen: [
      { id: "f-waehlen", text: "Tippe auf dem Bildschirm auf »Einzelfahrt«.", sagt: "Ich tippe auf »Einzelfahrt«.", teil: "bildschirm", setzt: ["gewaehlt"] },
      {
        id: "f-preis", text: "Lies den Preis auf dem Bildschirm ab.", sagt: "Da steht der Preis.", teil: "bildschirm",
        braucht: ["gewaehlt"], setzt: ["preis"],
        ohne: { gewaehlt: ausfuehrbar("Auf dem Bildschirm steht noch kein Preis — es ist ja nichts gewählt.") },
      },
      {
        id: "f-zahlen", text: "Wirf Münzen ein, bis der angezeigte Betrag bezahlt ist.", sagt: "Klimper, klimper — bezahlt!", teil: "muenzen",
        braucht: ["gewaehlt", "preis"], setzt: ["bezahlt", "fach"],
        ohne: { gewaehlt: ausfuehrbar("Der Automat spuckt die Münzen wieder aus — es ist noch keine Fahrkarte gewählt."), preis: eindeutig("Wie viel denn? Ich weiß den Preis nicht.") },
      },
      {
        id: "f-genau", text: "Wirf genau 2,30 € ein.", sagt: "Ich werfe 2,30 € ein.", teil: "muenzen",
        braucht: ["gewaehlt"], setzt: ["bezahlt", "fach"],
        ohne: { gewaehlt: ausfuehrbar("Der Automat spuckt die Münzen wieder aus — es ist noch keine Fahrkarte gewählt.") },
      },
      {
        id: "f-nehmen", text: "Nimm Fahrkarte und Wechselgeld aus dem Ausgabefach.", sagt: "Ich nehme die Fahrkarte heraus.", teil: "fach",
        braucht: ["fach"], nimmt: ["fach"], setzt: ["hand"],
        ohne: { fach: ausfuehrbar("Das Ausgabefach ist leer.") },
      },
      {
        id: "f-entwerten", text: "Steck die Fahrkarte in der Bahn in den Entwerter.", sagt: "Klack — gestempelt!",
        braucht: ["hand"], setzt: ["entwertet"],
        ohne: { hand: ausfuehrbar("Ich habe keine Fahrkarte, die ich entwerten könnte.") },
      },
      { id: "f-kaufen", text: "Kauf dir eine Fahrkarte.", sagt: "Kaufen … wie genau?", fehler: eindeutig("Das sind viele Schritte in einem. Welche Fahrkarte? Wie bezahlen?") },
      { id: "f-knopf", text: "Drück auf einen Knopf.", sagt: "Ich drücke … »Wochenkarte«. Hoppla.", teil: "bildschirm", fehler: eindeutig("Welchen Knopf? Der Schritt ist nicht eindeutig.") },
      {
        id: "f-abbrechen", text: "Drück so lange auf »Abbrechen«, bis die Fahrkarte kommt.", sagt: "Abbrechen … abbrechen … abbrechen …", teil: "bildschirm",
        fehler: { art: "endlich", text: "»Abbrechen« bricht immer nur ab — es kommt nie eine Fahrkarte. Das hört nie auf." },
      },
    ],
    varianten: [
      { id: "a", name: "Automat A (2,30 €)", text: "Eine Einzelfahrt kostet hier 2,30 €." },
      {
        id: "b", name: "Automat B (andere Stadt)", text: "In einer anderen Stadt kostet die Einzelfahrt 2,80 €.",
        ersetze: { "f-genau": { fehler: { art: "allgemein", text: "Hier kostet es 2,80 € — mit 2,30 € kommt keine Fahrkarte. Der Schritt passt nur zu einem Automaten." } } },
      },
    ],
    teile: [
      { id: "bildschirm", label: "Bildschirm", x: 50, y: 40, w: 100, h: 70 },
      { id: "muenzen", label: "Münzeinwurf", x: 120, y: 130, w: 30, h: 10 },
      { id: "fach", label: "Ausgabefach", x: 60, y: 200, w: 80, h: 30 },
    ],
    innen: [
      "Zeige das Startmenü an.",
      "Warte, bis eine Fahrkarte gewählt wird, und zeige den Preis an.",
      "Zähle die eingeworfenen Münzen mit.",
      "Ist genug bezahlt? Wenn nein: Warte auf weitere Münzen.",
      "Drucke die Fahrkarte und gib das Wechselgeld aus.",
    ],
    fluss: "fahrkarte",
  },
  {
    id: "kakao",
    name: "Kakaoautomat",
    icon: "☕",
    geschichte: "In der großen Pause willst du dir am Automaten in der Schule einen heißen Kakao holen. Bezahlt wird mit der Schülerkarte.",
    tatsachen: { becher: "🥤 Becher steht drunter", gewaehlt: "🔘 Kakao gewählt", bezahlt: "💳 bezahlt", fertig: "☕ Kakao fertig", hand: "☕ Kakao in der Hand" },
    ziel: ["hand"],
    zielFehlt: { hand: "Du hast noch keinen Kakao in der Hand." },
    handlungen: [
      { id: "c-becher", text: "Stell einen Becher unter den Auslauf.", sagt: "Ich stelle einen Becher unter den Auslauf.", teil: "auslauf", setzt: ["becher"] },
      { id: "c-taste", text: "Drück die Taste »Kakao«.", sagt: "Ich drücke »Kakao«. Die Anzeige sagt: Bitte bezahlen.", teil: "tasten", setzt: ["gewaehlt"] },
      {
        id: "c-karte", text: "Halte die Schülerkarte an das Lesegerät.", sagt: "Piep — bezahlt!", teil: "leser",
        braucht: ["gewaehlt"], setzt: ["bezahlt"],
        ohne: { gewaehlt: ausfuehrbar("Das Lesegerät piept: »Bitte zuerst ein Getränk wählen.«") },
      },
      {
        id: "c-zahlen", text: "Bezahle so, wie es auf dem Schild am Automaten steht.", sagt: "Ich lese das Schild und bezahle passend.", teil: "leser",
        braucht: ["gewaehlt"], setzt: ["bezahlt"],
        ohne: { gewaehlt: ausfuehrbar("Der Automat sagt: »Bitte zuerst ein Getränk wählen.«") },
      },
      {
        id: "c-warten", text: "Warte, bis die Anzeige »Fertig« zeigt.", sagt: "Blubb, zisch … »Fertig«!", teil: "auslauf",
        braucht: ["bezahlt", "becher"], setzt: ["fertig"],
        ohne: {
          bezahlt: { art: "endlich", text: "Es ist nicht bezahlt — die Anzeige wird nie »Fertig« zeigen. Ich warte für immer." },
          becher: ausfuehrbar("Der Kakao läuft in den Abfluss — es steht ja kein Becher drunter!"),
        },
      },
      {
        id: "c-nehmen", text: "Nimm den Becher vorsichtig heraus.", sagt: "Vorsichtig, heiß!", teil: "auslauf",
        braucht: ["fertig"], setzt: ["hand"],
        ohne: { fertig: ausfuehrbar("Da ist noch kein Kakao drin.") },
      },
      { id: "c-mach", text: "Mach dir einen Kakao.", sagt: "Wie macht man das?", fehler: eindeutig("Das ist kein Einzelschritt. Ich weiß nicht, was ich genau tun soll.") },
      { id: "c-irgendeine", text: "Drück irgendeine Taste.", sagt: "Ich drücke … »Tee mit Zitrone«.", teil: "tasten", fehler: eindeutig("»Irgendeine« ist nicht eindeutig — jetzt gibt es Tee.") },
      { id: "c-euro", text: "Halte eine 1-Euro-Münze an das Lesegerät.", sagt: "Ich halte die Münze ans Lesegerät … nichts.", teil: "leser", fehler: ausfuehrbar("Das Lesegerät liest nur Karten. Mit einer Münze geht das nicht.") },
    ],
    varianten: [
      { id: "a", name: "Automat A (Schülerkarte)", text: "Bezahlt wird mit der Schülerkarte." },
      {
        id: "b", name: "Automat B (Münzen)", text: "Der Automat im Lehrerzimmer nimmt nur Münzen.",
        ersetze: { "c-karte": { fehler: { art: "allgemein", text: "Dieser Automat hat kein Lesegerät, nur einen Münzschlitz. Der Schritt passt nur zu einem Automaten." } } },
      },
    ],
    teile: [
      { id: "tasten", label: "Tasten", x: 120, y: 50, w: 40, h: 70 },
      { id: "leser", label: "Lesegerät", x: 125, y: 135, w: 30, h: 25 },
      { id: "auslauf", label: "Auslauf", x: 45, y: 150, w: 60, h: 70 },
    ],
    innen: [
      "Warte, bis eine Getränketaste gedrückt wird.",
      "Warte auf die Bezahlung.",
      "Ist bezahlt? Wenn nein: Zeige »Bitte bezahlen«.",
      "Mische Pulver und heißes Wasser in den Becher.",
      "Zeige »Fertig« an.",
    ],
    fluss: "kakao",
  },
];

export type AusfuehrSchritt =
  | { art: "ok"; handlung: Handlung; tatsachen: string[] }
  | { art: "fehler"; handlung: Handlung | null; tatsachen: string[]; fehler: AutomatFehler };

/** Wendet eine Variante auf die Handlungen an. */
export function handlungenIn(a: Automat, varianteId: string): Handlung[] {
  const v = a.varianten.find(x => x.id === varianteId);
  return a.handlungen.map(h => (v?.ersetze?.[h.id] ? { ...h, ...v.ersetze[h.id] } : h));
}

const geld = (c: number) => (c >= 100 ? `${c / 100}-Euro` : `${c}-Cent`);

/** Warum die Münze nicht passt: am anderen Automaten ginge sie (allgemein), sonst gar nicht (ausführbar). */
function muenzFehler(a: Automat, wert: number, preis: number): AutomatFehler {
  if (a.varianten.some(v => v.preis === wert)) {
    return { art: "allgemein", text: `Hier kostet es ${preis} Cent — die ${geld(wert)}-Münze passt nur am anderen Automaten. Der Schritt gilt nicht für jeden Automaten.` };
  }
  if (wert < preis) return ausfuehrbar(`Die ${geld(wert)}-Münze ist zu wenig — sie fällt unten wieder heraus.`);
  return ausfuehrbar(`Die ${geld(wert)}-Münze passt gar nicht in den Schlitz.`);
}

/** Arbeitet die gewählten Karten wörtlich ab — bis zum ersten Fehler. */
export function fuehreAutomatAus(a: Automat, varianteId: string, ids: string[]): { schritte: AusfuehrSchritt[]; ok: boolean } {
  const alle = handlungenIn(a, varianteId);
  const schritte: AusfuehrSchritt[] = [];
  const preis = a.varianten.find(v => v.id === varianteId)?.preis;
  let t: string[] = [];
  let wert: number | null = null;
  for (const id of ids) {
    const h = alle.find(x => x.id === id);
    if (!h) continue;
    if (h.fehler) {
      schritte.push({ art: "fehler", handlung: h, tatsachen: t, fehler: h.fehler });
      return { schritte, ok: false };
    }
    const fehlt = (h.braucht ?? []).find(b => !t.includes(b));
    if (fehlt) {
      schritte.push({ art: "fehler", handlung: h, tatsachen: t, fehler: h.ohne?.[fehlt] ?? ausfuehrbar("Das geht jetzt noch nicht.") });
      return { schritte, ok: false };
    }
    if (h.prueftMuenze && preis !== undefined && wert !== preis) {
      schritte.push({ art: "fehler", handlung: h, tatsachen: t, fehler: muenzFehler(a, wert ?? 0, preis) });
      return { schritte, ok: false };
    }
    if (h.muenze !== undefined) wert = h.muenze === "preis" ? (preis ?? 0) : h.muenze;
    t = [...t.filter(x => !(h.nimmt ?? []).includes(x)), ...(h.setzt ?? []).filter(x => !t.includes(x))];
    schritte.push({ art: "ok", handlung: h, tatsachen: t });
  }
  const offen = a.ziel.find(z => !t.includes(z));
  if (offen) {
    schritte.push({ art: "fehler", handlung: null, tatsachen: t, fehler: { art: "ausfuehrbar", text: `Dein Algorithmus ist zu Ende, aber: ${a.zielFehlt[offen]}` } });
    return { schritte, ok: false };
  }
  return { schritte, ok: true };
}

/** Feste, aber gemischte Reihenfolge der Karten (gleich für alle, damit man vergleichen kann). */
export function gemischt<T>(liste: T[], saat: number): T[] {
  const a = [...liste];
  let s = saat;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
