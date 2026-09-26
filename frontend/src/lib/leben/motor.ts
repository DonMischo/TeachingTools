/**
 * Der Spielablauf: Zeit vergeht in Stunden, Bedürfnisse sinken, am Tages-
 * wechsel wird gegessen, verbraucht, bezahlt und gewürfelt, am Monatsende
 * kommt Lohn und die Monatsbilanz.
 *
 * Jede öffentliche Aktion bekommt einen Spielstand und gibt einen **neuen**
 * zurück (intern: Kopie, dann verändern) — React kann ihn direkt setzen.
 */
import { BERUF, helferBrutto, verguetung, type Beruf } from "./berufe";
import { essen, verbrauchen, verderben, type Mahlzeit } from "./ernaehrung";
import { alter, begrenzen, brief, buchen, effekt, klon, log, r2, uid, zufall, zwischen, de } from "./kern";
import { abrechnung, type Abrechnung } from "./lohn";
import type { Beduerfnisse, JobStand, Monatsbilanz, Spielstand, Vertrag, Wohnung } from "./typen";
import { SPIELSTAND_VERSION } from "./typen";
import { ANGEBOT, preisImMonat, stromAbschlag, stromVerbrauchJahr } from "./vertraege";
import { werte } from "./werte";
import {
  datum, ENDE_TAG, istArbeitstag, istMonatsletzter, jahrVon, kurzDatum, monatsIndex, monatsLetzter, monatText, monatVon,
  tagImMonat, tagVon, wochentag,
} from "./zeit";
import { ELTERN_ORTE, warmmiete } from "./wohnungen";
import { taeglicheEreignisse } from "./ereignisse";
import { amtTag } from "./amt";
import { nebenbei } from "./aktionen";
import { MOEBEL_DEF } from "./kern";

// ───────────────────────────────────────────────────────────── Start

export type StartOptionen = {
  name: string;
  geburtstag: string;
  avatar: string;
  farbe: string;
  kirche: boolean;
  zeugnis: Spielstand["zeugnis"];
  herkunft: Spielstand["herkunft"];
  seed?: number;
};

function ziffern(r: () => number, n: number): string {
  let t = "";
  for (let i = 0; i < n; i++) t += Math.floor(r() * 10);
  return t;
}

export function neuesSpiel(o: StartOptionen): Spielstand {
  const seed = o.seed ?? Math.floor(Math.random() * 2 ** 31);
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const [gj, gm, gt] = o.geburtstag.split("-");
  const leer: Beduerfnisse = { hunger: 80, energie: 85, hygiene: 80, sozial: 70, spass: 70, gesundheit: 90, ordnung: 70 };
  const eltern = ELTERN_ORTE[o.herkunft.eltern];
  const wohnung: Wohnung = {
    id: "eltern", form: "eltern", titel: "Kinderzimmer bei den Eltern", adresse: eltern.name, stadtteil: eltern.stadtteil,
    qm: 14, zimmer: 1, kalt: 0, nebenkosten: 0, heizung: 0, kaution: 0, genossenschaftsanteile: 0, ebk: true,
    etage: 1, fahrzeitArbeit: 0, entfernungKm: 0, einzug: 0, kostgeld: 0, kwh: 0,
  };
  const s: Spielstand = {
    version: SPIELSTAND_VERSION,
    id: `${seed.toString(36)}-${Date.now().toString(36)}`,
    seed, rng: seed >>> 0, tag: 0, stunde: 9, ort: "zuhause",
    figur: {
      name: o.name.trim() || "Alex",
      geburtstag: o.geburtstag,
      // Steuer-ID: 11 Ziffern, erste nicht 0 — fiktiv, nur fürs Formular
      steuerId: `${1 + Math.floor(r() * 9)}${ziffern(r, 10)}`,
      // SV-Nummer: Bereich, Geburtsdatum TTMMJJ, Anfangsbuchstabe, Seriennummer, Prüfziffer (hier zufällig)
      svNummer: `${ziffern(r, 2)} ${gt}${gm}${gj.slice(2)} ${(o.name.trim()[0] ?? "A").toUpperCase()} ${ziffern(r, 3)}`,
      iban: `DE${ziffern(r, 2)} 8205 1000 ${ziffern(r, 4)} ${ziffern(r, 4)} ${ziffern(r, 2)}`,
      kirche: o.kirche, krankenkasse: "", kvZusatz: werte(2026).kvZusatzDurchschnitt,
      avatar: o.avatar, farbe: o.farbe,
    },
    zeugnis: o.zeugnis,
    herkunft: o.herkunft,
    beduerfnisse: leer,
    ernaehrung: [],
    kcalBedarf: 2200,
    heute: { kcal: 0, protein: 0, obstGemuese: 0, zucker: 0, auswaerts: 0 },
    vorrat: [],
    wohnung,
    moebel: [],
    konto: { stand: 0, dispo: 0, buchungen: [] },
    sparkonto: 0,
    bargeld: 40,
    kredite: [],
    vertraege: [],
    job: null,
    jobHistorie: [],
    bewerbungen: [],
    antraege: [],
    dokumente: [],
    post: [],
    offen: [],
    zuletztEreignis: {},
    steuerjahre: {},
    steuererklaerungen: {},
    log: [],
    bilanzen: [],
    laufend: neueBilanz(0, 0, leer),
    zustand: {},
    flags: { mittag: "mitnehmen" },
    zuletzt: {},
    naechsteUid: 1,
  };
  // Startgeld: Erspartes von Jugendweihe/Konfirmation und Geburtstagen
  s.konto.stand = 0;
  buchen(s, 600 + Math.round(r() * 600), "eltern", "Erspartes (Jugendweihe, Geburtstage)");
  s.vertraege.push({ uid: uid(s), angebot: "konto-jugend", art: "konto", name: "Jugendkonto (Sparkasse)", monatlich: 0,
    start: 0, mindestBis: 0, zahltag: 1 });
  s.vertraege.push({ uid: uid(s), angebot: "prepaid-disc", art: "handy", name: "Prepaid 10 GB", monatlich: 9.99,
    start: 0, mindestBis: 0, zahltag: 15 });
  s.dokumente.push({ uid: uid(s), art: "zeugnis", titel: "Abschlusszeugnis", tag: 0 });
  log(s, "start", `${s.figur.name} startet ins Leben nach der 10. Klasse (${o.herkunft.eltern === "land" ? "Eltern auf dem Land" : "Eltern in Erfurt"}).`);
  brief(s, "Mama & Papa", "Glückwunsch zum Abschluss! 🎓",
    `Liebe/r ${s.figur.name},\n\nwir sind stolz auf dich! Jetzt geht's los: Such dir eine Ausbildung oder einen Job. ` +
    `Solange du noch bei uns wohnst, zahlst du ${o.herkunft.kindergeld === "eltern" ? "nichts, dafür behalten wir das Kindergeld" : "erst mal kein Kostgeld"}. ` +
    `Bewerbungen schreibst du am besten gleich — viele Betriebe fangen am 1. August oder 1. September an.\n\nDeine Eltern`);
  return s;
}

function neueBilanz(monat: number, konto: number, b: Beduerfnisse): Monatsbilanz {
  return { monat, ein: {}, aus: {}, brutto: 0, steuern: 0, sv: 0, kontoEnde: konto, beduerfnisse: { ...b } };
}

// ───────────────────────────────────────────────────────────── Job & Lohn

export function beruf(s: Spielstand): Beruf | null {
  return s.job ? BERUF.get(s.job.beruf) ?? null : null;
}

export function ausbildungsjahr(job: JobStand, tag: number): number {
  return Math.floor((tag - job.start) / 365.25) + 1;
}

/** Monatsbrutto für den Monat, in dem `tag` liegt (volles Monatsgehalt). */
export function monatsbrutto(s: Spielstand, tag = s.tag): { brutto: number; mindest: boolean; text: string } {
  const job = s.job;
  if (!job) return { brutto: 0, mindest: false, text: "" };
  const b = BERUF.get(job.beruf);
  const jahr = jahrVon(tag);
  if (job.art === "fachkraft") {
    const jahre = Math.max(0, jahr - jahrVon(job.start));
    return { brutto: r2((job.brutto ?? 0) * Math.pow(1.03, jahre)), mindest: false, text: "Gehalt" };
  }
  if (!b) return { brutto: 0, mindest: false, text: "" };
  if (job.art === "helfer") return { brutto: helferBrutto(b, werte(jahr).mindestlohn), mindest: false, text: "Lohn" };
  const aj = ausbildungsjahr(job, tag);
  const v = verguetung(b, aj, jahr);
  return { brutto: v.betrag, mindest: v.mindest, text: `Ausbildungsvergütung ${aj}. Jahr` };
}

export function person(s: Spielstand, azubi: boolean) {
  return { alter: alter(s), kinderlos: true, kirche: s.figur.kirche, kvZusatz: s.figur.kvZusatz, azubi };
}

function lohnZahlen(s: Spielstand): void {
  const job = s.job;
  if (!job) return;
  const letzter = monatsLetzter(s.tag);
  const erster = tagVon(jahrVon(s.tag), monatVon(s.tag), 1);
  const beginn = Math.max(erster, job.start);
  const ende = Math.min(letzter, job.ende ?? letzter);
  if (ende < beginn) return;
  const tageImMonat = letzter - erster + 1;
  const { brutto: voll, mindest, text } = monatsbrutto(s);
  let brutto = r2(voll * (ende - beginn + 1) / tageImMonat);
  const sonder = Number(s.flags.sonderzahlung ?? 0);
  if (sonder > 0) { brutto = r2(brutto + sonder); s.flags.sonderzahlung = 0; }
  const fehl = Number(s.flags.fehlTageMonat ?? 0);
  if (fehl > 0) brutto = r2(Math.max(0, brutto - (voll / 21.7) * fehl));
  s.flags.fehlTageMonat = 0;
  const b = BERUF.get(job.beruf);
  if (brutto <= 0) return;
  const jahr = jahrVon(s.tag);
  let a: Abrechnung;
  if (job.art === "schulisch") return;
  if (job.art === "freiwillig") {
    a = { brutto, kv: 0, pv: 0, rv: 0, av: 0, sv: 0, lohnsteuer: 0, soli: 0, kirchensteuer: 0, steuern: 0, netto: brutto,
      arbeitgeber: r2(brutto * 0.42), geringverdiener: true, minijob: false };
  } else {
    a = abrechnung(brutto, jahr, person(s, job.art === "ausbildung"));
  }
  buchen(s, a.netto, "lohn", `${b?.name ?? "Lohn"} ${monatText(s.tag)} (${job.betrieb})`);
  s.laufend.brutto = r2(s.laufend.brutto + a.brutto);
  s.laufend.steuern = r2(s.laufend.steuern + a.steuern);
  s.laufend.sv = r2(s.laufend.sv + a.sv);
  const st = s.steuerjahre[jahr] ?? { jahr, brutto: 0, lohnsteuer: 0, soli: 0, kirchensteuer: 0, rv: 0, kv: 0, pv: 0, av: 0, monate: 0 };
  st.brutto = r2(st.brutto + a.brutto);
  st.lohnsteuer = r2(st.lohnsteuer + a.lohnsteuer);
  st.soli = r2(st.soli + a.soli);
  st.kirchensteuer = r2(st.kirchensteuer + a.kirchensteuer);
  st.rv = r2(st.rv + a.rv); st.kv = r2(st.kv + a.kv); st.pv = r2(st.pv + a.pv); st.av = r2(st.av + a.av);
  st.monate += 1;
  s.steuerjahre[jahr] = st;
  s.dokumente.push({ uid: uid(s), art: "lohnabrechnung", titel: `Lohnabrechnung ${monatText(s.tag)}`, tag: s.tag,
    daten: { ...a, text, mindest, beruf: b?.name ?? "", betrieb: job.betrieb, jahr } });
  log(s, "geld", `Lohn: brutto ${de(a.brutto, 2)} €, netto ${de(a.netto, 2)} € (Steuern ${de(a.steuern, 2)} €, SV ${de(a.sv, 2)} €)`, a.netto);
  if (b && (b.id === "friseur" || b.id.startsWith("helfer-gastro") || b.id === "gastro" || b.id === "helfer-lieferdienst")) {
    const trinkgeld = Math.round(zwischen(s, 40, 140));
    s.bargeld = r2(s.bargeld + trinkgeld);
    log(s, "geld", `Trinkgeld im ${monatText(s.tag)}: ${trinkgeld} € bar`, trinkgeld);
  }
}

export function kindergeldBerechtigt(s: Spielstand): boolean {
  const a = alter(s);
  if (a < 18) return true;
  if (a >= 25) return false;
  if (s.flags.erstausbildungFertig) return false;
  if (!s.job) return true; // ausbildungsplatzsuchend (bei der Agentur gemeldet)
  return s.job.art === "ausbildung" || s.job.art === "schulisch" || s.job.art === "freiwillig";
}

// ───────────────────────────────────────────────────────────── Bedürfnisse

export type Modus = "wach" | "schlaf" | "arbeit" | "ausgehen" | "unterwegs";

function stundeVergehen(s: Spielstand, h: number, modus: Modus): void {
  const b = s.beduerfnisse;
  const koerper = beruf(s)?.koerperlich ?? 0;
  const schlafQ = [0.55, 0.75, 0.9, 1][effekt(s, "schlaf")];
  const kater = s.zustand.kater && s.zustand.kater >= s.tag ? 1 : 0;
  const d: Beduerfnisse = { hunger: 0, energie: 0, hygiene: 0, sozial: 0, spass: 0, gesundheit: 0, ordnung: 0 };
  switch (modus) {
    case "schlaf":
      d.hunger = -1.3; d.energie = 12.5 * schlafQ; d.hygiene = -0.7; d.sozial = -0.3; break;
    case "arbeit":
      d.hunger = -4.5; d.energie = -5.2 - koerper * 1.4 - kater * 2; d.hygiene = -2.3 - koerper; d.sozial = 0.4; d.spass = -1.6; break;
    case "ausgehen":
      d.hunger = -4.5; d.energie = -6.5; d.hygiene = -2; d.sozial = 9; d.spass = 11; break;
    case "unterwegs":
      d.hunger = -4.2; d.energie = -4.5; d.hygiene = -1.8; d.sozial = -0.5; d.spass = -1; break;
    default:
      d.hunger = -4.2; d.energie = -4.3 - kater * 2; d.hygiene = -1.8; d.sozial = -1.2; d.spass = -1.4;
      d.ordnung = effekt(s, "ordnung") >= 2 ? -0.45 : -0.8;
  }
  for (const k of Object.keys(d) as (keyof Beduerfnisse)[]) b[k] = begrenzen(b[k] + d[k] * h);
}

/** Lässt Zeit vergehen (auch über Mitternacht). */
export function vergehe(s: Spielstand, stunden: number, modus: Modus): void {
  let rest = stunden;
  while (rest > 1e-6 && !s.beendet) {
    const bisMitternacht = 24 - s.stunde;
    const schritt = Math.min(rest, bisMitternacht, 1);
    stundeVergehen(s, schritt, modus);
    s.stunde += schritt;
    rest -= schritt;
    if (s.stunde >= 24 - 1e-6) {
      s.stunde = 0;
      tagesWechsel(s);
    }
  }
}

// ───────────────────────────────────────────────────────────── Tageswechsel

function tagesWechsel(s: Spielstand): void {
  const gestern = s.tag;
  tagAuswerten(s, gestern);
  arbeitPruefen(s, gestern);
  s.tag += 1;
  if (s.tag >= ENDE_TAG) {
    s.beendet = true;
    log(s, "ende", "Fünf Jahre sind um — das Spiel ist zu Ende.");
    monatsWechsel(s);
    return;
  }
  if (tagImMonat(s.tag) === 1) monatsWechsel(s);
  zahlungen(s);
  if (istMonatsletzter(s.tag)) monatsEnde(s);
  geburtstag(s);
  amtTag(s);
  nebenbei(s);
  bewerbungenTag(s);
  taeglicheEreignisse(s);
}

function tagAuswerten(s: Spielstand, tag: number): void {
  const h = s.heute;
  s.ernaehrung.push({ tag, kcal: Math.round(h.kcal), protein: Math.round(h.protein), obstGemuese: r2(h.obstGemuese),
    zucker: Math.round(h.zucker), auswaerts: h.auswaerts });
  if (s.ernaehrung.length > 60) s.ernaehrung.shift();
  const b = s.beduerfnisse;
  // Gesundheit reagiert langsam auf die letzten sieben Tage
  const woche = s.ernaehrung.slice(-7);
  const og = woche.reduce((a, t) => a + t.obstGemuese, 0) / woche.length;
  const kcal = woche.reduce((a, t) => a + t.kcal, 0) / woche.length;
  const zucker = woche.reduce((a, t) => a + t.zucker, 0) / woche.length;
  let g = 0;
  g += og >= 4 ? 0.6 : og >= 2 ? 0 : -0.8;
  g += kcal < s.kcalBedarf * 0.6 ? -1.5 : kcal < s.kcalBedarf * 0.85 ? -0.5 : kcal > s.kcalBedarf * 1.35 ? -0.3 : 0.3;
  g += zucker > 110 ? -0.5 : 0;
  g += b.energie < 15 ? -1 : 0;
  g += b.hygiene < 15 ? -0.5 : 0;
  if (s.zustand.krank && s.zustand.krank.bis >= tag) g -= 0.5;
  b.gesundheit = begrenzen(b.gesundheit + g);
  s.heute = { kcal: 0, protein: 0, obstGemuese: 0, zucker: 0, auswaerts: 0 };

  // Verbrauch: Hygieneartikel und Haushalt (bei den Eltern zahlen die)
  if (s.wohnung.form !== "eltern") {
    const fehlt: string[] = [];
    if (!verbrauchen(s, "klopapier")) { fehlt.push("Klopapier"); b.hygiene = begrenzen(b.hygiene - 15); }
    if (!verbrauchen(s, "zaehne")) { fehlt.push("Zahnpasta"); b.gesundheit = begrenzen(b.gesundheit - 0.3); }
    if (!verbrauchen(s, "spuelen")) { fehlt.push("Spülmittel"); b.ordnung = begrenzen(b.ordnung - 6); }
    if (!verbrauchen(s, "muell")) { fehlt.push("Müllbeutel"); b.ordnung = begrenzen(b.ordnung - 3); }
    verbrauchen(s, "deo");
    verbrauchen(s, "kueche");
    if (fehlt.length) s.flags.fehltZuhause = fehlt.join(", ");
    else delete s.flags.fehltZuhause;
    // Strom: Grundlast + Geräte
    const geraete = s.moebel.reduce((a, m) => a + (m.defekt ? 0 : MOEBEL_DEF.get(m.id)?.strom ?? 0), 0);
    const tagesKwh = (stromVerbrauchJahr(geraete) / 365) * (s.flags.stromSparen ? 0.85 : 1) * zwischen(s, 0.85, 1.15);
    s.wohnung.kwh = r2(s.wohnung.kwh + tagesKwh);
  }
  verderben(s);
}

function arbeitPruefen(s: Spielstand, tag: number): void {
  const job = s.job;
  if (!job || tag < job.start || (job.ende !== undefined && tag > job.ende)) return;
  const pflicht = istArbeitstag(tag) && !(Number(s.flags.urlaubBis ?? -1) >= tag);
  if (!pflicht || job.heuteErledigt === tag) return;
  if (s.zustand.krank && s.zustand.krank.bis >= tag) {
    job.krankTage += 1;
    if (!s.flags[`krankGemeldet${tag}`] && !s.zustand.krank.au) {
      job.fehlTage += 1;
      job.leistung = begrenzen(job.leistung - 8);
      log(s, "arbeit", `Krank, aber nicht krankgemeldet (${kurzDatum(tag)}) — der Betrieb ist sauer.`);
    }
    return;
  }
  job.fehlTage += 1;
  s.flags.fehlTageMonat = Number(s.flags.fehlTageMonat ?? 0) + 1;
  job.leistung = begrenzen(job.leistung - 15);
  log(s, "arbeit", `Unentschuldigt gefehlt am ${kurzDatum(tag)}.`);
  abmahnungPruefen(s, `unentschuldigtes Fehlen am ${kurzDatum(tag)}`);
}

export function abmahnungPruefen(s: Spielstand, grund: string): void {
  const job = s.job;
  if (!job) return;
  job.abmahnungen += 1;
  const probezeit = s.tag <= job.probezeitBis;
  if ((probezeit && job.abmahnungen >= 2) || job.abmahnungen >= 3) {
    kuendigen(s, probezeit ? `Kündigung in der Probezeit (${grund})` : `Kündigung nach drei Abmahnungen (${grund})`);
    return;
  }
  s.dokumente.push({ uid: uid(s), art: "brief", titel: `Abmahnung: ${grund}`, tag: s.tag });
  brief(s, job.betrieb, `Abmahnung`,
    `Sehr geehrte/r ${s.figur.name},\n\nhiermit mahnen wir Sie wegen ${grund} ab. Im Wiederholungsfall müssen Sie mit der Kündigung rechnen.` +
    `\n\nDas ist Abmahnung Nr. ${job.abmahnungen}.${probezeit ? " Achtung: In der Probezeit kann dir ohne Grund und ohne Frist gekündigt werden." : ""}`);
  log(s, "arbeit", `Abmahnung Nr. ${job.abmahnungen}: ${grund}`);
}

export function kuendigen(s: Spielstand, grund: string): void {
  const job = s.job;
  if (!job) return;
  job.ende = s.tag;
  s.jobHistorie.push({ ...job });
  s.job = null;
  s.dokumente.push({ uid: uid(s), art: "kuendigung", titel: `Kündigung ${job.betrieb}`, tag: s.tag, text: grund });
  brief(s, job.betrieb, "Kündigung", `${grund}.\n\nIhr Arbeitsverhältnis endet am ${kurzDatum(s.tag)}. ` +
    `Melden Sie sich sofort bei der Agentur für Arbeit arbeitssuchend (Frist: 3 Tage nach Kenntnis).`);
  log(s, "arbeit", grund);
  s.flags.arbeitslosSeit = s.tag;
}

function zahlungen(s: Spielstand): void {
  const t = tagImMonat(s.tag);
  const jahr = jahrVon(s.tag);
  const w = werte(jahr);
  const wo = s.wohnung;
  // Miete am 1.
  if (t === 1) {
    if (wo.form === "eltern") {
      if ((wo.kostgeld ?? 0) > 0) buchen(s, -(wo.kostgeld ?? 0), "miete", "Kostgeld an die Eltern");
    } else if (s.tag > wo.einzug) {
      buchen(s, -(wo.kalt), "miete", `Miete ${wo.adresse}`);
      buchen(s, -(wo.nebenkosten + wo.heizung), "nebenkosten", `Nebenkosten-/Heizkostenvorauszahlung`);
    }
  }
  // Verträge
  for (const v of s.vertraege) {
    if (v.gekuendigtZum !== undefined && s.tag > v.gekuendigtZum) continue;
    const a = ANGEBOT.get(v.angebot);
    if (!a) continue;
    if (v.jaehrlich) {
      const start = datum(v.start);
      const heute = datum(s.tag);
      if (heute.getUTCMonth() === start.getUTCMonth() && heute.getUTCDate() === start.getUTCDate() && s.tag !== v.start) {
        buchen(s, -r2(v.monatlich * 12), "versicherung", `${v.name} (Jahresbeitrag)`);
      }
      continue;
    }
    if (t !== v.zahltag || s.tag === v.start) continue;
    let betrag = v.monatlich;
    if (a.art === "ticket") betrag = w.deutschlandticket - (s.flags.jobticket ? 20 : 0);
    else if (a.art !== "strom") {
      const vm = monatsIndex(s.tag) - monatsIndex(v.start);
      betrag = preisImMonat(a, vm);
    }
    if (betrag <= 0) continue;
    const kat = a.art === "strom" ? "strom" : a.art === "internet" ? "internet" : a.art === "handy" ? "handy"
      : a.art === "ticket" ? "mobilitaet" : a.art === "konto" ? "bank"
      : ["haftpflicht", "hausrat", "bu", "unfall", "handyversicherung", "rechtsschutz", "zahnzusatz"].includes(a.art) ? "versicherung"
      : "abos";
    buchen(s, -betrag, kat, `${v.name}${a.art === "strom" ? " (Abschlag)" : ""}`);
  }
  // Strom-Grundversorgung, wenn man in einer eigenen Wohnung keinen Vertrag hat
  if (t === 1 && wo.form === "wohnung" && s.tag > wo.einzug && !s.vertraege.some((v) => v.art === "strom" && aktiv(s, v))) {
    const a = ANGEBOT.get("strom-grund")!;
    const abschlag = stromAbschlag(a, 1400);
    buchen(s, -abschlag, "strom", "Strom Grundversorgung (ohne eigenen Vertrag)");
    if (!s.flags.grundversorgungHinweis) {
      s.flags.grundversorgungHinweis = true;
      brief(s, "SWE Energie", "Willkommen in der Grundversorgung",
        "Sie beziehen Strom, ohne einen Vertrag abgeschlossen zu haben — deshalb gilt automatisch die Grundversorgung (36,52 ct/kWh). " +
        "Ein eigener Tarif ist meist günstiger.");
    }
  }
  // Rundfunkbeitrag: vierteljährlich zur Mitte des Quartals
  if (s.flags.rundfunkAngemeldet && !s.flags.rundfunkBefreit && t === 15 && [2, 5, 8, 11].includes(monatVon(s.tag))) {
    buchen(s, -r2(w.rundfunk * 3), "rundfunk", "Rundfunkbeitrag (3 Monate)");
  }
  // Kindergeld: die Familienkasse zahlt an die Eltern, die geben es (vielleicht) weiter
  if (t === 12 && kindergeldBerechtigt(s)) {
    const kg = w.kindergeld;
    const weiter = s.herkunft.kindergeld === "weiter" ? kg : s.herkunft.kindergeld === "halb" ? Math.round(kg / 2) : 0;
    if (weiter > 0) buchen(s, weiter, "kindergeld", "Kindergeld (von den Eltern weitergeleitet)");
  }
  // BAB / Wohngeld: am Monatsanfang
  if (t === 1) {
    for (const a of s.antraege) {
      if (a.status !== "bewilligt" || !a.betrag) continue;
      if (a.bisTag !== undefined && s.tag > a.bisTag) continue;
      if (a.art === "bab") buchen(s, a.betrag, "bab", "Berufsausbildungsbeihilfe (BAB)");
      if (a.art === "wohngeld") buchen(s, a.betrag, "wohngeld", "Wohngeld");
      if (a.art === "kindergeld") { /* Abzweigung an das Kind */ buchen(s, a.betrag, "kindergeld", "Kindergeld (Abzweigung)"); }
    }
  }
  // Kredite und Raten
  for (const k of s.kredite) {
    if (k.rest <= 0 || k.art === "dispo") continue;
    if (s.tag === k.faellig) {
      const rate = Math.min(k.rate, k.rest);
      buchen(s, -rate, "schulden", `Rate: ${k.text}`);
      k.rest = r2(k.rest - rate + (k.rest * k.zins) / 100 / 12);
      k.faellig = tagVon(jahrVon(s.tag), monatVon(s.tag) + 1, Math.min(28, tagImMonat(s.tag)));
      if (k.rest < 0.01) { k.rest = 0; log(s, "schulden", `Abbezahlt: ${k.text}`); }
    }
  }
  // Offene Rechnungen: Mahnungen
  for (const p of s.post) {
    const a = p.aktion;
    if (!a || a.art !== "rechnung" || a.bezahlt) continue;
    if (s.tag === a.faellig + 14) mahnen(s, p);
  }
  // Sparplan
  if (t === 1 && Number(s.flags.sparrate ?? 0) > 0) {
    const rate = Number(s.flags.sparrate);
    if (s.konto.stand - rate >= 0) {
      buchen(s, -rate, "sparen", "Dauerauftrag aufs Sparkonto");
      s.sparkonto = r2(s.sparkonto + rate);
    }
  }
}

function mahnen(s: Spielstand, p: Spielstand["post"][number]): void {
  const a = p.aktion;
  if (!a || a.art !== "rechnung") return;
  const stufe = (a.mahnstufe ?? 0) + 1;
  const titel = p.betreff.replace(/^(\d+\. Mahnung|Inkasso|Mahnbescheid|Pfändung): /, "");
  a.bezahlt = true; // die alte Rechnung wird durch das neue Schreiben ersetzt
  if (stufe >= 5) {
    // Vollstreckungsbescheid → Kontopfändung: das Geld wird einfach abgebucht
    const betrag = r2(a.betrag + 60);
    buchen(s, -betrag, "schulden", `Kontopfändung (Gerichtsvollzieher): ${titel}`);
    brief(s, "Amtsgericht Erfurt – Gerichtsvollzieher", `Pfändung: ${titel}`,
      `Aufgrund eines Vollstreckungsbescheids wurde Ihr Konto gepfändet: ${de(betrag, 2)} € (inkl. Kosten). ` +
      `Tipp: Ein Pfändungsschutzkonto (P-Konto) schützt den Grundfreibetrag. Hilfe: Schuldnerberatung (Amt-Menü).`);
    log(s, "schulden", `Kontopfändung: ${titel} (${de(betrag, 2)} €)`, -betrag);
    return;
  }
  const gebuehr = stufe === 1 ? 5 : stufe === 2 ? 10 : stufe === 3 ? 55 : 40;
  const neu = { ...a, betrag: r2(a.betrag + gebuehr), faellig: s.tag, mahnstufe: stufe, bezahlt: false };
  const wer = stufe >= 4 ? "Amtsgericht (Zentrales Mahngericht)" : stufe === 3 ? "Inkasso Mitteldeutschland (fiktiv)" : p.von;
  const kopf = stufe >= 4 ? "Mahnbescheid" : stufe === 3 ? "Inkasso" : `${stufe}. Mahnung`;
  brief(s, wer, `${kopf}: ${titel}`,
    `Die Forderung ist noch offen. Neuer Betrag inkl. Gebühren: ${de(neu.betrag, 2)} €.` +
    (stufe === 3 ? "\n\nInkassokosten sind teuer. Bei weiterer Nichtzahlung: gerichtliches Mahnverfahren und SCHUFA-Eintrag." : "") +
    (stufe >= 4 ? "\n\nGegen den Mahnbescheid kann innerhalb von 2 Wochen Widerspruch eingelegt werden. Sonst folgt der Vollstreckungsbescheid." : ""),
    neu);
  log(s, "schulden", `${kopf}: ${titel} (${de(neu.betrag, 2)} €)`);
  if (stufe === 4 && !s.flags.schufaNegativ) {
    s.flags.schufaNegativ = true;
    log(s, "schulden", "SCHUFA-Negativeintrag: titulierte Forderung.");
  }
}

export function aktiv(s: Spielstand, v: Vertrag): boolean {
  return v.gekuendigtZum === undefined || s.tag <= v.gekuendigtZum;
}

function monatsEnde(s: Spielstand): void {
  lohnZahlen(s);
  // Dispozinsen
  if (s.konto.stand < 0) {
    const zins = r2((-s.konto.stand * 12.5) / 100 / 12);
    if (zins > 0) buchen(s, -zins, "bank", "Dispozinsen (12,5 % p. a.)");
  }
  // Kontoführung: Jugendkonto wird mit 25 oder nach der Ausbildung kostenpflichtig
  const konto = s.vertraege.find((v) => v.art === "konto" && aktiv(s, v));
  if (konto?.angebot === "konto-jugend" && (alter(s) >= 25 || (s.flags.erstausbildungFertig && s.job?.art !== "ausbildung"))) {
    konto.angebot = "konto-normal";
    konto.name = "Girokonto Klassik";
    konto.monatlich = 7.95;
    brief(s, "Sparkasse", "Ihr Kontomodell ändert sich",
      "Da Sie nicht mehr in Ausbildung sind, stellen wir Ihr Jugendkonto auf das Modell »Klassik« (7,95 €/Monat) um. " +
      "Kostenlose Online-Konten gibt es bei Direktbanken.");
  }
  if (konto && konto.monatlich > 0 && konto.angebot === "konto-direkt") {
    const eingang = s.laufend.ein.lohn ?? 0;
    if (eingang < 700) buchen(s, -4.9, "bank", "Kontoführung (unter 700 € Geldeingang)");
  } else if (konto && konto.monatlich > 0) {
    buchen(s, -konto.monatlich, "bank", "Kontoführungsgebühr");
  }
}

function monatsWechsel(s: Spielstand): void {
  const alt = s.laufend;
  alt.kontoEnde = s.konto.stand;
  alt.beduerfnisse = { ...s.beduerfnisse };
  s.bilanzen.push(alt);
  s.laufend = neueBilanz(monatsIndex(s.tag), s.konto.stand, s.beduerfnisse);
  const ein = Object.values(alt.ein).reduce((a, b) => a + (b ?? 0), 0);
  const aus = Object.values(alt.aus).reduce((a, b) => a + (b ?? 0), 0);
  log(s, "monat", `Monatsbilanz: +${de(ein, 2)} € / −${de(aus, 2)} €, Konto ${de(s.konto.stand, 2)} €`, ein - aus);
  s.flags.monatNeu = true;
  // Lohnsteuerbescheinigung im Februar für das Vorjahr
  if (monatVon(s.tag) === 2) {
    const vorjahr = jahrVon(s.tag) - 1;
    const st = s.steuerjahre[vorjahr];
    if (st) {
      s.dokumente.push({ uid: uid(s), art: "lohnsteuerbescheinigung", titel: `Lohnsteuerbescheinigung ${vorjahr}`, tag: s.tag, daten: { ...st } });
      brief(s, "Arbeitgeber", `Lohnsteuerbescheinigung ${vorjahr}`,
        `Anbei deine elektronische Lohnsteuerbescheinigung für ${vorjahr}: Bruttolohn ${de(st.brutto, 2)} €, ` +
        `einbehaltene Lohnsteuer ${de(st.lohnsteuer, 2)} €. Die Daten liegen dem Finanzamt schon vor — ` +
        `mit einer Steuererklärung bekommst du evtl. Geld zurück.`);
    }
  }
  // Strom-Jahresabrechnung
  stromJahresabrechnung(s);
  nebenkostenabrechnung(s);
}

function stromJahresabrechnung(s: Spielstand): void {
  const v = s.vertraege.find((x) => x.art === "strom" && aktiv(s, x));
  const wo = s.wohnung;
  if (wo.form !== "wohnung") return;
  const seit = Number(s.flags.stromAbgelesen ?? wo.einzug);
  if (s.tag - seit < 365) return;
  const a = ANGEBOT.get(v?.angebot ?? "strom-grund")!;
  const monate = 12;
  const kosten = r2(wo.kwh * (a.kwhPreis ?? 0.3652) + (a.grundpreis ?? 17.15) * monate);
  const gezahlt = r2((v?.monatlich ?? stromAbschlag(ANGEBOT.get("strom-grund")!, 1400)) * monate);
  const diff = r2(gezahlt - kosten);
  const neuerAbschlag = Math.ceil(kosten / 12);
  if (v) v.monatlich = neuerAbschlag;
  s.flags.stromAbgelesen = s.tag;
  brief(s, a.anbieter, "Ihre Stromjahresabrechnung",
    `Verbrauch: ${Math.round(wo.kwh)} kWh. Kosten: ${de(kosten, 2)} €. Gezahlte Abschläge: ${de(gezahlt, 2)} €.\n\n` +
    (diff >= 0 ? `Guthaben: ${de(diff, 2)} € — wir überweisen es Ihnen.` : `Nachzahlung: ${de((-diff), 2)} €, fällig in 14 Tagen.`) +
    `\n\nIhr neuer Abschlag: ${neuerAbschlag} € im Monat.`,
    diff < 0 ? { art: "rechnung", betrag: -diff, kategorie: "strom", faellig: s.tag + 14 } : undefined);
  if (diff >= 0) buchen(s, diff, "erstattung", "Guthaben Stromabrechnung");
  log(s, "geld", `Stromabrechnung: ${Math.round(wo.kwh)} kWh, ${diff >= 0 ? "Guthaben" : "Nachzahlung"} ${de(Math.abs(diff), 2)} €`, diff);
  wo.kwh = 0;
}

function nebenkostenabrechnung(s: Spielstand): void {
  const wo = s.wohnung;
  if (wo.form !== "wohnung" || monatVon(s.tag) !== 6) return;
  const jahr = jahrVon(s.tag) - 1;
  const beginn = Math.max(wo.einzug, tagVon(jahr, 1, 1));
  const ende = tagVon(jahr, 12, 31);
  if (ende <= beginn) return;
  const monate = Math.round((ende - beginn) / 30.4);
  const voraus = (wo.nebenkosten + wo.heizung) * monate;
  const heizFaktor = s.flags.heizenSparsam ? 0.9 : s.flags.lueftenFalsch ? 1.2 : 1;
  const tatsaechlich = r2(wo.nebenkosten * monate * zwischen(s, 0.9, 1.15) + wo.heizung * monate * heizFaktor * zwischen(s, 0.85, 1.3));
  const diff = r2(voraus - tatsaechlich);
  const haushaltsnah = r2(wo.nebenkosten * monate * 0.18);
  s.flags[`haushaltsnah${jahr}`] = haushaltsnah;
  brief(s, "Hausverwaltung", `Betriebskostenabrechnung ${jahr}`,
    `Vorauszahlungen: ${de(voraus, 2)} €. Tatsächliche Kosten: ${de(tatsaechlich, 2)} €.\n\n` +
    (diff >= 0 ? `Guthaben: ${de(diff, 2)} €.` : `Nachzahlung: ${de((-diff), 2)} €, fällig in 30 Tagen.`) +
    `\n\nDarin enthalten: haushaltsnahe Dienstleistungen (Hausmeister, Treppenreinigung) ${de(haushaltsnah, 2)} € — ` +
    `das kannst du in der Steuererklärung angeben (§ 35a EStG).`,
    diff < 0 ? { art: "rechnung", betrag: -diff, kategorie: "nebenkosten", faellig: s.tag + 30 } : undefined);
  if (diff >= 0) buchen(s, diff, "erstattung", `Guthaben Betriebskosten ${jahr}`);
  log(s, "geld", `Nebenkostenabrechnung ${jahr}: ${diff >= 0 ? "Guthaben" : "Nachzahlung"} ${de(Math.abs(diff), 2)} €`, diff);
}

function geburtstag(s: Spielstand): void {
  const [, gm, gt] = s.figur.geburtstag.split("-").map(Number);
  if (monatVon(s.tag) !== gm || tagImMonat(s.tag) !== gt) return;
  const a = alter(s);
  s.bargeld = r2(s.bargeld + 50);
  log(s, "start", `${a}. Geburtstag! Die Familie schenkt 50 € bar.`, 50);
  if (a === 18) {
    s.konto.dispo = s.job ? Math.min(1000, Math.round(monatsbrutto(s).brutto)) : 0;
    brief(s, "Sparkasse", "Du bist volljährig — dein Konto auch",
      `Ab heute kannst du Verträge allein unterschreiben. ${s.konto.dispo > 0 ? `Wir räumen dir einen Dispositionskredit von ${s.konto.dispo} € ein (12,5 % Zinsen). Ein Dispo ist kein Geld, sondern ein teurer Kredit!` : ""}`);
  }
}

// ───────────────────────────────────────────────────────────── Bewerbungen

function bewerbungenTag(s: Spielstand): void {
  for (const b of s.bewerbungen) {
    // Termine gelten als verpasst, wenn der Tag vorbei ist
    const verpasst = (b.status === "test" || b.status === "gespraech") && b.naechsterTag === s.tag - 1;
    if (b.naechsterTag !== s.tag && !verpasst) continue;
    if ((b.status === "test" || b.status === "gespraech") && !verpasst) continue;
    const beruf = BERUF.get(b.beruf);
    if (!beruf) continue;
    if (b.status === "versendet") {
      // Erste Antwort: Absage, Einladung zum Test oder zum Gespräch
      const p = vorauswahl(s, beruf, b.qualitaet);
      if (zufall(s) < p) {
        b.status = beruf.einstellungstest ? "test" : "gespraech";
        b.naechsterTag = werktagAb(s.tag + 3 + Math.floor(zufall(s) * 8));
        brief(s, b.betrieb, beruf.einstellungstest ? "Einladung zum Einstellungstest" : "Einladung zum Vorstellungsgespräch",
          `Vielen Dank für Ihre Bewerbung als ${beruf.name}. Wir laden Sie ein am ${kurzDatum(b.naechsterTag)} um 10:00 Uhr.`);
        log(s, "bewerbung", `Einladung: ${beruf.name} bei ${b.betrieb}`);
      } else {
        b.status = "absage";
        brief(s, b.betrieb, "Ihre Bewerbung",
          `Vielen Dank für Ihr Interesse. Leider haben wir uns für andere Bewerber:innen entschieden. Wir wünschen Ihnen viel Erfolg.`);
        log(s, "bewerbung", `Absage: ${beruf.name} bei ${b.betrieb}`);
      }
    } else if (b.status === "test" || b.status === "gespraech") {
      // Termin verpasst?
      b.status = "absage";
      brief(s, b.betrieb, "Termin verpasst", "Sie sind zum vereinbarten Termin nicht erschienen. Damit ist Ihre Bewerbung leider erledigt.");
      log(s, "bewerbung", `Termin verpasst: ${beruf.name}`);
    } else if (b.status === "zusage" && b.naechsterTag === s.tag) {
      b.status = "abgelehnt";
      log(s, "bewerbung", `Zusage verfallen: ${beruf.name}`);
    }
  }
}

/** Nächster Werktag ab einem Tag (Termine liegen nicht am Wochenende). */
export function werktagAb(tag: number): number {
  let t = tag;
  while (!istArbeitstag(t)) t++;
  return t;
}

/** Notendurchschnitt der relevanten Fächer (bzw. aller, falls keine genannt). */
export function schnitt(z: Spielstand["zeugnis"], faecher?: string[]): number {
  const noten = Object.entries(z.noten).filter(([f, n]) => n && (!faecher || faecher.length === 0 || faecher.includes(f)));
  if (noten.length === 0) return 3;
  return noten.reduce((a, [, n]) => a + (n ?? 3), 0) / noten.length;
}

/** Wahrscheinlichkeit, nach der schriftlichen Bewerbung eingeladen zu werden. */
export function vorauswahl(s: Spielstand, b: Beruf, qualitaet: number): number {
  if (b.art === "helfer" || b.art === "freiwillig") return 0.85;
  const gesamt = schnitt(s.zeugnis);
  const fach = schnitt(s.zeugnis, b.faecher);
  const note = gesamt * 0.5 + fach * 0.5;
  // Abstand zur Wunschnote: jede halbe Note besser/schlechter verschiebt deutlich
  let p = 0.55 + (b.schnitt - note) * 0.35;
  p -= (b.konkurrenz - 2) * 0.07;
  p += (qualitaet - 0.5) * 0.4;
  const rang = { HSA: 0, QHSA: 1, RSA: 2 } as const;
  if (rang[s.zeugnis.abschluss] < rang[b.abschluss]) p *= 0.25;
  if (s.zeugnis.fehltageUnentschuldigt > 5) p -= 0.15;
  if (s.zeugnis.verhalten >= 4) p -= 0.1;
  if (s.flags.fsjGemacht) p += 0.1;
  return Math.max(0.03, Math.min(0.95, p));
}

// ───────────────────────────────────────────────────────────── Aktionen

export type Ergebnis = { stand: Spielstand; meldung?: string; fehler?: string };

function gibt(s: Spielstand, meldung?: string): Ergebnis {
  return { stand: s, meldung };
}

export function istUrlaub(s: Spielstand, tag = s.tag): boolean {
  return Number(s.flags.urlaubBis ?? -1) >= tag && Number(s.flags.urlaubVon ?? 1e9) <= tag;
}

export function arbeitHeute(s: Spielstand, tag = s.tag): { muss: boolean; schule: boolean; beginn: number; erledigt: boolean } {
  const job = s.job;
  if (!job || tag < job.start || (job.ende !== undefined && tag > job.ende) || !istArbeitstag(tag) || istUrlaub(s, tag)) {
    return { muss: false, schule: false, beginn: 0, erledigt: false };
  }
  const b = BERUF.get(job.beruf);
  const bs = b?.berufsschule ?? 0;
  const wt = wochentag(tag);
  const woche = Math.floor(tag / 7);
  const schule = job.art === "schulisch" || (job.art === "ausbildung" && (wt === 0 || (bs >= 1.5 && wt === 1 && woche % 2 === 0)) && bs > 0);
  let beginn = schule ? 7.5 : b?.beginn ?? 8;
  if (!schule && alter(s) < 18 && beginn < 6) beginn = alter(s) >= 17 ? 5 : 6; // Jugendarbeitsschutz
  return { muss: true, schule, beginn, erledigt: job.heuteErledigt === tag };
}

/** Zur Arbeit bzw. Berufsschule gehen. */
export function arbeiten(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  const job = s.job;
  const heute = arbeitHeute(s);
  if (!job || !heute.muss) return { stand: alt, fehler: "Heute musst du nicht arbeiten." };
  if (heute.erledigt) return { stand: alt, fehler: "Du warst heute schon da." };
  if (s.zustand.krank && s.zustand.krank.bis >= s.tag) return { stand: alt, fehler: "Du bist krank — bleib zu Hause und melde dich krank." };
  const b = BERUF.get(job.beruf);
  const weg = (s.wohnung.form === "eltern"
    ? ELTERN_ORTE[s.herkunft.eltern].extraMin + 25
    : s.wohnung.fahrzeitArbeit || 25) / 60;
  const ankunft = s.stunde + weg;
  let zuSpaet = Math.max(0, ankunft - heute.beginn);
  if (s.flags.verschlafen !== undefined && Number(s.flags.verschlafen) === s.tag) {
    delete s.flags.verschlafen;
    zuSpaet += 1.5;
    vergehe(s, 1.5, "schlaf");
  }
  vergehe(s, weg, "unterwegs");
  if (!s.vertraege.some((v) => v.art === "ticket" && aktiv(s, v)) && !s.moebel.some((m) => m.id === "fahrrad-schloss")) {
    // Ohne Ticket und Rad: Einzelfahrschein (EVAG, Richtwert)
    buchen(s, -2 * 2.6, "mobilitaet", "Einzelfahrscheine hin und zurück");
  }
  const stunden = heute.schule ? 6.5 : Math.min(alter(s) < 18 ? 8 : 9, (b?.stundenWoche ?? 40) / 5) + 0.5;
  // Mittag
  const regel = String(s.flags.mittag ?? "mitnehmen");
  let mittag = "";
  if (regel === "mitnehmen" && s.wohnung.form === "eltern") {
    beiDenEltern(s, "mittag");
    mittag = "Brotdose von zu Hause";
  } else if (regel === "mitnehmen") {
    const e = essen(s, "mittag", false);
    mittag = e.kcal > 200 ? `Brotdose: ${e.produkte.slice(0, 3).join(", ")}` : "Brotdose leer — Hunger!";
  } else if (regel === "kaufen") {
    buchen(s, -6.5, "lebensmittel", heute.schule ? "Mittag in der Schulmensa" : "Mittag beim Bäcker/in der Kantine");
    s.heute.kcal += 750; s.heute.protein += 25; s.heute.obstGemuese += 1; s.heute.zucker += 20; s.heute.auswaerts++;
    s.beduerfnisse.hunger = begrenzen(s.beduerfnisse.hunger + 30);
    mittag = "Mittag gekauft (6,50 €)";
  }
  vergehe(s, stunden / 2, "arbeit");
  if (regel !== "kaufen") {
    const kcal = s.heute.kcal;
    s.beduerfnisse.hunger = begrenzen(s.beduerfnisse.hunger + Math.min(35, (kcal / s.kcalBedarf) * 90));
  }
  vergehe(s, stunden / 2, "arbeit");
  vergehe(s, weg, "unterwegs");
  // Leistung: ausgeschlafen, sauber, satt, nicht verkatert
  const bd = s.beduerfnisse;
  let tagesform = (bd.energie + bd.hygiene + bd.hunger + bd.gesundheit) / 4;
  if (s.zustand.kater && s.zustand.kater >= s.tag) tagesform -= 25;
  const delta = (tagesform - 45) / 12 - zuSpaet * 6;
  job.leistung = begrenzen(job.leistung + delta);
  job.heuteErledigt = s.tag;
  job.zuletzt = s.tag;
  s.flags[`arbeitstage${jahrVon(s.tag)}`] = Number(s.flags[`arbeitstage${jahrVon(s.tag)}`] ?? 0) + 1;
  let meldung = `${heute.schule ? "Berufsschule" : "Arbeit"} geschafft. ${mittag}`;
  if (zuSpaet > 0.1) {
    meldung += ` Du warst ${Math.round(zuSpaet * 60)} Minuten zu spät!`;
    log(s, "arbeit", `${Math.round(zuSpaet * 60)} min zu spät gekommen.`);
    const verspaetungen = Number(s.flags.verspaetungen ?? 0) + 1;
    s.flags.verspaetungen = verspaetungen;
    if (verspaetungen % 4 === 0) abmahnungPruefen(s, "wiederholtes Zuspätkommen");
  }
  if (bd.hygiene < 20 && zufall(s) < 0.3) {
    meldung += " Kolleg:innen haben sich über deinen Geruch beschwert.";
    job.leistung = begrenzen(job.leistung - 5);
  }
  if (b?.id === "friseur" || b?.id === "gastro" || b?.id === "helfer-gastro") {
    const tg = Math.round(zwischen(s, 0, 8));
    s.bargeld = r2(s.bargeld + tg);
  }
  return gibt(s, meldung);
}

/** Krankmelden (Anruf vor Arbeitsbeginn). */
export function krankmelden(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  if (!s.job) return { stand: alt, fehler: "Du hast gerade keinen Job." };
  s.flags[`krankGemeldet${s.tag}`] = true;
  log(s, "arbeit", "Beim Betrieb krankgemeldet.");
  return gibt(s, "Du hast im Betrieb angerufen. Denk an die Krankschreibung (AU) vom Arzt — dein Betrieb will sie ab dem ersten Tag.");
}

export function schlafen(alt: Spielstand, bisStunde: number): Ergebnis {
  const s = klon(alt);
  let dauer = bisStunde - s.stunde;
  if (dauer <= 0) dauer += 24;
  vergehe(s, dauer, "schlaf");
  let meldung = `Geschlafen bis ${String(Math.floor(bisStunde)).padStart(2, "0")}:${bisStunde % 1 ? "30" : "00"}.`;
  if (effekt(s, "schlaf") === 0) meldung += " Auf dem Boden schläft es sich schlecht — eine Matratze wäre gut.";
  return gibt(s, meldung);
}

export function duschen(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  const hatDuschgel = s.wohnung.form === "eltern" || verbrauchen(s, "duschen", 1);
  vergehe(s, 0.5, "wach");
  s.beduerfnisse.hygiene = begrenzen(s.beduerfnisse.hygiene + (hatDuschgel ? 70 : 35));
  s.zuletzt.duschen = s.tag;
  return gibt(s, hatDuschgel ? "Frisch geduscht." : "Nur mit Wasser geduscht — Duschgel ist alle.");
}

export function mahlzeit(alt: Spielstand, m: Mahlzeit): Ergebnis {
  const s = klon(alt);
  const kochen = m !== "snack";
  const e = s.wohnung.form === "eltern" ? beiDenEltern(s, m) : essen(s, m, kochen);
  vergehe(s, kochen && effekt(s, "kochen") >= 2 ? 0.75 : 0.25, "wach");
  s.beduerfnisse.hunger = begrenzen(s.beduerfnisse.hunger + (e.kcal / s.kcalBedarf) * 110);
  if (e.kcal < 100) return gibt(s, "Nichts Essbares da. Einkaufen gehen — oder bei den Eltern vorbeischauen?");
  return gibt(s, `Gegessen (${e.kcal} kcal): ${e.produkte.slice(0, 4).join(", ")}${e.fehlt > 150 ? " — nicht ganz satt." : "."}`);
}

/** Bei den Eltern steht Essen auf dem Tisch (dafür gibt es Kostgeld bzw. das Kindergeld). */
function beiDenEltern(s: Spielstand, m: Mahlzeit) {
  const kcal = Math.round(s.kcalBedarf * { fruehstueck: 0.25, mittag: 0.35, abend: 0.35, snack: 0.1 }[m]);
  s.heute.kcal += kcal; s.heute.protein += kcal / 35; s.heute.obstGemuese += kcal / 450; s.heute.zucker += kcal / 60;
  const was = { fruehstueck: "Frühstück zu Hause", mittag: "Mittag zu Hause", abend: "Abendessen mit der Familie", snack: "Snack aus dem Kühlschrank" }[m];
  return { kcal, produkte: [was], fehlt: 0 };
}

export function putzen(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  const mittel = s.wohnung.form === "eltern" || verbrauchen(s, "putzen", 3);
  vergehe(s, 1, "wach");
  s.beduerfnisse.ordnung = begrenzen(s.beduerfnisse.ordnung + (mittel ? 45 : 20));
  s.beduerfnisse.spass = begrenzen(s.beduerfnisse.spass - 5);
  s.zuletzt.putzen = s.tag;
  return gibt(s, mittel ? "Wohnung geputzt. ✨" : "Ohne Putzmittel nur oberflächlich sauber.");
}

export function waschen(alt: Spielstand): Ergebnis {
  const s = klon(alt);
  const maschine = effekt(s, "waschen") > 0;
  const mittel = s.wohnung.form === "eltern" || verbrauchen(s, "waesche", 7);
  if (!mittel) return { stand: alt, fehler: "Kein Waschmittel da." };
  if (!maschine) {
    buchen(s, -6.5, "sonstiges", "Waschsalon (waschen + trocknen)");
    vergehe(s, 2, "unterwegs");
  } else vergehe(s, 0.5, "wach");
  s.zuletzt.waesche = s.tag;
  s.beduerfnisse.hygiene = begrenzen(s.beduerfnisse.hygiene + 10);
  s.beduerfnisse.ordnung = begrenzen(s.beduerfnisse.ordnung + 10);
  return gibt(s, maschine ? "Wäsche gewaschen." : "Im Waschsalon gewaschen (6,50 €, 2 Stunden).");
}

export type Freizeit = "zocken" | "serie" | "lesen" | "sport" | "telefonieren" | "lernen" | "chillen";
export function freizeit(alt: Spielstand, art: Freizeit, stunden: number): Ergebnis {
  const s = klon(alt);
  vergehe(s, stunden, "wach");
  const b = s.beduerfnisse;
  const spass = effekt(s, "spass");
  const inet = effekt(s, "internet") > 0 || s.vertraege.some((v) => v.art === "internet" && aktiv(s, v));
  switch (art) {
    case "zocken":
      if (spass < 3) return gibt(s, "Ohne Konsole oder PC wird das nichts — du scrollst stattdessen am Handy.");
      b.spass = begrenzen(b.spass + 12 * stunden); b.sozial = begrenzen(b.sozial + (inet ? 3 : 0) * stunden); break;
    case "serie":
      b.spass = begrenzen(b.spass + (spass >= 2 && inet ? 9 : 4) * stunden); break;
    case "lesen":
      b.spass = begrenzen(b.spass + 5 * stunden); break;
    case "sport":
      b.spass = begrenzen(b.spass + 6 * stunden); b.gesundheit = begrenzen(b.gesundheit + 1.5 * stunden);
      b.energie = begrenzen(b.energie - 6 * stunden); b.hygiene = begrenzen(b.hygiene - 15 * stunden); break;
    case "telefonieren":
      b.sozial = begrenzen(b.sozial + 10 * stunden); break;
    case "lernen":
      s.flags.lernstunden = Number(s.flags.lernstunden ?? 0) + stunden;
      b.spass = begrenzen(b.spass - 3 * stunden);
      if (s.job) s.job.leistung = begrenzen(s.job.leistung + 0.8 * stunden);
      break;
    default:
      b.spass = begrenzen(b.spass + 3 * stunden); b.energie = begrenzen(b.energie + 2 * stunden);
  }
  return gibt(s);
}

// ───────────────────────────────────────────────────────────── Verträge

export function vertragAbschliessen(alt: Spielstand, angebotId: string, abschlag?: number): Ergebnis {
  const s = klon(alt);
  const a = ANGEBOT.get(angebotId);
  if (!a) return { stand: alt, fehler: "Unbekanntes Angebot." };
  if (a.ab18 && alter(s) < 18 && !s.flags.elternUnterschreiben) {
    return { stand: alt, fehler: "Du bist noch nicht volljährig — dafür müssen deine Eltern mitunterschreiben." };
  }
  if (a.wohnung && s.wohnung.form === "eltern") return { stand: alt, fehler: "Das brauchst du erst mit eigener Wohnung." };
  // Nur ein Vertrag je Art (außer Abos)
  const einzeln = !["streaming", "musik", "gaming", "zeitung"].includes(a.art);
  const alte = einzeln ? s.vertraege.filter((v) => v.art === a.art && aktiv(s, v)) : [];
  const gebunden = alte.find((v) => v.mindestBis > s.tag);
  if (gebunden) return { stand: alt, fehler: `Du hast schon »${gebunden.name}« — Mindestlaufzeit bis ${kurzDatum(gebunden.mindestBis)}.` };
  for (const v of alte) v.gekuendigtZum = s.tag;
  const monatlich = a.art === "strom" ? (abschlag ?? stromAbschlag(a, 1400)) : a.art === "ticket" ? werte(jahrVon(s.tag)).deutschlandticket : a.monatlich;
  const v: Vertrag = {
    uid: uid(s), angebot: a.id, art: a.art, name: a.name, monatlich, jaehrlich: a.jaehrlich,
    start: s.tag, mindestBis: s.tag + Math.round(a.laufzeitMonate * 30.4), zahltag: a.art === "strom" || a.art === "ticket" ? 1 : 15,
  };
  s.vertraege.push(v);
  if (a.einmalig) buchen(s, -a.einmalig, a.art === "fitness" ? "abos" : "sonstiges", `${a.name}: einmalige Gebühr`);
  if (a.jaehrlich) buchen(s, -r2(a.monatlich * 12), "versicherung", `${a.name} (Jahresbeitrag)`);
  else if (a.art === "ticket") buchen(s, -monatlich, "mobilitaet", `${a.name} (erster Monat)`);
  s.dokumente.push({ uid: uid(s), art: "vertrag", titel: `Vertrag: ${a.name}`, tag: s.tag, text: a.details });
  log(s, "vertrag", `Vertrag abgeschlossen: ${a.name} (${de(monatlich, 2)} €${a.jaehrlich ? "/Monat, jährlich bezahlt" : "/Monat"}, Laufzeit ${a.laufzeitMonate} Monate)`);
  return gibt(s, `Abgeschlossen: ${a.name}.`);
}

export function vertragKuendigen(alt: Spielstand, vuid: number): Ergebnis {
  const s = klon(alt);
  const v = s.vertraege.find((x) => x.uid === vuid);
  if (!v || !aktiv(s, v)) return { stand: alt, fehler: "Vertrag nicht gefunden." };
  // Nach der Mindestlaufzeit: ein Monat Frist; vorher zum Ende der Mindestlaufzeit
  const zum = Math.max(v.mindestBis, s.tag + 30);
  v.gekuendigtZum = zum;
  log(s, "vertrag", `Gekündigt: ${v.name} zum ${kurzDatum(zum)}`);
  return gibt(s, `Gekündigt zum ${kurzDatum(zum)}.`);
}

// ───────────────────────────────────────────────────────────── Rechnungen

export function rechnungBezahlen(alt: Spielstand, briefUid: number): Ergebnis {
  const s = klon(alt);
  const b = s.post.find((p) => p.uid === briefUid);
  const a = b?.aktion;
  if (!b || !a || a.art !== "rechnung" || a.bezahlt) return { stand: alt, fehler: "Nichts zu bezahlen." };
  buchen(s, -a.betrag, a.kategorie, `Überweisung: ${b.betreff}`);
  a.bezahlt = true;
  log(s, "geld", `Rechnung bezahlt: ${b.betreff}`, -a.betrag);
  return gibt(s, `${de(a.betrag, 2)} € überwiesen.`);
}

export function bargeldAbheben(alt: Spielstand, betrag: number): Ergebnis {
  const s = klon(alt);
  if (s.konto.stand - betrag < -s.konto.dispo) return { stand: alt, fehler: "Nicht genug Geld auf dem Konto." };
  buchen(s, -betrag, "sonstiges", "Bargeld am Automaten");
  s.bargeld = r2(s.bargeld + betrag);
  return gibt(s, `${betrag} € abgehoben.`);
}

export function sparen(alt: Spielstand, betrag: number): Ergebnis {
  const s = klon(alt);
  if (betrag > 0) {
    if (s.konto.stand < betrag) return { stand: alt, fehler: "So viel ist nicht auf dem Girokonto." };
    buchen(s, -betrag, "sparen", "Umbuchung aufs Sparkonto");
    s.sparkonto = r2(s.sparkonto + betrag);
  } else {
    const x = Math.min(-betrag, s.sparkonto);
    s.sparkonto = r2(s.sparkonto - x);
    buchen(s, x, "sonstiges_ein", "Umbuchung vom Sparkonto");
  }
  return gibt(s);
}

// ───────────────────────────────────────────────────────────── Routine

export type Routine = { bisTag: number; stopBeiPost?: boolean };

/**
 * Tage automatisch durchspielen: aufstehen, frühstücken, duschen, arbeiten,
 * Abendessen, schlafen. Hält an, sobald etwas passiert, das man selbst
 * entscheiden sollte (Post, Ereignis, kein Essen, Monatswechsel …).
 */
export function routine(alt: Spielstand, tage: number): Ergebnis {
  let s = klon(alt);
  const ziel = Math.min(ENDE_TAG, s.tag + tage);
  const ungelesen = () => s.post.filter((p) => !p.gelesen).length;
  const postVorher = ungelesen();
  const offenVorher = s.offen.length;
  let grund = "";
  let schutz = 0;
  while (s.tag < ziel && !s.beendet && schutz++ < 400) {
    // Tage enden abends: nicht in den nächsten Morgen hineinschlafen, wenn das Ziel erreicht ist
    if (s.stunde >= 12 && s.tag + 1 >= ziel && schutz > 1) break;
    // Morgen ist ein Bewerbungstermin: nach dem Aufstehen anhalten
    const terminBw = s.bewerbungen.find((b) => (b.status === "test" || b.status === "gespraech") && b.naechsterTag === (s.stunde >= 12 ? s.tag + 1 : s.tag)
      && !s.flags[`terminErinnert${b.uid}`]);
    const terminMorgen = !!terminBw;
    if (terminBw) s.flags[`terminErinnert${terminBw.uid}`] = true;
    // Schlafen bis zum Aufstehen des (nächsten) Arbeitstags
    const morgen = s.stunde >= 12 ? s.tag + 1 : s.tag;
    const job = arbeitHeute(s, morgen);
    const weg = (s.wohnung.form === "eltern" ? ELTERN_ORTE[s.herkunft.eltern].extraMin + 25 : s.wohnung.fahrzeitArbeit || 25) / 60;
    const aufstehen = job.muss ? Math.max(3, job.beginn - 1.5 - weg) : 8.5;
    if (s.tag < morgen || s.stunde < aufstehen) s = schlafen(s, aufstehen).stand;
    if (s.beendet || s.tag >= ziel) break;
    s = mahlzeit(s, "fruehstueck").stand;
    if (terminMorgen) { grund = "Heute um 10 Uhr ist dein Bewerbungstermin! (Jobs → Bewerbungen → Hingehen)"; break; }
    if (s.beduerfnisse.hygiene < 75) s = duschen(s).stand;
    const j2 = arbeitHeute(s);
    if (j2.muss && !j2.erledigt && !(s.zustand.krank && s.zustand.krank.bis >= s.tag)) {
      s = arbeiten(s).stand;
    } else {
      s = freizeit(s, "chillen", 3).stand;
      s = mahlzeit(s, "mittag").stand;
      s = freizeit(s, s.beduerfnisse.sozial < 40 ? "telefonieren" : "serie", 3).stand;
    }
    if (s.stunde < 18.5) s = freizeit(s, "chillen", 18.5 - s.stunde).stand;
    s = mahlzeit(s, "abend").stand;
    if (s.wohnung.form !== "eltern" && s.beduerfnisse.ordnung < 35) s = putzen(s).stand;
    if (s.wohnung.form !== "eltern" && s.tag - Number(s.zuletzt.waesche ?? s.wohnung.einzug) > 7) {
      const w = waschen(s);
      if (!w.fehler) s = w.stand;
    }
    if (s.stunde < 22 && s.stunde >= 12) s = freizeit(s, s.beduerfnisse.spass < 40 ? "serie" : "chillen", 22 - s.stunde).stand;
    // Anhalten, wenn etwas passiert ist
    if (s.flags.monatNeu) { grund = "Neuer Monat — schau dir deine Monatsbilanz an."; delete s.flags.monatNeu; }
    else if (s.offen.length > offenVorher) grund = "Es ist etwas passiert!";
    else if (ungelesen() > postVorher) grund = "Du hast Post.";
    else if (s.beduerfnisse.hunger < 25) grund = "Du hast Hunger — der Vorrat ist leer oder reicht nicht.";
    else if (s.beduerfnisse.gesundheit < 30) grund = "Dir geht es gesundheitlich schlecht.";
    else if (s.konto.stand < -s.konto.dispo) grund = "Dein Konto ist im Minus!";
    else if (s.zustand.krank && s.zustand.krank.bis >= s.tag && s.flags.krankGemeldetRoutine !== s.zustand.krank.bis) {
      s.flags.krankGemeldetRoutine = s.zustand.krank.bis;
      grund = s.zustand.krank.au ? "Du bist krankgeschrieben." : "Du bist krank — krankmelden (Jobs → Mein Job) und zum Arzt (Raus → Arzt)!";
    }
    if (grund) break;
  }
  return { stand: s, meldung: grund || "Routine erledigt." };
}

export { warmmiete };
