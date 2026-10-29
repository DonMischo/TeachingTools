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

export const TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
export const LETZTER_TAG = TAGE.length - 1;

export const CHAT_NAME: Record<ChatId, string> = {
  klasse: "8b 🔥", lea: "Lea", mo: "Mo", jonas: "Jonas", mama: "Mama", yilmaz: "Frau Yilmaz", klikkteam: "Klikk-Team",
};

const uhr = (h: number, m = 0) => h * 60 + m;

export function spur(s: Stand, app: AppId, an: "Klikk" | "AdKit", text: string) {
  s.spur.push({ tag: s.tag, uhr: s.uhr, app, an, text });
}

export function push(s: Stand, app: AppId, titel: string, text: string, chat?: ChatId, zeit = s.uhr) {
  if (s.rechte.mitteilungen === false) return;
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
    nachricht(s, "klasse", "Ben", "💀💀", wahl("bus", ["lachen", "😂😂"], ["stopp", "Lasst das mal, das ist fies."]));
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
      wahl("kommentar", ["liken", "Die Kommentare liken 😂"], ["nett", "Selbst kommentieren: »Klingt echt gut!«"]));
  } },
  { id: "gleis", tag: 2, uhr: uhr(17, 45), tu: s => {
    nachricht(s, "mo", "Mo", "ALTER hast du die #GleisSelfie videos gesehen?? 12k aufrufe 🤯");
    nachricht(s, "mo", "Mo", "morgen nach der schule am alten bahndamm. da fährt eh kaum was. du kommst mit 😏",
      wahl("gleis", ["dabei", "Bin dabei 😎"], ["ohne", "Ohne mich."], ["stopp", "Mo, lass das. Echt jetzt. Da sterben Leute."]));
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

  // ── Freitag ──
  { id: "trendFr", tag: 4, uhr: uhr(15, 0), wenn: s => !!s.flags.moVerletzt, tu: s => push(s, "klikk", "🔥 Trend in deiner Nähe", "Mo am Bahndamm – #GleisSelfie · 48.000 Aufrufe, 230 Duette") },
  { id: "wochenende", tag: 4, uhr: uhr(18, 0), tu: s => nachricht(s, "lea", "Lea", "endlich wochenende 🥳 kommst du morgen mit ins freibad?") },
];

/** Folgen einer Entscheidung, sofort beim Tippen. */
export const FOLGEN: Record<string, (s: Stand, o: string) => void> = {
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
  if (s.tag === 2 && s.flags.erkaeltet) m.push("Seit der Eiswasser-Challenge hast du Halsschmerzen.");
  if (s.tag === 2) m.push("In der großen Pause sitzt Jonas allein auf der Treppe und schaut aufs Handy.");
  if (s.tag === 3) m.push("Jemand hat den Schnarch-Sticker auf die Tafel gemalt. Jonas wischt ihn wortlos weg.");
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

/** Am Freitagmorgen: Wie es für Jonas und Mo ausgeht. */
export function wocheAuswerten(s: Stand) {
  const geschrieben = jonasGeschrieben(s);
  s.flags.jonasAusgang = s.flags.jonas_j4 || gewaehlt(s, "umfrage") === "screenshot" ? 2 : geschrieben.length ? 1 : 0;
  s.flags.moVerletzt = gewaehlt(s, "gleis") !== "stopp";
}
