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
import { VEREINE, schritteFuer, vereinHeute, type AktArt } from "./freizeit";
import { npcKommentare } from "./klasse";
import { ENERGIE_MAX, energieAuffuellen, neuerElemonStand, type ElemonStand } from "./elemon/spiel";
import type { AppId, ChatId, ElternTyp, Recht, Stand } from "./typen";

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
    eltern: "locker", limit: { proTag: null, sperreAb: null, vonEltern: false }, handyMinuten: [], limitIgnoriert: 0,
    stumm: [], trackingAus: false, werbeIdNeu: false, fokus: false, vereinTage: null, vereinUm: null,
    famAbgelehnt: 0, famZusagen: [], famErzwungen: null, samstag: false, ton: false,
    weckzeit: 6 * 60 + 30, hygiene: 80, morgenErledigt: [], zuSpaet: [],
    spielRunden: [], checks: {}, geteilt: [], eigenePosts: [], blockiert: [], klasseGesehen: [], aktivitaet: null, freizeit: [], verein: null, lesestand: {}, serienstand: {},
    erledigt: [], chats: { klasse: [], lea: [], mo: [], jonas: [], mama: [], yilmaz: [], klikkteam: [], gewinn: [], leon: [], verein: [], emma: [], marke: [], tim: [] },
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
/**
 * Die Eltern-Sperre greift: die Klasse schreibt trotzdem weiter — und merkt,
 * dass du nie da bist. Einmal am Tag, zu lesen erst, wenn das Handy wieder geht.
 */
function nichtErreichbar(s: Stand) {
  if (s.phase !== "woche" || s.flags[`nieda_${s.tag}`]) return;
  const grund = gesperrt(s);
  if (grund !== "elternSperre" && grund !== "elternLimit") return;
  s.flags[`nieda_${s.tag}`] = true;
  const r = zufall(s.seed * 17 + s.tag);
  const fies = [
    ["Finn", "Wer kommt noch in die Elemon-Arena? 🏟️"],
    ["Aylin", `@${s.name || "du"} bist du da?`],
    ["Finn", "Lass, der Akku ist bei den Eltern 😂"],
    ["Aylin", "Nie erreichbar 🙄"],
  ];
  const ende = r() < 0.5 ? ["Mo", "Kein Stress, wir spielen morgen 🤝"] : ["Finn", "Kannst eh nicht mitspielen 🤷"];
  for (const [i, [von, text]] of [...fies, ende].entries()) nachricht(s, "klasse", von, text, {}, s.uhr + i);
}

function tick(s: Stand, minuten: number, uhrZieht = false) {
  // Klassenmodus: die Zeit bestimmt die Klassen-Uhr, nicht die Handlung
  if (s.flags.klassenuhr && !uhrZieht) minuten = 0;
  const vorher = s.uhr;
  s.uhr = Math.min(MITTERNACHT, s.uhr + minuten);
  feuere(s);
  nichtErreichbar(s);
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
  neueKommentare(s);
  moKopieFaellig(s);
  // Genug Reichweite: eine Marke meldet sich (bezahlt wird am Ende nie)
  if (!s.flags.dealAngebot && (s.follower >= 200 || s.videos.some(v => v.aufrufe >= 5000))) {
    s.flags.dealAngebot = true;
    nachricht(s, "marke", "GlowDrink Team ✔", "Hey 💫 Wir lieben deinen Content! Wir schicken dir 12 Dosen GlowDrink, du postest ein Video damit. Deal? 🤝",
      { wahl: { id: "deal", optionen: [{ id: "kennzeichnen", text: "Annehmen und als #Werbung kennzeichnen" }, { id: "verstecken", text: "Annehmen, aber ohne »Werbung« – wirkt echter" }, { id: "ablehnen", text: "Ablehnen" }] } });
  }
  if (s.flags.deal && !s.flags.dealEnde && s.flags.dealAngebot && s.uhr >= 9 * 60 && s.tag > Number(s.flags.dealTag ?? 99)) {
    s.flags.dealEnde = true;
    nachricht(s, "marke", "GlowDrink Team ✔", "Leider hat dein Video unsere Reichweiten-Ziele nicht erreicht 😔 Eine Bezahlung ist daher nicht möglich. Die Dosen darfst du natürlich behalten! 💫");
  }
  if (s.flags.deal && s.flags.dealTag === undefined) s.flags.dealTag = s.tag;
  if (s.famErzwungen && !s.aktivitaet && s.phase === "woche") {
    const id = s.famErzwungen;
    s.famErzwungen = null;
    s.aktivitaet = { art: "familie", id, schritt: 0, unterbrochen: 0, start: s.uhr, gestoert: false };
    s.flags[`fam_${id}_${s.tag}`] = true;
    s.flags[`fam_${id}`] = true;
  }
  // Freitagabend: der Wochenbericht der Bildschirmzeit
  if (s.tag === LETZTER_TAG && s.uhr >= 20 * 60 && !s.flags.bildschirmBericht) {
    s.flags.bildschirmBericht = true;
    const tage = s.handyMinuten.filter(m => m !== undefined);
    const schnitt = tage.length ? tage.reduce((a, b) => a + (b ?? 0), 0) / tage.length : 0;
    push(s, "einstellungen", "📊 Bildschirmzeit", `Diese Woche ${Math.floor(schnitt / 60)} Std. ${Math.round(schnitt % 60)} Min. pro Tag – ${schnitt > 120 ? "+" : "−"}${Math.abs(Math.round((schnitt - 120) / 1.2))} % zur Vorwoche`);
  }
  const v = vereinHeute(s);
  if (v?.vorbei && !s.flags[`verein_${s.tag}`] && !s.flags[`vereinFehlt_${s.tag}`] && !(s.aktivitaet?.art === "verein")) {
    s.flags[`vereinFehlt_${s.tag}`] = true;
    s.flags.vereinFehlt = Number(s.flags.vereinFehlt ?? 0) + 1;
    nachricht(s, "verein", v.verein.trainer, Number(s.flags.vereinFehlt) > 1 ? "Schon wieder nicht da. Ist alles okay bei dir? Sag Bescheid, wenn was ist." : "Hey, wo warst du heute? Wir haben dich vermisst 🤨", {}, v.verein.um + 20);
  }
}

/** Zeit am Handy: zählt für die Bildschirmzeit und vergeht wie jede andere. */
function handyTick(s: Stand, minuten: number) {
  s.handyMinuten[s.tag] = (s.handyMinuten[s.tag] ?? 0) + minuten;
  tick(s, minuten);
}

/** Ist das Handy gerade gesperrt (Limit, Sperrzeit)? Liefert den Grund. */
export function gesperrt(s: Stand): string | null {
  if (s.flags.klassenuhr && s.phase === "woche" && s.uhr >= 8 * 60 && s.uhr < START_UHR && s.tag <= LETZTER_TAG) return "schule";
  if (s.limit.sperreAb !== null && s.uhr >= s.limit.sperreAb && !s.flags[`sperreWeg_${s.tag}`])
    return s.limit.vonEltern ? "elternSperre" : "sperre";
  if (s.limit.proTag !== null && (s.handyMinuten[s.tag] ?? 0) >= s.limit.proTag && !s.flags[`limitWeg_${s.tag}`])
    return s.limit.vonEltern ? "elternLimit" : "limit";
  return null;
}

/** Eigenes Limit für heute ignorieren — oder die Eltern um mehr Zeit bitten. */
export function limitUmgehen(alt: Stand): Stand {
  const grund = gesperrt(alt);
  if (!grund) return alt;
  const s = kopie(alt);
  if (grund === "sperre" || grund === "limit") {
    s.flags[grund === "sperre" ? `sperreWeg_${s.tag}` : `limitWeg_${s.tag}`] = true;
    s.limitIgnoriert++;
    return s;
  }
  // Eltern fragen: Besorgte geben einmal nach, Strenge nie
  const schon = Number(s.flags.elternGefragt ?? 0);
  s.flags.elternGefragt = schon + 1;
  if (s.eltern === "besorgt" && schon === 0) {
    s.flags[grund === "elternSperre" ? `sperreWeg_${s.tag}` : `limitWeg_${s.tag}`] = true;
    nachricht(s, "mama", "Mama", "Na gut, heute noch ein bisschen. Aber wirklich nur heute. ❤️");
  } else {
    nachricht(s, "mama", s.eltern === "streng" ? "Papa" : "Mama", s.eltern === "streng" ? "Nein. Regel ist Regel." : "Nein, Schatz. Morgen wieder.");
  }
  return s;
}

/** Vor der Woche: Eltern, Bildschirmzeit, Verein. */
export function einstellen(alt: Stand, e: { eltern: ElternTyp; proTag: number | null; sperreAb: number | null; verein: string | null; vereinTage: number[] | null; vereinUm: number | null; samstag?: boolean; weckzeit?: number }): Stand {
  const s = kopie(alt);
  if (e.weckzeit) s.weckzeit = e.weckzeit;
  s.eltern = e.eltern;
  s.samstag = !!e.samstag;
  // Strenge Eltern sammeln das Handy um 21 Uhr ein, besorgte setzen zwei Stunden — wer selbst strenger ist, gewinnt
  const eltern = e.eltern === "streng" ? { proTag: null, sperreAb: 21 * 60 } : e.eltern === "besorgt" ? { proTag: 120, sperreAb: null } : null;
  s.limit = {
    proTag: eltern?.proTag ?? e.proTag ?? null, sperreAb: eltern?.sperreAb ?? e.sperreAb ?? null,
    vonEltern: !!eltern,
  };
  if (eltern && e.proTag !== null) s.limit.proTag = Math.min(e.proTag, s.limit.proTag ?? e.proTag);
  if (eltern && e.sperreAb !== null) s.limit.sperreAb = Math.min(e.sperreAb, s.limit.sperreAb ?? e.sperreAb);
  s.verein = e.verein;
  s.vereinTage = e.vereinTage;
  s.vereinUm = e.vereinUm;
  return s;
}

/** Handy-Einstellungen ändern. */
export function handyEinstellung(alt: Stand, was: "stumm" | "tracking" | "werbeId" | "fokus" | "recht" | "limit" | "ton", wert: string | boolean | number | null, recht?: Recht): Stand {
  const s = kopie(alt);
  if (was === "stumm") { const app = wert as AppId; s.stumm = s.stumm.includes(app) ? s.stumm.filter(a => a !== app) : [...s.stumm, app]; }
  if (was === "tracking") { s.trackingAus = !!wert; spur(s, "klikk", "Klikk", wert ? "App-Tracking verboten – AdKit bekommt keine Geräte-ID mehr" : "App-Tracking wieder erlaubt"); }
  if (was === "werbeId") { s.werbeIdNeu = true; spur(s, "klikk", "Klikk", "Werbe-ID zurückgesetzt – das alte Werbeprofil hängt nicht mehr an deinem Gerät"); }
  if (was === "fokus") s.fokus = !!wert;
  if (was === "ton") s.ton = !!wert;
  if (was === "recht" && recht) s.rechte[recht] = !!wert;
  if (was === "limit" && !s.limit.vonEltern) s.limit = { ...s.limit, proTag: wert as number | null };
  handyTick(s, 1);
  return s;
}

/** Training heute absagen — freundlich, statt einfach nicht zu kommen. */
export function vereinAbsagen(alt: Stand): Stand {
  const v = vereinHeute(alt);
  if (!v?.offen) return alt;
  const s = kopie(alt);
  s.flags[`vereinAbgesagt_${s.tag}`] = true;
  s.flags.vereinAbsagen = Number(s.flags.vereinAbsagen ?? 0) + 1;
  nachricht(s, "verein", "du", "Ich kann heute leider nicht, sorry!");
  nachricht(s, "verein", v.verein.trainer, Number(s.flags.vereinAbsagen) > 1 ? "Okay. Langsam vermissen wir dich aber 😅" : "Danke fürs Bescheid sagen 👍 Bis zum nächsten Mal!");
  handyTick(s, 1);
  return s;
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
  handyTick(s, 2);
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
  handyTick(s, stufe === "seite" ? 2 : 1);
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
  eigenerPost(s, { art: "video", trend: trendId, fake }, tr.risiko !== "harmlos");
  s.flags.offeneLikes = Number(s.flags.offeneLikes ?? 0) + Math.round(aufrufe / 9);
  s.follower += Math.round(aufrufe / 60);
  spur(s, "klikk", "Klikk", `Challenge-Video ${tr.name} gepostet (${fake ? "gefaked" : "echt"}, ${RISIKO_NAME[tr.risiko]}) — Gesicht, Zimmer und Stimme im Video`);
  handyTick(s, fake ? 30 : 20);

  push(s, "klikk", "🚀 Dein Video läuft!", `${tr.name} · ${aufrufe.toLocaleString("de-DE")} Aufrufe`);
  push(s, "klikk", "💬 Neue Kommentare", fake ? "»fake 🤡« »egal, krass 🔥« »mach's in echt«" : tr.risiko === "harmlos" ? "»haha 😂« »süß«" : "»KRASS 🔥🔥« »mach's noch krasser« »legende«");
  if (tr.risiko === "gefaehrlich") abzeichen(s, "viral");
  if (tr.risiko === "gefaehrlich") Object.assign(s, moNachmachen(s, trendId, "dir", fake));

  if (!fake) {
    if (tr.risiko === "harmlos") nachricht(s, "lea", "Lea", "😂😂😂 dein video omg");
    else nachricht(s, "mama", "", tr.folge, { system: true });
    if (tr.id === "eis") { s.flags.erkaeltet = true; nachricht(s, "mama", "Mama", "Warum ist das Bad nass und du hast Fieber??"); }
    if (tr.id === "hotchip") { nachricht(s, "mama", "Mama", "Wir fahren JETZT in die Notaufnahme. Zieh dir Schuhe an."); handyTick(s, 180); }
    if (tr.id === "gleis") nachricht(s, "mama", "Mama", "Die Bundespolizei war hier. Ich bin fassungslos. Dir hätte sonst was passieren können!");
    if (tr.id === "dach") { nachricht(s, "mama", "Mama", "Ich hol dich im Krankenhaus ab. Wir reden später."); handyTick(s, 120); }
    if (tr.id === "nosleep") s.flags.nosleep = s.tag;
    if (tr.risiko !== "harmlos") s.flags[`folge_${tr.id}`] = s.tag;
  }
  // Der Algorithmus will mehr: die nächste, riskantere Challenge vorschlagen
  const mehr = TRENDS.find(t => t.tag <= s.tag + 1 && REICHWEITE[t.risiko] > REICHWEITE[tr.risiko] && !s.videos.some(v => v.trend === t.id));
  if (mehr) push(s, "klikk", "🔥 Deine Follower wollen mehr", `Probier ${mehr.name} — das geht gerade richtig ab!`);
  return s;
}

// ───────── Eigene Beiträge: Kommentare, Klasse, Nachahmer ─────────

const jetztAbs = (s: Stand) => s.tag * MITTERNACHT + s.uhr;

/** Eigenen Beitrag merken; Kommentare von Fremden kommen über die nächste Stunde. */
function eigenerPost(s: Stand, p: { art: "foto" | "video" | "spiel"; motiv?: string; trend?: string; fake?: boolean; spiel?: string; punkte?: number; tipp?: string; spruch?: string }, riskant: boolean) {
  const id = `e${s.eigenePosts.length}`;
  const roh = npcKommentare(s.seed * 13 + s.eigenePosts.length * 7 + s.tag, riskant);
  // Wer ungewaschen in die Kamera hält, bekommt das zu lesen
  if (s.hygiene < 35 && p.art !== "spiel") roh.push({ von: "kein.name.7", text: "Riecht man bis hier 🤢", gemein: true });
  const kommentare = roh.map((k, i) => ({ ...k, um: jetztAbs(s) + 10 + i * 12 }));
  s.eigenePosts.push({ id, ...p, tag: s.tag, uhr: s.uhr, kommentare });
}

/** Kommentare, die inzwischen da sind, melden sich per Benachrichtigung. */
function neueKommentare(s: Stand) {
  const jetzt = jetztAbs(s);
  for (const p of s.eigenePosts) for (const k of p.kommentare) {
    if (k.um <= jetzt && !k.gemeldet && !s.blockiert.includes(k.von)) {
      k.gemeldet = true;
      push(s, "klikk", `💬 ${k.von}`, k.text);
    }
  }
}

export function kommentarAktion(alt: Stand, postId: string, index: number, aktion: "antworten" | "loeschen" | "blockieren" | "melden", antwort?: string): Stand {
  const s = kopie(alt);
  const k = s.eigenePosts.find(p => p.id === postId)?.kommentare[index];
  if (!k) return alt;
  if (aktion === "antworten") { k.status = "beantwortet"; k.antwort = antwort; }
  if (aktion === "loeschen") k.status = "geloescht";
  if (aktion === "blockieren") { k.status = "blockiert"; if (!s.blockiert.includes(k.von)) s.blockiert.push(k.von); }
  if (aktion === "melden") {
    k.status = "gemeldet";
    // Plattformen entscheiden oft gegen die Gemeldeten — nicht jede Meldung wirkt
    const entfernt = k.gemein && zufall(s.seed + index * 17 + s.eigenePosts.length)() < 0.5;
    nachricht(s, "klikkteam", "Klikk-Team", entfernt
      ? `Wir haben den Kommentar von ${k.von} entfernt. Danke für deine Meldung. 💙`
      : `Wir haben den Kommentar von ${k.von} geprüft und keinen Verstoß gegen unsere Richtlinien festgestellt.`);
  }
  if (k.gemein) s.flags[`hass_${aktion}`] = Number(s.flags[`hass_${aktion}`] ?? 0) + 1;
  handyTick(s, 1);
  return s;
}

/** Faktencheck abgeschlossen: Urteil abgeben. */
export function faktencheck(alt: Stand, id: string, urteil: "echt" | "fake", istFake: boolean): Stand {
  if (alt.checks[id]) return alt;
  const s = kopie(alt);
  s.checks[id] = { urteil, richtig: (urteil === "fake") === istFake };
  handyTick(s, 4);
  return s;
}

/** Eine Nachricht weiterteilen — mit oder ohne vorher zu prüfen. */
export function teilen(alt: Stand, id: string, istFake: boolean): Stand {
  if (alt.geteilt.some(g => g.id === id)) return alt;
  const s = kopie(alt);
  s.geteilt.push({ id, geprueft: !!s.checks[id], fake: istFake });
  spur(s, "klikk", "Klikk", `Nachricht geteilt${s.checks[id] ? " (nach Prüfung)" : " (ungeprüft)"}`);
  if (istFake) push(s, "klikk", "📤 Geteilt", "38 Leute haben deinen geteilten Beitrag weitergeschickt.");
  return s;
}

/** Ein Spielergebnis teilen — Klikk macht daraus einen Beitrag. */
export function spielTeilen(alt: Stand, spiel: string, punkte: number, tipp?: string, spruch?: string): Stand {
  const s = kopie(alt);
  eigenerPost(s, { art: "spiel", spiel, punkte, tipp, spruch }, false);
  s.flags.offeneLikes = Number(s.flags.offeneLikes ?? 0) + 5 + Math.round(Math.random() * 20);
  spur(s, "klikk", "Klikk", `Spielergebnis geteilt: ${spiel} (${punkte})`);
  handyTick(s, 1);
  return s;
}

/** Selbst einen gemeinen Kommentar unter den Beitrag einer Mitschülerin/eines Mitschülers gesetzt. */
export function klassenGemein(alt: Stand): Stand {
  return { ...alt, flags: { ...alt.flags, klasseGemein: Number(alt.flags.klasseGemein ?? 0) + 1 } };
}

/** Ein Beitrag aus der Klasse wurde angesehen. */
export function klassenGesehen(alt: Stand, id: number): Stand {
  if (alt.klasseGesehen.includes(id)) return alt;
  const s = kopie(alt);
  s.klasseGesehen.push(id);
  handyTick(s, 2);
  return s;
}

/** Likes und Kommentare aus der Klasse als Benachrichtigungen. */
export function klassenEcho(alt: Stand, texte: { titel: string; text: string }[]): Stand {
  if (!texte.length) return alt;
  const s = kopie(alt);
  for (const t of texte) push(s, "klikk", t.titel, t.text);
  return s;
}

/**
 * Mo sieht ein gefährliches Challenge-Video — von dir oder aus der Klasse —
 * und macht es nach. Ob das Video gefaked war, weiß er nicht.
 */
export function moNachmachen(alt: Stand, trendId: string, von: string, fake: boolean): Stand {
  const tr = trendNachId(trendId);
  if (!tr || tr.risiko !== "gefaehrlich" || alt.flags.moKopie || alt.tag >= LETZTER_TAG) return alt;
  const s = kopie(alt);
  s.flags.moKopie = true;
  s.moKopieTrend = trendId;
  s.flags.moKopieFake = fake;
  s.flags.moKopieUm = jetztAbs(s) + 120;
  s.moKopieName = von;
  const quelle = von === "dir" ? `dein ${tr.name}-video` : `das ${tr.name}-video von ${von}`;
  nachricht(s, "mo", "Mo", `hab ${quelle} gesehen 😎 mach ich heute auch, nur krasser`);
  return s;
}

function moKopieFaellig(s: Stand) {
  const um = Number(s.flags.moKopieUm ?? 0);
  if (!s.flags.moKopie || s.flags.moKopieFolge !== undefined || jetztAbs(s) < um) return;
  const tr = trendNachId(s.moKopieTrend ?? "");
  s.flags.moKopieFolge = s.tag;
  nachricht(s, "klasse", "Emma", `MO hat ${tr?.name} nachgemacht und ist abgestürzt 😳 krankenwagen war da`);
  nachricht(s, "klasse", "Finn", "das video von mo geht schon rum 💀");
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
  eigenerPost(s, { art: "foto", motiv }, false);
  handyTick(s, 5);
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
  stoere(s);
  if (s.rechte.standort && !s.flags[`ort${s.tag}`]) {
    s.flags[`ort${s.tag}`] = true;
    spur(s, app, app === "klikk" || app === "chats" ? "Klikk" : "AdKit", `Standort ${zeit(s.uhr)}: Zuhause (derselbe Ort wie jeden Abend)`);
  }
  nachtCheck(s, app);
  handyTick(s, 1);
  return s;
}

export function oeffneChat(alt: Stand, chat: ChatId): Stand {
  const s = kopie(alt);
  s.ungelesen[chat] = 0;
  for (const n of s.chats[chat]) if (!s.gelesen.includes(n.id)) s.gelesen.push(n.id);
  if (chat === "jonas") {
    for (const sig of SIGNALE) if (s.flags[sig.flag] && !s.bemerkt[sig.id]) s.bemerkt[sig.id] = { tag: s.tag, uhr: s.uhr };
  }
  handyTick(s, 1);
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
  stoere(s);
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
  // Bei einer Systemfrage (»Was jetzt?«) ist die Wahl ein Entschluss, keine Nachricht
  if (!n.system) nachricht(s, chat, "du", text);
  if (n.wahl.id === "kommentar" && option === "nett") spur(s, "klikk", "Klikk", "Kommentar unter Jonas' Video");
  if (n.wahl.id === "account" && option === "folgen") spur(s, "klikk", "Klikk", "Folgt @jonas_schnarcht");
  FOLGEN[n.wahl.id]?.(s, option);
  imChat(s, chat);
  handyTick(s, 1);
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
  handyTick(s, 4);
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
  handyTick(s, 1);
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
  handyTick(s, 2);
  return s;
}

/** Eine Runde in »Klikk Games« — kostet Zeit, und Klikk zählt mit. */
export function spielRunde(alt: Stand, spiel: string, punkte: number): Stand {
  const s = kopie(alt);
  s.spielRunden = [...(s.spielRunden ?? []), { spiel, punkte, tag: s.tag, uhr: s.uhr }];
  spur(s, "spiele", "Klikk", `Spiel »${spiel}«: ${punkte} Punkte um ${zeit(s.uhr)}`);
  handyTick(s, 6);
  return s;
}

/**
 * Eine Aktion in »Elemon«: Spielstand ändern, Spielzeit verbrauchen und —
 * wenn das SDK mitläuft — eine Spur an AdKit.
 */
export function elemonAktion(alt: Stand, f: (e: ElemonStand) => ElemonStand, minuten = 0, spurText?: string): Stand {
  const s = kopie(alt);
  const jetzt = s.tag * 1440 + s.uhr;
  s.elemon = energieAuffuellen(f(energieAuffuellen(s.elemon ?? { ...neuerElemonStand(), energieAb: jetzt }, jetzt)), jetzt);
  if (spurText && !s.trackingAus) spur(s, "elemon", "AdKit", spurText);
  if (minuten) handyTick(s, minuten);
  return s;
}

/** Merken, wo man eine Spiele-App verlassen hat — kostet keine Zeit */
export function merkeOrt<K extends keyof NonNullable<Stand["appOrt"]>>(alt: Stand, app: K, ort: NonNullable<Stand["appOrt"]>[K]): Stand {
  return { ...alt, appOrt: { ...alt.appOrt, [app]: ort } };
}

/**
 * Eltern um Extra-Zeit für Elemon bitten (einmal am Tag). Ob es klappt, hängt
 * am echten Leben im Spiel: Hausaufgaben, zugesagte und abgelehnte
 * Familienbitten, Handyzeit heute — und daran, wie die Eltern ticken.
 */
export function elternUmZeit(alt: Stand): Stand {
  const s = kopie(alt);
  const e = s.elemon;
  if (!e || e.elternAntwort?.tag === s.tag) return alt;
  const wer = s.eltern === "streng" ? "Papa" : "Mama";
  const hausaufgaben = s.hausaufgabenStand >= AUFGABEN;
  const minuten = s.handyMinuten[s.tag] ?? 0;
  const punkte = (hausaufgaben ? 2 : -1) + Math.min(2, s.famZusagen.length) - Math.min(2, s.famAbgelehnt)
    + (minuten > 120 ? -1 : 0) + ({ streng: -1, locker: 2, besorgt: 0, arbeit: 1 } as const)[s.eltern];
  const plus = punkte >= 3 ? 3 : punkte >= 1 ? 1 : 0;
  const grund = !hausaufgaben ? "Erst die Hausaufgaben." : s.famAbgelehnt > s.famZusagen.length ? "Wenn ich dich um Hilfe bitte, hast du auch nie Zeit." : minuten > 120 ? "Du warst heute schon ewig am Handy." : "";
  const text = plus >= 3 ? "Na gut – du hast heute echt was geschafft. Viel Spaß! 😊"
    : plus === 1 ? `Eine Runde noch, dann ist Schluss. ${grund}`.trim()
    : `Nein. ${grund || "Heute nicht."}`;
  nachricht(s, "mama", "du", "Darf ich noch ein bisschen Elemon spielen? 🥺");
  nachricht(s, "mama", wer, text);
  if (!plus) {
    nachricht(s, "klasse", "Finn", "Arena in 5 Min? Alle da? ⚔️");
    nachricht(s, "klasse", "Aylin", "Ohne dich wieder 🙄 Darfst wohl nicht wegen Mami 👶");
  }
  s.elemon = { ...e, energie: Math.min(ENERGIE_MAX, e.energie + plus), elternAntwort: { tag: s.tag, ja: plus > 0, plus, text } };
  tick(s, 2);
  return s;
}

export function candyRunde(alt: Stand, punkte: number): Stand {
  const s = kopie(alt);
  s.candyRunden++;
  spur(s, "candy", "AdKit", `Spielrunde: ${punkte} Punkte, Geräte-ID, Spielzeit ${zeit(s.uhr)}`);
  handyTick(s, 6);
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
  handyTick(s, 1);
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

// ───────── Freizeit: Lesen, Serie, Familie, Verein, Freunde ─────────

/** Handy während einer Aktivität: wird gezählt (einmal je Schritt). */
function stoere(s: Stand) {
  const a = s.aktivitaet;
  if (!a || a.gestoert) return;
  a.gestoert = true;
  a.unterbrochen++;
}

export function vereinWaehlen(alt: Stand, id: string): Stand {
  if (alt.verein || !VEREINE.some(v => v.id === id)) return alt;
  return { ...alt, verein: id };
}

export function starteAktivitaet(alt: Stand, art: AktArt, id: string): Stand {
  if (alt.aktivitaet) return alt;
  if (art === "freunde" && (alt.freundeTag === alt.tag || alt.uhr >= ABENDESSEN)) return alt;
  if (art === "verein" && (alt.verein !== id || !vereinHeute(alt)?.offen)) return alt;
  const s = kopie(alt);
  const schritt = art === "lesen" ? s.lesestand[id] ?? 0 : art === "serie" ? s.serienstand[id] ?? 0 : 0;
  s.aktivitaet = { art, id, schritt, unterbrochen: 0, start: s.uhr, gestoert: false };
  if (art === "freunde") s.freundeTag = s.tag;
  if (art === "familie") { s.flags[`fam_${id}_${s.tag}`] = true; s.flags[`fam_${id}`] = true; }
  if (art === "verein") { s.flags[`verein_${s.tag}`] = true; if (s.uhr < (VEREINE.find(v => v.id === id)?.um ?? s.uhr)) s.uhr = VEREINE.find(v => v.id === id)!.um; }
  return s;
}

/** Den aktuellen Schritt zu Ende bringen (Seite umblättern, Folge zu Ende, Szene weiter). */
export function weiterAktivitaet(alt: Stand): Stand {
  const a0 = alt.aktivitaet;
  if (!a0) return alt;
  const s = kopie(alt);
  const a = s.aktivitaet!;
  const schritte = schritteFuer(s, a.art, a.id);
  const schritt = schritte[a.schritt];
  // Klassenmodus: weiter erst, wenn die Uhr so weit ist
  if (s.flags.klassenuhr && s.uhr < (a.schrittStart ?? a.start) + (schritt?.minuten ?? 10)) return alt;
  // Nach dem Blick aufs Handy: Wo war ich? (Lesen und Serie kosten Wiedereinstieg)
  if (a.gestoert && (a.art === "lesen" || a.art === "serie")) tick(s, 3);
  a.gestoert = false;
  tick(s, schritt?.minuten ?? 10);
  if (s.uhr >= MITTERNACHT) return beendeAktivitaet(s);
  a.schritt++;
  a.schrittStart = s.uhr;
  if (a.art === "lesen") s.lesestand[a.id] = a.schritt;
  if (a.art === "serie") s.serienstand[a.id] = a.schritt;
  if (a.schritt >= schritte.length) return beendeAktivitaet(s);
  return s;
}

/** Aufhören — auch mitten im Buch oder nach einer Folge. */
export function beendeAktivitaet(alt: Stand): Stand {
  const a = alt.aktivitaet;
  if (!a) return alt;
  const s = kopie(alt);
  s.freizeit.push({ art: a.art, id: a.id, tag: s.tag, minuten: s.uhr - a.start, unterbrochen: a.unterbrochen });
  if (a.art === "freunde" || a.art === "verein") s.freunde++;
  if (a.art === "verein") s.flags[`vereinMal_${a.id}`] = Number(s.flags[`vereinMal_${a.id}`] ?? 0) + 1;
  if (a.art === "lesen" && (s.lesestand[a.id] ?? 0) >= schritteFuer(s, "lesen", a.id).length) s.flags[`gelesen_${a.id}`] = true;
  s.aktivitaet = null;
  return s;
}

// ───────── Morgen: Wecker, Bad, Frühstück, Bus ─────────

export const MORGEN_SACHEN: { id: string; name: string; emoji: string; minuten: number; hygiene: number }[] = [
  { id: "duschen", name: "Duschen", emoji: "🚿", minuten: 15, hygiene: 45 },
  { id: "zaehne", name: "Zähne putzen", emoji: "🪥", minuten: 5, hygiene: 15 },
  { id: "deo", name: "Deo und Haare", emoji: "🧴", minuten: 5, hygiene: 10 },
  { id: "anziehen", name: "Frische Sachen anziehen", emoji: "👕", minuten: 5, hygiene: 10 },
  { id: "fruehstueck", name: "Frühstücken", emoji: "🥣", minuten: 15, hygiene: 0 },
];
export const BUS = 7 * 60 + 35;

export function morgenSache(alt: Stand, id: string): Stand {
  const m = MORGEN_SACHEN.find(x => x.id === id);
  if (!m || alt.phase !== "morgen" || alt.morgenErledigt.includes(id)) return alt;
  const s = kopie(alt);
  s.morgenErledigt.push(id);
  s.hygiene = Math.min(100, s.hygiene + m.hygiene);
  tick(s, m.minuten);
  return s;
}

/** Aus dem Haus: Schule (8–14 Uhr) läuft ab, der Nachmittag beginnt. */
export function losgehen(alt: Stand): Stand {
  if (alt.phase !== "morgen") return alt;
  const s = kopie(alt);
  if (s.uhr > BUS) s.zuSpaet.push(s.tag);
  if (!s.morgenErledigt.includes("fruehstueck")) s.flags[`ohneFruehstueck_${s.tag}`] = true;
  s.phase = "woche";
  if (!s.flags.klassenuhr) s.uhr = START_UHR;
  s.morgen = morgenMeldung(s);
  feuere(s);
  return s;
}

/** Ins Bett. Danach kommt (fast) immer noch eine Benachrichtigung um 23:40. */
export function schlafen(alt: Stand): Stand {
  const s = kopie(alt.aktivitaet ? beendeAktivitaet(alt) : alt);
  if (s.flags.klassenuhr) {
    // Klassenmodus: schlafen und auf den Morgen warten – der kommt für alle gleichzeitig
    if (s.hausaufgaben[s.tag] === undefined) s.hausaufgaben[s.tag] = false;
    s.schlaeft = true;
    s.flags.bettZeit = s.uhr;
    s.phase = "schlaf";
    return s;
  }
  if (s.hausaufgaben[s.tag] === undefined) s.hausaufgaben[s.tag] = false;
  s.flags.bettZeit = s.uhr;
  feuere(s, MITTERNACHT);
  // Kein Handy (bei der Polizei): nichts leuchtet um 23:40
  // Kein Handy (bei der Polizei, eingesammelt oder gesperrt): nichts leuchtet um 23:40
  const nachtGesperrt = s.limit.sperreAb !== null && s.limit.sperreAb <= 23 * 60 + 40 && !s.flags[`sperreWeg_${s.tag}`];
  s.phase = s.uhr < MITTERNACHT && !(s.flags.handyWeg && s.tag === 4) && !nachtGesperrt ? "nacht" : s.phase;
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
  if (s.flags.klassenuhr) {
    if (nachsehen) {
      s.nachtOeffnungen.push({ tag: s.tag, uhr: s.uhr });
      abzeichen(s, "nachteule");
      if (s.snapTag !== s.tag && s.streak > 0) { s.snapTag = s.tag; s.streak++; }
      s.flags.bettZeit = Math.max(Number(s.flags.bettZeit ?? s.uhr), 23 * 60 + 40) + 45;
    }
    s.phase = "schlaf";
    return s;
  }
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
  s.schlaf[s.tag] = Math.round(((MITTERNACHT - Math.max(bett, FRUEHESTES_BETT)) + (s.weckzeit ?? AUFSTEHEN)) / 6) / 10;
  if (s.flags.nosleep === s.tag) s.schlaf[s.tag] = 0; // #NoSleep48: die Nacht durch gestreamt
  if (s.snapTag !== s.tag && s.streak > 0) {
    s.flags.streakVerloren = s.streak;
    s.flags.streakWeg = Number(s.flags.streakWeg ?? 0) + 1;
    s.streak = 0;
  }
  // Was nicht beantwortet wurde, ist jetzt Schweigen
  for (const c of Object.values(s.chats)) for (const n of c) if (n.wahl && !n.wahl.gewaehlt) n.wahl.gewaehlt = "still";
  if (s.tag >= LETZTER_TAG && !(s.samstag && s.tag === LETZTER_TAG)) {
    s.phase = "jonas";
    return s;
  }
  s.tag++;
  s.hausaufgabenStand = 0;
  s.flags.haPause = false;
  // Über Nacht und den Tag riecht man nicht frischer
  s.hygiene = Math.max(0, s.hygiene - 25);
  s.morgenErledigt = [];
  const schultag = s.tag <= LETZTER_TAG;
  // Schultage beginnen mit dem Wecker; der Samstag erst um 10
  s.uhr = schultag ? s.weckzeit ?? AUFSTEHEN : 10 * 60;
  s.phase = schultag ? "morgen" : "woche";
  if (s.tag === LETZTER_TAG) wocheAuswerten(s);
  if (s.flags.streakVerloren) {
    nachricht(s, "lea", "Lea", `unsere streak ist weg 😭😭 ${s.flags.streakVerloren} tage!! warum hast du nicht geantwortet`, {}, Math.min(s.uhr, 7 * 60));
    s.flags.streakVerloren = 0;
  }
  // Die Schulmeldung kommt beim Losgehen (dann sind Bad, Frühstück und Bus bekannt)
  s.morgen = schultag ? [] : morgenMeldung(s);
  feuere(s);
  return s;
}

// ───────── Klassenmodus: eine Uhr für alle ─────────

export const KLASSEN_TAG_START = 6 * 60;

/** Spielzeit aus der Klassen-Uhr: ein Tag (6–24 Uhr) dauert `minutenProTag` echte Minuten. */
export function klassenZiel(vergangenMs: number, minutenProTag: number) {
  const tage = vergangenMs / (minutenProTag * 60000);
  const tag = Math.floor(tage);
  return { tag, uhr: Math.min(MITTERNACHT - 1, KLASSEN_TAG_START + Math.floor((tage - tag) * (MITTERNACHT - KLASSEN_TAG_START))) };
}

/**
 * Die Klassen-Uhr zieht den Stand nach: Tage enden um Mitternacht für alle,
 * morgens fährt der Bus, von 8 bis 14 Uhr ist Schule, um 23:40 leuchtet das Handy.
 */
export function klassenZeit(alt: Stand, tagZiel: number, uhrZiel: number): Stand {
  if (!["morgen", "woche", "nacht", "schlaf"].includes(alt.phase)) return alt;
  if (alt.tag === tagZiel && alt.uhr >= uhrZiel && alt.flags.klassenuhr) return alt;
  const s = kopie(alt);
  s.flags.klassenuhr = true;

  // Ganze Tage abschließen
  while (s.tag < tagZiel && s.phase !== "jonas") {
    if (s.aktivitaet) Object.assign(s, beendeAktivitaet(s));
    feuere(s, MITTERNACHT);
    if (s.hausaufgaben[s.tag] === undefined) s.hausaufgaben[s.tag] = false;
    const bett = s.schlaeft ? Number(s.flags.bettZeit ?? MITTERNACHT) : MITTERNACHT;
    s.schlaeft = false;
    naechsterTag(s, bett);
    // naechsterTag kann die Woche beenden (TypeScript weiß das nicht)
    if ((s.phase as Stand["phase"]) === "jonas") return s;
    if (s.tag > LETZTER_TAG) { s.phase = "jonas"; return s; }
    s.uhr = KLASSEN_TAG_START;
  }
  if (s.tag > tagZiel) return s;

  // Innerhalb des Tages vorrücken
  const ziel = Math.max(s.uhr, uhrZiel);
  if (s.phase === "morgen" && ziel >= BUS + 5) {
    tick(s, BUS + 5 - s.uhr, true);
    Object.assign(s, losgehen(s));
  }
  tick(s, ziel - s.uhr, true);
  // 23:40: das Handy auf dem Nachttisch
  if (s.phase === "schlaf" && s.uhr >= 23 * 60 + 40 && !s.flags[`nachtFrage_${s.tag}`]) {
    s.flags[`nachtFrage_${s.tag}`] = true;
    const gesperrtNachts = s.limit.sperreAb !== null && s.limit.sperreAb <= 23 * 60 + 40 && !s.flags[`sperreWeg_${s.tag}`];
    if (!gesperrtNachts && !(s.flags.handyWeg && s.tag === LETZTER_TAG)) s.phase = "nacht";
  }
  return s;
}

export const zumSpiegel = (alt: Stand): Stand => ({ ...alt, phase: "spiegel" });

export const zeit = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export { ABZEICHEN };
