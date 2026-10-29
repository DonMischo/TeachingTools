/**
 * Der Motor: jede Handlung ist eine reine Funktion Stand → neuer Stand.
 * Zeit vergeht nur durch Handlungen (Beitrag ansehen 2 Min., Hausaufgabe 9 Min. …),
 * dabei feuern die Ereignisse der Geschichte zu ihrer Uhrzeit.
 */
import { zufall, type FeedEintrag } from "./feed";
import {
  ABZEICHEN, EREIGNISSE, FOLGEN, JONAS_OPTIONEN, LETZTER_TAG, SIGNALE,
  abzeichen, morgenMeldung, nachricht, push, spur, wocheAuswerten,
} from "./geschichte";
import { POSTS, THEMA_NAME } from "./posts";
import { REICHWEITE, RISIKO_NAME, TRENDS, trendNachId } from "./trends";
import type { AppId, ChatId, Recht, Stand } from "./typen";

export const START_UHR = 14 * 60;
export const MITTERNACHT = 24 * 60;
const AUFSTEHEN = 6 * 60 + 30;
export const ABENDESSEN = 19 * 60;
const FRUEHESTES_BETT = 21 * 60 + 30;

export function neuerStand(seed = 1): Stand {
  return {
    phase: "start", tag: 0, uhr: START_UHR, seed,
    agbSekunden: 0, rechte: {}, name: "", alterAngabe: 0, alterEcht: 0,
    follower: 23, likes: 0, streak: 12, snapTag: -1, abzeichen: [], gepostet: [],
    schlaf: [], hausaufgaben: [], hausaufgabenStand: 0, unterbrechungen: 0, freunde: 0, freundeTag: -1,
    verweil: {}, gelikt: {}, gesehen: [], spur: [], nachtOeffnungen: [], pushGesamt: 0, pushGeoeffnet: 0,
    appsGeoeffnet: {}, shopAngesehen: [], quiz: {}, candyRunden: 0, werbung: [],
    werbungKlicks: [], schleich: [], umfragen: {}, videos: [],
    erledigt: [], chats: { klasse: [], lea: [], mo: [], jonas: [], mama: [], yilmaz: [], klikkteam: [], gewinn: [], leon: [] },
    ungelesen: {}, gelesen: [], pushes: [], flags: {}, bemerkt: {}, morgen: [],
  };
}

const kopie = (s: Stand): Stand => structuredClone(s);

/** Gespeicherte Stände älterer Versionen um neue Felder ergänzen. */
export function ergaenze(s: Stand): Stand {
  const n = neuerStand(s.seed);
  return { ...n, ...s, chats: { ...n.chats, ...s.chats } };
}

/** Feuert alle fälligen Ereignisse des Tages (bis `bis`, Standard: jetzt). */
function feuere(s: Stand, bis = s.uhr) {
  const faellig = EREIGNISSE
    .filter(e => e.tag === s.tag && e.uhr <= bis && !s.erledigt.includes(e.id))
    .sort((a, b) => a.uhr - b.uhr);
  for (const e of faellig) {
    s.erledigt.push(e.id);
    if (e.wenn && !e.wenn(s)) continue;
    const jetzt = s.uhr;
    s.uhr = e.uhr;
    e.tu(s);
    s.uhr = jetzt;
  }
}

/** Zeit vergeht. Likes auf eigene Beiträge tröpfeln ein — mal viele, mal wenige. */
function tick(s: Stand, minuten: number) {
  const vorher = s.uhr;
  s.uhr = Math.min(MITTERNACHT, s.uhr + minuten);
  feuere(s);
  const offen = Number(s.flags.offeneLikes ?? 0);
  if (offen > 0 && Math.floor(s.uhr / 20) > Math.floor(vorher / 20)) {
    const r = zufall(s.seed + s.uhr);
    const n = Math.max(1, Math.round(offen * (0.15 + r() * 0.6)));
    s.flags.offeneLikes = offen - n;
    s.likes += n;
    s.follower += Math.floor(n / 6);
    push(s, "klikk", "❤️ Neue Likes", `${n} Leute mögen deinen Beitrag`);
  }
  if (s.follower >= 150) abzeichen(s, "aufsteiger");
}

/** Wer die App nachts öffnet, wird gezählt. */
function nachtCheck(s: Stand, app: AppId) {
  if (s.uhr >= 23 * 60) {
    s.nachtOeffnungen.push({ tag: s.tag, uhr: s.uhr });
    spur(s, app, app === "klikk" || app === "chats" ? "Klikk" : "AdKit", "App-Öffnung nach 23 Uhr");
    abzeichen(s, "nachteule");
  }
}

// ───────── Anmeldung ─────────

export const starte = (alt: Stand): Stand => ({ ...alt, phase: "onboarding" });

export function agbAkzeptiert(alt: Stand, sekunden: number): Stand {
  const s = kopie(alt);
  s.agbSekunden = Math.round(sekunden);
  spur(s, "klikk", "Klikk", `Nutzungsbedingungen (ca. 20 Min. Lesezeit) nach ${s.agbSekunden} Sekunden akzeptiert`);
  return s;
}

const RECHT_SPUR: Record<Recht, string> = {
  kontakte: "Adressbuch hochgeladen: 47 Kontakte mit Telefonnummern (auch von Leuten ohne Klikk — Oma, Kinderarzt, Fußballtrainer)",
  standort: "Standortzugriff erlaubt — ab jetzt bei jeder Öffnung mitgeschickt",
  mikrofon: "Mikrofonzugriff erlaubt",
  mitteilungen: "Mitteilungen erlaubt — Klikk darf dich jederzeit zurückholen",
};

export function recht(alt: Stand, r: Recht, ja: boolean, app: AppId = "klikk"): Stand {
  const s = kopie(alt);
  if (s.rechte[r] === undefined || ja) s.rechte[r] = ja;
  if (ja) spur(s, app, app === "klikk" ? "Klikk" : "AdKit", RECHT_SPUR[r]);
  return s;
}

export function profil(alt: Stand, name: string, alterAngabe: number, alterEcht: number): Stand {
  const s = kopie(alt);
  s.name = name.trim() || "du";
  s.alterAngabe = alterAngabe;
  s.alterEcht = alterEcht;
  spur(s, "klikk", "Klikk", `Profil angelegt: »${s.name}«, angeblich ${alterAngabe} Jahre`);
  return s;
}

export function onboardingFertig(alt: Stand): Stand {
  const s = kopie(alt);
  s.phase = "woche";
  s.morgen = ["Montag, nach der Schule. Neues Handy, neue App — alle aus der 8b sind schon auf Klikk."];
  feuere(s);
  return s;
}

// ───────── Klikk-Feed ─────────

/** Ein Beitrag wurde angesehen (Verweildauer echt gemessen) und weggewischt. */
export function gesehen(alt: Stand, e: FeedEintrag, ms: number, gelikt: boolean): Stand {
  const s = kopie(alt);
  if (e.art === "werbung") {
    s.gesehen.push(`w:${e.werbung.id}`);
    s.werbung.push({ id: e.werbung.id, tag: s.tag, uhr: s.uhr });
  } else {
    const t = e.post.thema;
    s.gesehen.push(e.post.id);
    s.verweil[t] = (s.verweil[t] ?? 0) + Math.min(ms, 60000);
    if (gelikt) s.gelikt[t] = (s.gelikt[t] ?? 0) + 1;
    if (ms > 6000) spur(s, "klikk", "Klikk", `${Math.round(ms / 1000)} s bei »${e.post.text.slice(0, 40)}…« (${THEMA_NAME[t]})`);
    if (gelikt) spur(s, "klikk", "Klikk", `Gelikt: ${THEMA_NAME[t]}`);
    if (e.post.schleich && !s.schleich.includes(e.post.schleich)) s.schleich.push(e.post.schleich);
  }
  if (s.gesehen.length >= 60) abzeichen(s, "dauergast");
  tick(s, 2);
  return s;
}

/** Eine Umfrage im Feed beantworten — »anonym«, sagt der Beitrag. */
export function umfrage(alt: Stand, postId: string, option: string): Stand {
  if (alt.umfragen[postId]) return alt;
  const s = kopie(alt);
  s.umfragen[postId] = option;
  const p = POSTS.find(x => x.id === postId);
  const frage = p?.medien?.art === "umfrage" ? p.medien.frage : postId;
  spur(s, "klikk", "Klikk", `Umfrage »${frage}« → ${option}`);
  return s;
}

/** Auf eine Anzeige geklickt — und wie weit es danach ging. */
export function werbungKlick(alt: Stand, id: string, stufe: "seite" | "kasse" | "bestellt"): Stand {
  const s = kopie(alt);
  const rang = { seite: 0, kasse: 1, bestellt: 2 };
  const k = s.werbungKlicks.find(x => x.id === id);
  if (k) { if (rang[stufe] > rang[k.stufe]) k.stufe = stufe; }
  else s.werbungKlicks.push({ id, stufe, tag: s.tag, uhr: s.uhr });
  spur(s, "klikk", "Klikk", stufe === "seite" ? `Anzeige angeklickt: ${id}` : stufe === "kasse" ? `Bis zur Kasse: ${id}` : `»Bestellen« gedrückt: ${id}`);
  tick(s, stufe === "seite" ? 2 : 1);
  return s;
}

/** Trends, zu denen man heute ein Video posten kann. */
export function moeglicheTrends(s: Stand) {
  return TRENDS.filter(t => t.tag <= s.tag && !s.videos.some(v => v.trend === t.id));
}

/**
 * Ein eigenes Challenge-Video posten. Klikk belohnt das Risiko mit Reichweite —
 * ob echt oder gefaked, kann der Algorithmus nicht unterscheiden.
 */
export function challengePosten(alt: Stand, trendId: string, fake: boolean): Stand {
  const tr = trendNachId(trendId);
  if (!tr || tr.tag > alt.tag || alt.videos.some(v => v.trend === trendId)) return alt;
  const s = kopie(alt);
  const r = zufall(s.seed * 7 + s.tag * 31 + trendId.length);
  const aufrufe = Math.round(REICHWEITE[tr.risiko] * (8 + r() * 12));
  s.videos.push({ trend: trendId, fake, tag: s.tag, aufrufe });
  s.flags.offeneLikes = Number(s.flags.offeneLikes ?? 0) + Math.round(aufrufe / 9);
  s.follower += Math.round(aufrufe / 60);
  spur(s, "klikk", "Klikk", `Challenge-Video ${tr.name} gepostet (${fake ? "gefaked" : "echt"}, ${RISIKO_NAME[tr.risiko]}) — Gesicht, Zimmer und Stimme im Video`);
  tick(s, fake ? 30 : 20);

  push(s, "klikk", "🚀 Dein Video läuft!", `${tr.name} · ${aufrufe.toLocaleString("de-DE")} Aufrufe`);
  push(s, "klikk", "💬 Neue Kommentare", fake ? "»fake 🤡« »egal, krass 🔥« »mach's in echt«" : tr.risiko === "harmlos" ? "»haha 😂« »süß«" : "»KRASS 🔥🔥« »mach's noch krasser« »legende«");
  if (tr.risiko === "gefaehrlich") abzeichen(s, "viral");

  if (!fake) {
    if (tr.risiko === "harmlos") nachricht(s, "lea", "Lea", "😂😂😂 dein video omg");
    else nachricht(s, "mama", "", tr.folge, { system: true });
    if (tr.id === "eis") { s.flags.erkaeltet = true; nachricht(s, "mama", "Mama", "Warum ist das Bad nass und du hast Fieber??"); }
    if (tr.id === "hotchip") { nachricht(s, "mama", "Mama", "Wir fahren JETZT in die Notaufnahme. Zieh dir Schuhe an."); tick(s, 180); }
    if (tr.id === "gleis") nachricht(s, "mama", "Mama", "Die Bundespolizei war hier. Ich bin fassungslos. Du hättest TOT sein können.");
    if (tr.id === "dach") { nachricht(s, "mama", "Mama", "Ich hol dich im Krankenhaus ab. Wir reden später."); tick(s, 120); }
    if (tr.id === "nosleep") s.flags.nosleep = s.tag;
    if (tr.risiko !== "harmlos") s.flags[`folge_${tr.id}`] = s.tag;
  }
  // Der Algorithmus will mehr: die nächste, riskantere Challenge vorschlagen
  const mehr = TRENDS.find(t => t.tag <= s.tag + 1 && REICHWEITE[t.risiko] > REICHWEITE[tr.risiko] && !s.videos.some(v => v.trend === t.id));
  if (mehr) push(s, "klikk", "🔥 Deine Follower wollen mehr", `Probier ${mehr.name} — das geht gerade richtig ab!`);
  return s;
}

export const MOTIVE = [
  { id: "selfie", emoji: "🤳", text: "Selfie nach der Schule" },
  { id: "essen", emoji: "🍜", text: "Mittagessen" },
  { id: "tier", emoji: "🐈", text: "Die Katze von nebenan" },
  { id: "himmel", emoji: "🌇", text: "Sonnenuntergang" },
];

/** Einmal am Tag etwas posten — die Likes kommen über den Nachmittag. */
export function posten(alt: Stand, motiv: string): Stand {
  if (alt.gepostet.includes(alt.tag)) return alt;
  const s = kopie(alt);
  s.gepostet.push(s.tag);
  const r = zufall(s.seed * 31 + s.tag);
  // Variable Belohnung: mal 6, mal 140 Likes — wie am Spielautomaten
  s.flags.offeneLikes = Number(s.flags.offeneLikes ?? 0) + Math.round(6 + r() * r() * 160) + (motiv === "selfie" ? 20 : 0);
  spur(s, "klikk", "Klikk", motiv === "selfie" ? "Selfie hochgeladen — Gesichtsdaten erfasst" : `Foto gepostet (${motiv}) mit Ort und Uhrzeit`);
  tick(s, 5);
  return s;
}

// ───────── Apps und Chats ─────────

export function oeffneApp(alt: Stand, app: AppId): Stand {
  const s = kopie(alt);
  s.appsGeoeffnet[app] = (s.appsGeoeffnet[app] ?? 0) + 1;
  if (s.hausaufgabenStand > 0 && s.hausaufgabenStand < AUFGABEN && !s.flags.haPause) {
    s.unterbrechungen++;
    s.flags.haPause = true;
  }
  if (s.rechte.standort && !s.flags[`ort${s.tag}`]) {
    s.flags[`ort${s.tag}`] = true;
    spur(s, app, app === "klikk" || app === "chats" ? "Klikk" : "AdKit", `Standort ${zeit(s.uhr)}: Zuhause (derselbe Ort wie jeden Abend)`);
  }
  nachtCheck(s, app);
  tick(s, 1);
  return s;
}

export function oeffneChat(alt: Stand, chat: ChatId): Stand {
  const s = kopie(alt);
  s.ungelesen[chat] = 0;
  for (const n of s.chats[chat]) if (!s.gelesen.includes(n.id)) s.gelesen.push(n.id);
  if (chat === "jonas") {
    for (const sig of SIGNALE) if (s.flags[sig.flag] && !s.bemerkt[sig.id]) s.bemerkt[sig.id] = { tag: s.tag, uhr: s.uhr };
  }
  tick(s, 1);
  return s;
}

/** Antworten im gerade offenen Chat sind gelesen und brauchen keine Benachrichtigung. */
function imChat(s: Stand, chat: ChatId) {
  s.pushes = s.pushes.filter(p => p.chat !== chat);
  s.ungelesen[chat] = 0;
  for (const n of s.chats[chat]) if (!s.gelesen.includes(n.id)) s.gelesen.push(n.id);
}

export function oeffnePush(alt: Stand, id: string): Stand {
  const s = kopie(alt);
  s.pushes = s.pushes.filter(p => p.id !== id);
  s.pushGeoeffnet++;
  spur(s, "klikk", "Klikk", `Benachrichtigung um ${zeit(s.uhr)} geöffnet`);
  if (s.pushGeoeffnet >= 5) abzeichen(s, "blitz");
  return s;
}

export const pushesWeg = (alt: Stand): Stand => ({ ...alt, pushes: [] });

export function waehle(alt: Stand, chat: ChatId, nachrichtId: string, option: string): Stand {
  const s = kopie(alt);
  const n = s.chats[chat].find(x => x.id === nachrichtId);
  if (!n?.wahl || n.wahl.gewaehlt) return alt;
  n.wahl.gewaehlt = option;
  const text = n.wahl.optionen.find(o => o.id === option)?.text ?? option;
  nachricht(s, chat, "du", text);
  if (n.wahl.id === "kommentar" && option === "nett") spur(s, "klikk", "Klikk", "Kommentar unter Jonas' Video");
  if (n.wahl.id === "account" && option === "folgen") spur(s, "klikk", "Klikk", "Folgt @jonas_schnarcht");
  FOLGEN[n.wahl.id]?.(s, option);
  imChat(s, chat);
  tick(s, 1);
  return s;
}

export function jonasOptionen(s: Stand) {
  return JONAS_OPTIONEN.filter(o => s.tag >= o.ab && !s.flags[`jonas_${o.id}`] && (!o.nach || s.flags[`jonas_${o.nach}`]));
}

export function schreibeJonas(alt: Stand, id: string): Stand {
  const o = JONAS_OPTIONEN.find(x => x.id === id);
  if (!o || alt.flags[`jonas_${id}`]) return alt;
  const s = kopie(alt);
  s.flags[`jonas_${id}`] = true;
  s.flags[`jonas_${id}_zeit`] = s.tag * MITTERNACHT + s.uhr;
  nachricht(s, "jonas", "du", o.text);
  tick(s, 4);
  nachricht(s, "jonas", "Jonas", o.antwort(s));
  imChat(s, "jonas");
  return s;
}

export function snap(alt: Stand): Stand {
  if (alt.snapTag === alt.tag) return alt;
  const s = kopie(alt);
  s.snapTag = s.tag;
  s.streak++;
  nachricht(s, "lea", "du", "", { bild: "📸 Snap: schwarzes Bild mit »streak«" });
  spur(s, "klikk", "Klikk", "Streak-Snap an Lea — täglich aktiv");
  if (s.streak >= 15) abzeichen(s, "streak");
  tick(s, 1);
  return s;
}

// ───────── Fremde Apps (alle mit dem Werbe-SDK »AdKit«) ─────────

export const PRODUKTE = [
  { id: "airmax", name: "Air Blitz 90", preis: 139, emoji: "👟" },
  { id: "jordan", name: "Jumpman Retro", preis: 189, emoji: "🏀" },
  { id: "samba", name: "Sambino OG", preis: 99, emoji: "⚽" },
  { id: "crocs", name: "Clogz Neon", preis: 49, emoji: "🐊" },
];

export function shopAnsehen(alt: Stand, produkt: string): Stand {
  const s = kopie(alt);
  const p = PRODUKTE.find(x => x.id === produkt);
  if (p && !s.shopAngesehen.includes(p.name)) s.shopAngesehen.push(p.name);
  if (p) spur(s, "sneakr", "AdKit", `Produkt angesehen: ${p.name} (${p.preis} €)`);
  tick(s, 2);
  return s;
}

export function candyRunde(alt: Stand, punkte: number): Stand {
  const s = kopie(alt);
  s.candyRunden++;
  spur(s, "candy", "AdKit", `Spielrunde: ${punkte} Punkte, Geräte-ID, Spielzeit ${zeit(s.uhr)}`);
  tick(s, 6);
  return s;
}

export const QUIZ = [
  { id: "laune", frage: "Wie fühlst du dich meistens abends?", antworten: [["gut", "😊 Gut drauf"], ["muede", "😴 Müde"], ["allein", "😔 Irgendwie allein"], ["gestresst", "😤 Gestresst"]] },
  { id: "aendern", frage: "Was würdest du an dir ändern, wenn du könntest?", antworten: [["nichts", "Nichts!"], ["koerper", "Meinen Körper"], ["noten", "Meine Noten"], ["freunde", "Mehr Freunde"]] },
  { id: "schlaf", frage: "Wann schläfst du unter der Woche ein?", antworten: [["frueh", "Vor 22 Uhr"], ["mittel", "22–23 Uhr"], ["spaet", "Nach 23 Uhr"], ["sehrspaet", "Nach Mitternacht"]] },
  { id: "geld", frage: "Wie viel Taschengeld hast du im Monat?", antworten: [["0", "Keins"], ["20", "Bis 20 €"], ["50", "20–50 €"], ["mehr", "Mehr als 50 €"]] },
  { id: "eltern", frage: "Wie oft streitest du mit deinen Eltern?", antworten: [["nie", "Fast nie"], ["manchmal", "Manchmal"], ["oft", "Oft"], ["immer", "Ständig"]] },
] as const;

export function quizAntwort(alt: Stand, frage: string, antwort: string): Stand {
  const s = kopie(alt);
  s.quiz[frage] = antwort;
  const q = QUIZ.find(x => x.id === frage);
  const text = q?.antworten.find(a => a[0] === antwort)?.[1] ?? antwort;
  spur(s, "quiz", "AdKit", `Quiz: »${q?.frage}« → ${text}`);
  tick(s, 1);
  return s;
}

// ───────── Nachmittag: Hausaufgaben, Freunde, Schlafen ─────────

export const AUFGABEN = 5;

export function aufgabe(s: Stand, i = s.hausaufgabenStand) {
  const r = zufall(s.seed * 97 + s.tag * 13 + i);
  const a = 3 + Math.floor(r() * 7), b = 4 + Math.floor(r() * 6);
  return { text: `${a} · ${b}`, loesung: a * b };
}

export function loeseAufgabe(alt: Stand, antwort: number): Stand {
  const s = kopie(alt);
  if (s.hausaufgaben[s.tag]) return alt;
  // Nach einer Unterbrechung dauert es, wieder reinzukommen
  if (s.flags.haPause) { s.flags.haPause = false; tick(s, 5); }
  if (antwort !== aufgabe(s).loesung) { tick(s, 2); return s; }
  s.hausaufgabenStand++;
  tick(s, 9);
  if (s.hausaufgabenStand >= AUFGABEN) s.hausaufgaben[s.tag] = true;
  return s;
}

export function freundeTreffen(alt: Stand): Stand {
  if (alt.freundeTag === alt.tag || alt.uhr >= ABENDESSEN) return alt;
  const s = kopie(alt);
  s.freundeTag = s.tag;
  s.freunde++;
  tick(s, 90);
  return s;
}

/** Ins Bett. Danach kommt (fast) immer noch eine Benachrichtigung um 23:40. */
export function schlafen(alt: Stand): Stand {
  const s = kopie(alt);
  if (s.hausaufgaben[s.tag] === undefined) s.hausaufgaben[s.tag] = false;
  s.flags.bettZeit = s.uhr;
  feuere(s, MITTERNACHT);
  s.phase = s.uhr < MITTERNACHT ? "nacht" : s.phase;
  if (s.phase !== "nacht") return naechsterTag(s, s.uhr);
  return s;
}

export function nachtPush(s: Stand) {
  return s.snapTag !== s.tag && s.streak > 0
    ? { titel: "🔥 Lea · Streak", text: `Eure ${s.streak}-Tage-Streak läuft in 20 Minuten ab!` }
    : { titel: "8b 🔥", text: "31 neue Nachrichten" };
}

export function nacht(alt: Stand, nachsehen: boolean): Stand {
  const s = kopie(alt);
  let bett = Number(s.flags.bettZeit ?? s.uhr);
  if (nachsehen) {
    s.uhr = Math.max(s.uhr, 23 * 60 + 40);
    s.nachtOeffnungen.push({ tag: s.tag, uhr: s.uhr });
    spur(s, "klikk", "Klikk", `Benachrichtigung um ${zeit(s.uhr)} geöffnet — im Bett`);
    abzeichen(s, "nachteule");
    if (s.snapTag !== s.tag && s.streak > 0) { s.snapTag = s.tag; s.streak++; if (s.streak >= 15) abzeichen(s, "streak"); }
    bett = Math.max(bett, 23 * 60 + 40) + 45;
  }
  return naechsterTag(s, bett);
}

function naechsterTag(s: Stand, bett: number): Stand {
  // Vor 21:30 liegt niemand wirklich im Bett: Abendessen, Familie, Zähneputzen
  s.schlaf[s.tag] = Math.round(((MITTERNACHT - Math.max(bett, FRUEHESTES_BETT)) + AUFSTEHEN) / 6) / 10;
  if (s.flags.nosleep === s.tag) s.schlaf[s.tag] = 0; // #NoSleep48: die Nacht durch gestreamt
  if (s.snapTag !== s.tag && s.streak > 0) {
    s.flags.streakVerloren = s.streak;
    s.streak = 0;
  }
  // Was nicht beantwortet wurde, ist jetzt Schweigen
  for (const c of Object.values(s.chats)) for (const n of c) if (n.wahl && !n.wahl.gewaehlt) n.wahl.gewaehlt = "still";
  if (s.tag >= LETZTER_TAG) {
    s.phase = "jonas";
    return s;
  }
  s.tag++;
  s.uhr = START_UHR;
  s.hausaufgabenStand = 0;
  s.flags.haPause = false;
  s.phase = "woche";
  if (s.tag === LETZTER_TAG) wocheAuswerten(s);
  if (s.flags.streakVerloren) {
    const zeitAlt = s.uhr;
    s.uhr = 7 * 60;
    nachricht(s, "lea", "Lea", `unsere streak ist weg 😭😭 ${s.flags.streakVerloren} tage!! warum hast du nicht geantwortet`);
    s.uhr = zeitAlt;
    s.flags.streakVerloren = 0;
  }
  s.morgen = morgenMeldung(s);
  feuere(s);
  return s;
}

export const zumSpiegel = (alt: Stand): Stand => ({ ...alt, phase: "spiegel" });

export const zeit = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export { ABZEICHEN };
