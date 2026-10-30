/**
 * Die Geschichte der Woche: Nachrichten, Trends, Jonas und Mo.
 *
 * Nichts davon wird kommentiert. Die Ereignisse passieren zu ihrer Uhrzeit, die
 * Entscheidungen haben Folgen — und Schweigen ist auch eine Entscheidung
 * (unbeantwortete Wahlen verfallen über Nacht als »still«).
 *
 * Alle Funktionen hier ändern den (bereits kopierten) Stand direkt.
 */
import type { AppId, ChatId, Nachricht, Stand } from "./typen";
import { TRENDS } from "./trends";

export const TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
/** Letzter Schultag; der Samstag ist ein freiwilliger Bonustag danach */
export const LETZTER_TAG = 4;

export const CHAT_NAME: Record<ChatId, string> = {
  klasse: "8b 🔥", lea: "Lea", mo: "Mo", jonas: "Jonas", mama: "Mama", yilmaz: "Frau Yilmaz", klikkteam: "Klikk-Team", marke: "GlowDrink Team ✔", tim: "Tim",
  gewinn: "🎁 Klikk Gewinnspiel", leon: "leon.16", verein: "Verein", emma: "Emma",
};

const uhr = (h: number, m = 0) => h * 60 + m;

export function spur(s: Stand, app: AppId, an: "Klikk" | "AdKit", text: string) {
  // App-Tracking verboten: AdKit bekommt nichts mehr
  if (an === "AdKit" && s.trackingAus) { s.flags.adkitBlockiert = Number(s.flags.adkitBlockiert ?? 0) + 1; return; }
  s.spur.push({ tag: s.tag, uhr: s.uhr, app, an, text });
}

export function push(s: Stand, app: AppId, titel: string, text: string, chat?: ChatId, zeit = s.uhr) {
  if (s.rechte.mitteilungen === false || s.stumm?.includes(app)) return;
  // Fokus-Modus: während Hausaufgaben und Freizeit bleibt das Handy still
  if (s.fokus && (s.aktivitaet || (s.hausaufgabenStand > 0 && !s.hausaufgaben[s.tag]))) {
    s.flags.fokusGefiltert = Number(s.flags.fokusGefiltert ?? 0) + 1;
    return;
  }
  s.pushes.push({ id: `p${s.pushGesamt}`, app, chat, titel, text, tag: s.tag, uhr: zeit });
  s.pushGesamt++;
}

export function nachricht(s: Stand, chat: ChatId, von: string, text: string, extra: Partial<Nachricht> = {}, zeit = s.uhr) {
  const n: Nachricht = { id: `${chat}-${s.chats[chat].length}`, von, text, tag: s.tag, uhr: zeit, ...extra };
  s.chats[chat].push(n);
  if (von !== "du") {
    s.ungelesen[chat] = (s.ungelesen[chat] ?? 0) + 1;
    if (!n.system) push(s, "chats", chat === "klasse" ? `${CHAT_NAME.klasse} · ${von}` : von, n.bild ? `📷 ${text || "Foto"}` : text, chat, zeit);
  }
  return n;
}

export function abzeichen(s: Stand, id: keyof typeof ABZEICHEN) {
  if (s.abzeichen.includes(id)) return;
  s.abzeichen.push(id);
  push(s, "klikk", "🏅 Neues Abzeichen!", `${ABZEICHEN[id].name} — ${ABZEICHEN[id].klikk}`);
}

/** Wie Klikk die Abzeichen verkauft — und was sie im Datenspiegel bedeuten. */
export const ABZEICHEN = {
  nachteule: { name: "🦉 Nachteule", klikk: "Du bist auch nachts für deine Leute da!", wahr: "Du hast Klikk nach 23 Uhr geöffnet. Jede Minute nachts ist Werbezeit — und fehlender Schlaf." },
  streak: { name: "🔥 Streak-Profi", klikk: "15 Tage in Folge! Unaufhaltsam!", wahr: "Streaks sind so gebaut, dass Aufhören sich wie Verlieren anfühlt. Du kommst jeden Tag wieder — genau das ist der Zweck." },
  dauergast: { name: "👀 Dauergast", klikk: "60 Beiträge angesehen — du verpasst nichts!", wahr: "60 Beiträge sind etwa zwei Stunden Spielzeit. Der Feed hat kein Ende, damit du keins findest." },
  blitz: { name: "⚡ Blitzantwort", klikk: "Du reagierst schneller als 90 % aller Nutzer!", wahr: "Du hast 5 Benachrichtigungen geöffnet. Benachrichtigungen holen dich zurück — auch mitten in den Hausaufgaben." },
  aufsteiger: { name: "📈 Aufsteiger", klikk: "Über 150 Follower — du wirst bekannt!", wahr: "Follower fühlen sich wie Freunde an. Die meisten kennst du nicht." },
  viral: { name: "🚀 Viral", klikk: "Dein Video geht durch die Decke!", wahr: "Am meisten Reichweite bekam das gefährlichste Video. Das ist kein Zufall: Klikk belohnt, was Aufmerksamkeit bringt." },
} as const;

/** Warnsignale bei Jonas: ab wann sichtbar (Flag) und was man sieht. */
export const SIGNALE: { id: string; flag: string; text: string }[] = [
  { id: "bild", flag: "sigBild", text: "Jonas hat sein Profilbild gelöscht." },
  { id: "status", flag: "sigStatus", text: "Sein Status: »einfach alles egal«." },
  { id: "nachts", flag: "sigNachts", text: "Zuletzt online: 03:12 Uhr — mitten in der Nacht." },
  { id: "verlassen", flag: "sigVerlassen", text: "Er hat die Klassengruppe verlassen." },
  { id: "privat", flag: "sigPrivat", text: "Sein Konto ist privat, alle Beiträge sind gelöscht." },
];

interface Ereignis { id: string; tag: number; uhr: number; wenn?: (s: Stand) => boolean; tu: (s: Stand) => void }

const wahl = (id: string, ...optionen: [string, string][]) => ({ wahl: { id, optionen: optionen.map(([oid, text]) => ({ id: oid, text })) } });
const gewaehlt = (s: Stand, id: string) => {
  for (const c of Object.values(s.chats)) for (const n of c) if (n.wahl?.id === id) return n.wahl.gewaehlt;
  return undefined;
};
export const istGewaehlt = gewaehlt;

export const EREIGNISSE: Ereignis[] = [
  // ── Montag ──
  { id: "lea0", tag: 0, uhr: uhr(14, 5), tu: s => nachricht(s, "lea", "Lea", "heyyy hast du jetzt auch klikk?? 😍 unsere streak läuft da weiter, 12 tage 🔥 nicht vergessen!!") },
  { id: "bus", tag: 0, uhr: uhr(15, 10), tu: s => {
    nachricht(s, "klasse", "Finn", "😂😂😂 guckt mal wer im bus pennt", { bild: "🚌 Foto: Jonas schläft im Bus, Mund offen, Kopf am Fenster" });
    nachricht(s, "klasse", "Emma", "LMAOOO");
    nachricht(s, "klasse", "Ben", "💀💀", wahl("bus", ["lachen", "😂😂"], ["weiter", "📤 In meine Story stellen"], ["stopp", "Lasst das mal, das ist fies."]));
  } },
  { id: "spiegel", tag: 0, uhr: uhr(16, 30), tu: s => nachricht(s, "mo", "Mo", "hast du den #SpiegelTanz gesehen? lass morgen in der pause machen 😂",
    wahl("spiegel", ["ja", "Bin dabei 💃"], ["nein", "Nee, lass mal"])) },
  { id: "mama0", tag: 0, uhr: uhr(18, 0), tu: s => nachricht(s, "mama", "Mama", "Hast du Hausaufgaben auf? Essen um 19 Uhr 🍝") },
  { id: "streak0", tag: 0, uhr: uhr(20, 0), wenn: s => s.snapTag !== s.tag, tu: s => push(s, "klikk", "🔥 Deine Streak mit Lea", "Nur noch 4 Stunden! Schick einen Snap, sonst ist sie weg!", "lea") },

  // ── Dienstag ──
  { id: "account", tag: 1, uhr: uhr(15, 40), tu: s => {
    nachricht(s, "klasse", "Ben", "hab nen sticker gemacht", { bild: "💤 Sticker: Jonas' Gesicht mit »ZZZ« und Sabber" });
    nachricht(s, "klasse", "Sara", "ich schick den jetzt überall hin 😂");
    nachricht(s, "klasse", "Finn", "folgt alle @jonas_schnarcht 😂😂 hab den acc gemacht",
      wahl("account", ["folgen", "Folgen 😂"], ["melden", "Account bei Klikk melden"]));
  } },
  { id: "meldung", tag: 2, uhr: uhr(9, 10), wenn: s => gewaehlt(s, "account") === "melden", tu: s =>
    nachricht(s, "klikkteam", "Klikk-Team", "Wir haben den Account @jonas_schnarcht geprüft und keinen Verstoß gegen unsere Gemeinschaftsrichtlinien festgestellt. Du kannst den Account blockieren, damit du ihn nicht mehr siehst.") },
  { id: "eis", tag: 1, uhr: uhr(16, 50), tu: s => nachricht(s, "mo", "Mo", "#EiswasserChallenge heute?? 60 sek kopf rein, ich film 🥶 hat schon 3000 aufrufe",
    wahl("eis", ["ja", "Klar, ich bin hart 🧊"], ["nein", "Bei dem Wetter? Nee."])) },
  { id: "bild", tag: 1, uhr: uhr(19, 0), tu: s => { s.flags.sigBild = true; } },
  { id: "streak1", tag: 1, uhr: uhr(20, 0), wenn: s => s.snapTag !== s.tag, tu: s => push(s, "klikk", "🔥 Streak in Gefahr!", "Lea wartet auf deinen Snap!", "lea") },

  // ── Mittwoch ──
  { id: "gitarre", tag: 2, uhr: uhr(15, 20), tu: s => {
    nachricht(s, "klasse", "Ben", "jonas hat ein gitarren-video gepostet 😭😭 kommentare sind gold", { bild: "🎸 Jonas spielt »Wonderwall« · 14 Kommentare: »schnarch 💤« »sticker > lied« »geh schlafen«" });
    nachricht(s, "klasse", "Sara", "😂😂 ich kann nicht mehr",
      wahl("kommentar", ["liken", "Die Kommentare liken 😂"], ["mitlaestern", "Selbst kommentieren: »geh lieber schlafen 💤«"], ["nett", "Selbst kommentieren: »Klingt echt gut!«"]));
  } },
  { id: "gleis", tag: 2, uhr: uhr(17, 45), tu: s => {
    nachricht(s, "mo", "Mo", "ALTER hast du die #GleisSelfie videos gesehen?? 12k aufrufe 🤯");
    nachricht(s, "mo", "Mo", "morgen nach der schule am alten bahndamm. da fährt eh kaum was. du kommst mit 😏",
      wahl("gleis", ["dabei", "Bin dabei 😎"], ["ohne", "Ohne mich."], ["stopp", "Mo, lass das. Echt jetzt. Da verunglücken Leute richtig schlimm."]));
  } },
  { id: "status", tag: 2, uhr: uhr(22, 0), tu: s => { s.flags.sigStatus = true; } },
  { id: "streak2", tag: 2, uhr: uhr(20, 0), wenn: s => s.snapTag !== s.tag, tu: s => push(s, "klikk", "🔥 Lea hat dir einen Snap geschickt", "Antworte, um eure Streak zu halten!", "lea") },

  // ── Donnerstag ──
  { id: "nachts", tag: 3, uhr: uhr(7, 0), tu: s => { s.flags.sigNachts = true; } },
  { id: "moUmgestimmt", tag: 3, uhr: uhr(7, 20), wenn: s => gewaehlt(s, "gleis") === "stopp", tu: s => {
    s.flags.moUmgestimmt = true;
    nachricht(s, "mo", "Mo", "hab nochmal nachgedacht wegen gestern. lass ich. war dumm. 😒 sag's keinem");
  } },
  { id: "bahndamm", tag: 3, uhr: uhr(15, 0), wenn: s => gewaehlt(s, "gleis") === "dabei", tu: s => {
    s.flags.gleisDabei = true;
    nachricht(s, "mo", "", "Ihr seid am alten Bahndamm. Mo filmt dich auf den Schienen. Ein Güterzug hupt — viel näher, als ihr dachtet. Ihr rennt. Mo stolpert und fällt den Schotter hinunter.", { system: true });
    nachricht(s, "mo", "Mo", "mein arm 😭😭 der ist komisch");
    nachricht(s, "mama", "Mama", "Die BUNDESPOLIZEI hat gerade angerufen. Du kommst SOFORT nach Hause.");
    s.follower += 340;
    push(s, "klikk", "🚀 Dein Video geht viral!", "#GleisSelfie · 8.300 Aufrufe in einer Stunde");
    abzeichen(s, "viral");
  } },
  { id: "moUnfall", tag: 3, uhr: uhr(17, 30), wenn: s => gewaehlt(s, "gleis") !== "dabei" && gewaehlt(s, "gleis") !== "stopp", tu: s => {
    nachricht(s, "klasse", "Emma", "MO IST IM KRANKENHAUS 😳 die waren am bahndamm, zug kam, beim wegrennen den damm runtergefallen. arm gebrochen. bundespolizei war da");
    nachricht(s, "klasse", "Finn", "das video hat schon 20k 💀");
  } },
  { id: "umfrage", tag: 3, uhr: uhr(16, 20), tu: s => {
    nachricht(s, "klasse", "Sara", "UMFRAGE 📊 wer ist der größte loser der 8b?", { bild: "📊 Umfrage · Jonas 14 · Ben 2 · Finn 1 · (anonym)" },);
    nachricht(s, "klasse", "Finn", "eindeutig 😂 stimmt alle ab",
      wahl("umfrage", ["jonas", "Abstimmen: Jonas"], ["screenshot", "Screenshot an Frau Yilmaz (Vertrauenslehrerin) schicken"]));
  } },
  { id: "verlassen", tag: 3, uhr: uhr(16, 45), tu: s => {
    s.flags.sigVerlassen = true;
    nachricht(s, "klasse", "", "Jonas hat die Gruppe verlassen.", { system: true });
    nachricht(s, "klasse", "Finn", "rage quit 😂😂");
  } },
  { id: "privat", tag: 3, uhr: uhr(21, 0), tu: s => { s.flags.sigPrivat = true; } },
  { id: "streak3", tag: 3, uhr: uhr(20, 0), wenn: s => s.snapTag !== s.tag, tu: s => push(s, "klikk", "🔥 Nicht aufgeben!", "Deine Streak läuft heute Nacht ab.", "lea") },

  // ── Neue Fäden: Gewinnspiel, Lea, Fremder, Nachrichten ──
  { id: "trendpush1", tag: 1, uhr: uhr(21, 30), wenn: s => !s.videos.length, tu: s =>
    push(s, "klikk", "🔥 Dein Moment!", "Poste dein Video zur #EiswasserChallenge – 3.200 Leute machen schon mit 🧊") },
  { id: "gewinn", tag: 1, uhr: uhr(17, 30), tu: s =>
    nachricht(s, "gewinn", "Klikk Gewinnspiel", "🎉 GLÜCKWUNSCH! Du wurdest als Gewinner·in eines iPhone 17 ausgewählt! Bestätige jetzt mit deiner Handynummer – nur noch 10 Minuten gültig ⏰",
      wahl("gewinn", ["nummer", "Handynummer schicken 📱"], ["melden", "Löschen & melden"])) },
  { id: "abo", tag: 2, uhr: uhr(7, 40), wenn: s => gewaehlt(s, "gewinn") === "nummer", tu: s => {
    nachricht(s, "mama", "Mama", "Was ist das für ein ABO über 4,99 € pro WOCHE auf deiner Handyrechnung?? »Premium-Gewinnclub«?!");
    nachricht(s, "mama", "Mama", "Ich lass jetzt eine Drittanbietersperre einrichten. Wir reden heute Abend.");
  } },
  { id: "leaKoerper", tag: 2, uhr: uhr(21, 0), tu: s =>
    nachricht(s, "lea", "Lea", "ich glaub ich bin hässlich 😭 alle auf klikk sehen so perfekt aus",
      wahl("leaKoerper", ["nett", "Du bist schön, so wie du bist! Die haben alle Filter und gutes Licht."], ["witz", "😂 same"])) },
  { id: "leon1", tag: 2, uhr: uhr(19, 30), tu: s =>
    nachricht(s, "leon", "leon.16", "hey 😊 hab dein profil gesehen, du bist echt cool. wie alt bist du?",
      wahl("leon1", ["antworten", "14, und du?"], ["block", "Blockieren"])) },
  { id: "leon2", tag: 3, uhr: uhr(16, 10), wenn: s => gewaehlt(s, "leon1") === "antworten", tu: s => {
    nachricht(s, "leon", "leon.16", "können wir auf SnapTalk weiterschreiben? hier liest klikk mit 😅");
    nachricht(s, "leon", "leon.16", "und schick mal ein foto von dir. nur für mich 🙈 ich zeig's auch keinem, versprochen",
      wahl("leon2", ["foto", "Ein Selfie schicken"], ["zeigen", "Screenshot an Mama schicken"], ["block", "Blockieren & melden"]));
  } },
  { id: "leon3", tag: 3, uhr: uhr(21, 45), wenn: s => gewaehlt(s, "leon2") === "foto", tu: s => {
    nachricht(s, "leon", "leon.16", "schick mir mehr. sonst bekommt deine klasse das hier 😈", { bild: "📷 dein Selfie" });
    nachricht(s, "leon", "leon.16", "du hast bis morgen früh",
      wahl("leon3", ["schweigen", "Nichts sagen. Hoffen, dass es aufhört."], ["mama", "Mama alles zeigen"]));
  } },
  { id: "eilmeldung", tag: 3, uhr: uhr(18, 0), tu: s =>
    push(s, "klikk", "📰 Eilmeldung", "14-Jähriger an Bahnstrecke schwer verletzt – Freunde filmten für #GleisSelfie") },
  { id: "klasseNews", tag: 3, uhr: uhr(18, 30), tu: s => {
    nachricht(s, "klasse", "Emma", "habt ihr das gesehen?? 😳 der war so alt wie wir", { bild: "📰 Klikk News: 14-Jähriger an Bahnstrecke schwer verletzt" });
    nachricht(s, "klasse", "Ben", istGewaehlt(s, "gleis") !== "stopp" ? "krass… mo hätte das auch sein können" : "zum glück hat mo das gelassen");
    nachricht(s, "klasse", "Finn", "wer guckt das video? 👀");
  } },

  // ── Fall: Freundschaft in Gefahr (Lea) ──
  { id: "leaStreit", tag: 3, uhr: uhr(19, 15), wenn: s => leaGrund(s) !== null, tu: s => {
    s.flags.leaStreit = true;
    nachricht(s, "lea", "Lea", leaGrund(s)!);
    nachricht(s, "lea", "Lea", "weißt du was. vergiss es einfach. ich brauch grad abstand.");
    nachricht(s, "lea", "", "Lea hat dich blockiert.", { system: true });
    nachricht(s, "lea", "", "Was jetzt?", { system: true, ...wahl("leaStreit",
      ["nichts", "Nichts tun – sie beruhigt sich schon"],
      ["text", "Eine lange Nachricht schreiben"],
      ["mo", "Mo bitten zu vermitteln"],
      ["reden", "Morgen in der Pause persönlich mit ihr reden"]) });
  } },

  // ── Fall: ein heimliches Foto (Emma) ──
  { id: "emmaFoto", tag: 3, uhr: uhr(20, 15), tu: s => {
    nachricht(s, "klasse", "Ben", "😏 ratet mal wer das ist", { bild: "🚫 Foto (hier verpixelt): Emma in der Umkleide nach dem Sport – heimlich aufgenommen" });
    nachricht(s, "klasse", "Sara", "OMG 💀💀 schickt das weiter");
    nachricht(s, "klasse", "Finn", "das geht heute noch viral 😂", wahl("emmaFoto",
      ["lachen", "😂"],
      ["weiter", "An ein paar Freunde weiterleiten"],
      ["emma", "Emma privat schreiben: »Da geht ein Foto von dir rum. Ich helf dir.«"],
      ["melden", "Ben auffordern, es zu löschen – und Frau Yilmaz Bescheid sagen"]));
  } },

  // ── Fall: Mobbing – wer mitgemacht hat, wird angesprochen ──
  { id: "taeterGespraech", tag: 4, uhr: uhr(14, 10), wenn: s => taeterPunkte(s) >= 2, tu: s => {
    nachricht(s, "yilmaz", "Frau Yilmaz", "Kannst du nach der 6. Stunde kurz zu mir kommen? Es geht um Jonas. Auf den Screenshots, die mir gezeigt wurden, steht auch dein Name.",
      wahl("gespraech",
        ["ehrlich", "Ehrlich sagen, was ich gemacht habe, und mich bei Jonas entschuldigen"],
        ["spass", "Sagen, dass das alles nur Spaß war"],
        ["leugnen", "Sagen, dass ich das nicht war"]));
  } },

  // ── Fall: Nach der Challenge (Mo) ──
  { id: "moVideo", tag: 4, uhr: uhr(15, 30), wenn: s => !!s.flags.moVerletzt, tu: s =>
    nachricht(s, "mo", "Mo", "das video hat jetzt 48k 😳 soll ich's löschen? meine mutter sagt ja. die likes sagen nein 😅",
      wahl("moVideo", ["loeschen", "Lösch es. Und melde die Kopien."], ["lassen", "Lass es online, 48k ist krass!"], ["reden", "Wie geht's dir eigentlich? Also nicht dem Arm. Dir."])) },
  { id: "nachahmer", tag: 4, uhr: uhr(18, 30), wenn: s => istGewaehlt(s, "moVideo") === "lassen", tu: s => {
    push(s, "klikk", "📰 Klikk News", "Zwei Jugendliche aus dem Nachbarort beim Nachstellen eines #GleisSelfie-Videos schwer verletzt");
    nachricht(s, "mo", "Mo", "hast du das gesehen… die haben MEIN video nachgemacht 😶 ich lösch es jetzt");
  } },

  // ── Familie bittet um Hilfe (ablehnen geht – bis es reicht) ──
  { id: "bitteEinkaufen", tag: 0, uhr: uhr(16, 40), tu: s => bitte(s, "einkaufen", ELTERN_TEXT[s.eltern].einkaufen) },
  { id: "bitteAufraeumen", tag: 1, uhr: uhr(17, 50), tu: s => bitte(s, "aufraeumen", ELTERN_TEXT[s.eltern].aufraeumen) },
  { id: "bitteOma", tag: 2, uhr: uhr(14, 20), tu: s => bitte(s, "omaBesuch", "Oma hat heute Geburtstag 🎂 Wir fahren um 16 Uhr zu ihr. Kommst du mit?") },
  { id: "bitteMila", tag: 3, uhr: uhr(15, 10), tu: s => bitte(s, "mila", ELTERN_TEXT[s.eltern].mila) },
  { id: "bitteFahrrad", tag: 4, uhr: uhr(15, 30), tu: s => bitte(s, "fahrrad", "Hilfst du mir, dein Fahrrad fürs Wochenende fit zu machen? Kette ist voll rostig.") },
  // ── Elterntypen ──
  { id: "besorgt0", tag: 0, uhr: uhr(14, 15), wenn: s => s.eltern === "besorgt", tu: s => nachricht(s, "mama", "Mama", "Bist du gut nach Hause gekommen? Schreib kurz! ❤️ Und denk dran: 2 Stunden Handy, nicht mehr.") },
  { id: "besorgt2", tag: 2, uhr: uhr(17, 0), wenn: s => s.eltern === "besorgt", tu: s => nachricht(s, "mama", "Mama", "Ich hab gelesen, dass da so eine Gleis-Challenge rumgeht 😟 Du machst sowas nicht, oder?") },
  { id: "streng0", tag: 0, uhr: uhr(14, 10), wenn: s => s.eltern === "streng", tu: s => nachricht(s, "mama", "Papa", "Erst Hausaufgaben, dann Handy. Um 21 Uhr liegt es in der Küche.") },
  { id: "arbeit0", tag: 0, uhr: uhr(18, 30), wenn: s => s.eltern === "arbeit", tu: s => nachricht(s, "mama", "Mama", "Sorry Schatz, wird heute wieder spät 😩 Essen steht im Kühlschrank. Papa ist auf Dienstreise.") },
  { id: "arbeit3", tag: 3, uhr: uhr(19, 0), wenn: s => s.eltern === "arbeit", tu: s => nachricht(s, "mama", "Mama", "Ich weiß, ich war diese Woche kaum da. Am Wochenende machen wir was zusammen, versprochen.") },
  { id: "locker1", tag: 1, uhr: uhr(20, 30), wenn: s => s.eltern === "locker", tu: s => nachricht(s, "mama", "Mama", "Na, alles gut bei dir? Du sitzt ja nur noch am Handy 😅 Ist ja deine Sache, aber geh nicht so spät ins Bett.") },

  // ── Fall: KI-Fake von Lea ──
  { id: "deepfake", tag: 2, uhr: uhr(18, 30), tu: s => {
    nachricht(s, "klasse", "Sara", "😂😂 lea ohne filter", { bild: "🤖 KI-Bild: Leas Gesicht auf einem Clown mit Pickeln und Zahnlücke – sieht täuschend echt aus" });
    nachricht(s, "klasse", "Finn", "LOL wie echt das aussieht 💀",
      wahl("deepfake", ["lachen", "😂😂"], ["weiter", "An ein paar Leute weiterleiten"],
        ["lea", "Lea schreiben: »Ich weiß, dass das KI ist. Ich helf dir, es zu melden.«"], ["gruppe", "In die Gruppe: »Das ist ein KI-Fake. Löscht das.«"]));
  } },
  { id: "leaKi", tag: 2, uhr: uhr(19, 0), tu: s => nachricht(s, "lea", "Lea", "das bin ich NICHT 😭😭 das ist KI. wieso macht man sowas") },
  // ── Bonustag Samstag ──
  { id: "samstagLea", tag: 5, uhr: uhr(11, 0), wenn: s => !s.flags.leaStreit || !!s.flags.leaVersoehnt, tu: s => nachricht(s, "lea", "Lea", "FREIBAD um 13 uhr?? 🏊‍♀️ mo kommt auch (mit gips am rand sitzen lol)") },
  { id: "samstagPush", tag: 5, uhr: uhr(10, 5), tu: s => push(s, "klikk", "☀️ Wochenende!", "Deine Freunde sind schon online. Schau, was du verpasst hast!") },

  // ── Fall: Tim riecht ──
  { id: "tim", tag: 1, uhr: uhr(15, 5), tu: s => {
    nachricht(s, "klasse", "Finn", "tim stinkt heute wieder sooo 🤢🤢 wer setzt sich morgen neben den", { bild: "🦨 Sticker: Stinktier mit Tims Gesicht" });
    nachricht(s, "klasse", "Ben", "nicht ich 💀",
      wahl("tim", ["lachen", "🤢😂"], ["mitmachen", "Selbst schreiben: »Ich setz mich nicht neben den 🦨«"],
        ["fragen", "Tim privat fragen, ob alles okay ist"], ["stopp", "»Hört auf. Ihr wisst nicht, was bei ihm los ist.«"]));
  } },
  { id: "timErzaehlt", tag: 2, uhr: uhr(16, 0), wenn: s => istGewaehlt(s, "tim") === "fragen", tu: s => {
    nachricht(s, "tim", "Tim", "unsere waschmaschine ist seit 2 wochen kaputt. mama ist im krankenhaus, ich wohn grad bei meinem bruder. der hat kein geld für ne neue.");
    nachricht(s, "tim", "Tim", "bitte sag's keinem. das ist so peinlich",
      wahl("timHilfe", ["sozial", "»Frau Weber (Schulsozialarbeit) kann helfen – ohne Namen zu nennen. Soll ich mitkommen?«"],
        ["leihen", "»Ich bring dir morgen ein paar Pullis mit.«"], ["schweigen", "»Ok, ich sag nix.«"]));
  } },

  // ── Freitag ──
  { id: "trendFr", tag: 4, uhr: uhr(15, 0), wenn: s => !!s.flags.moVerletzt, tu: s => push(s, "klikk", "🔥 Trend in deiner Nähe", "Mo am Bahndamm – #GleisSelfie · 48.000 Aufrufe, 230 Duette") },
  { id: "wochenende", tag: 4, uhr: uhr(18, 0), wenn: s => !s.flags.leaStreit || !!s.flags.leaVersoehnt, tu: s => nachricht(s, "lea", "Lea", "endlich wochenende 🥳 kommst du morgen mit ins freibad?") },
];

/** Folgen einer Entscheidung, sofort beim Tippen. */
export const FOLGEN: Record<string, (s: Stand, o: string) => void> = {
  ...Object.fromEntries(["einkaufen", "aufraeumen", "omaBesuch", "mila", "fahrrad"].map(id => [`bitte_${id}`, (s: Stand, o: string) => bitteBeantworten(s, id, o === "ja")])),
  bus: (s, o) => {
    if (o === "lachen") nachricht(s, "klasse", "Finn", "sag ich doch 😂");
    else { nachricht(s, "klasse", "Finn", "chill, ist nur spaß"); nachricht(s, "klasse", "Emma", "naja… stimmt schon irgendwie"); }
  },
  spiegel: (s, o) => {
    if (o === "ja") { s.follower += 40; nachricht(s, "mo", "Mo", "yesss 💃 morgen 1. pause"); }
    else nachricht(s, "mo", "Mo", "langweiler 😛");
  },
  account: (s, o) => {
    if (o === "folgen") nachricht(s, "klasse", "Finn", "schon 31 follower 😂😂");
    else nachricht(s, "klikkteam", "Klikk-Team", "Danke für deine Meldung! Wir prüfen den Account so schnell wie möglich. 💙");
  },
  eis: (s, o) => {
    if (o === "ja") { s.follower += 120; s.flags.erkaeltet = true; nachricht(s, "mo", "Mo", "LEGENDE 🥶🥶 120 neue follower für dich"); }
    else nachricht(s, "mo", "Mo", "ok dann mach ich's alleine 🙄");
  },
  kommentar: (s, o) => {
    if (o === "nett") nachricht(s, "klasse", "Ben", "uiii jemand ist verliebt 😂");
  },
  gleis: (s, o) => {
    if (o === "dabei") nachricht(s, "mo", "Mo", "LETS GOOO 🚂 15 uhr");
    else if (o === "ohne") nachricht(s, "mo", "Mo", "dann geh ich mit finn 🙄");
    else nachricht(s, "mo", "Mo", "boah chill. ist doch nix passiert bei denen");
  },
  leaStreit: (s, o) => {
    if (o === "text") nachricht(s, "lea", "", "Nachricht nicht zugestellt – du bist blockiert.", { system: true });
    if (o === "mo") nachricht(s, "mo", "Mo", "ok ich red mit ihr. aber du musst auch was sagen, nicht nur ich");
    if (o === "reden") nachricht(s, "lea", "", "Du nimmst dir vor, sie morgen in der ersten Pause anzusprechen. Persönlich.", { system: true });
  },
  emmaFoto: (s, o) => {
    if (o === "weiter") nachricht(s, "klasse", "", "Du hast das Foto an 4 Leute weitergeleitet. Es liegt jetzt auch auf deinem Handy.", { system: true });
    if (o === "emma") {
      nachricht(s, "klasse", "", "Du schreibst Emma privat.", { system: true });
      nachricht(s, "emma", "Emma", "was?? 😭 welches foto … ich hab das nicht gewusst. kommst du morgen mit zu frau yilmaz?");
      s.flags.emmaHilfe = true;
    }
    if (o === "melden") {
      nachricht(s, "klasse", "Ben", "chill, ist doch nur spaß 🙄");
      nachricht(s, "yilmaz", "Frau Yilmaz", "Danke, dass du mir das sagst. Ich kümmere mich sofort darum und informiere Emmas Eltern. Bitte speichere und teile das Foto nirgends – auch nicht als »Beweis«.");
      s.flags.emmaHilfe = true;
    }
  },
  gespraech: (s, o) => {
    if (o === "ehrlich") {
      nachricht(s, "yilmaz", "Frau Yilmaz", "Danke für deine Ehrlichkeit. Das ist nicht leicht. Wir machen ein Gespräch zu dritt mit Jonas – du sagst ihm selbst, was dir leidtut. Und du hilfst beim Projekttag gegen Mobbing mit. Deinen Eltern erzählst du es heute selbst.");
    } else {
      nachricht(s, "yilmaz", "Frau Yilmaz", o === "spass"
        ? "Für Jonas war es kein Spaß. Er ist seit gestern nicht mehr in die Schule gekommen. Es gibt nächste Woche eine Klassenkonferenz, deine Eltern werden eingeladen. Ein schriftlicher Verweis ist möglich."
        : "Auf den Screenshots steht dein Name, mit Uhrzeit. Leugnen macht es nicht besser. Es gibt nächste Woche eine Klassenkonferenz, deine Eltern werden eingeladen. Ein schriftlicher Verweis ist möglich.");
      nachricht(s, "mama", "Mama", "Die Schule hat angerufen. Wegen Jonas. Wir reden heute Abend. Handy liegt ab 19 Uhr in der Küche.");
    }
    if (polizeiTaeter(s)) {
      s.flags.polizeiTaeter = true;
      nachricht(s, "mama", "Mama", "Und noch was: Jonas' Eltern haben Anzeige erstattet, wegen Beleidigung und dem Foto. Die Polizei will mit dir reden. Mit 14 bist du strafmündig. Wir gehen da zusammen hin.");
    }
  },
  moVideo: (s, o) => {
    if (o === "loeschen") nachricht(s, "mo", "Mo", "ok. gelöscht. ein paar kopien gibt's trotzdem noch 😕 hab sie gemeldet");
    if (o === "lassen") nachricht(s, "mo", "Mo", "haha ja oder 😎");
    if (o === "reden") {
      nachricht(s, "mo", "Mo", "ehrlich? ich hör immer noch das hupen. ich schlaf voll schlecht seitdem");
      nachricht(s, "mo", "Mo", "meinst du ich sollte mit jemandem reden? die schulsozialarbeiterin hat mich gefragt");
      nachricht(s, "mo", "du", "Ja. Mach das. Das ist kein Ding.");
      nachricht(s, "mo", "Mo", "ok. danke dass du fragst 🤝");
    }
  },
  deepfake: (s, o) => {
    if (o === "lea") { s.flags.leaHilfe = true; nachricht(s, "lea", "Lea", "danke 🥺 ich dachte, alle glauben das. kannst du mitkommen, wenn ich's frau yilmaz zeige?"); }
    if (o === "gruppe") { s.flags.deepfakeGestoppt = true; nachricht(s, "klasse", "Sara", "ok sorry 🙄 gelöscht"); nachricht(s, "klasse", "Emma", "gut dass das einer sagt"); }
    if (o === "weiter") nachricht(s, "klasse", "", "Du hast das KI-Bild an 3 Leute weitergeleitet.", { system: true });
  },
  deal: (s, o) => {
    if (o === "ablehnen") nachricht(s, "marke", "GlowDrink Team ✔", "Schade! Melde dich, wenn du es dir anders überlegst 💫");
    else {
      s.flags.deal = o === "kennzeichnen" ? 1 : 2;
      nachricht(s, "marke", "GlowDrink Team ✔", "Mega 🥳 Dein Paket ist unterwegs! Poste es bis morgen 18 Uhr. Bezahlung nach Reichweite.");
      if (o === "verstecken") nachricht(s, "klasse", "Emma", "seit wann trinkst du glowdrink 😂 sieht nach werbung aus");
    }
  },
  tim: (s, o) => {
    if (o === "fragen") nachricht(s, "tim", "Tim", "warum fragst du? … ich erzähl's dir morgen. vielleicht.");
    if (o === "stopp") { nachricht(s, "klasse", "Finn", "uiii der tim-anwalt 😂"); nachricht(s, "klasse", "Emma", "naja er hat recht, ist echt fies"); }
    if (o === "mitmachen") nachricht(s, "klasse", "Finn", "😂😂😂 sag ich doch");
  },
  timHilfe: (s, o) => {
    if (o === "sozial") { s.flags.timHilfe = true; nachricht(s, "tim", "Tim", "ok … wenn du mitkommst. danke 🙏"); }
    if (o === "leihen") nachricht(s, "tim", "Tim", "echt? danke. das vergess ich dir nicht.");
    if (o === "schweigen") nachricht(s, "tim", "Tim", "danke.");
  },
  gewinn: (s, o) => {
    if (o === "nummer") nachricht(s, "gewinn", "Klikk Gewinnspiel", "✅ Danke! Dein Code: 4471. Mit der Antwort »JA« bestätigst du die Teilnahmebedingungen.");
    else nachricht(s, "klikkteam", "Klikk-Team", "Danke für deine Meldung. Tipp: Klikk verlost nie Handys per Nachricht. 💙");
  },
  leaKoerper: (s, o) => {
    if (o === "nett") nachricht(s, "lea", "Lea", "danke 🥹 echt jetzt? ich hab gestern 2 stunden lang so fitness-videos geguckt");
    else nachricht(s, "lea", "Lea", "😐");
  },
  leon1: (s, o) => {
    if (o === "antworten") nachricht(s, "leon", "leon.16", "16 😊 ich find jüngere eh reifer als die aus meiner stufe. erzähl mir nix von deinen eltern ok? die verstehen sowas nicht");
  },
  leon2: (s, o) => {
    if (o === "zeigen") leonGemeldet(s);
    if (o === "block") nachricht(s, "klikkteam", "Klikk-Team", "Du hast leon.16 blockiert. Danke für deine Meldung. 💙");
  },
  leon3: (s, o) => {
    if (o === "mama") leonGemeldet(s);
  },
  umfrage: (s, o) => {
    if (o === "jonas") nachricht(s, "klasse", "Sara", "15 😂😂");
    else {
      nachricht(s, "yilmaz", "du", "", { bild: "📊 Screenshot: Umfrage »Wer ist der größte Loser der 8b?«" });
      nachricht(s, "yilmaz", "Frau Yilmaz", "Danke, dass du mir das zeigst. Ich kümmere mich morgen früh darum. Niemand erfährt, dass es von dir kam.");
    }
  },
};

/** Was man Jonas privat schreiben kann. `nach`: erst nach dieser Nachricht. */
export const JONAS_OPTIONEN: { id: string; ab: number; nach?: string; text: string; antwort: (s: Stand) => string }[] = [
  { id: "j1", ab: 0, text: "Hey, alles okay bei dir?", antwort: s => s.tag === 0 ? "ja klar, wieso?" : "geht so" },
  { id: "j2", ab: 1, text: "Das in der Gruppe ist echt daneben. Ich find das nicht lustig.", antwort: () => "danke. ich weiß nicht mal, was ich denen getan hab" },
  { id: "j3", ab: 1, text: "Willst du morgen in der Pause bei uns sitzen?", antwort: () => "echt? ok 🙂" },
  { id: "j4", ab: 2, nach: "j2", text: "Lass uns morgen zusammen zu Frau Yilmaz gehen. Ich komm mit.", antwort: () => "…ok. wenn du mitkommst." },
];

export function jonasGeschrieben(s: Stand): string[] {
  return JONAS_OPTIONEN.filter(o => s.flags[`jonas_${o.id}`]).map(o => o.id);
}

/** Was in der Schule passiert — die Morgenmeldung, bevor der Nachmittag beginnt. */
export function morgenMeldung(s: Stand): string[] {
  const m: string[] = [];
  const schlaf = s.schlaf[s.tag - 1];
  if (schlaf !== undefined) {
    if (schlaf < 6.5) m.push(`Du hast ${schlaf.toFixed(1).replace(".", ",")} Stunden geschlafen. In der dritten Stunde fallen dir die Augen zu — Frau Brandt sieht es.`);
    else if (schlaf < 8) m.push(`${schlaf.toFixed(1).replace(".", ",")} Stunden Schlaf. Du bist ein bisschen müde.`);
    else m.push(`${schlaf.toFixed(1).replace(".", ",")} Stunden Schlaf. Du bist ausgeschlafen.`);
  }
  if (s.hausaufgaben[s.tag - 1] === false) m.push("Hausaufgaben vergessen. Frau Brandt macht einen Strich in ihre Liste.");
  if (s.zuSpaet?.includes(s.tag)) m.push(s.eltern === "arbeit" ? "Bus verpasst. Niemand kann dich fahren – du kommst zwanzig Minuten zu spät. Eintrag ins Klassenbuch." : "Bus verpasst. Mama fährt dich, genervt. Du kommst trotzdem zu spät: Eintrag ins Klassenbuch.");
  if (s.flags[`ohneFruehstueck_${s.tag}`]) m.push("Ohne Frühstück knurrt dir in der zweiten Stunde der Magen. Laut. Jemand kichert.");
  if (s.hygiene < 25) {
    m.push("In der Pause rückt Ben demonstrativ von dir weg und hält sich die Nase zu. »Wer müffelt hier so?« Ein paar lachen. Du weißt, dass er dich meint.");
    s.flags.selbstGestunken = Number(s.flags.selbstGestunken ?? 0) + 1;
  } else if (s.hygiene < 45) m.push("Lea flüstert dir zu: »Du, ähm … Deo?« Sie meint es nett. Es ist trotzdem peinlich.");
  if (s.tag === 3 && istGewaehlt(s, "tim") && istGewaehlt(s, "tim") !== "still") m.push("Tim sitzt heute ganz hinten, allein. Sein Pulli ist frisch gewaschen – zu groß, vermutlich von seinem Bruder.");
  if (s.tag === 2 && s.flags.erkaeltet && s.flags.folge_eis !== 1) m.push("Seit der Eiswasser-Challenge hast du Halsschmerzen.");
  if (s.tag === 2) m.push("In der großen Pause sitzt Jonas allein auf der Treppe und schaut aufs Handy.");
  if (s.tag === 3) m.push("Jemand hat den Schnarch-Sticker auf die Tafel gemalt. Jonas wischt ihn wortlos weg.");
  // Mo hat ein Video nachgemacht
  if (s.flags.moKopieFolge === s.tag - 1) {
    const tr = TRENDS.find(t => t.id === s.moKopieTrend);
    m.push(`Mo liegt im Krankenhaus: Gehirnerschütterung, das Bein zweimal gebrochen. Er hat ${s.moKopieName === "dir" ? "dein" : `${s.moKopieName}s`} ${tr?.name}-Video nachgemacht.${s.flags.moKopieFake ? " Das Video war gefaked – Schnitt und Filter. Mo wusste das nicht." : ""}`);
  }
  // Folgen eigener Challenge-Videos vom Vortag
  for (const tr of TRENDS) if (s.flags[`folge_${tr.id}`] === s.tag - 1) m.push(MORGEN_FOLGE[tr.id] ?? "");
  if (s.tag === 4 && s.flags.leonGemeldet) m.push("Die Polizei hat sich gemeldet: »leon.16« war ein 34-jähriger Mann mit vielen Fake-Profilen. Das Foto ist gesichert und wird gelöscht. Du hast nichts falsch gemacht.");
  else if (s.tag === 4 && istGewaehlt(s, "leon3") === "schweigen") m.push("Du hast kaum geschlafen. leon.16 hat dir in der Nacht 14 Nachrichten geschickt.");
  if (s.tag === 3) {
    const d = istGewaehlt(s, "deepfake");
    if (d === "weiter" || d === "lachen") m.push("Das KI-Bild von Lea ist auf mindestens drei Schulhöfen angekommen. Lea war heute nur zwei Stunden in der Schule.");
    else if (s.flags.deepfakeGestoppt || s.flags.leaHilfe) m.push("Das KI-Bild von Lea ist gelöscht. Frau Yilmaz spricht in der ersten Stunde über KI-Fakes und das Recht am eigenen Bild.");
  }
  if (s.tag === 5) m.push("Samstag. Kein Wecker, keine Schule, keine Hausaufgaben. Der ganze Tag gehört dir – und dem Handy, wenn du es lässt.");
  if (s.tag === 4 && s.flags.leaStreit) {
    const w = istGewaehlt(s, "leaStreit");
    if (w === "reden") { s.flags.leaVersoehnt = true; m.push("In der ersten Pause sprichst du Lea an. Erst schaut sie weg. Dann redet ihr zwanzig Minuten, und ihr beide sagt Sachen, die man nicht schreiben kann. Am Ende entsperrt sie dich."); }
    else if (w === "mo") { s.flags.leaVersoehnt = true; m.push("Mo hat mit Lea geredet. Sie ist noch kühl, aber sie setzt sich in der Pause wieder neben dich. Es ist ein Anfang."); }
    else m.push("Lea sitzt in der Pause bei Emma und Sara. Sie schaut nicht zu dir herüber. Eine Streak lässt sich nicht retten, eine Freundschaft vielleicht noch – aber nicht von allein.");
  }
  if (s.tag === 4) {
    const f = istGewaehlt(s, "emmaFoto");
    if (f === "weiter") { s.flags.handyWeg = true; m.push("Zweite Stunde: Die Polizei ist in der Schule. Das Foto wurde heimlich in der Umkleide gemacht – so etwas weiterzuleiten ist eine Straftat (§ 201a StGB), auch mit 14. Alle, die es verschickt haben, müssen ihr Handy abgeben. Deins auch. Deine Eltern werden angerufen."); }
    else if (s.flags.emmaHilfe) m.push("Ben muss zur Schulleitung, die Polizei ermittelt gegen ihn, das Foto wird überall gelöscht. Emma ist heute nicht in der Schule. Aber sie hat dir geschrieben: »danke. echt.«");
    else m.push("Emma ist heute nicht in der Schule. Das Foto kennt inzwischen die halbe Schule – auch die, die nur gelacht haben, haben es weitergetragen.");
  }
  if (s.tag === 4) {
    if (s.flags.moVerletzt) m.push("Mo kommt mit Gips. Die Bundespolizei hat eine Anzeige geschrieben — Betreten der Gleisanlage. Das Video läuft trotzdem weiter.");
    else if (s.flags.moUmgestimmt) m.push("Mo ist ganz normal da. Am Bahndamm war gestern keiner.");
    const j = s.flags.jonasAusgang;
    if (j === 2) m.push("In der ersten Stunde sprechen Frau Yilmaz und Frau Brandt mit der Klasse. Der Fake-Account ist weg. In der Pause sitzt Jonas bei euch.");
    else if (j === 1) m.push("Jonas ist da, aber er sagt den ganzen Tag kein Wort.");
    else m.push("Jonas' Platz bleibt leer. Frau Brandt sagt nur: »Jonas ist krank.«");
  }
  return m;
}

const MORGEN_FOLGE: Record<string, string> = {
  eis: "Seit der Eiswasser-Challenge hast du Fieber und Halsweh.",
  nosleep: "Nach der Nacht ohne Schlaf schläfst du in Mathe ein. Frau Brandt weckt dich vor der ganzen Klasse.",
  hotchip: "Gestern Notaufnahme, heute Bauchweh. In der Pause zeigen dir Leute dein Video.",
  gleis: "Die Bundespolizei hat Anzeige erstattet — Betreten der Gleisanlage. Deine Eltern müssen zu einem Gespräch.",
  dach: "Du kommst mit Krücken. Sportunterricht fällt für dich sechs Wochen aus. Dein Video hat 30.000 Aufrufe.",
};

function leonGemeldet(s: Stand) {
  s.flags.leonGemeldet = true;
  nachricht(s, "mama", "du", "", { bild: "📷 Screenshots vom Chat mit leon.16" });
  nachricht(s, "mama", "Mama", "Gut, dass du mir das zeigst. Du hast NICHTS falsch gemacht. Wir machen Screenshots, blockieren ihn und gehen morgen zur Polizei. ❤️");
}

/** Texte je nach Elterntyp */
const ELTERN_TEXT: Record<Stand["eltern"], { einkaufen: string; aufraeumen: string; mila: string }> = {
  streng: { einkaufen: "Um 17 Uhr fährst du mit mir einkaufen. Wir brauchen Getränke.", aufraeumen: "Dein Zimmer sieht aus wie ein Schlachtfeld. Heute noch aufräumen.", mila: "Ich muss noch weg. Du passt eine Stunde auf Mila auf." },
  locker: { einkaufen: "Hast du Lust, nachher mit einkaufen zu kommen? Du darfst die Chips aussuchen 😄", aufraeumen: "Könntest du heute mal dein Zimmer aufräumen? Wäre echt lieb.", mila: "Kannst du kurz auf Mila aufpassen? Ich bin in einer Stunde zurück." },
  besorgt: { einkaufen: "Kommst du mit einkaufen? Dann bist du mal an der frischen Luft ☀️", aufraeumen: "Räumst du heute dein Zimmer auf? Ich finde da sonst nie was.", mila: "Ich muss kurz zum Arzt. Passt du auf Mila auf? Ruf an, wenn was ist!" },
  arbeit: { einkaufen: "Ich schaff's heute nicht zum Einkaufen 😩 Gehst du mit Papas Liste? Geld liegt auf dem Tisch.", aufraeumen: "Kannst du die Spülmaschine ausräumen und dein Zimmer machen? Ich komm erst um 21 Uhr.", mila: "Notfall im Büro. Kannst du Mila vom Hort abholen und auf sie aufpassen?" },
};

function bitte(s: Stand, id: string, text: string) {
  nachricht(s, "mama", s.eltern === "streng" ? "Papa" : "Mama", text, wahl(`bitte_${id}`, ["ja", "Ja, mach ich"], ["nein", "Keine Zeit gerade"]));
}

/** Zusage oder Absage zu einer Familienbitte — irgendwann ist die Geduld vorbei. */
export function bitteBeantworten(s: Stand, id: string, ja: boolean) {
  const wer = s.eltern === "streng" ? "Papa" : "Mama";
  if (ja) { if (!s.famZusagen.includes(id)) s.famZusagen.push(id); nachricht(s, "mama", wer, "Danke dir! ❤️"); return; }
  s.famAbgelehnt++;
  const geduld = { streng: 1, arbeit: 2, besorgt: 2, locker: 3 }[s.eltern];
  if (s.famAbgelehnt > geduld) {
    s.famErzwungen = id;
    nachricht(s, "mama", wer, s.eltern === "streng" ? "Schluss jetzt. Handy weg, du kommst. Sofort."
      : s.eltern === "locker" ? "Ich frag nicht nochmal nett. Komm bitte JETZT." : "Jetzt reicht's. Keine Diskussion.");
  } else {
    nachricht(s, "mama", wer, ["Hm. Okay.", "Schon wieder nein?", "Du hast echt nie Zeit, oder?"][Math.min(2, s.famAbgelehnt - 1)]);
  }
}

/** Wie sehr man beim Mobbing gegen Jonas mitgemacht hat (Lachen zählt, Verbreiten mehr). */
export function taeterPunkte(s: Stand) {
  const w = (id: string) => istGewaehlt(s, id);
  return (w("bus") === "lachen" ? 1 : 0) + (w("bus") === "weiter" ? 2 : 0) + (w("account") === "folgen" ? 1 : 0)
    + (w("kommentar") === "liken" ? 1 : 0) + (w("kommentar") === "mitlaestern" ? 2 : 0) + (w("umfrage") === "jonas" ? 1 : 0)
    + (w("tim") === "lachen" ? 1 : 0) + (w("tim") === "mitmachen" ? 2 : 0)
    // gemeine Kommentare unter echten Beiträgen aus der Klasse
    + Number(s.flags.klasseGemein ?? 0);
}

/** Wer das Foto selbst verbreitet und den Fake-Account gestützt hat, bekommt es mit der Polizei zu tun. */
function polizeiTaeter(s: Stand) {
  return istGewaehlt(s, "bus") === "weiter" && istGewaehlt(s, "account") === "folgen";
}

/** Warum Lea genug hat — oder null, wenn alles okay ist. */
function leaGrund(s: Stand): string | null {
  const d = istGewaehlt(s, "deepfake");
  if (d === "lachen" || d === "weiter") return "du hast über das ki-bild von mir gelacht. ich hab's gesehen. ich dachte, wir sind freunde.";
  if (istGewaehlt(s, "leaKoerper") === "witz") return "ich hab dir gesagt, dass ich mich hässlich fühle, und du schickst »😂 same«. echt jetzt?";
  if (s.freizeit.some(f => f.art === "freunde" && f.unterbrochen >= 2)) return "wir treffen uns endlich mal und du hängst die ganze zeit am handy. ich hätte auch allein in den park gehen können.";
  if (Number(s.flags.streakWeg ?? 0) >= 2) return "zweimal streak weg. zweimal. ist dir das egal oder ich?";
  return null;
}

/** Am Freitagmorgen: Wie es für Jonas und Mo ausgeht. */
export function wocheAuswerten(s: Stand) {
  const geschrieben = jonasGeschrieben(s);
  s.flags.jonasAusgang = s.flags.jonas_j4 || gewaehlt(s, "umfrage") === "screenshot" ? 2 : geschrieben.length ? 1 : 0;
  s.flags.moVerletzt = gewaehlt(s, "gleis") !== "stopp";
}
