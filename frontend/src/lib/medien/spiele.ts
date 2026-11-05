/**
 * Die Spiele der Medien-Sim:
 *  - Eilbote: Ein Auftrag aus einem bestimmten Jahr — welches Medium bringt die
 *    Nachricht am besten ans Ziel? Nur Medien, die es damals schon gab.
 *  - Wer war zuerst? Medien nach dem Jahr ordnen.
 */
import { MEDIEN, medium, type Medium } from "./medien";

export interface Auftrag {
  id: string;
  jahr: number;
  ort: string;
  text: string;
  /** Medium-Ids; das erste ist NICHT automatisch richtig */
  wahl: string[];
  richtig: string;
  warum: string;
  /** witzige Antwort je falscher Wahl */
  daneben: Record<string, string>;
}

export const AUFTRAEGE: Auftrag[] = [
  {
    id: "jagd", jahr: -15000, ort: "In einer Höhle", text: "Du willst deinen Enkeln zeigen, wie man ein Wildpferd jagt — auch wenn du längst nicht mehr lebst.",
    wahl: ["signale", "hoehle"], richtig: "hoehle", warum: "Nur das Bild an der Wand bleibt erhalten. Ein Trommelsignal ist nach Sekunden verklungen.",
    daneben: { signale: "Bumm-bumm. Deine Enkel sind in 40 Jahren geboren. Das Signal leider nicht mehr zu hören." },
  },
  {
    id: "bier", jahr: -3000, ort: "Uruk, Mesopotamien", text: "Der Tempel verleiht 30 Krüge Bier. In einem Jahr soll niemand behaupten können, es seien nur 20 gewesen.",
    wahl: ["signale", "keilschrift", "hoehle"], richtig: "keilschrift", warum: "Eine Tontafel ist ein Beleg — fest, haltbar und mit Siegel. Die Buchhaltung war der Grund, warum die Schrift erfunden wurde.",
    daneben: { signale: "Rauchzeichen als Quittung? »Ich hab doch gesehen, dass es zwei Wölkchen waren!« — Streit garantiert.", hoehle: "30 Krüge an die Tempelwand malen? Über Nacht übermalt jemand zehn davon — und eine Unterschrift fehlt auch." },
  },
  {
    id: "troja", jahr: -1200, ort: "Vor Troja", text: "Sobald Troja fällt, soll die Königin im 600 km entfernten Argos es noch in derselben Nacht wissen.",
    wahl: ["signale", "leuchtfeuer", "keilschrift"], richtig: "leuchtfeuer", warum: "Die Feuerkette ist rasend schnell. Und die Nachricht ist ein einziges Ja — dafür reicht ein Feuer.",
    daneben: { signale: "Trommeln über 600 km und das Meer? Die Fische hören es. Die Königin nicht.", keilschrift: "Eine Tontafel schreiben, trocknen, tragen … Die Nacht ist leider vorbei." },
  },
  {
    id: "rom", jahr: -50, ort: "Gallien", text: "Caesar will dem Senat in Rom einen ausführlichen Bericht über seinen Feldzug schicken.",
    wahl: ["leuchtfeuer", "bote", "brieftaube"], richtig: "bote", warum: "Ein langer Text braucht Schrift und einen Boten, der Stationen wechselt — der römische Kurierdienst.",
    daneben: { leuchtfeuer: "Ein Feuer kann nicht »Ich kam, ich sah, ich siegte, siehe Anhang« sagen.", brieftaube: "Die Tauben fliegen nur heim — und zwar nach Gallien, nicht nach Rom. Außerdem: 300 Seiten am Taubenbein?" },
  },
  {
    id: "reformation", jahr: 1520, ort: "Wittenberg", text: "Du willst, dass in wenigen Wochen in ganz Deutschland Tausende deine Ideen lesen.",
    wahl: ["handschrift", "buchdruck", "bote"], richtig: "buchdruck", warum: "Nur der Druck macht Tausende gleiche Kopien in kurzer Zeit. So verbreiteten sich Luthers Schriften.",
    daneben: { handschrift: "Bis die Mönche fertig sind, ist es 1620. Und die Mönche sind nicht unbedingt deine Fans.", bote: "Ein Bote, eine Nachricht, ein Empfänger. Du bräuchtest 10 000 Boten." },
  },
  {
    id: "seeschlacht", jahr: 1795, ort: "Lille", text: "Die französische Regierung in Paris soll in einer Stunde wissen, ob die Stadt Condé zurückerobert ist.",
    wahl: ["post", "chappe", "zeitung"], richtig: "chappe", warum: "Der optische Telegraf schafft 230 km in weniger als einer Stunde — wenn das Wetter mitspielt.",
    daneben: { post: "Die Postkutsche braucht zwei Tage. Bis dahin ist der nächste Krieg schon angefangen.", zeitung: "Die Zeitung erscheint nächste Woche. »Wie wir erfahren …« ist zu spät." },
  },
  {
    id: "reuters", jahr: 1850, ort: "Brüssel", text: "Börsenkurse sollen nach Aachen. Die Telegrafenleitung hat dazwischen eine Lücke von 120 km.",
    wahl: ["brieftaube", "bote", "post"], richtig: "brieftaube", warum: "Genau so machte es Paul Julius Reuter 1850: Die Tauben überbrückten die Lücke in rund zwei Stunden — schneller als jeder Zug.",
    daneben: { bote: "Ein Reiter galoppiert die 120 km — und kommt Stunden nach der Taube an. Die Konkurrenz hat schon gekauft.", post: "Die Postkutsche ist langsamer als die Konkurrenz. Wer an der Börse zu spät ist, verliert." },
  },
  {
    id: "atlantik", jahr: 1870, ort: "London", text: "Eine Bank muss in New York noch heute einen Kauf bestätigen.",
    wahl: ["post", "telegraf", "brieftaube"], richtig: "telegraf", warum: "Seit 1866 liegt das Telegrafenkabel durch den Atlantik: Minuten statt zehn Tage Schiffsreise.",
    daneben: { post: "Das Postschiff kommt in zehn Tagen an. Die Bank wartet nicht.", brieftaube: "5600 km übers Meer? Die Taube landet erschöpft auf einem Fischerboot und bleibt dort." },
  },
  {
    id: "gurke", jahr: 1890, ort: "Hamburg", text: "Du willst deiner Oma in Berlin persönlich und sofort zum Geburtstag gratulieren — mit deiner eigenen Stimme.",
    wahl: ["telegraf", "telefon", "schallplatte"], richtig: "telefon", warum: "Nur am Telefon hört Oma deine Stimme live. (Das Fräulein vom Amt verbindet.)",
    daneben: { telegraf: "»HERZLICHEN GLUECKWUNSCH STOP« — kommt an, aber ohne deine Stimme. Und kostet pro Wort.", schallplatte: "Eine Platte aufnehmen und schicken? Oma hört's nächste Woche. Und braucht ein Grammophon." },
  },
  {
    id: "alle", jahr: 1930, ort: "Berlin", text: "Eine Sturmwarnung soll sofort alle Menschen an der Küste erreichen.",
    wahl: ["telefon", "radio", "zeitung"], richtig: "radio", warum: "Ein Sender, alle Empfänger gleichzeitig — und ohne Kabel. Dafür ist der Rundfunk gemacht.",
    daneben: { telefon: "Jeden einzeln anrufen? Bis du beim Buchstaben B bist, ist der Sturm da.", zeitung: "»Gestern gab es einen Sturm« — danke, das haben wir bemerkt." },
  },
  {
    id: "mondlandung", jahr: 1969, ort: "Houston", text: "Die Mondlandung soll live auf der ganzen Welt zu sehen sein.",
    wahl: ["film", "fernsehen", "radio"], richtig: "fernsehen", warum: "Fernsehen, über Satelliten verteilt: Etwa 600 Millionen Menschen sahen gleichzeitig zu.",
    daneben: { film: "Den Film entwickeln und in Kinos verschicken — live ist anders.", radio: "Live ja, aber niemand sieht den Fußabdruck. »Er ist jetzt … ziemlich … grau.«" },
  },
  {
    id: "mixtape", jahr: 1985, ort: "Erfurt", text: "Du willst deiner besten Freundin die zehn besten Lieder aus dem Radio schenken.",
    wahl: ["schallplatte", "kassette", "cd"], richtig: "kassette", warum: "Kassetten konnte jeder bespielen — das Mixtape war das Geschenk der 1980er.",
    daneben: { schallplatte: "Eine Platte pressen? Dafür brauchst du ein Presswerk.", cd: "CDs gab es 1985, aber selbst brennen konnte man sie noch nicht." },
  },
  {
    id: "hausaufgabe", jahr: 1992, ort: "Zuhause", text: "Deine Hausaufgabe (eine Textdatei) soll zu deinem Freund nebenan, der einen Computer hat.",
    wahl: ["diskette", "fax", "cd"], richtig: "diskette", warum: "1992 hatte fast jeder PC ein Diskettenlaufwerk. Die Datei passt locker drauf.",
    daneben: { fax: "Er bekommt Papier — aber keine Datei, die er bearbeiten kann.", cd: "Einen CD-Brenner hatte 1992 fast niemand — die Dinger kosteten so viel wie ein Gebrauchtwagen." },
  },
  {
    id: "spaet", jahr: 1999, ort: "Bushaltestelle", text: "Du kommst eine halbe Stunde später nach Hause. Deine Mutter soll es wissen, ohne dass du sie im Meeting störst.",
    wahl: ["telefon", "sms", "email"], richtig: "sms", warum: "Die SMS wartet still, bis sie Zeit hat — und du hast das Handy dabei.",
    daneben: { telefon: "Das Handy klingelt mitten im Meeting. Sehr unangenehm.", email: "1999 liest Mama E-Mails abends am PC. Dann bist du längst daheim." },
  },
  {
    id: "video", jahr: 2015, ort: "Schulhof", text: "Ein Video von deinem Skateboard-Trick soll heute noch Tausende Menschen sehen.",
    wahl: ["fernsehen", "socialmedia", "videokassette"], richtig: "socialmedia", warum: "Hochladen, teilen, viral: Jeder ist Sender. Mit dem Fernsehen musst du erst einen Sender überzeugen.",
    daneben: { fernsehen: "Die Redaktion meldet sich in drei Monaten. Vielleicht.", videokassette: "Kassetten kopieren und verteilen? Bis 1000 Leute sie haben, kannst du den Trick nicht mehr." },
  },
  {
    id: "faktencheck", jahr: 2024, ort: "Klassenzimmer", text: "Ein Chatbot behauptet, Gutenberg habe 1650 das Telefon erfunden. Was hilft am besten, um das zu prüfen?",
    wahl: ["ki", "buchdruck", "socialmedia"], richtig: "buchdruck", warum: "Ein Lexikon oder Schulbuch mit geprüften Angaben ist eine verlässliche Quelle. Eine zweite KI-Antwort ist kein Beleg — und ein virales Video auch nicht.",
    daneben: { ki: "Die KI noch mal fragen? Sie entschuldigt sich höflich und erfindet etwas Neues.", socialmedia: "Ein Video mit 2 Millionen Likes sagt: »Gutenberg war ein Alien.« Hm." },
  },
];

/** Welche Medien gab es in diesem Jahr schon? */
export const gabEs = (m: Medium, jahr: number) => m.jahr <= jahr;

/** Punkte: erster Versuch 100, zweiter 40, sonst 0 */
export const punkteFuer = (versuche: number) => (versuche === 1 ? 100 : versuche === 2 ? 40 : 0);

/** Zufällige Auswahl für »Wer war zuerst?«: n Medien mit mindestens `abstand` Jahren Unterschied */
export function sortierRunde(n: number, zufall: () => number = Math.random, abstand = 10): Medium[] {
  const kandidaten = MEDIEN.filter(m => !m.unsicher);
  for (let versuch = 0; versuch < 200; versuch++) {
    const gemischt = [...kandidaten].sort(() => zufall() - 0.5);
    const auswahl: Medium[] = [];
    for (const m of gemischt) {
      if (auswahl.every(a => Math.abs(a.jahr - m.jahr) >= abstand)) auswahl.push(m);
      if (auswahl.length === n) return auswahl;
    }
  }
  return kandidaten.slice(0, n);
}

/** Wie viele stehen an der richtigen Stelle? */
export function richtigPlatziert(reihenfolge: string[]): boolean[] {
  const soll = [...reihenfolge].sort((a, b) => medium(a)!.jahr - medium(b)!.jahr);
  return reihenfolge.map((id, i) => medium(id)!.jahr === medium(soll[i])!.jahr);
}
