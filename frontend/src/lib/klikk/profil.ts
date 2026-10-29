/**
 * Der Datenspiegel: was Klikk und AdKit aus einer Woche geschlossen haben.
 * Jede Erkenntnis nennt ihre Belege — nichts davon ist geraten, alles kam aus
 * dem, was im Spiel wirklich passiert ist.
 */
import { interesse } from "./feed";
import { ABZEICHEN, SIGNALE, TAGE, istGewaehlt, jonasGeschrieben } from "./geschichte";
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
  klikk: "Klikk", chats: "Klikk Chats", wetter: "Wolke (Wetter)", candy: "Candy Blast", sneakr: "Sneakr", quiz: "Welcher Typ bist du?",
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
    ] as [string, string][],
  };
}

export function abzeichenWahrheit(s: Stand) {
  return s.abzeichen.map(id => ABZEICHEN[id as keyof typeof ABZEICHEN]).filter(Boolean);
}

export function warnsignale(s: Stand) {
  return SIGNALE.map(sig => ({ ...sig, sichtbar: !!s.flags[sig.flag], bemerkt: s.bemerkt[sig.id] }));
}
