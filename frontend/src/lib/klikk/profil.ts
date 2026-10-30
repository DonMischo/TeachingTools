/**
 * Der Datenspiegel: was Klikk und AdKit aus einer Woche geschlossen haben.
 * Jede Erkenntnis nennt ihre Belege — nichts davon ist geraten, alles kam aus
 * dem, was im Spiel wirklich passiert ist.
 */
import { interesse } from "./feed";
import { ABZEICHEN, SIGNALE, TAGE, istGewaehlt, jonasGeschrieben, taeterPunkte } from "./geschichte";
import { POSTS, THEMA_NAME, WERBUNG } from "./posts";
import { RISIKO_NAME, trendNachId } from "./trends";
import { PRODUKTE, QUIZ, zeit } from "./motor";
import type { AppId, Stand, Thema } from "./typen";

export interface Erkenntnis {
  titel: string;
  wert: string;
  belege: string[];
  /** heikel = so etwas dürfte niemand über ein Kind verkaufen */
  heikel?: boolean;
}

const wann = (tag: number, uhr: number) => `${TAGE[tag]?.slice(0, 2) ?? "?"} ${zeit(uhr)}`;
const sek = (ms: number) => `${Math.round(ms / 1000)} s`;

export function erkenntnisse(s: Stand): Erkenntnis[] {
  const r: Erkenntnis[] = [];
  const w = interesse(s);
  const themen = (Object.keys(w) as Thema[]).filter(t => t !== "trend").sort((a, b) => w[b] - w[a]);
  const gesamtVerweil = Object.values(s.verweil).reduce((a, b) => a + (b ?? 0), 0);

  if (gesamtVerweil > 0) {
    r.push({
      titel: "Interessen",
      wert: themen.slice(0, 3).map(t => THEMA_NAME[t]).join(", "),
      belege: themen.slice(0, 3).map(t => `${THEMA_NAME[t]}: ${sek(s.verweil[t] ?? 0)} angesehen${s.gelikt[t] ? `, ${s.gelikt[t]}× gelikt` : ""}`),
    });
  }

  const koerper = (s.verweil.fitness ?? 0) + (s.verweil.beauty ?? 0);
  if ((koerper > 15000 && koerper / gesamtVerweil > 0.25) || s.quiz.aendern === "koerper") {
    r.push({
      titel: "Körperbild",
      wert: "vermutlich unzufrieden mit dem eigenen Aussehen",
      belege: [
        ...(koerper ? [`${Math.round((koerper / Math.max(1, gesamtVerweil)) * 100)} % deiner Zeit im Feed: Körper- und Beauty-Beiträge`] : []),
        ...(s.quiz.aendern === "koerper" ? ["Quiz-App: »Was würdest du ändern?« → »Meinen Körper« (über AdKit)"] : []),
      ],
      heikel: true,
    });
  }

  const quizLaune = s.quiz.laune;
  if (quizLaune && quizLaune !== "gut") {
    r.push({
      titel: "Stimmung",
      wert: quizLaune === "allein" ? "fühlt sich oft allein" : quizLaune === "gestresst" ? "gestresst" : "abends erschöpft",
      belege: [`Quiz-App: »${QUIZ[0].frage}« (über AdKit)`],
      heikel: true,
    });
  }

  const spaet = [...s.nachtOeffnungen].sort((a, b) => b.uhr - a.uhr)[0];
  const minSchlaf = s.schlaf.length ? Math.min(...s.schlaf) : undefined;
  if (spaet || (minSchlaf !== undefined && minSchlaf < 7) || s.quiz.schlaf === "spaet" || s.quiz.schlaf === "sehrspaet") {
    r.push({
      titel: "Schlafrhythmus",
      wert: spaet ? `wach bis mindestens ${zeit(spaet.uhr)}` : "geht spät ins Bett",
      belege: [
        ...s.nachtOeffnungen.map(n => `App nachts geöffnet: ${wann(n.tag, n.uhr)}`),
        ...(s.quiz.schlaf ? [`Quiz-App: Einschlafzeit (über AdKit)`] : []),
      ],
    });
  }

  if (s.rechte.standort) {
    r.push({
      titel: "Orte",
      wert: "Schule (Mo–Fr 8–14 Uhr) und Zuhause (jeden Abend)",
      belege: s.spur.filter(x => x.text.startsWith("Standort")).map(x => `${wann(x.tag, x.uhr)} · ${x.app}: ${x.text}`),
      heikel: true,
    });
  }

  if (s.alterAngabe && s.alterEcht && s.alterAngabe !== s.alterEcht) {
    r.push({
      titel: "Alter",
      wert: `Profil sagt ${s.alterAngabe}, Verhalten sagt ${s.alterEcht - 1}–${s.alterEcht}`,
      belege: ["Nutzung erst ab 14 Uhr an Schultagen, Hausaufgaben-Pausen", "Klassenchat »8b«", "Freunde im selben Alter"],
    });
  }

  if (s.rechte.kontakte) {
    r.push({ titel: "Soziales Netz", wert: "47 Kontakte, Klasse 8b, enge Freundin: Lea", belege: ["Adressbuch beim Start hochgeladen", `Streak mit Lea: ${s.streak} Tage`] });
  }

  if (s.shopAngesehen.length) {
    const preise = PRODUKTE.filter(p => s.shopAngesehen.includes(p.name)).map(p => p.preis);
    r.push({
      titel: "Kaufinteresse",
      wert: `Sneaker um ${Math.round(preise.reduce((a, b) => a + b, 0) / preise.length)} €`,
      belege: s.shopAngesehen.map(n => `Sneakr-App: ${n} angesehen (über AdKit)`),
    });
  }

  const challenges = ["spiegel", "eis", "gleis"].filter(id => { const g = istGewaehlt(s, id); return g === "ja" || g === "dabei"; });
  r.push({
    titel: "Gruppendruck",
    wert: challenges.length >= 2 ? "macht bei Trends mit — gut erreichbar für virale Kampagnen" : challenges.length ? "macht manchmal mit" : "lässt sich schwer mitreißen",
    belege: challenges.length ? challenges.map(c => `Challenge mitgemacht: ${c === "spiegel" ? "#SpiegelTanz" : c === "eis" ? "#EiswasserChallenge" : "#GleisSelfie"}`) : ["Keine Challenge mitgemacht"],
  });

  if (s.pushGesamt) {
    const q = Math.round((s.pushGeoeffnet / s.pushGesamt) * 100);
    r.push({
      titel: "Erreichbarkeit",
      wert: q > 40 ? "reagiert schnell auf Benachrichtigungen" : "lässt Benachrichtigungen oft liegen",
      belege: [`${s.pushGeoeffnet} von ${s.pushGesamt} Benachrichtigungen geöffnet`, ...(s.unterbrechungen ? [`${s.unterbrechungen}× Hausaufgaben fürs Handy unterbrochen`] : [])],
    });
  }

  const aussehen = s.umfragen.um2;
  if (aussehen && !aussehen.startsWith("Sehr")) {
    r.push({ titel: "Selbstbild", wert: "unzufrieden mit dem Aussehen (selbst gesagt)", belege: [`»Anonyme« Umfrage: »Wie zufrieden bist du mit deinem Aussehen?« → ${aussehen}`], heikel: true });
  }
  const meinungen = Object.entries(s.umfragen).filter(([id]) => id !== "um2");
  if (meinungen.length) {
    r.push({
      titel: "Meinungen", wert: `${meinungen.length} Antwort(en) aus Umfragen`,
      belege: meinungen.map(([id, o]) => { const p = POSTS.find(x => x.id === id); return `${p?.medien?.art === "umfrage" ? p.medien.frage : id} → ${o}`; }),
    });
  }

  const echt = s.videos.filter(v => !v.fake && trendNachId(v.trend)?.risiko !== "harmlos");
  if (s.videos.length) {
    r.push({
      titel: "Risikobereitschaft",
      wert: echt.some(v => trendNachId(v.trend)?.risiko === "gefaehrlich") ? "macht für Reichweite auch Lebensgefährliches" : echt.length ? "geht Risiken für Likes ein" : "postet, bleibt aber vorsichtig",
      belege: s.videos.map(v => `${trendNachId(v.trend)?.name} (${RISIKO_NAME[trendNachId(v.trend)?.risiko ?? "harmlos"]}${v.fake ? ", gefaked" : ""}): ${v.aufrufe.toLocaleString("de-DE")} Aufrufe`),
      heikel: echt.length > 0,
    });
  }

  if (istGewaehlt(s, "gewinn") === "nummer" || s.werbungKlicks.some(k => k.stufe === "bestellt")) {
    r.push({
      titel: "Leichtgläubigkeit", wert: "reagiert auf Gewinnspiele und Kauf-Druck — gut für Abo-Fallen",
      belege: [
        ...(istGewaehlt(s, "gewinn") === "nummer" ? ["Handynummer an ein »Gewinnspiel« geschickt"] : []),
        ...s.werbungKlicks.filter(k => k.stufe === "bestellt").map(k => `»Bestellen« gedrückt: ${WERBUNG.find(w => w.id === k.id)?.firma}`),
      ],
      heikel: true,
    });
  }

  if (istGewaehlt(s, "leon1") === "antworten") {
    r.push({
      titel: "Kontakt mit Fremden", wert: "antwortet Unbekannten und verrät das Alter",
      belege: ["Chat mit »leon.16«: Alter genannt", ...(istGewaehlt(s, "leon2") === "foto" ? ["Foto an eine unbekannte Person geschickt"] : [])],
      heikel: true,
    });
  }

  r.push({
    titel: "Nutzungsbedingungen",
    wert: s.agbSekunden < 30 ? "stimmt allem zu" : "liest manchmal nach",
    belege: [`Bedingungen (ca. 20 Min. Lesezeit) nach ${s.agbSekunden} Sekunden akzeptiert`],
  });

  return r;
}

/** Wie viel ein solches Profil auf dem Werbemarkt ungefähr bringt (grobe Spielrechnung). */
export function profilWert(s: Stand): number {
  const e = erkenntnisse(s);
  return Math.round((0.4 + e.length * 0.35 + e.filter(x => x.heikel).length * 0.9 + s.gesehen.length * 0.02) * 100) / 100;
}

export const APP_NAME: Record<AppId, string> = {
  klikk: "Klikk", chats: "Klikk Chats", spiele: "Klikk Games", einstellungen: "Einstellungen", wetter: "Wolke (Wetter)", candy: "Candy Blast", sneakr: "Sneakr", quiz: "Welcher Typ bist du?",
};

/** Was jede App an wen geschickt hat — für das Bild »Wer liest mit?«. */
export function datenfluesse(s: Stand) {
  const apps = Object.keys(APP_NAME) as AppId[];
  return apps
    .map(app => ({ app, an: s.spur.find(x => x.app === app)?.an ?? (app === "klikk" || app === "chats" ? "Klikk" : "AdKit"), zeilen: s.spur.filter(x => x.app === app) }))
    .filter(x => x.zeilen.length > 0);
}

export function punktestaende(s: Stand) {
  const tage = s.schlaf.length;
  return {
    app: [
      ["Follower", String(s.follower)],
      ["Likes", String(s.likes)],
      ["Streak mit Lea", `${s.streak} Tage`],
      ["Abzeichen", String(s.abzeichen.length)],
      ["Beiträge angesehen", String(s.gesehen.length)],
    ] as [string, string][],
    leben: [
      ["Schlaf im Schnitt", tage ? `${(s.schlaf.reduce((a, b) => a + b, 0) / tage).toFixed(1).replace(".", ",")} Std. (empfohlen: 9)` : "–"],
      ["Hausaufgaben gemacht", `${s.hausaufgaben.filter(Boolean).length} von ${tage}`],
      ["Freunde getroffen", `${s.freunde}×`],
      ["Handyzeit (geschätzt)", `${Math.round((s.gesehen.length * 2 + Object.values(s.appsGeoeffnet).reduce((a, b) => a + (b ?? 0), 0) * 4) / 60 * 10) / 10} Std.`.replace(".", ",")],
      ["Für Jonas da gewesen", jonasGeschrieben(s).length ? `${jonasGeschrieben(s).length} Nachricht(en)` : "nein"],
      ["Offline-Freizeit", `${(s.freizeit.reduce((a, f) => a + f.minuten, 0) / 60).toFixed(1).replace(".", ",")} Std. (${s.freizeit.length} Aktivitäten)`],
      ["Dabei aufs Handy geschaut", `${s.freizeit.reduce((a, f) => a + f.unterbrochen, 0)}×`],
      ["Gelesen / geschaut", `${Object.values(s.lesestand).reduce((a, b) => a + b, 0)} Buchseiten · ${Object.values(s.serienstand).reduce((a, b) => a + b, 0)} Folgen`],
    ] as [string, string][],
  };
}

export function abzeichenWahrheit(s: Stand) {
  return s.abzeichen.map(id => ABZEICHEN[id as keyof typeof ABZEICHEN]).filter(Boolean);
}

export function warnsignale(s: Stand) {
  return SIGNALE.map(sig => ({ ...sig, sichtbar: !!s.flags[sig.flag], bemerkt: s.bemerkt[sig.id] }));
}

/** Ein Krisenfall der Woche: was passiert ist, was man getan hat, was hilft. */
export interface Fall {
  emoji: string;
  titel: string;
  passiert: string;
  deinWeg: string;
  ausgang: string;
  /** gut (geholfen), mittel, schlecht (mitgemacht/weggeschaut) */
  bilanz: "gut" | "mittel" | "schlecht";
  recht?: string;
}

/** Was in so einem Fall hilft — von leicht nach schwer. */
export const HILFE_LEITER = [
  { stufe: "1 · Freund·innen", text: "Mit jemandem reden, dem du vertraust. Nicht allein bleiben, nicht mitlachen." },
  { stufe: "2 · Erwachsene", text: "Eltern, Vertrauenslehrkraft, Schulsozialarbeit. Screenshots zeigen (ohne heikle Fotos zu speichern)." },
  { stufe: "3 · Schule", text: "Klassenleitung und Schulleitung können Gespräche, Klassenkonferenzen und Ordnungsmaßnahmen veranlassen." },
  { stufe: "4 · Polizei", text: "Bei Straftaten: heimliche oder intime Fotos, Drohungen, Erpressung, Fake-Profile mit Beleidigungen. Anzeige geht auch über die Onlinewache." },
];

export function faelle(s: Stand): Fall[] {
  const w = (id: string) => istGewaehlt(s, id);
  const r: Fall[] = [];

  // Jonas
  const taeter = taeterPunkte(s);
  const geholfen = jonasGeschrieben(s).length > 0 || w("umfrage") === "screenshot" || w("account") === "melden" || w("bus") === "stopp";
  r.push({
    emoji: "🎸", titel: "Cybermobbing gegen Jonas",
    passiert: "Ein heimliches Foto, ein Sticker, ein Fake-Account, Spott unter seinem Gitarrenvideo, eine »Loser«-Umfrage. Jonas zog sich zurück, war nachts wach, verließ die Gruppe.",
    deinWeg: [
      taeter ? `Du hast mitgemacht (${taeter} Mal: ${[w("bus") === "lachen" && "gelacht", w("bus") === "weiter" && "Foto in deine Story gestellt", w("account") === "folgen" && "dem Fake-Account gefolgt", w("kommentar") === "liken" && "Spott gelikt", w("kommentar") === "mitlaestern" && "selbst gelästert", w("umfrage") === "jonas" && "für Jonas abgestimmt"].filter(Boolean).join(", ")}).` : "",
      geholfen ? "Du hast etwas dagegen getan." : "",
      !taeter && !geholfen ? "Du hast zugeschaut. Das ist bequem – aber für Jonas sieht Schweigen aus wie Zustimmung." : "",
    ].filter(Boolean).join(" "),
    ausgang: s.flags.polizeiTaeter ? "Jonas' Eltern haben Anzeige erstattet; die Polizei will mit dir reden."
      : w("gespraech") === "ehrlich" ? "Du hast es zugegeben und dich bei Jonas entschuldigt. Das ist der schwerste und beste Weg."
      : w("gespraech") ? "Klassenkonferenz nächste Woche, Eltern eingeladen, möglicher Verweis."
      : s.flags.jonasAusgang === 2 ? "Die Schule hat eingegriffen. Jonas sitzt wieder bei euch." : s.flags.jonasAusgang === 1 ? "Jonas ist da, aber still." : "Jonas ist nicht mehr in die Schule gekommen.",
    bilanz: taeter >= 2 && w("gespraech") !== "ehrlich" ? "schlecht" : geholfen ? "gut" : "mittel",
    recht: "Beleidigung (§ 185 StGB), Fotos ohne Einwilligung verbreiten (§ 33 KUG), Fake-Profile mit Spott können strafbar sein. Ab 14 Jahren ist man strafmündig (§ 19 StGB).",
  });

  // Emma
  const f = w("emmaFoto");
  if (f) r.push({
    emoji: "📷", titel: "Das heimliche Foto von Emma",
    passiert: "Ben stellte ein heimlich in der Umkleide aufgenommenes Foto von Emma in den Klassenchat. Andere forderten: weiterschicken.",
    deinWeg: f === "weiter" ? "Du hast es an vier Leute weitergeleitet." : f === "lachen" ? "Du hast gelacht." : f === "emma" ? "Du hast Emma Bescheid gesagt und Hilfe angeboten." : f === "melden" ? "Du hast Ben widersprochen und Frau Yilmaz informiert." : "Du hast nichts gesagt.",
    ausgang: f === "weiter" ? "Polizei in der Schule, dein Handy wurde eingezogen, deine Eltern angerufen." : s.flags.emmaHilfe ? "Das Foto wurde gelöscht, gegen Ben wird ermittelt, Emma hat Unterstützung." : "Das Foto ging durch die halbe Schule. Emma blieb zu Hause.",
    bilanz: f === "weiter" || f === "lachen" ? "schlecht" : s.flags.emmaHilfe ? "gut" : "mittel",
    recht: "Heimliche Aufnahmen aus Umkleiden, Toiletten oder Schlafzimmern – und ihr Weiterleiten – sind strafbar (§ 201a StGB). Bei Nacktbildern von Minderjährigen ist schon das Speichern eine schwere Straftat. Nicht weiterleiten, nicht als »Beweis« speichern, sofort einem Erwachsenen sagen.",
  });

  // Lea
  if (s.flags.leaStreit) {
    const l = w("leaStreit");
    r.push({
      emoji: "🌸", titel: "Freundschaft mit Lea",
      passiert: "Lea hatte genug: zu viel Handy, zu wenig da. Sie hat dich blockiert.",
      deinWeg: l === "reden" ? "Du hast sie persönlich angesprochen." : l === "mo" ? "Du hast Mo um Vermittlung gebeten." : l === "text" ? "Du hast geschrieben – blockiert." : "Du hast abgewartet.",
      ausgang: s.flags.leaVersoehnt ? "Ihr habt geredet. Die Freundschaft hält." : "Lea sitzt jetzt woanders.",
      bilanz: l === "reden" ? "gut" : l === "mo" ? "mittel" : "schlecht",
    });
  }

  // Challenges
  const eigene = s.videos.filter(v => !v.fake && trendNachId(v.trend)?.risiko !== "harmlos");
  r.push({
    emoji: "🛤️", titel: "Gefährliche Challenges",
    passiert: "Je riskanter die Challenge, desto mehr Reichweite. Mo war am Bahndamm (außer jemand hat ihn rechtzeitig umgestimmt).",
    deinWeg: [
      w("gleis") === "stopp" ? "Du hast Mo widersprochen." : w("gleis") === "dabei" ? "Du warst mit am Bahndamm." : "Du hast Mo gehen lassen.",
      eigene.length ? `Eigene riskante Videos: ${eigene.map(v => trendNachId(v.trend)?.name).join(", ")}.` : "",
      w("moVideo") === "reden" ? "Du hast Mo gefragt, wie es ihm wirklich geht." : w("moVideo") === "lassen" ? "Du hast Mo geraten, das Video online zu lassen." : w("moVideo") === "loeschen" ? "Du hast Mo geraten, das Video zu löschen." : "",
    ].filter(Boolean).join(" "),
    ausgang: s.flags.moUmgestimmt ? "Mo ist unverletzt." : w("moVideo") === "lassen" ? "Mos Video wurde nachgemacht – zwei Jugendliche schwer verletzt." : "Mo hat einen gebrochenen Arm und eine Anzeige.",
    bilanz: w("gleis") === "stopp" || w("moVideo") === "reden" ? "gut" : w("gleis") === "dabei" || eigene.length ? "schlecht" : "mittel",
    recht: "Gleisanlagen betreten ist eine Ordnungswidrigkeit oder Straftat; die Bundespolizei schreibt Anzeigen. Wichtiger: Strom an Oberleitungen springt schon aus 1,5 m über.",
  });

  // leon.16
  const l1 = w("leon1");
  if (l1) r.push({
    emoji: "😎", titel: "Ein Fremder schreibt (»leon.16«)",
    passiert: "Komplimente, »erzähl's nicht deinen Eltern«, Wechsel auf eine andere App, Bitte um ein Foto – dann eine Drohung.",
    deinWeg: l1 === "block" ? "Du hast ihn sofort blockiert." : w("leon2") === "foto" ? (w("leon3") === "mama" ? "Du hast ein Foto geschickt – und es dann Mama gezeigt." : "Du hast ein Foto geschickt und geschwiegen.") : w("leon2") ? "Du hast ihn blockiert oder Mama gezeigt." : "Du hast geantwortet.",
    ausgang: s.flags.leonGemeldet ? "Polizei eingeschaltet; »leon.16« war ein erwachsener Mann. Du hast nichts falsch gemacht." : l1 === "block" || w("leon2") === "block" ? "Kontakt beendet." : "Er schreibt weiter.",
    bilanz: s.flags.leonGemeldet || l1 === "block" || w("leon2") === "block" ? "gut" : "schlecht",
    recht: "Kinder online sexuell anzusprechen (Cybergrooming) und mit Fotos zu erpressen ist strafbar. Die Schuld liegt immer beim Täter.",
  });
  return r;
}

/**
 * Die anonyme Wochen-Zusammenfassung für die Klassenübersicht der Lehrkraft:
 * nur Zahlen und Entscheidungen, keine Namen, keine Inhalte.
 */
export function wocheWerte(s: Stand): Record<string, boolean | number | string> {
  const w = (id: string) => istGewaehlt(s, id) ?? "still";
  const schlaf = s.schlaf.length ? s.schlaf.reduce((a, b) => a + b, 0) / s.schlaf.length : 0;
  return {
    agb_sekunden: s.agbSekunden,
    rechte_erlaubt: Object.values(s.rechte).filter(Boolean).length,
    mobbing_mitgemacht: taeterPunkte(s),
    jonas_geschrieben: jonasGeschrieben(s).length > 0,
    bus: w("bus"),
    umfrage: w("umfrage"),
    signale_bemerkt: Object.keys(s.bemerkt).length,
    emma_foto: w("emmaFoto"),
    gleis: w("gleis"),
    videos_riskant_echt: s.videos.filter(v => !v.fake && trendNachId(v.trend)?.risiko !== "harmlos").length,
    videos_gefaked: s.videos.filter(v => v.fake).length,
    leon: w("leon2") !== "still" ? w("leon2") : w("leon1"),
    gewinnspiel_nummer: w("gewinn") === "nummer",
    werbung_geklickt: s.werbungKlicks.length,
    werbung_bestellt: s.werbungKlicks.filter(k => k.stufe === "bestellt").length,
    fakes_erkannt: Object.values(s.checks).filter(c => c.richtig).length,
    ungeprueft_geteilt: s.geteilt.filter(g => !g.geprueft).length,
    schlaf_schnitt: Math.round(schlaf * 10) / 10,
    nachts_am_handy: s.nachtOeffnungen.length,
    hausaufgaben: s.hausaufgaben.filter(Boolean).length,
    beitraege_gesehen: s.gesehen.length,
    offline_minuten: s.freizeit.reduce((a, f) => a + f.minuten, 0),
    handy_waehrend_freizeit: s.freizeit.reduce((a, f) => a + f.unterbrochen, 0),
    gemeine_kommentare_gemeldet: Number(s.flags.hass_melden ?? 0),
  };
}
